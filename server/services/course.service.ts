import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import type { CourseInput } from "@/lib/validations/admin";

export async function listCourses(opts?: {
  search?: string;
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}) {
  const { search, page = 1, pageSize = 20, includeInactive = false } = opts ?? {};
  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(search
      ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { code: { contains: search, mode: "insensitive" as const } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.course.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.course.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createCourse(data: CourseInput, actorId: string) {
  const course = await prisma.course.create({ data });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "Course", entityId: course.id, newValues: { name: course.name, code: course.code } });
  return course;
}

export async function updateCourse(id: string, data: Partial<CourseInput>, actorId: string) {
  const old = await prisma.course.findUniqueOrThrow({ where: { id } });
  const course = await prisma.course.update({ where: { id }, data });
  await writeAuditLog({ userId: actorId, action: "UPDATE", entity: "Course", entityId: id, oldValues: { name: old.name }, newValues: { name: course.name } });
  return course;
}

export async function deleteCourse(id: string, actorId: string) {
  const old = await prisma.course.findUniqueOrThrow({ where: { id } });
  const course = await prisma.course.update({ where: { id }, data: { isActive: false } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "Course", entityId: id, oldValues: { name: old.name } });
  return course;
}
