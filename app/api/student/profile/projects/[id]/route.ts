import { NextRequest } from "next/server";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validations/profile";
import { updateProject, deleteProject } from "@/server/services/project.service";
import { verifyUploadedObject } from "@/lib/uploads/presign";

async function getStudentId(userId: string) {
  const s = await prisma.student.findUniqueOrThrow({ where: { userId }, select: { id: true } });
  return s.id;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentId(actor.id);
    // Phase 16 — P5: see the sibling POST route's comment.
    const { imageKey, ...body } = await req.json();
    if (imageKey) await verifyUploadedObject(imageKey);

    const parsed = projectSchema.partial().safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const project = await updateProject(params.id, studentId, parsed.data, actor.id, imageKey);
    return Response.json(project);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentId(actor.id);
    await deleteProject(params.id, studentId, actor.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
