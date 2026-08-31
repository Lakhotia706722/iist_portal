import { NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { branchSchema } from "@/lib/validations/admin";
import { createBranch, listBranches } from "@/server/services/branch.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("branch:read");
    const { searchParams } = req.nextUrl;
    return Response.json(await listBranches({ search: searchParams.get("search") ?? undefined, departmentId: searchParams.get("departmentId") ?? undefined, page: Number(searchParams.get("page") ?? 1), pageSize: Number(searchParams.get("pageSize") ?? 50) }));
  } catch (err) { return errorResponse(err); }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("branch:write");
    const body = await req.json();
    const parsed = branchSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    return Response.json(await createBranch(parsed.data, actor.id), { status: 201 });
  } catch (err) { return errorResponse(err); }
}
