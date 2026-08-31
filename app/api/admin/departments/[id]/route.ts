import { NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { departmentSchema } from "@/lib/validations/admin";
import { updateDepartment, deleteDepartment, getDepartment } from "@/server/services/department.service";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("department:read");
    const dept = await getDepartment(params.id);
    return Response.json(dept);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("department:write");
    const body = await req.json();
    const parsed = departmentSchema.partial().safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const dept = await updateDepartment(params.id, parsed.data, actor.id);
    return Response.json(dept);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("department:write");
    await deleteDepartment(params.id, actor.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
