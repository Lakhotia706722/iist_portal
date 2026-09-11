/**
 * Staff Users & Roles API — Phase 12
 *
 * GET  /api/admin/users - List staff accounts (TP_ADMIN/FACULTY/HOD/COMPANY_REP).
 * POST /api/admin/users - Create a staff account. Returns a one-time
 *   temporary password in the response — never persisted in plaintext,
 *   never emailed by this endpoint; the admin is expected to relay it
 *   out-of-band. The new account's mustChangePassword flag forces a real
 *   password on first login.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { createUserSchema } from "@/lib/validations/admin";
import { listUsers, createStaffUser } from "@/server/services/user.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("user:read");

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const isActiveParam = searchParams.get("isActive");

    const result = await listUsers({
      search: searchParams.get("search") || undefined,
      role: searchParams.get("role") || undefined,
      isActive: isActiveParam === null ? undefined : isActiveParam === "true",
      limit,
      offset,
    });

    return NextResponse.json({
      users: result.users,
      pagination: { total: result.total, limit, offset, hasMore: result.total > offset + limit },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("user:create");

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { user, tempPassword } = await createStaffUser(parsed.data, actor.id as string);
    return NextResponse.json({ user, tempPassword }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
