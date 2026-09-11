import { NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { departmentSchema } from "@/lib/validations/admin";
import { createDepartment, listDepartments } from "@/server/services/department.service";
import { extractRequestMeta } from "@/server/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("department:read");
    const { searchParams } = req.nextUrl;
    const result = await listDepartments({
      search: searchParams.get("search") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 20),
      includeInactive: searchParams.get("includeInactive") === "true",
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("department:write");
    const body = await req.json();
    const parsed = departmentSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const dept = await createDepartment(parsed.data, actor.id);
    return Response.json(dept, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
