import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';

// Extend Express Request with our auth context
declare global {
  namespace Express {
    interface Request {
      auth: DecodedIdToken;
      requestId: string;
    }
  }
}

export type AuthRequest = Request;

export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

export interface ApiResponse<T = unknown> {
  data: T;
  meta: { requestId: string };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
  meta: { requestId: string };
}
