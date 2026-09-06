/**
 * Admin Drive Shortlist API — Phase 3
 * 
 * GET /api/admin/drives/[id]/shortlist - List shortlistable applications
 * POST /api/admin/drives/[id]/shortlist - Bulk shortlist/reject or CSV upload
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { checkPermission } from "@/lib/rbac";
import { bulkShortlistSchema, csvShortlistSchema } from "@/lib/validations/placement";
import { 
  listShortlistableApplications, 
  bulkShortlistApplications, 
  shortlistFromCsv,
  getShortlistStats,
  exportShortlistData 
} from "@/lib/services/shortlist.service";
import { handleApiError, createCsvResponse } from "@/lib/api-utils";

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

    await checkPermission(session.user.id, "shortlist:read");

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Handle export action
    if (action === "export") {
      const filters = {
        jobRoleId: searchParams.get("jobRoleId") || undefined,
        status: searchParams.get("status") || undefined,
        batchYear: searchParams.get("batchYear") || undefined,
        branchCode: searchParams.get("branchCode") || undefined,
        minCgpa: searchParams.get("minCgpa") ? parseFloat(searchParams.get("minCgpa")!) : undefined,
        maxCgpa: searchParams.get("maxCgpa") ? parseFloat(searchParams.get("maxCgpa")!) : undefined,
        search: searchParams.get("search") || undefined,
      };

      const exportData = await exportShortlistData(params.id, filters);
      
      return createCsvResponse(
        exportData.data,
        exportData.filename,
        ["enrollmentNumber", "name", "email", "branch", "batch", "cgpa", "status", "jobRole", "appliedAt"]
      );
    }

    // Handle stats action
    if (action === "stats") {
      const stats = await getShortlistStats(params.id);
      return NextResponse.json({ stats });
    }

    // Regular list with filters
    const filters = {
      jobRoleId: searchParams.get("jobRoleId") || undefined,
      status: searchParams.get("status") || undefined,
      batchYear: searchParams.get("batchYear") || undefined,
      branchCode: searchParams.get("branchCode") || undefined,
      courseCode: searchParams.get("courseCode") || undefined,
      minCgpa: searchParams.get("minCgpa") ? parseFloat(searchParams.get("minCgpa")!) : undefined,
      maxCgpa: searchParams.get("maxCgpa") ? parseFloat(searchParams.get("maxCgpa")!) : undefined,
      gender: searchParams.get("gender") || undefined,
      category: searchParams.get("category") || undefined,
      search: searchParams.get("search") || undefined,
      sortBy: (searchParams.get("sortBy") as any) || "appliedAt",
      sortOrder: (searchParams.get("sortOrder") as any) || "desc",
      limit: parseInt(searchParams.get("limit") || "50"),
      offset: parseInt(searchParams.get("offset") || "0"),
    };

    const result = await listShortlistableApplications(params.id, filters);

    return NextResponse.json({
      applications: result.applications,
      stats: result.stats,
      pagination: {
        total: result.total,
        limit: filters.limit!,
        offset: filters.offset!,
        hasMore: result.total > filters.offset! + filters.limit!,
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

    await checkPermission(session.user.id, "shortlist:write");

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Handle CSV upload
    if (action === "csv") {
      const body = await request.json();
      const validatedData = csvShortlistSchema.parse(body);
      
      const result = await shortlistFromCsv(validatedData);
      
      return NextResponse.json({
        message: `Processed ${result.processed} enrollment numbers. ${result.shortlisted} shortlisted successfully.`,
        processed: result.processed,
        shortlisted: result.shortlisted,
        failed: result.failed,
      });
    }

    // Handle bulk shortlist/reject
    const body = await request.json();
    const validatedData = bulkShortlistSchema.parse(body);
    
    const result = await bulkShortlistApplications(validatedData);
    
    return NextResponse.json({
      message: `${result.updated} applications ${validatedData.action.toLowerCase()} successfully`,
      updated: result.updated,
      failed: result.failed,
    });

  } catch (error) {
    return handleApiError(error);
  }
}