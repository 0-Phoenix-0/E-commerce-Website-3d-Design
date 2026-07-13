import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Product } from '../models/Product';
import { AppError } from '../middleware/AppError';
import { env } from '../config/env';

/**
 * Computes a stable SHA256 hash using sorted product image URLs.
 */
function getImagesHash(images: any[]): string {
  if (!images || images.length === 0) return '';
  const sortedUrls = [...images].map((img) => img.url).sort();
  return crypto.createHash('sha256').update(sortedUrls.join('|')).digest('hex');
}

/**
 * GET /products/:id/3d
 * Returns the status, modelUrl, previewImage, and full metadata of a product's 3D model.
 */
export async function getThreeDMetadata(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false }).lean();
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const threeD = product.threeD || {
      enabled: false,
      status: 'none',
      engine: null,
      version: null,
      modelUrl: null,
      thumbnailUrl: null,
      previewImage: null,
      generatedAt: null,
      imageHash: null,
      generationTime: null,
      fileSize: null,
      gpuUsed: null,
      vramUsage: null,
      textureResolution: null,
      estimatedTime: null,
      error: null,
      meshStats: null,
    };

    res.json({
      success: true,
      data: {
        status: threeD.status,
        modelUrl: threeD.modelUrl,
        previewImage: threeD.previewImage,
        metadata: {
          enabled: threeD.enabled,
          engine: threeD.engine,
          version: threeD.version,
          thumbnailUrl: threeD.thumbnailUrl,
          generatedAt: threeD.generatedAt,
          imageHash: threeD.imageHash,
          generationTime: threeD.generationTime,
          fileSize: threeD.fileSize,
          gpuUsed: (threeD as any).gpuUsed,
          vramUsage: (threeD as any).vramUsage,
          textureResolution: (threeD as any).textureResolution,
          estimatedTime: (threeD as any).estimatedTime,
          error: (threeD as any).error,
          meshStats: (threeD as any).meshStats,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /products/:id/3d/generate
 * Queues model generation with the FastAPI AI Service.
 * Implements hash-based caching to reuse existing models if images did not change.
 */
export async function generateThreeDModel(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const images = product.images || [];
    if (images.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Product images are required for 3D model generation.',
      });
      return;
    }

    const imageHash = getImagesHash(images);
    const force = !!req.body.force;

    // ── Cache Check ───────────────────────────────────────────────────────────
    if (!force && imageHash) {
      // Find another ready product that has identical image hashes
      const cachedProduct = await Product.findOne({
        _id: { $ne: product._id },
        isDeleted: false,
        'threeD.imageHash': imageHash,
        'threeD.status': 'ready',
      }).lean();

      if (cachedProduct && cachedProduct.threeD) {
        // Reuse cached attributes
        product.threeD = {
          enabled: true,
          status: 'ready',
          engine: cachedProduct.threeD.engine,
          version: cachedProduct.threeD.version,
          modelUrl: cachedProduct.threeD.modelUrl,
          thumbnailUrl: cachedProduct.threeD.thumbnailUrl,
          previewImage: cachedProduct.threeD.previewImage,
          generatedAt: new Date(),
          imageHash: imageHash,
          generationTime: cachedProduct.threeD.generationTime,
          fileSize: cachedProduct.threeD.fileSize,
          gpuUsed: (cachedProduct.threeD as any).gpuUsed,
          vramUsage: (cachedProduct.threeD as any).vramUsage,
          textureResolution: (cachedProduct.threeD as any).textureResolution,
          meshStats: (cachedProduct.threeD as any).meshStats,
          error: null,
        };

        await product.save();

        res.json({
          success: true,
          message: 'Cached 3D model reused.',
          data: product.threeD,
        });
        return;
      }
    }

    // ── Queue Job in FastAPI Service ──────────────────────────────────────────
    if (!product.threeD) {
      product.threeD = {} as any;
    }
    const threeD = product.threeD!;
    threeD.status = 'processing';
    threeD.imageHash = imageHash;
    threeD.error = null;
    threeD.estimatedTime = 30; // default initial estimation
    product.threeD = threeD;
    await product.save();

    // Call FastAPI service asynchronously
    const aiServiceUrl = `${env.AI_SERVICE_URL}/api/v1/generate`;
    fetch(aiServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ai-secret': env.INTERNAL_SECRET,
      },
      body: JSON.stringify({
        product_id: product._id.toString(),
        image_urls: images.map((img) => img.url),
        quality: req.body.quality || 'standard',
        texture_resolution: req.body.textureResolution || '1024x1024',
        force: force,
      }),
    }).catch((err) => {
      console.error('Failed to notify FastAPI AI service:', err);
      // Mark as failed in DB since service is unreachable
      Product.findOneAndUpdate(
        { _id: product._id },
        {
          'threeD.status': 'failed',
          'threeD.error': `AI Service unreachable: ${err.message}`,
        }
      ).exec();
    });

    res.json({
      success: true,
      message: '3D model generation queued in background.',
      data: product.threeD,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /products/:id/3d
 * Resets 3D model metadata and triggers cleanup on the Python AI Service.
 */
export async function deleteThreeDMetadata(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Call deletion cleanups in background
    const aiServiceUrl = `${env.AI_SERVICE_URL}/api/v1/delete/${product._id}`;
    fetch(aiServiceUrl, {
      method: 'DELETE',
      headers: {
        'x-ai-secret': env.INTERNAL_SECRET,
      },
    }).catch((err) => {
      console.error('Failed to notify AI service of deletion:', err);
    });

    // Reset local database properties
    product.threeD = {
      enabled: false,
      status: 'none',
      engine: null,
      version: null,
      modelUrl: null,
      thumbnailUrl: null,
      previewImage: null,
      generatedAt: null,
      imageHash: null,
      generationTime: null,
      fileSize: null,
      gpuUsed: null,
      vramUsage: null,
      textureResolution: null,
      estimatedTime: null,
      error: null,
      meshStats: null,
    };

    await product.save();

    res.json({
      success: true,
      message: '3D model metadata deleted successfully.',
      data: product.threeD,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /products/:id/3d
 * Updates 3D model metadata manually or via FastAPI callbacks.
 */
export async function updateThreeDMetadata(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const threeD = (product.threeD || {
      enabled: false,
      status: 'none',
      engine: null,
      version: null,
      modelUrl: null,
      thumbnailUrl: null,
      previewImage: null,
      generatedAt: null,
      imageHash: null,
      generationTime: null,
      fileSize: null,
      gpuUsed: null,
      vramUsage: null,
      textureResolution: null,
      estimatedTime: null,
      error: null,
      meshStats: null,
    }) as any;

    const fields = [
      'enabled',
      'status',
      'engine',
      'version',
      'modelUrl',
      'thumbnailUrl',
      'previewImage',
      'generatedAt',
      'imageHash',
      'generationTime',
      'fileSize',
      'gpuUsed',
      'vramUsage',
      'textureResolution',
      'estimatedTime',
      'error',
      'stageLabel',
      'generationSettings',
      'meshStats',
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        threeD[field] = req.body[field];
      }
    });

    product.threeD = threeD;
    await product.save();

    res.json({
      success: true,
      message: '3D model metadata updated successfully.',
      data: product.threeD,
    });
  } catch (err) {
    next(err);
  }
}
