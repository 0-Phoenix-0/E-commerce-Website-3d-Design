import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // ── Operational errors (AppError) ─────────────────────────────────────────
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(req.id && { requestId: req.id }),
    });
    return;
  }

  // ── Mongoose: duplicate key ────────────────────────────────────────────────
  if ((err as NodeJS.ErrnoException).code === '11000') {
    res.status(409).json({
      success: false,
      message: 'A record with that value already exists.',
      ...(req.id && { requestId: req.id }),
    });
    return;
  }

  // ── Mongoose: validation error ─────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: err.message,
      ...(req.id && { requestId: req.id }),
    });
    return;
  }

  // ── Mongoose: cast error (bad ObjectId) ────────────────────────────────────
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      message: 'Invalid resource identifier.',
      ...(req.id && { requestId: req.id }),
    });
    return;
  }

  // ── Unexpected / programmer errors ────────────────────────────────────────
  logger.error(
    {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    },
    'Unhandled server error'
  );

  res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === 'development'
        ? err.message
        : 'An unexpected error occurred. Please try again later.',
    ...(req.id && { requestId: req.id }),
  });
}
