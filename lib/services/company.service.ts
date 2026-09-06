/**
 * Company Service — Phase 3
 *
 * CRUD operations for companies with:
 * - Logo upload/replacement with cleanup
 * - Slug uniqueness validation
 * - Soft delete (isActive=false) vs hard delete protection
 */

import { prisma } from "@/lib/prisma";
import { CompanyInput } from "@/lib/validations/placement";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { deleteFile } from "@/lib/storage";

export type CompanyWithDrives = {
  id: string;
  name: string;
  slug: string;
  industry: string;
  description: string | null;
  website: string | null;
  location: string | null;
  headcount: string | null;
  logoKey: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    drives: number;
  };
};

// Shared include for count
const companyInclude = {
  _count: {
    select: { drives: true },
  },
} as const;

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createCompany(
  data: CompanyInput,
  logoKey?: string
): Promise<CompanyWithDrives> {
  await validateSlugUnique(data.slug);

  const company = await prisma.company.create({
    data: { ...data, logoKey: logoKey || null },
    include: companyInclude,
  });

  return company as unknown as CompanyWithDrives;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function listCompanies(filters?: {
  search?: string;
  industry?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  companies: CompanyWithDrives[];
  total: number;
}> {
  const where: any = {};

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters?.industry) where.industry = filters.industry;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: companyInclude,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip: filters?.offset || 0,
      take: filters?.limit || 50,
    }),
    prisma.company.count({ where }),
  ]);

  return {
    companies: companies as unknown as CompanyWithDrives[],
    total,
  };
}

export async function getCompanyById(id: string): Promise<CompanyWithDrives> {
  const company = await prisma.company.findUnique({
    where: { id },
    include: companyInclude,
  });

  if (!company) throw new NotFoundError("Company not found");

  return company as unknown as CompanyWithDrives;
}

export async function getCompanyBySlug(slug: string): Promise<CompanyWithDrives> {
  const company = await prisma.company.findUnique({
    where: { slug },
    include: companyInclude,
  });

  if (!company) throw new NotFoundError("Company not found");

  return company as unknown as CompanyWithDrives;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateCompany(
  id: string,
  data: Partial<CompanyInput>,
  newLogoKey?: string
): Promise<CompanyWithDrives> {
  const existing = await prisma.company.findUnique({
    where: { id },
    select: { id: true, slug: true, logoKey: true },
  });

  if (!existing) throw new NotFoundError("Company not found");

  if (data.slug && data.slug !== existing.slug) {
    await validateSlugUnique(data.slug, id);
  }

  // Handle logo replacement
  const logoUpdate: any = {};
  if (newLogoKey) {
    logoUpdate.logoKey = newLogoKey;
    if (existing.logoKey) {
      try {
        await deleteFile(existing.logoKey);
      } catch (error) {
        console.warn("Failed to delete old logo:", error);
      }
    }
  }

  const company = await prisma.company.update({
    where: { id },
    data: { ...data, ...logoUpdate },
    include: companyInclude,
  });

  return company as unknown as CompanyWithDrives;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCompany(id: string, force = false): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      _count: { select: { drives: true } },
    },
  });

  if (!company) throw new NotFoundError("Company not found");

  if (!force && company._count.drives > 0) {
    // Soft delete
    await prisma.company.update({ where: { id }, data: { isActive: false } });
    return;
  }

  await prisma.company.delete({ where: { id } });

  if (company.logoKey) {
    try {
      await deleteFile(company.logoKey);
    } catch (error) {
      console.warn("Failed to delete company logo:", error);
    }
  }
}

export async function toggleCompanyStatus(id: string): Promise<CompanyWithDrives> {
  const company = await prisma.company.findUnique({
    where: { id },
    select: { isActive: true },
  });

  if (!company) throw new NotFoundError("Company not found");

  const updated = await prisma.company.update({
    where: { id },
    data: { isActive: !company.isActive },
    include: companyInclude,
  });

  return updated as unknown as CompanyWithDrives;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export async function getCompanyStats(): Promise<{
  total: number;
  active: number;
  byIndustry: Record<string, number>;
  withActiveDrives: number;
}> {
  const [total, active, byIndustry, withActiveDrives] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { isActive: true } }),
    prisma.company.groupBy({
      by: ["industry"],
      _count: { _all: true },
      where: { isActive: true },
    }),
    prisma.company.count({
      where: {
        isActive: true,
        drives: { some: { status: { not: "CANCELLED" } } },
      },
    }),
  ]);

  return {
    total,
    active,
    byIndustry: byIndustry.reduce(
      (acc, item) => ({ ...acc, [item.industry]: item._count._all }),
      {}
    ),
    withActiveDrives,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function validateSlugUnique(slug: string, excludeId?: string): Promise<void> {
  const existing = await prisma.company.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing && existing.id !== excludeId) {
    throw new ValidationError("Company slug must be unique");
  }
}
