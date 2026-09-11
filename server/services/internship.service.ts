import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import { getStorageAdapter } from "@/lib/storage";
import type { InternshipInput } from "@/lib/validations/profile";

export async function getInternships(studentId: string) {
  const items = await prisma.internship.findMany({
    where: { studentId },
    orderBy: [{ isOngoing: "desc" }, { startDate: "desc" }],
  });
  const storage = getStorageAdapter();
  return Promise.all(
    items.map(async (i) => ({
      ...i,
      certificateUrl: i.certificateKey ? await storage.getSignedUrl(i.certificateKey) : null,
    }))
  );
}

export async function createInternship(
  studentId: string, data: InternshipInput, actorId: string, certificateKey?: string
) {
  const item = await prisma.internship.create({
    data: {
      studentId,
      company: data.company,
      role: data.role,
      description: data.description || null,
      location: data.location || null,
      isRemote: data.isRemote,
      startDate: new Date(data.startDate),
      endDate: data.isOngoing ? null : data.endDate ? new Date(data.endDate) : null,
      isOngoing: data.isOngoing,
      stipend: data.stipend ?? null,
      certificateKey: certificateKey ?? null,
    },
  });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "Internship", entityId: item.id, newValues: { studentId, company: data.company } });
  return item;
}

export async function updateInternship(
  id: string, studentId: string, data: Partial<InternshipInput>, actorId: string, certificateKey?: string
) {
  await prisma.internship.findFirstOrThrow({ where: { id, studentId } });
  const item = await prisma.internship.update({
    where: { id },
    data: {
      ...(data.company !== undefined && { company: data.company }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.location !== undefined && { location: data.location || null }),
      ...(data.isRemote !== undefined && { isRemote: data.isRemote }),
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && { endDate: data.isOngoing ? null : data.endDate ? new Date(data.endDate) : null }),
      ...(data.isOngoing !== undefined && { isOngoing: data.isOngoing }),
      ...(data.stipend !== undefined && { stipend: data.stipend ?? null }),
      ...(certificateKey !== undefined && { certificateKey }),
    },
  });
  await writeAuditLog({ userId: actorId, action: "UPDATE", entity: "Internship", entityId: id });
  return item;
}

export async function deleteInternship(id: string, studentId: string, actorId: string) {
  const item = await prisma.internship.findFirstOrThrow({ where: { id, studentId } });
  if (item.certificateKey) {
    await getStorageAdapter().delete(item.certificateKey).catch(() => {});
  }
  await prisma.internship.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "Internship", entityId: id });
}
