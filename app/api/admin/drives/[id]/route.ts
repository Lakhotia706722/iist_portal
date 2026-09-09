/**
 * Admin Drive Detail API — Phase 3
 * 
 * GET /api/admin/drives/[id] - Get drive by ID
 * PUT /api/admin/drives/[id] - Update drive
 * DELETE /api/admin/drives/[id] - Delete drive
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { requirePermission } from "@/lib/rbac/server-guard";
import { driveSchema, driveStatusSchema } from "@/lib/validations/placement";
import { 
  getDriveById, 
  updateDrive, 
  deleteDrive, 
  updateDriveStatus 
} from "@/server/services/drive.service";
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

    await requirePermission("drive:read");

    const drive = await getDriveById(params.id);

    return NextResponse.json({ drive });

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

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Handle status update
    if (action === "update-status") {
      const actor = await requirePermission("drive:publish");
      
      const body = await request.json();
      const { status } = driveStatusSchema.parse(body);

      const drive = await updateDriveStatus(params.id, status, actor.id as string);

      return NextResponse.json({
        message: `Drive status updated to ${status}`,
        drive,
      });
    }

    // Handle regular update
    const actor = await requirePermission("drive:write");

    const body = await request.json();
    const validatedData = driveSchema.partial().parse(body);

    const drive = await updateDrive(params.id, validatedData, actor.id as string);

    return NextResponse.json({
      message: "Drive updated successfully",
      drive,
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

    const actor = await requirePermission("drive:write");

    await deleteDrive(params.id, actor.id as string);

    return NextResponse.json({
      message: "Drive deleted successfully",
    });

  } catch (error) {
    return handleApiError(error);
  }
}