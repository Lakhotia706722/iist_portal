import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validations/profile";
import { getProjects, createProject } from "@/server/services/project.service";
import { uploadFile } from "../_helpers";

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
    const contentType = req.headers.get("content-type") ?? "";

    let imageKey: string | undefined;
    let body: any;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      body = JSON.parse(formData.get("data") as string);
      const file = formData.get("image") as File | null;
      if (file) {
        imageKey = await uploadFile(file, "projects", studentId, {
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          maxBytes: 5 * 1024 * 1024, // 5 MB
        });
      }
    } else {
      body = await req.json();
    }

    const parsed = projectSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const project = await createProject(studentId, parsed.data, actor.id, imageKey);
    return Response.json(project, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

