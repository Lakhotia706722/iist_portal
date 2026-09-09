/**
 * Student Placement History API — Phase 3.5
 *
 * GET /api/student/offers - Offers belonging to the logged-in student
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { listOffersForStudent } from "@/server/services/offer.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePermission("offer:read");
    const studentId = await getStudentIdFromUserId(user.id as string);
    const offers = await listOffersForStudent(studentId);
    return NextResponse.json({ offers });
  } catch (error) {
    return handleApiError(error);
  }
}
