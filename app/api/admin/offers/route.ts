/**
 * Admin Offers API — Phase 3.5
 *
 * GET  /api/admin/offers - List offers (filters + optional stats)
 * POST /api/admin/offers - Record an offer against a SELECTED application
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import {
  createOffer,
  listOffers,
  getOfferStats,
} from "@/server/services/offer.service";
import {
  createOfferSchema,
  offerFiltersSchema,
} from "@/lib/validations/offer";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("offer:read:all");

    const { searchParams } = new URL(request.url);
    const filters = offerFiltersSchema.parse(
      Object.fromEntries(searchParams.entries())
    );
    const includeStats = searchParams.get("includeStats") === "true";

    const [result, stats] = await Promise.all([
      listOffers(filters),
      includeStats ? getOfferStats(filters.academicYear) : null,
    ]);

    return NextResponse.json({
      offers: result.offers,
      stats,
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

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("offer:write");

    const body = await request.json();
    const data = createOfferSchema.parse(body);

    const offer = await createOffer(
      data,
      user.id as string,
      extractRequestMeta(request)
    );

    return NextResponse.json(
      { message: "Offer recorded successfully", offer },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
