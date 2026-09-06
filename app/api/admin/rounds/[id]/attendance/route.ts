/**
 * Admin Round Attendance API — Phase 3
 * 
 * GET /api/admin/rounds/[id]/attendance - Get attendance for round
 * POST /api/admin/rounds/[id]/attendance - Mark attendance (single or bulk)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { checkPermission } from "@/lib/rbac";
import { attendanceSchema, bulkAttendanceSchema } from "@/lib/validations/placement";
import { 
  getRoundAttendance, 
  markAttendance, 
  bulkMarkAttendance 
} from "@/lib/services/attendance.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await checkPermission(session.user.id, "attendance:read");

    const result = await getRoundAttendance(params.id);

    return NextResponse.json(result);

  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await checkPermission(session.user.id, "attendance:write");

    const body = await request.json();
    
    // Check if bulk or single attendance marking
    if (body.records && Array.isArray(body.records)) {
      // Bulk marking
      const validatedData = bulkAttendanceSchema.parse(body);
      const result = await bulkMarkAttendance(validatedData, session.user.id);
      
      return NextResponse.json({
        message: `Attendance marked for ${result.updated} participants`,
        updated: result.updated,
        failed: result.failed,
      });
    } else if (body.roundParticipantId) {
      // Single marking
      const { roundParticipantId, status, note } = body;
      const validatedData = attendanceSchema.parse({ status, note });
      
      const record = await markAttendance(roundParticipantId, validatedData, session.user.id);
      
      return NextResponse.json({
        message: "Attendance marked successfully",
        record,
      });
    } else {
      return NextResponse.json({ 
        error: "Either 'records' array or 'roundParticipantId' is required" 
      }, { status: 400 });
    }

  } catch (error) {
    return handleApiError(error);
  }
}