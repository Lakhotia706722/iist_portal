/**
 * Student Opportunity Detail API — Phase 3
 * 
 * GET /api/student/opportunities/[id] - Get opportunity details with eligibility check
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { getOpportunityDetail } from "@/server/services/drive.service";
import { evaluateEligibility } from "@/lib/eligibility-engine";
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
      return NextResponse.json({ error: "Only students can access opportunities" }, { status: 403 });
    }

    const studentId = await getStudentIdFromUserId(session.user.id);

    const { searchParams } = new URL(request.url);
    const checkEligibility = searchParams.get("checkEligibility") === "true";

    // Get opportunity details
    const opportunity = await getOpportunityDetail(params.id);

    // Calculate time status
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

    // Check eligibility for each job role if requested
    let eligibilityResults: Record<string, any> = {};
    
    if (checkEligibility) {
      await Promise.all(
        opportunity.jobRoles.map(async (jobRole) => {
          try {
            const result = await evaluateEligibility(studentId, jobRole.id);
            eligibilityResults[jobRole.id] = result;
          } catch (error) {
            console.warn(`Eligibility check failed for job role ${jobRole.id}:`, error);
            eligibilityResults[jobRole.id] = {
              eligible: false,
              results: [{
                ruleId: "system",
                label: "System Error",
                field: "system",
                passed: false,
                reason: "Unable to check eligibility. Please try again or contact support.",
              }],
            };
          }
        })
      );
    }

    // Check if student has already applied
    const { prisma } = await import("@/lib/prisma");
    const existingApplications = await prisma.application.findMany({
      where: {
        studentId,
        jobRole: {
          driveId: opportunity.id,
        },
      },
      select: {
        id: true,
        jobRoleId: true,
        status: true,
        appliedAt: true,
      },
    });

    const applicationStatus: Record<string, any> = {};
    existingApplications.forEach(app => {
      applicationStatus[app.jobRoleId] = {
        applicationId: app.id,
        status: app.status,
        appliedAt: app.appliedAt.toISOString(),
      };
    });

    return NextResponse.json({
      opportunity: {
        ...opportunity,
        timeStatus,
        timeRemaining,
        applicationOpenAt: opportunity.applicationOpenAt?.toISOString(),
        applicationCloseAt: opportunity.applicationCloseAt?.toISOString(),
        driveStartDate: opportunity.driveStartDate?.toISOString(),
        driveEndDate: opportunity.driveEndDate?.toISOString(),
      },
      eligibility: eligibilityResults,
      applicationStatus,
    });

  } catch (error) {
    return handleApiError(error);
  }
}