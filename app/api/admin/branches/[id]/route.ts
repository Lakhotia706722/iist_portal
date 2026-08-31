import { NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { branchSchema } from "@/lib/validations/admin";
import { updateBranch, deleteBranch } from "@/server/services/branch.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("branch:write");
    const body = await req.json();
    const parsed = branchSchema.partial().safeParse(body);
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    return Response.json(await updateBranch(params.id, parsed.data, actor.id));
  } catch (err) { return errorResponse(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("branch:write");
    await deleteBranch(params.id, actor.id);
    return new Response(null, { status: 204 });
  } catch (err) { return errorResponse(err); }
}
