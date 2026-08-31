import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import type { DepartmentInput } from "@/lib/validations/admin";

export async function listDepartments(opts?: {
  search?: string;
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}) {
  const { search, page = 1, pageSize = 20, includeInactive = false } = opts ?? {};
  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.department.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { branches: true } } },
    }),
    prisma.department.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getDepartment(id: string) {
  return prisma.department.findUniqueOrThrow({ where: { id } });
}

export async function createDepartment(data: DepartmentInput, actorId: string) {
  const dept = await prisma.department.create({ data });
  await writeAuditLog({
    userId: actorId,
    action: "CREATE",
    entity: "Department",
    entityId: dept.id,
    newValues: { name: dept.name, code: dept.code },
  });
  return dept;
}

export async function updateDepartment(
  id: string,
  data: Partial<DepartmentInput>,
  actorId: string
) {
  const old = await prisma.department.findUniqueOrThrow({ where: { id } });
  const dept = await prisma.department.update({ where: { id }, data });
  await writeAuditLog({
    userId: actorId,
    action: "UPDATE",
    entity: "Department",
    entityId: id,
    oldValues: { name: old.name, code: old.code, isActive: old.isActive },
    newValues: { name: dept.name, code: dept.code, isActive: dept.isActive },
  });
  return dept;
}

export async function deleteDepartment(id: string, actorId: string) {
  const old = await prisma.department.findUniqueOrThrow({ where: { id } });
  // Soft-delete: set isActive = false
  const dept = await prisma.department.update({
    where: { id },
    data: { isActive: false },
  });
  await writeAuditLog({
    userId: actorId,
    action: "DELETE",
    entity: "Department",
    entityId: id,
    oldValues: { name: old.name, code: old.code },
  });
  return dept;
}
