/**
 * Custom Error Classes — Phase 3
 * 
 * Standardized error classes for consistent error handling
 * across services and API routes.
 */

export class NotFoundError extends Error {
  name = "NotFoundError";
  
  constructor(message: string = "Resource not found") {
    super(message);
  }
}

export class ValidationError extends Error {
  name = "ValidationError";
  
  constructor(message: string) {
    super(message);
  }
}

export class ForbiddenError extends Error {
  name = "ForbiddenError";
  
  constructor(message: string = "Access forbidden") {
    super(message);
  }
}

export class UnauthorizedError extends Error {
  name = "UnauthorizedError";
  
  constructor(message: string = "Authentication required") {
    super(message);
  }
}

export class ConflictError extends Error {
  name = "ConflictError";
  
  constructor(message: string = "Resource conflict") {
    super(message);
  }
}

export class BadRequestError extends Error {
  name = "BadRequestError";

  constructor(message: string = "Bad request") {
    super(message);
  }
}

export class ServiceUnavailableError extends Error {
  name = "ServiceUnavailableError";

  constructor(message: string = "Service temporarily unavailable") {
    super(message);
  }
}

/** Phase 16 — P6: thrown when a per-user AI usage cap (burst or daily) is hit. */
export class RateLimitedError extends Error {
  name = "RateLimitedError";
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}