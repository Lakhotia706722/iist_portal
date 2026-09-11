import { NextRequest } from "next/server";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { getStudentIdFromUserId } from "../_helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    return Response.json(await calculateProfileCompletion(studentId));
  } catch (err) {
    return errorResponse(err);
  }
}
