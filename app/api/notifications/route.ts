/**
 * Notification inbox - Phase 4
 * Every role has its own inbox; rows are always scoped to the caller.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listNotifications } from "@/server/services/notification.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("notification:read:own");
    const sp = new URL(request.url).searchParams;
    const result = await listNotifications(user.id as string, {
      unreadOnly: sp.get("unreadOnly") === "true",
      limit: Math.min(parseInt(sp.get("limit") || "20"), 50),
      cursor: sp.get("cursor") || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
