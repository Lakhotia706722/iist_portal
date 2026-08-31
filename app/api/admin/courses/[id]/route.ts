import { NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { courseSchema } from "@/lib/validations/admin";
import { updateCourse, deleteCourse } from "@/server/services/course.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("course:write");
    const body = await req.json();
    const parsed = courseSchema.partial().safeParse(body);
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    return Response.json(await updateCourse(params.id, parsed.data, actor.id));
  } catch (err) { return errorResponse(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("course:write");
    await deleteCourse(params.id, actor.id);
    return new Response(null, { status: 204 });
  } catch (err) { return errorResponse(err); }
}
