/**
 * Admin calendar - Phase 4
 * GET  - full institute calendar
 * POST - create a standalone event
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import {
  getAdminCalendar,
  createCalendarEvent,
} from "@/server/services/calendar.service";
import { calendarEventSchema } from "@/lib/validations/calendar";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("calendar:write");
    const sp = new URL(request.url).searchParams;
    const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
    const to = sp.get("to") ? new Date(sp.get("to")!) : undefined;
    return NextResponse.json({ events: await getAdminCalendar({ from, to }) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("calendar:write");
    const data = calendarEventSchema.parse(await request.json());
    const event = await createCalendarEvent(
      data,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Event created", event }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
