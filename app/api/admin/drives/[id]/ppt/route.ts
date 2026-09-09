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
import { getStorageAdapter, buildStorageKey } from "@/lib/storage";
import { BadRequestError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-powerpoint", // .ppt
  "image/jpeg",
  "image/png",
];

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
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new BadRequestError("No file provided");
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new BadRequestError("Attachment must be a PDF, PowerPoint file, or image");
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestError("Attachment must be 20MB or smaller");
    }

    const key = buildStorageKey("ppt-attachments", params.id, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await getStorageAdapter().upload(key, buffer, file.type);

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
