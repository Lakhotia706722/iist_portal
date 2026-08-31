import { auth } from "@/lib/auth/auth";
import type { Permission } from "./index";
import { hasPermission } from "./index";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") { super(message); this.name = "UnauthorizedError"; }
}
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") { super(message); this.name = "ForbiddenError"; }
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session.user;
}

export async function requireRole(...roles: string[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role as string)) {
    throw new ForbiddenError(`Role ${user.role} is not allowed here`);
  }
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireAuth();
  if (!hasPermission(user.role as string, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return user;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (error instanceof ForbiddenError)
    return Response.json({ error: error.message }, { status: 403 });
  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
