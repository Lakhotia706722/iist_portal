/**
 * Admin Round Detail API — Phase 3
 * 
 * GET /api/admin/rounds/[id] - Get round details
 * PUT /api/admin/rounds/[id] - Update round
 * DELETE /api/admin/rounds/[id] - Delete round
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { requirePermission } from "@/lib/rbac/server-guard";
import { roundSchema } from "@/lib/validations/placement";
import { getRoundById, updateRound, deleteRound, getRoundStats } from "@/server/services/round.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission("round:read");

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get("includeStats") === "true";

    const [round, stats] = await Promise.all([
      getRoundById(params.id),
      includeStats ? getRoundStats(params.id) : null,
    ]);

    return NextResponse.json({
      round,
      ...(stats && { stats }),
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

    await requirePermission("round:write");

    const body = await request.json();
    const validatedData = roundSchema.partial().parse(body);

    const round = await updateRound(params.id, validatedData);

    return NextResponse.json({
      message: "Round updated successfully",
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

    await requirePermission("round:write");

    await deleteRound(params.id);

    return NextResponse.json({
      message: "Round deleted successfully",
    });

  } catch (error) {
    return handleApiError(error);
  }
}