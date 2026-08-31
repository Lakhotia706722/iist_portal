import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import type { BatchInput } from "@/lib/validations/admin";

export async function listBatches(opts?: { search?: string; branchId?: string; page?: number; pageSize?: number; includeInactive?: boolean }) {
  const { search, branchId, page = 1, pageSize = 20, includeInactive = false } = opts ?? {};
  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(branchId ? { branchId } : {}),
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { academicYear: { contains: search, mode: "insensitive" as const } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.batch.findMany({ where, orderBy: { startYear: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { branch: { select: { name: true, code: true } }, _count: { select: { students: true } } } }),
    prisma.batch.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createBatch(data: BatchInput, actorId: string) {
  const batch = await prisma.batch.create({ data, include: { branch: true } });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "Batch", entityId: batch.id, newValues: { name: batch.name, academicYear: batch.academicYear } });
  return batch;
}

export async function updateBatch(id: string, data: Partial<BatchInput>, actorId: string) {
  const old = await prisma.batch.findUniqueOrThrow({ where: { id } });
  const batch = await prisma.batch.update({ where: { id }, data, include: { branch: true } });
  await writeAuditLog({ userId: actorId, action: "UPDATE", entity: "Batch", entityId: id, oldValues: { name: old.name }, newValues: { name: batch.name } });
  return batch;
}

export async function deleteBatch(id: string, actorId: string) {
  const old = await prisma.batch.findUniqueOrThrow({ where: { id } });
  const batch = await prisma.batch.update({ where: { id }, data: { isActive: false } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "Batch", entityId: id, oldValues: { name: old.name } });
  return batch;
}
