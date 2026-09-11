/**
 * Admin Companies API — Phase 3
 * 
 * GET /api/admin/companies - List companies with filters
 * POST /api/admin/companies - Create new company
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { requirePermission } from "@/lib/rbac/server-guard";
import { companySchema } from "@/lib/validations/placement";
import { createCompany, listCompanies, getCompanyStats } from "@/server/services/company.service";
import { getStorageAdapter, buildStorageKey } from "@/lib/storage";
import { ApiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission("company:read");

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const industry = searchParams.get("industry") || undefined;
    const isActive = searchParams.get("isActive");
    const includeStats = searchParams.get("includeStats") === "true";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const filters = {
      search,
      industry,
      isActive: isActive !== null ? isActive === "true" : undefined,
      limit: Math.min(limit, 100), // Cap at 100
      offset: Math.max(offset, 0),
    };

    const [result, stats] = await Promise.all([
      listCompanies(filters),
      includeStats ? getCompanyStats() : null,
    ]);

    return NextResponse.json({
      companies: result.companies,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.total > filters.offset + filters.limit,
      },
      ...(stats && { stats }),
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission("company:write");

    const formData = await request.formData();
    
    // Extract company data
    const companyData = {
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      industry: formData.get("industry") as string,
      description: formData.get("description") as string || "",
      website: formData.get("website") as string || "",
      location: formData.get("location") as string || "",
      headcount: formData.get("headcount") as string || "",
      isActive: formData.get("isActive") === "true",
    };

    // Validate company data
    const validatedData = companySchema.parse(companyData);

    // Handle logo upload if present
    const logoFile = formData.get("logo") as File | null;
    let uploadedLogoKey: string | undefined;

    if (logoFile && logoFile.size > 0) {
      // Validate file type and size
      if (!logoFile.type.startsWith("image/")) {
        throw new ApiError("Invalid file type. Only images are allowed.", 400);
      }

      if (logoFile.size > 2 * 1024 * 1024) { // 2MB limit
        throw new ApiError("File size too large. Maximum 2MB allowed.", 400);
      }

      const logoBuffer = await logoFile.arrayBuffer();
      uploadedLogoKey = await getStorageAdapter().upload(
        buildStorageKey("company-logos", "shared", logoFile.name),
        Buffer.from(logoBuffer),
        logoFile.type
      );
    }

    const company = await createCompany(validatedData, uploadedLogoKey, session.user.id);

    return NextResponse.json({
      message: "Company created successfully",
      company,
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}