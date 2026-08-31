import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { visibilityUpdateSchema } from "@/lib/validations/profile";
import {
  getVisibilitySettings,
  updateVisibilitySettings,
} from "@/server/services/profile-visibility.service";

export async function GET(_req: NextRequest) {
  try {
    await requirePermission("profile:visibility:write");
    return Response.json(await getVisibilitySettings());
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission("profile:visibility:write");
    const body = await req.json();
    const parsed = visibilityUpdateSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const result = await updateVisibilitySettings(parsed.data, actor.id);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

