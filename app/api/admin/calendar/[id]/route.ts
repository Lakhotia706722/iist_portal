import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import {
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/server/services/calendar.service";
import { updateCalendarEventSchema } from "@/lib/validations/calendar";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("calendar:write");
    const data = updateCalendarEventSchema.parse(await request.json());
    const event = await updateCalendarEvent(
      params.id,
      data as any,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Event updated", event });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("calendar:write");
    await deleteCalendarEvent(
      params.id,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Event deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
