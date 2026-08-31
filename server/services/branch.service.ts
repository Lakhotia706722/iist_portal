import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import type { BranchInput } from "@/lib/validations/admin";

export async function listBranches(opts?: { search?: string; departmentId?: string; page?: number; pageSize?: number; includeInactive?: boolean }) {
  const { search, departmentId, page = 1, pageSize = 20, includeInactive = false } = opts ?? {};
  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(departmentId ? { departmentId } : {}),
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { code: { contains: search, mode: "insensitive" as const } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.branch.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize, include: { department: { select: { name: true } }, course: { select: { name: true } }, _count: { select: { students: true } } } }),
    prisma.branch.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createBranch(data: BranchInput, actorId: string) {
  const branch = await prisma.branch.create({ data, include: { department: true, course: true } });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "Branch", entityId: branch.id, newValues: { name: branch.name, code: branch.code } });
  return branch;
}

export async function updateBranch(id: string, data: Partial<BranchInput>, actorId: string) {
  const old = await prisma.branch.findUniqueOrThrow({ where: { id } });
  const branch = await prisma.branch.update({ where: { id }, data, include: { department: true, course: true } });
  await writeAuditLog({ userId: actorId, action: "UPDATE", entity: "Branch", entityId: id, oldValues: { name: old.name }, newValues: { name: branch.name } });
  return branch;
}

export async function deleteBranch(id: string, actorId: string) {
  const old = await prisma.branch.findUniqueOrThrow({ where: { id } });
  const branch = await prisma.branch.update({ where: { id }, data: { isActive: false } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "Branch", entityId: id, oldValues: { name: old.name } });
  return branch;
}
