import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import { getStorageAdapter } from "@/lib/storage";
import type { AchievementInput } from "@/lib/validations/profile";

export async function getAchievements(studentId: string) {
  const items = await prisma.achievement.findMany({
    where: { studentId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  const storage = getStorageAdapter();
  return Promise.all(
    items.map(async (a) => ({
      ...a,
      certificateUrl: a.certificateKey ? await storage.getSignedUrl(a.certificateKey) : null,
    }))
  );
}

export async function createAchievement(
  studentId: string, data: AchievementInput, actorId: string, certificateKey?: string
) {
  const item = await prisma.achievement.create({
    data: {
      studentId,
      type: data.type,
      title: data.title,
      description: data.description || null,
      date: data.date ? new Date(data.date) : null,
      position: data.position || null,
      organizer: data.organizer || null,
      certificateKey: certificateKey ?? null,
    },
  });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "Achievement", entityId: item.id, newValues: { studentId, title: data.title } });
  return item;
}

export async function updateAchievement(
  id: string, studentId: string, data: Partial<AchievementInput>, actorId: string, certificateKey?: string
) {
  await prisma.achievement.findFirstOrThrow({ where: { id, studentId } });
  const item = await prisma.achievement.update({
    where: { id },
    data: {
      ...(data.type !== undefined && { type: data.type }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.date !== undefined && { date: data.date ? new Date(data.date) : null }),
      ...(data.position !== undefined && { position: data.position || null }),
      ...(data.organizer !== undefined && { organizer: data.organizer || null }),
      ...(certificateKey !== undefined && { certificateKey }),
    },
  });
  await writeAuditLog({ userId: actorId, action: "UPDATE", entity: "Achievement", entityId: id });
  return item;
}

export async function deleteAchievement(id: string, studentId: string, actorId: string) {
  const item = await prisma.achievement.findFirstOrThrow({ where: { id, studentId } });
  if (item.certificateKey) {
    await getStorageAdapter().delete(item.certificateKey).catch(() => {});
  }
  await prisma.achievement.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "Achievement", entityId: id });
}
