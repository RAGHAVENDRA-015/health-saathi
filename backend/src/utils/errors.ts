export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthError extends AppError {
  constructor(code: string, message: string) {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(400, 'VALIDATION_ERROR', message, fields);
  }
}

export class BusinessError extends AppError {
  constructor(code: string, message: string) {
    super(422, code, message);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, 'RATE_LIMITED', message);
  }
}
