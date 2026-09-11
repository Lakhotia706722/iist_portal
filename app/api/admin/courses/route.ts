import { NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { courseSchema } from "@/lib/validations/admin";
import { createCourse, listCourses } from "@/server/services/course.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("course:read");
    const { searchParams } = req.nextUrl;
    return Response.json(await listCourses({ search: searchParams.get("search") ?? undefined, page: Number(searchParams.get("page") ?? 1), pageSize: Number(searchParams.get("pageSize") ?? 20), includeInactive: searchParams.get("includeInactive") === "true" }));
  } catch (err) { return errorResponse(err); }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("course:write");
    const body = await req.json();
    const parsed = courseSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    return Response.json(await createCourse(parsed.data, actor.id), { status: 201 });
  } catch (err) { return errorResponse(err); }
}
