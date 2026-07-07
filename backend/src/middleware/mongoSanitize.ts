import { Request, Response, NextFunction } from 'express';

function hasOwnProperty(obj: any, prop: string) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function sanitizeObject(obj: any): void {
  if (obj === null || typeof obj !== 'object') {
    return;
  }

  for (const key in obj) {
    if (hasOwnProperty(obj, key)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else {
        const val = obj[key];
        if (typeof val === 'object' && val !== null) {
          sanitizeObject(val);
        }
      }
    }
  }
}

export function mongoSanitize(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeObject(req.params);
  }
  next();
}
