/**
 * Admin Drive Dashboard API — Phase 3
 * 
 * GET /api/admin/drives/[id]/dashboard - Get comprehensive drive analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { checkPermission } from "@/lib/rbac";
import { getDriveAnalytics, compareDrivePerformance } from "@/lib/services/drive-dashboard.service";
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

    await checkPermission(session.user.id, "drive:read");

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Handle comparative analysis
    if (action === "compare") {
      const comparison = await compareDrivePerformance(params.id);
      return NextResponse.json({ comparison });
    }

    // Regular analytics
    const analytics = await getDriveAnalytics(params.id);

    return NextResponse.json({ analytics });

  } catch (error) {
    return handleApiError(error);
  }
}