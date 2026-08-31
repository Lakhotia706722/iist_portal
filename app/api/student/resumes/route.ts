import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { resumeSchema } from "@/lib/validations/profile";
import { getResumes, createResume } from "@/server/services/resume.service";
import { getStudentIdFromUserId } from "../profile/_helpers";

export async function GET(_req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    return Response.json(await getResumes(studentId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    const body = await req.json();
    const parsed = resumeSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const resume = await createResume(studentId, parsed.data, actor.id);
    return Response.json(resume, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

