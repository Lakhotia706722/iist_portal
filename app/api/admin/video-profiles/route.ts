import { NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { listPendingVideoProfiles } from "@/server/services/video-profile.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("video:verify");
    const { searchParams } = req.nextUrl;
    const result = await listPendingVideoProfiles({
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 20),
      status: searchParams.get("status") ?? undefined,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
