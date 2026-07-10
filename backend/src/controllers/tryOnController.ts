import { Request, Response, NextFunction } from 'express';
import { cloudinary } from '../config/cloudinary';
import { env } from '../config/env';
import { Product } from '../models/Product';
import { AppError } from '../middleware/AppError';

const CLAID_API_URL = 'https://api.claid.ai/v1/image/ai-fashion-models';
const TRY_ON_FOLDER = 'ecommerce/try-on';
const MAX_CLOTHING_IMAGES = 5; // Claid API limit

// One generation task per view — Claid renders a single pose per request
const TRY_ON_VIEWS = [
  { view: 'front', pose: 'full body, front view, facing the camera, neutral stance, arms relaxed' },
  { view: 'side', pose: 'full body, side profile view, standing sideways to the camera, neutral stance, arms relaxed' },
  { view: 'back', pose: 'full body, back view, facing away from the camera, neutral stance, arms relaxed' },
] as const;

// Claid rate limit: 1 generation per second
const CLAID_REQUEST_SPACING_MS = 1100;

interface ClaidTaskResponse {
  data?: {
    id: number;
    status: 'ACCEPTED' | 'WAITING' | 'PROCESSING' | 'DONE' | 'ERROR' | 'CANCELLED' | 'PAUSED';
    errors?: { error: string }[];
    result?: {
      output_objects?: { tmp_url?: string }[];
    };
  };
  error_message?: string;
}

/**
 * POST /try-on/sign
 * Returns a signed Cloudinary payload so the customer can upload their
 * photo directly from the browser (same flow as review image uploads).
 */
export function signTryOnUpload(_req: Request, res: Response): void {
  const timestamp = Math.round(Date.now() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: TRY_ON_FOLDER },
    env.CLOUDINARY_API_SECRET
  );

  res.json({
    success: true,
    data: {
      timestamp,
      signature,
      apiKey: env.CLOUDINARY_API_KEY,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      folder: TRY_ON_FOLDER,
    },
  });
}

/**
 * POST /try-on
 * Body: { productId: string, photoUrl: string }
 * Starts an async Claid AI try-on generation using the customer's photo
 * as the model and the product's images as the clothing.
 */
export async function createTryOn(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!env.CLAID_API_KEY) {
      return next(new AppError('Virtual try-on is not configured on this server.', 503));
    }

    const { productId, photoUrl } = (req.body ?? {}) as { productId?: string; photoUrl?: string };

    if (!productId || typeof productId !== 'string') {
      return next(new AppError('productId is required.', 400));
    }
    // Only accept photos hosted on our own Cloudinary account (uploaded via /try-on/sign)
    if (
      !photoUrl ||
      typeof photoUrl !== 'string' ||
      !photoUrl.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`)
    ) {
      return next(new AppError('photoUrl must be a valid uploaded photo URL.', 400));
    }

    const product = await Product.findOne({ _id: productId, isDeleted: false }).lean();
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const clothing = (product.images ?? [])
      .filter((img) => img.type !== 'video' && img.url)
      .map((img) => img.url)
      .slice(0, MAX_CLOTHING_IMAGES);

    if (clothing.length === 0) {
      return next(new AppError('This product has no images available for try-on.', 400));
    }

    // Launch 3 generation tasks — front, side, back — respecting Claid's 1 req/sec rate limit
    const taskIds: number[] = [];

    for (let i = 0; i < TRY_ON_VIEWS.length; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, CLAID_REQUEST_SPACING_MS));
      }

      const claidRes = await fetch(CLAID_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLAID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            model: photoUrl,
            clothing,
          },
          options: {
            pose: TRY_ON_VIEWS[i].pose,
            background: 'minimalistic studio background',
            aspect_ratio: '3:4',
          },
          output: {
            format: 'jpeg',
            number_of_images: 1,
          },
        }),
      });

      const json = (await claidRes.json().catch(() => null)) as ClaidTaskResponse | null;

      if (!claidRes.ok || !json?.data?.id) {
        if (claidRes.status === 402) {
          return next(new AppError('Try-on service has no credits left. Please try again later.', 503));
        }
        if (claidRes.status === 429) {
          return next(new AppError('Try-on service is busy. Please try again in a minute.', 429));
        }
        return next(new AppError(json?.error_message || 'Failed to start try-on generation.', 502));
      }

      taskIds.push(json.data.id);
    }

    res.status(202).json({
      success: true,
      data: { taskIds, status: 'ACCEPTED' },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /try-on/:taskId
 * Polls the Claid task and returns a simplified status payload.
 */
export async function getTryOnStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!env.CLAID_API_KEY) {
      return next(new AppError('Virtual try-on is not configured on this server.', 503));
    }

    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return next(new AppError('Invalid try-on task id.', 400));
    }

    const claidRes = await fetch(`${CLAID_API_URL}/${taskId}`, {
      headers: { Authorization: `Bearer ${env.CLAID_API_KEY}` },
    });

    const json = (await claidRes.json().catch(() => null)) as ClaidTaskResponse | null;

    if (!claidRes.ok || !json?.data) {
      if (claidRes.status === 404) {
        return next(new AppError('Try-on task not found.', 404));
      }
      return next(new AppError(json?.error_message || 'Failed to fetch try-on status.', 502));
    }

    const { status, errors, result } = json.data;
    const images = (result?.output_objects ?? [])
      .map((obj) => obj.tmp_url)
      .filter((url): url is string => Boolean(url));

    res.json({
      success: true,
      data: {
        status,
        images,
        error: status === 'ERROR' ? errors?.[0]?.error || 'Generation failed.' : null,
      },
    });
  } catch (err) {
    next(err);
  }
}
