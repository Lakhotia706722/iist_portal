/**
 * Student Applications API — Phase 3
 * 
 * GET /api/student/applications - List student's applications
 * POST /api/student/applications - Apply for a job role
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { applySchema } from "@/lib/validations/placement";
import { applyForJobRole, listStudentApplications } from "@/server/services/application.service";
import { handleApiError } from "@/lib/api-utils";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Only students can access applications" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const academicYear = searchParams.get("academicYear") || undefined;
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const filters = {
      academicYear,
      status,
      limit: Math.min(limit, 50),
      offset: Math.max(offset, 0),
    };

    const studentId = await getStudentIdFromUserId(session.user.id);
    const result = await listStudentApplications(studentId, filters);

    return NextResponse.json({
      applications: result.applications,
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
  const limit = await checkRateLimit(request, { bucket: "apply", limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return rateLimitedResponse(limit);

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Only students can apply" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = applySchema.parse(body);

    // Apply for the job role (eligibility is checked in service)
    const studentId = await getStudentIdFromUserId(session.user.id);
    const application = await applyForJobRole(studentId, validatedData);

    return NextResponse.json({
      message: "Application submitted successfully",
      application,
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}