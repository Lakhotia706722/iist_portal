/**
 * Single staff user — Phase 12
 *
 * PATCH /api/admin/users/[id] - Update name and/or active status.
 * Role changes and password resets aren't exposed here — swapping a live
 * account's role would leave orphaned profile rows (FacultyProfile /
 * HodProfile / CompanyRepProfile) with no migration path; deactivating and
 * creating a fresh account with the correct role is the safe path this UI
 * offers instead.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { updateUserSchema } from "@/lib/validations/admin";
import { updateUser, setUserActive } from "@/server/services/user.service";
import { handleApiError } from "@/lib/api-utils";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("user:write");

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    let user;
    if (parsed.data.isActive !== undefined) {
      user = await setUserActive(params.id, parsed.data.isActive, actor.id as string);
    }
    if (parsed.data.name !== undefined) {
      user = await updateUser(params.id, { name: parsed.data.name }, actor.id as string);
    }

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}
