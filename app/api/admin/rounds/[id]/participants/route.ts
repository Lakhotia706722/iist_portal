/**
 * Admin Round Participants API — Phase 3
 * 
 * POST /api/admin/rounds/[id]/participants - Add participants to round
 * DELETE /api/admin/rounds/[id]/participants - Remove participant from round
 * PUT /api/admin/rounds/[id]/participants - Update participant results
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { checkPermission } from "@/lib/rbac";
import { 
  addParticipants, 
  removeParticipant, 
  updateParticipantResult,
  bulkUpdateParticipantResults 
} from "@/lib/services/round.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await checkPermission(session.user.id, "round:participant:write");

    const body = await request.json();
    const { applicationIds } = body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return NextResponse.json({ error: "applicationIds array is required" }, { status: 400 });
    }

    const round = await addParticipants(params.id, applicationIds);

    return NextResponse.json({
      message: `${applicationIds.length} participants added successfully`,
      round,
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await checkPermission(session.user.id, "round:participant:write");

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get("applicationId");

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
    }

    const round = await removeParticipant(params.id, applicationId);

    return NextResponse.json({
      message: "Participant removed successfully",
      round,
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await checkPermission(session.user.id, "round:participant:write");

    const body = await request.json();
    
    // Check if bulk update or single update
    if (body.updates && Array.isArray(body.updates)) {
      // Bulk update
      const round = await bulkUpdateParticipantResults(params.id, body.updates);
      
      return NextResponse.json({
        message: `${body.updates.length} participant results updated`,
        round,
      });
    } else if (body.participantId) {
      // Single update
      const { participantId, result, remarks, nextAction } = body;
      
      const participant = await updateParticipantResult(participantId, {
        result,
        remarks,
        nextAction,
      });
      
      return NextResponse.json({
        message: "Participant result updated successfully",
        participant,
      });
    } else {
      return NextResponse.json({ 
        error: "Either 'updates' array or 'participantId' is required" 
      }, { status: 400 });
    }

  } catch (error) {
    return handleApiError(error);
  }
}