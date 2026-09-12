/**
 * Notification "has anything changed" short-circuit — Phase 16, P3.1.
 * Cheap enough (one indexed count + one indexed single-row lookup, no
 * notification bodies) to poll on the bell's tight 8s interval without the
 * cost of re-serializing the full inbox every cycle. See
 * server/services/notification.service.ts's peekNotifications() for why.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { peekNotifications } from "@/server/services/notification.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePermission("notification:read:own");
    const result = await peekNotifications(user.id as string);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
