/**
 * Admin student directory — Phase 4
 *
 * Lightweight list used by staff pickers (schedule an interview, pick test
 * participants). Not the full student-management screen.
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
    const limit = Math.min(parseInt(sp.get("limit") || "100"), 500);

    const students = await prisma.student.findMany({
      where: {
        ...(batchId ? { batchId } : {}),
        ...(search
          ? {
              OR: [
                { enrollmentNumber: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
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
  } catch (error) {
    return handleApiError(error);
  }
}
