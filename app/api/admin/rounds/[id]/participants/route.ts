/**
 * Admin Round Participants API — Phase 3
 *
 * GET    /api/admin/rounds/[id]/participants?action=eligible - Applications
 *          eligible to be added to this round (Phase 10 — the missing
 *          piece that connected shortlisting to attendance marking)
 * POST   /api/admin/rounds/[id]/participants - Add participants to round
 * DELETE /api/admin/rounds/[id]/participants - Remove participant from round
 * PUT    /api/admin/rounds/[id]/participants - Update participant results
 *
 * Phase 5: closed a validation gap here — `result`/`remarks`/`nextAction`
 * used to be passed straight from the request body to the service with no
 * type or length checking.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac/server-guard";
import {
  addParticipants,
  removeParticipant,
  updateParticipantResult,
  bulkUpdateParticipantResults,
  listRoundEligibleApplications,
  getRoundById,
} from "@/server/services/round.service";
import { participantResultSchema } from "@/lib/validations/placement";
import { BadRequestError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("round:participant:write");

    const { searchParams } = new URL(request.url);

    if (searchParams.get("action") === "eligible") {
      const applications = await listRoundEligibleApplications(params.id);
      return NextResponse.json({ applications });
    }

    // Default: this round's current participants — drive-rounds.tsx's own
    // "Attendance & Results" panel called this with no handler defined at
    // all until now (always a 405), so it never actually rendered any
    // participants either.
    const round = await getRoundById(params.id);
    return NextResponse.json({ participants: round.participants });
  } catch (error) {
    return handleApiError(error);
  }
}

const addParticipantsSchema = z.object({
  applicationIds: z.array(z.string().min(1)).min(1, "applicationIds array is required"),
});

const bulkUpdateSchema = z.object({
  updates: z
    .array(participantResultSchema.extend({ participantId: z.string().min(1) }))
    .min(1),
});

const singleUpdateSchema = participantResultSchema.extend({
  participantId: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("round:participant:write");

    const { applicationIds } = addParticipantsSchema.parse(await request.json());
    const round = await addParticipants(params.id, applicationIds);

    return NextResponse.json({
      message: `${applicationIds.length} participants added successfully`,
      round,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("round:participant:write");

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get("applicationId");
    if (!applicationId) throw new BadRequestError("applicationId is required");

    const round = await removeParticipant(params.id, applicationId);

    return NextResponse.json({ message: "Participant removed successfully", round });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("round:participant:write");

    const body = await request.json();

    if (body.updates && Array.isArray(body.updates)) {
      const { updates } = bulkUpdateSchema.parse(body);
      const round = await bulkUpdateParticipantResults(params.id, updates);
      return NextResponse.json({
        message: `${updates.length} participant results updated`,
        round,
      });
    }

    if (body.participantId) {
      const { participantId, result, remarks, nextAction } = singleUpdateSchema.parse(body);
      const participant = await updateParticipantResult(participantId, {
        result,
        remarks,
        nextAction,
      });
      return NextResponse.json({ message: "Participant result updated successfully", participant });
    }

    throw new BadRequestError("Either 'updates' array or 'participantId' is required");
  } catch (error) {
    return handleApiError(error);
  }
}
