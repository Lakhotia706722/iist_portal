import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validations/profile";
import { getProjects, createProject } from "@/server/services/project.service";
import { verifyUploadedObject } from "@/lib/uploads/presign";

async function getStudentId(userId: string) {
  const s = await prisma.student.findUniqueOrThrow({ where: { userId }, select: { id: true } });
  return s.id;
}

export async function GET(_req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentId(actor.id);
    return Response.json(await getProjects(studentId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentId(actor.id);
    // Phase 16 — P5: the client uploads the image directly to storage
    // (see hooks/use-direct-upload.ts) and sends the resulting key as a
    // plain JSON field — no more multipart parsing here.
    const { imageKey, ...body } = await req.json();
    if (imageKey) await verifyUploadedObject(imageKey);

    const parsed = projectSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const project = await createProject(studentId, parsed.data, actor.id, imageKey);
    return Response.json(project, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

