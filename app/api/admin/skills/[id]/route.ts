import { NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { skillCatalogSchema } from "@/lib/validations/profile";
import { updateSkill, deleteSkill } from "@/server/services/skill.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("skill:write");
    const body = await req.json();
    const parsed = skillCatalogSchema.partial().safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const skill = await updateSkill(params.id, parsed.data, actor.id);
    return Response.json(skill);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("skill:write");
    await deleteSkill(params.id, actor.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
