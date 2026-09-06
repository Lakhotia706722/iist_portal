/**
 * Admin Application Status API — Phase 3
 * 
 * PUT /api/admin/applications/[id]/status - Update application status
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { checkPermission } from "@/lib/rbac";
import { applicationStatusSchema } from "@/lib/validations/placement";
import { updateApplicationStatus } from "@/lib/services/application.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await checkPermission(session.user.id, "application:status:write");

    const body = await request.json();
    const validatedData = applicationStatusSchema.parse(body);

    const application = await updateApplicationStatus(
      params.id,
      validatedData,
      session.user.id
    );

    return NextResponse.json({
      message: "Application status updated successfully",
      application,
    });

  } catch (error) {
    return handleApiError(error);
  }
}