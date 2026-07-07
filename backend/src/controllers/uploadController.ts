import { Request, Response } from 'express';
import { cloudinary } from '../config/cloudinary';
import { env } from '../config/env';

export function signUpload(_req: Request, res: Response): void {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'ecommerce';

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    env.CLOUDINARY_API_SECRET
  );

  res.json({
    success: true,
    data: {
      timestamp,
      signature,
      apiKey: env.CLOUDINARY_API_KEY,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      folder,
    },
  });
}
