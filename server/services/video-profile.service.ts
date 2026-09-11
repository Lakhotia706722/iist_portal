import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import { getStorageAdapter } from "@/lib/storage";
import type { VideoProfileInput, VideoVerifyInput } from "@/lib/validations/profile";

export async function getVideoProfile(studentId: string) {
  const vp = await prisma.videoProfile.findUnique({ where: { studentId } });
  if (!vp) return null;
  const storage = getStorageAdapter();
  return {
    ...vp,
    videoFileUrl: vp.videoKey ? await storage.getSignedUrl(vp.videoKey) : null,
  };
}

/** Student submits a URL or an already-uploaded file key */
export async function upsertVideoProfile(
  studentId: string,
  data: VideoProfileInput,
  actorId: string,
  videoKey?: string,
) {
  const existing = await prisma.videoProfile.findUnique({ where: { studentId } });

  // If replacing a stored file, delete the old one
  if (existing?.videoKey && (videoKey || data.videoUrl)) {
    await getStorageAdapter().delete(existing.videoKey).catch(() => {});
  }

  const payload = {
    videoKey: videoKey ?? (data.videoUrl ? null : existing?.videoKey ?? null),
    videoUrl: data.videoUrl || null,
    status: "PENDING_VERIFICATION" as const,
    adminNote: null,
    verifiedAt: null,
    verifiedBy: null,
  };

  const vp = existing
    ? await prisma.videoProfile.update({ where: { studentId }, data: payload })
    : await prisma.videoProfile.create({ data: { studentId, ...payload } });

  await writeAuditLog({
    userId: actorId,
    action: existing ? "UPDATE" : "CREATE",
    entity: "VideoProfile",
    entityId: vp.id,
    newValues: { studentId, status: "PENDING_VERIFICATION" },
  });

  return vp;
}

/** Admin verifies or rejects a video profile */
export async function adminVerifyVideoProfile(
  studentId: string,
  data: VideoVerifyInput,
  actorId: string,
) {
  const vp = await prisma.videoProfile.findUniqueOrThrow({ where: { studentId } });

  const updated = await prisma.videoProfile.update({
    where: { studentId },
    data: {
      status: data.action,
      adminNote: data.adminNote || null,
      verifiedAt: data.action === "VERIFIED" ? new Date() : null,
      verifiedBy: data.action === "VERIFIED" ? actorId : null,
    },
  });

  await writeAuditLog({
    userId: actorId,
    action: "STATUS_CHANGE",
    entity: "VideoProfile",
    entityId: vp.id,
    oldValues: { status: vp.status },
    newValues: { status: data.action, adminNote: data.adminNote },
  });

  return updated;
}

/** List all video profiles pending admin verification */
export async function listPendingVideoProfiles(opts: {
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  const { page = 1, pageSize = 20, status } = opts;
  const where = {
    status: status
      ? (status as any)
      : { in: ["PENDING_VERIFICATION", "REJECTED"] as any[] },
  };
  const [items, total] = await Promise.all([
    prisma.videoProfile.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            enrollmentNumber: true,
            firstName: true,
            lastName: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { updatedAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.videoProfile.count({ where }),
  ]);

  const storage = getStorageAdapter();
  const enriched = await Promise.all(
    items.map(async (vp) => ({
      ...vp,
      videoFileUrl: vp.videoKey ? await storage.getSignedUrl(vp.videoKey) : null,
    }))
  );

  return { items: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
