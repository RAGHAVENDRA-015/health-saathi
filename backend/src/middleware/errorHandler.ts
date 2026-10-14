import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
      meta: { requestId },
    });
    return;
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    err.errors.forEach((e) => {
      fields[e.path.join('.')] = e.message;
    });
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields },
      meta: { requestId },
    });
    return;
  }

  // Multer errors
  const multerErr = err as { code?: string };
  if (multerErr.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: { code: 'FILE_TOO_LARGE', message: 'File exceeds maximum allowed size' },
      meta: { requestId },
    });
    return;
  }

  // Unknown — never expose internals
  const anyErr = err as Error;
  console.error(`[error] ${requestId}`, anyErr?.message ?? err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    meta: { requestId },
  });
}
