/**
 * Admin Drive Job Roles API — Phase 3
 * 
 * GET /api/admin/drives/[id]/roles - List job roles for drive
 * POST /api/admin/drives/[id]/roles - Create new job role
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { checkPermission } from "@/lib/rbac";
import { jobRoleSchema } from "@/lib/validations/placement";
import { createJobRole, listJobRoles } from "@/lib/services/job-role.service";
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

    await checkPermission(session.user.id, "jobrole:read");

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const filters = {
      isActive: isActive !== null ? isActive === "true" : undefined,
      limit: Math.min(limit, 100),
      offset: Math.max(offset, 0),
    };

    const result = await listJobRoles(params.id, filters);

    return NextResponse.json({
      jobRoles: result.jobRoles,
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

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await checkPermission(session.user.id, "jobrole:write");

    const body = await request.json();
    const validatedData = jobRoleSchema.parse(body);

    const jobRole = await createJobRole(params.id, validatedData);

    return NextResponse.json({
      message: "Job role created successfully",
      jobRole,
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}