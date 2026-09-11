/**
 * Student calendar - Phase 4
 * Scoping is enforced in the service query, not the UI.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { getStudentCalendar } from "@/server/services/calendar.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("calendar:read");
    const studentId = await getStudentIdFromUserId(user.id as string);

    const sp = new URL(request.url).searchParams;
    const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
    const to = sp.get("to") ? new Date(sp.get("to")!) : undefined;

    const events = await getStudentCalendar(studentId, { from, to });
    return NextResponse.json({ events });
  } catch (error) {
    return handleApiError(error);
  }
}
