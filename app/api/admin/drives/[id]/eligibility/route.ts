/**
 * Admin Drive Eligibility API — Phase 3
 * 
 * GET /api/admin/drives/[id]/eligibility - Get all eligibility rules for drive
 * POST /api/admin/drives/[id]/eligibility - Bulk update eligibility rules for job role
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { checkPermission } from "@/lib/rbac";
import { eligibilityRulesBulkSchema } from "@/lib/validations/placement";
import { bulkUpdateEligibilityRules } from "@/lib/services/job-role.service";
import { prisma } from "@/lib/prisma";
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

    await checkPermission(session.user.id, "eligibility:read");

    const { searchParams } = new URL(request.url);
    const jobRoleId = searchParams.get("jobRoleId");

    let where: any = { jobRole: { driveId: params.id } };
    if (jobRoleId) {
      where.jobRoleId = jobRoleId;
    }

    // Get all eligibility rules for the drive (or specific job role)
    const eligibilityRules = await prisma.eligibilityRule.findMany({
      where,
      include: {
        jobRole: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [
        { jobRole: { title: "asc" } },
        { createdAt: "asc" },
      ],
    });

    // Group by job role for easier consumption
    const rulesByJobRole = eligibilityRules.reduce((acc, rule) => {
      const jobRoleId = rule.jobRoleId;
      if (!acc[jobRoleId]) {
        acc[jobRoleId] = {
          jobRole: rule.jobRole,
          rules: [],
        };
      }
      acc[jobRoleId].rules.push({
        id: rule.id,
        field: rule.field,
        operator: rule.operator,
        value: rule.value,
        label: rule.label,
        isActive: rule.isActive,
      });
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      eligibilityRules: Object.values(rulesByJobRole),
      totalRules: eligibilityRules.length,
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

    await checkPermission(session.user.id, "eligibility:write");

    const body = await request.json();
    const { jobRoleId, rules } = body;

    if (!jobRoleId) {
      return NextResponse.json({ error: "jobRoleId is required" }, { status: 400 });
    }

    // Validate the rules
    const { rules: validatedRules } = eligibilityRulesBulkSchema.parse({ rules });

    // Verify job role belongs to the drive
    const jobRole = await prisma.jobRole.findFirst({
      where: { id: jobRoleId, driveId: params.id },
    });

    if (!jobRole) {
      return NextResponse.json({ error: "Job role not found in this drive" }, { status: 404 });
    }

    const updatedJobRole = await bulkUpdateEligibilityRules(jobRoleId, validatedRules);

    return NextResponse.json({
      message: "Eligibility rules updated successfully",
      jobRole: updatedJobRole,
    });

  } catch (error) {
    return handleApiError(error);
  }
}