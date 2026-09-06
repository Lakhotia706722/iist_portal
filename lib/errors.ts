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