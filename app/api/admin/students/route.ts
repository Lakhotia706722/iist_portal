/**
 * Admin student directory — Phase 4, extended Phase 12
 *
 * Started as a lightweight list for staff pickers (schedule an interview,
 * pick test participants) — still the default shape when `detailed` isn't
 * requested, so those existing callers are unaffected. `?detailed=true`
 * (used by the "Students" nav page, which had no real screen before this
 * phase) adds branch filtering, pagination, and the same placement-summary
 * counts hod.service.ts's listDepartmentStudents already computes, just
 * unscoped.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("student:read:all");

    const sp = new URL(request.url).searchParams;
    const search = sp.get("search")?.trim();
    const batchId = sp.get("batchId") || undefined;
    const branchId = sp.get("branchId") || undefined;
    const detailed = sp.get("detailed") === "true";
    const limit = Math.min(parseInt(sp.get("limit") || "100"), 500);
    const offset = Math.max(parseInt(sp.get("offset") || "0"), 0);

    const where = {
      ...(batchId ? { batchId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(search
        ? {
            OR: [
              { enrollmentNumber: { contains: search, mode: "insensitive" as const } },
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    if (!detailed) {
      const students = await prisma.student.findMany({
        where,
        select: {
          id: true,
          enrollmentNumber: true,
          firstName: true,
          lastName: true,
          profileStatus: true,
          branch: { select: { id: true, code: true, name: true } },
          batch: { select: { id: true, name: true, academicYear: true } },
        },
        orderBy: { enrollmentNumber: "asc" },
        take: limit,
      });
      return NextResponse.json({ students, total: students.length });
    }

    const [rows, total] = await Promise.all([
      prisma.student.findMany({
        where,
        select: {
          id: true,
          enrollmentNumber: true,
          firstName: true,
          lastName: true,
          branch: { select: { name: true, code: true } },
          batch: { select: { name: true } },
          testResults: { select: { percentage: true }, orderBy: { createdAt: "desc" }, take: 1 },
          applications: { select: { id: true, status: true } },
          offers: { select: { id: true, status: true } },
        },
        orderBy: { enrollmentNumber: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.student.count({ where }),
    ]);

    const students = rows.map((s) => ({
      id: s.id,
      name: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.enrollmentNumber,
      enrollmentNumber: s.enrollmentNumber,
      branch: s.branch,
      batch: s.batch,
      latestSkillUpPercent: s.testResults[0]?.percentage ?? null,
      applicationCount: s.applications.length,
      shortlistedCount: s.applications.filter((a) =>
        ["SHORTLISTED", "WRITTEN_TEST", "TECHNICAL_ROUND", "HR_ROUND", "FINAL_ROUND", "SELECTED"].includes(a.status)
      ).length,
      isPlaced: s.offers.some((o) => o.status === "ACCEPTED" || o.status === "JOINED"),
    }));

    return NextResponse.json({
      students,
      pagination: { total, limit, offset, hasMore: total > offset + limit },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
