/**
 * Student Application Detail API — Phase 3
 * 
 * GET /api/student/applications/[id] - Get application details
 * DELETE /api/student/applications/[id] - Withdraw application
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { withdrawSchema } from "@/lib/validations/placement";
import { getApplicationById, withdrawApplication } from "@/lib/services/application.service";
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

    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Only students can access applications" }, { status: 403 });
    }

    const application = await getApplicationById(params.id);

    // Verify the application belongs to the logged-in student
    if (application.studentId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ application });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Only students can withdraw applications" }, { status: 403 });
    }

    // Get application to verify ownership
    const application = await getApplicationById(params.id);

    if (application.studentId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse optional withdrawal reason
    let reason: string | undefined;
    try {
      const body = await request.json();
      const validated = withdrawSchema.parse(body);
      reason = validated.reason;
    } catch {
      // No body or invalid body - proceed without reason
    }

    const withdrawnApplication = await withdrawApplication(params.id, reason);

    return NextResponse.json({
      message: "Application withdrawn successfully",
      application: withdrawnApplication,
    });

  } catch (error) {
    return handleApiError(error);
  }
}