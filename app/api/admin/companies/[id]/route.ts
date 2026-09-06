/**
 * Admin Company Detail API — Phase 3
 * 
 * GET /api/admin/companies/[id] - Get company by ID
 * PUT /api/admin/companies/[id] - Update company
 * DELETE /api/admin/companies/[id] - Delete company
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { checkPermission } from "@/lib/rbac";
import { companySchema } from "@/lib/validations/placement";
import { 
  getCompanyById, 
  updateCompany, 
  deleteCompany, 
  toggleCompanyStatus 
} from "@/lib/services/company.service";
import { uploadFile } from "@/lib/storage";
import { ApiError, handleApiError } from "@/lib/api-utils";

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

    await checkPermission(session.user.id, "company:read");

    const company = await getCompanyById(params.id);

    return NextResponse.json({ company });

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

    await checkPermission(session.user.id, "company:write");

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Handle toggle status action
    if (action === "toggle-status") {
      const company = await toggleCompanyStatus(params.id);
      return NextResponse.json({
        message: `Company ${company.isActive ? "activated" : "deactivated"} successfully`,
        company,
      });
    }

    // Handle regular update
    const formData = await request.formData();
    
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

    // Only validate fields that are provided (partial update)
    const updateData: any = {};
    Object.entries(companyData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        updateData[key] = value;
      }
    });

    // Validate the update data if it's not empty
    let validatedData = {};
    if (Object.keys(updateData).length > 0) {
      validatedData = companySchema.partial().parse(updateData);
    }

    // Handle logo upload if present
    const logoFile = formData.get("logo") as File | null;
    let uploadedLogo;

    if (logoFile && logoFile.size > 0) {
      // Validate file type and size
      if (!logoFile.type.startsWith("image/")) {
        throw new ApiError("Invalid file type. Only images are allowed.", 400);
      }

      if (logoFile.size > 2 * 1024 * 1024) { // 2MB limit
        throw new ApiError("File size too large. Maximum 2MB allowed.", 400);
      }

      const logoBuffer = await logoFile.arrayBuffer();
      uploadedLogo = await uploadFile(
        Buffer.from(logoBuffer),
        `company-logos/${Date.now()}-${logoFile.name}`,
        logoFile.type
      );
    }

    const company = await updateCompany(params.id, validatedData, uploadedLogo?.url);

    return NextResponse.json({
      message: "Company updated successfully",
      company,
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

    await checkPermission(session.user.id, "company:write");

    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    await deleteCompany(params.id, force);

    return NextResponse.json({
      message: "Company deleted successfully",
    });

  } catch (error) {
    return handleApiError(error);
  }
}