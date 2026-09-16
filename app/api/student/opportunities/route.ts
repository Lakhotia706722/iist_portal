/**
 * Student Opportunities API — Phase 3
 * 
 * GET /api/student/opportunities - List active opportunities for students
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { listActiveOpportunities } from "@/server/services/drive.service";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Students can view opportunities, but let's verify they have the right role
    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Only students can access opportunities" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const industry = searchParams.get("industry") || undefined;
    const workMode = searchParams.get("workMode") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const filters = {
      search,
      industry,
      workMode,
      limit: Math.min(limit, 50), // Cap at 50 for students
      offset: Math.max(offset, 0),
    };

    const result = await listActiveOpportunities(filters);

    // Which of these opportunities has the CURRENT student already applied
    // to — derived from the authenticated session's studentId (never a
    // client-supplied id), same "does an Application row exist" definition
    // the opportunity detail route already uses. A raw applications count
    // is global across all students and must never be used for this.
    const studentId = await getStudentIdFromUserId(session.user.id);
    const appliedDriveIds = new Set(
      (
        await prisma.application.findMany({
          where: {
            studentId,
            driveId: { in: result.opportunities.map((o) => o.id) },
          },
          select: { driveId: true },
        })
      ).map((a) => a.driveId)
    );

    // Add time-sensitive information for each opportunity
    const enhancedOpportunities = result.opportunities.map(opportunity => {
      let timeStatus = "active";
      let timeRemaining = null;

      if (opportunity.applicationCloseAt) {
        const now = new Date();
        const closeTime = new Date(opportunity.applicationCloseAt);
        const timeDiff = closeTime.getTime() - now.getTime();

        if (timeDiff <= 0) {
          timeStatus = "closed";
        } else if (timeDiff <= 24 * 60 * 60 * 1000) { // 24 hours
          timeStatus = "closing_soon";
          timeRemaining = Math.ceil(timeDiff / (60 * 60 * 1000)); // hours
        } else {
          timeRemaining = Math.ceil(timeDiff / (24 * 60 * 60 * 1000)); // days
        }
      }

      return {
        ...opportunity,
        timeStatus,
        timeRemaining,
        applicationCloseAt: opportunity.applicationCloseAt?.toISOString(),
        hasApplied: appliedDriveIds.has(opportunity.id),
      };
    });

    return NextResponse.json({
      opportunities: enhancedOpportunities,
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