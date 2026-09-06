/**
 * Admin Job Role Detail API — Phase 3
 * 
 * GET /api/admin/drives/[id]/roles/[roleId] - Get job role details
 * PUT /api/admin/drives/[id]/roles/[roleId] - Update job role
 * DELETE /api/admin/drives/[id]/roles/[roleId] - Delete job role
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { checkPermission } from "@/lib/rbac";
import { jobRoleSchema } from "@/lib/validations/placement";
import { 
  getJobRoleById, 
  updateJobRole, 
  deleteJobRole, 
  toggleJobRoleStatus 
} from "@/lib/services/job-role.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string; roleId: string };
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

    await checkPermission(session.user.id, "jobrole:read");

    const jobRole = await getJobRoleById(params.roleId);

    return NextResponse.json({ jobRole });

  } catch (error) {
    return handleApiError(error);
  }
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

    await checkPermission(session.user.id, "jobrole:write");

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Handle toggle status
    if (action === "toggle-status") {
      const jobRole = await toggleJobRoleStatus(params.roleId);
      
      return NextResponse.json({
        message: `Job role ${jobRole.isActive ? "activated" : "deactivated"} successfully`,
        jobRole,
      });
    }

    // Handle regular update
    const body = await request.json();
    const validatedData = jobRoleSchema.partial().parse(body);

    const jobRole = await updateJobRole(params.roleId, validatedData);

    return NextResponse.json({
      message: "Job role updated successfully",
      jobRole,
    });

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

    await checkPermission(session.user.id, "jobrole:write");

    await deleteJobRole(params.roleId);

    return NextResponse.json({
      message: "Job role deleted successfully",
    });

  } catch (error) {
    return handleApiError(error);
  }
}