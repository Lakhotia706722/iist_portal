/**
 * Mark notifications read - Phase 4
 * POST body: { id } for one, or { all: true } for every unread one.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac/server-guard";
import { markAsRead, markAllAsRead } from "@/server/services/notification.service";
import { handleApiError } from "@/lib/api-utils";

const markReadSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ id: z.string().min(1) }),
]);

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("notification:write:own");
    const body = markReadSchema.parse(await request.json().catch(() => ({})));

    if ("all" in body) {
      const result = await markAllAsRead(user.id as string);
      return NextResponse.json({ message: "All notifications marked read", ...result });
    }

    const result = await markAsRead(user.id as string, body.id);
    return NextResponse.json({ message: "Notification marked read", ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
