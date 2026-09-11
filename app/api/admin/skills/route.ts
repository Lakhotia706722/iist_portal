import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { skillCatalogSchema } from "@/lib/validations/profile";
import { listSkillCatalog, createSkill } from "@/server/services/skill.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("skill:read");
    const { searchParams } = req.nextUrl;
    const result = await listSkillCatalog({
      search: searchParams.get("search") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 50),
      includeInactive: searchParams.get("includeInactive") === "true",
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("skill:write");
    const body = await req.json();
    const parsed = skillCatalogSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const skill = await createSkill(parsed.data, actor.id);
    return Response.json(skill, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

