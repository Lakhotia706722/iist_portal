/**
 * Admin Drives API — Phase 3
 * 
 * GET /api/admin/drives - List drives with filters
 * POST /api/admin/drives - Create new drive
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { checkPermission } from "@/lib/rbac";
import { driveSchema } from "@/lib/validations/placement";
import { createDrive, listDrives } from "@/lib/services/drive.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await checkPermission(session.user.id, "drive:read");

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId") || undefined;
    const academicYear = searchParams.get("academicYear") || undefined;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const filters = {
      companyId,
      academicYear,
      status,
      search,
      limit: Math.min(limit, 100),
      offset: Math.max(offset, 0),
    };

    const result = await listDrives(filters);

    return NextResponse.json({
      drives: result.drives,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.total > filters.offset + filters.limit,
      },
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await checkPermission(session.user.id, "drive:write");

    const body = await request.json();
    const validatedData = driveSchema.parse(body);

    const drive = await createDrive(validatedData, session.user.id);

    return NextResponse.json({
      message: "Placement drive created successfully",
      drive,
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}