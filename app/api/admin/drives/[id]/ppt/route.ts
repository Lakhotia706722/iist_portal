/**
 * Pre-placement talk for a drive - Phase 4
 * GET  - current talk
 * PUT  - create/update schedule details
 * POST - upload an attachment (deck / JD) through the storage adapter
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import {
  getPrePlacementTalk,
  upsertPrePlacementTalk,
  addTalkAttachment,
} from "@/server/services/calendar.service";
import { prePlacementTalkSchema } from "@/lib/validations/calendar";
import { verifyUploadedObject } from "@/lib/uploads/presign";
import { BadRequestError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("drive:read");
    return NextResponse.json({ talk: await getPrePlacementTalk(params.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("drive:write");
    const data = prePlacementTalkSchema.parse(await request.json());
    const talk = await upsertPrePlacementTalk(
      params.id,
      data,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Pre-placement talk saved", talk });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("drive:write");
    // Phase 16 — P5: the deck/JD goes straight to storage (type/size
    // enforced by /api/uploads/presign before the upload URL was issued)
    // — only the key is sent here.
    const { key } = await request.json();
    if (!key || typeof key !== "string") throw new BadRequestError("No attachment key provided");
    await verifyUploadedObject(key);

    const talk = await addTalkAttachment(
      params.id,
      key,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Attachment uploaded", talk });
  } catch (error) {
    return handleApiError(error);
  }
}
