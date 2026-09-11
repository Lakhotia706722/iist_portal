import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import type { SkillCatalogInput, StudentSkillInput, CustomSkillInput } from "@/lib/validations/profile";

// ─── Skill Catalog (admin-managed) ───────────────────────────────────────────

export async function listSkillCatalog(opts: {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}) {
  const { search, category, page = 1, pageSize = 50, includeInactive = false } = opts;
  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(category ? { category: category as any } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.skill.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.skill.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createSkill(data: SkillCatalogInput, actorId: string) {
  const skill = await prisma.skill.create({ data });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "Skill", entityId: skill.id, newValues: data as any });
  return skill;
}

export async function updateSkill(id: string, data: Partial<SkillCatalogInput>, actorId: string) {
  const old = await prisma.skill.findUniqueOrThrow({ where: { id } });
  const skill = await prisma.skill.update({ where: { id }, data });
  await writeAuditLog({ userId: actorId, action: "UPDATE", entity: "Skill", entityId: id, oldValues: old as any, newValues: data as any });
  return skill;
}

export async function deleteSkill(id: string, actorId: string) {
  await prisma.skill.update({ where: { id }, data: { isActive: false } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "Skill", entityId: id });
}

// ─── Student Skills ───────────────────────────────────────────────────────────

export async function getStudentSkills(studentId: string) {
  const [catalogSkills, customSkills] = await Promise.all([
    prisma.studentSkill.findMany({
      where: { studentId },
      include: { skill: true },
      orderBy: [{ skill: { category: "asc" } }, { skill: { name: "asc" } }],
    }),
    prisma.customSkill.findMany({
      where: { studentId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);
  return { catalogSkills, customSkills };
}

export async function addStudentSkill(studentId: string, data: StudentSkillInput, actorId: string) {
  const item = await prisma.studentSkill.create({
    data: { studentId, skillId: data.skillId, level: data.level, yearsExp: data.yearsExp ?? null },
    include: { skill: true },
  });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "StudentSkill", entityId: item.id, newValues: { studentId, ...data } as any });
  return item;
}

export async function updateStudentSkill(
  id: string, studentId: string, data: Partial<StudentSkillInput>, actorId: string
) {
  const item = await prisma.studentSkill.update({
    where: { id },
    data: { level: data.level, yearsExp: data.yearsExp ?? null },
    include: { skill: true },
  });
  await writeAuditLog({ userId: actorId, action: "UPDATE", entity: "StudentSkill", entityId: id, newValues: data as any });
  return item;
}

export async function removeStudentSkill(id: string, studentId: string, actorId: string) {
  // Verify ownership
  await prisma.studentSkill.findFirstOrThrow({ where: { id, studentId } });
  await prisma.studentSkill.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "StudentSkill", entityId: id });
}

export async function addCustomSkill(studentId: string, data: CustomSkillInput, actorId: string) {
  const item = await prisma.customSkill.create({
    data: { studentId, name: data.name, category: data.category, level: data.level, yearsExp: data.yearsExp ?? null },
  });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "CustomSkill", entityId: item.id, newValues: { studentId, ...data } as any });
  return item;
}

export async function updateCustomSkill(
  id: string, studentId: string, data: Partial<CustomSkillInput>, actorId: string
) {
  await prisma.customSkill.findFirstOrThrow({ where: { id, studentId } });
  const item = await prisma.customSkill.update({
    where: { id },
    data: { name: data.name, category: data.category, level: data.level, yearsExp: data.yearsExp ?? null },
  });
  await writeAuditLog({ userId: actorId, action: "UPDATE", entity: "CustomSkill", entityId: id, newValues: data as any });
  return item;
}

export async function removeCustomSkill(id: string, studentId: string, actorId: string) {
  await prisma.customSkill.findFirstOrThrow({ where: { id, studentId } });
  await prisma.customSkill.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "CustomSkill", entityId: id });
}
