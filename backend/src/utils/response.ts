import { Request, Response } from 'express';

export function ok<T>(req: Request, res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    data,
    meta: { requestId: req.requestId },
  });
}

export function created<T>(req: Request, res: Response, data: T): void {
  ok(req, res, data, 201);
}

export function noContent(res: Response): void {
  res.status(204).send();
}
