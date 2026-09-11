/**
 * API Utilities — Phase 3
 * 
 * Common utilities for API route error handling and response formatting.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error);

  // Custom API errors
  if (error instanceof ApiError) {
    return NextResponse.json({
      error: error.message,
      code: error.code,
    }, { status: error.statusCode });
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const fieldErrors = (error as ZodError).issues.reduce((acc: Record<string, string>, err) => {
      const path = err.path.join(".");
      acc[path] = err.message;
      return acc;
    }, {} as Record<string, string>);

    // Phase 11: `error` used to be the hardcoded generic string
    // "Validation failed", not any real message from the issues below it.
    // Every consumer that reads `body.error ?? Object.values(body.fieldErrors ?? {})[0] ?? fallback`
    // (admin-calendar-client.tsx, incidents-client.tsx, interviews-client.tsx,
    // skillup-client.tsx, offers-client.tsx, ...) therefore always showed
    // that generic string and never reached the specific field message,
    // because `??` only falls through on null/undefined, not a non-empty
    // string — found via a negative-path test expecting SkillUp's own
    // "Passing marks cannot exceed maximum marks" refine message and
    // getting "Validation failed" instead. `error` is now the real
    // issue message(s) — the single most common case (one failed field,
    // e.g. any `.refine()`) surfaces exactly that message; multiple
    // failures join with "; " so nothing is silently dropped either way.
    // `fieldErrors` is unchanged, for any consumer that maps per-field.
    const message = Object.values(fieldErrors).join("; ") || "Validation failed";

    return NextResponse.json({
      error: message,
      fieldErrors,
    }, { status: 400 });
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": // Unique constraint violation
        return NextResponse.json({
          error: "A record with this value already exists",
          code: "DUPLICATE_ENTRY",
        }, { status: 409 });
      
      case "P2025": // Record not found
        return NextResponse.json({
          error: "Record not found",
          code: "NOT_FOUND",
        }, { status: 404 });
      
      case "P2003": // Foreign key constraint violation
        return NextResponse.json({
          error: "Cannot delete record due to existing references",
          code: "FOREIGN_KEY_CONSTRAINT",
        }, { status: 409 });
      
      default:
        return NextResponse.json({
          error: "Database operation failed",
          code: error.code,
        }, { status: 400 });
    }
  }

  // Custom error types from services
  if (error instanceof Error) {
    switch (error.name) {
      case "NotFoundError":
        return NextResponse.json({
          error: error.message,
          code: "NOT_FOUND",
        }, { status: 404 });
      
      case "ValidationError":
        return NextResponse.json({
          error: error.message,
          code: "VALIDATION_ERROR",
        }, { status: 400 });
      
      case "ForbiddenError":
        return NextResponse.json({
          error: error.message,
          code: "FORBIDDEN",
        }, { status: 403 });

      case "ConflictError":
        return NextResponse.json({
          error: error.message,
          code: "CONFLICT",
        }, { status: 409 });

      case "BadRequestError":
        return NextResponse.json({
          error: error.message,
          code: "BAD_REQUEST",
        }, { status: 400 });
      
      case "UnauthorizedError":
        return NextResponse.json({
          error: error.message,
          code: "UNAUTHORIZED",
        }, { status: 401 });

      case "ServiceUnavailableError":
        return NextResponse.json({
          error: error.message,
          code: "SERVICE_UNAVAILABLE",
        }, { status: 503 });
    }
  }

  // Generic server error
  return NextResponse.json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  }, { status: 500 });
}

export function createSuccessResponse(
  data: any,
  message?: string,
  statusCode: number = 200
): NextResponse {
  const response: any = { ...data };
  if (message) {
    response.message = message;
  }
  
  return NextResponse.json(response, { status: statusCode });
}

export function createPaginatedResponse(
  items: any[],
  total: number,
  limit: number,
  offset: number,
  itemKey: string = "items"
): NextResponse {
  return NextResponse.json({
    [itemKey]: items,
    pagination: {
      total,
      limit,
      offset,
      hasMore: total > offset + limit,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1,
    },
  });
}

export function validateFileUpload(
  file: File,
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    required?: boolean;
  } = {}
): void {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = [],
    required = false,
  } = options;

  if (!file || file.size === 0) {
    if (required) {
      throw new ApiError("File is required", 400);
    }
    return;
  }

  if (file.size > maxSize) {
    throw new ApiError(
      `File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`,
      400
    );
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    throw new ApiError(
      `File type not allowed. Accepted types: ${allowedTypes.join(", ")}`,
      400
    );
  }
}

export function parseSearchParams(url: string): Record<string, any> {
  const { searchParams } = new URL(url);
  const params: Record<string, any> = {};

  Array.from(searchParams.entries()).forEach(([key, value]) => {
    // Try to parse common param types
    if (key.includes("limit") || key.includes("offset") || key.includes("page")) {
      params[key] = parseInt(value, 10) || 0;
    } else if (key.includes("Active") || value === "true" || value === "false") {
      params[key] = value === "true";
    } else {
      params[key] = value;
    }
  });

  return params;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
}

export async function validateRequestBody(
  request: Request,
  schema: any
): Promise<any> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError("Invalid JSON in request body", 400);
    }
    throw error;
  }
}

export function createCsvResponse(
  data: any[],
  filename: string,
  headers: string[]
): NextResponse {
  // Convert data to CSV
  const csvContent = [
    headers.join(","),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV values
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value?.toString() || "";
      }).join(",")
    ),
  ].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}