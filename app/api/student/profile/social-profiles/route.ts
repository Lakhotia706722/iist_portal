import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { socialProfileSchema } from "@/lib/validations/profile";
import { getSocialProfiles, upsertSocialProfile } from "@/server/services/social-profile.service";
import { getStudentIdFromUserId } from "../_helpers";

export async function GET(_req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    return Response.json(await getSocialProfiles(studentId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    const body = await req.json();
    const parsed = socialProfileSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const item = await upsertSocialProfile(studentId, parsed.data, actor.id);
    return Response.json(item, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

