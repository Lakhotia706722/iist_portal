import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import type { SocialProfileInput } from "@/lib/validations/profile";

export async function getSocialProfiles(studentId: string) {
  return prisma.socialProfile.findMany({
    where: { studentId },
    orderBy: { platform: "asc" },
  });
}

export async function upsertSocialProfile(studentId: string, data: SocialProfileInput, actorId: string) {
  const existing = await prisma.socialProfile.findUnique({
    where: { studentId_platform: { studentId, platform: data.platform } },
  });

  if (existing) {
    const item = await prisma.socialProfile.update({
      where: { id: existing.id },
      data: { url: data.url, username: data.username || null },
    });
    await writeAuditLog({
      userId: actorId, action: "UPDATE", entity: "SocialProfile",
      entityId: item.id, newValues: { studentId, ...data } as any,
    });
    return item;
  }

  const item = await prisma.socialProfile.create({
    data: { studentId, platform: data.platform, url: data.url, username: data.username || null },
  });
  await writeAuditLog({
    userId: actorId, action: "CREATE", entity: "SocialProfile",
    entityId: item.id, newValues: { studentId, ...data } as any,
  });
  return item;
}

export async function removeSocialProfile(id: string, studentId: string, actorId: string) {
  await prisma.socialProfile.findFirstOrThrow({ where: { id, studentId } });
  await prisma.socialProfile.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "SocialProfile", entityId: id });
}
