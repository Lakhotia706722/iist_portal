/**
 * Admin Drive Rounds API — Phase 3
 * 
 * GET /api/admin/drives/[id]/rounds - List rounds for drive
 * POST /api/admin/drives/[id]/rounds - Create new round
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { requirePermission } from "@/lib/rbac/server-guard";
import { roundSchema } from "@/lib/validations/placement";
import { createRound, listRounds } from "@/server/services/round.service";
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
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const filters = {
      limit: Math.min(limit, 100),
      offset: Math.max(offset, 0),
    };

    const result = await listRounds(params.id, filters);

    return NextResponse.json({
      rounds: result.rounds,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.total > filters.offset + filters.limit,
      },
    });

  } catch (error) {
    return handleApiError(error);
  }
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

    const actor = await requirePermission("round:write");

    const body = await request.json();
    const validatedData = roundSchema.parse(body);

    const round = await createRound(params.id, validatedData, actor.id as string);

    return NextResponse.json({
      message: "Round created successfully",
      round,
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}