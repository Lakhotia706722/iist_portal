import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import { getStorageAdapter } from "@/lib/storage";
import { notify, PlacementNotifications } from "@/lib/notifications";
import type { DocumentUploadInput, DocumentVerifyInput } from "@/lib/validations/profile";

export async function getDocuments(studentId: string) {
  const docs = await prisma.document.findMany({
    where: { studentId },
    orderBy: [{ type: "asc" }, { uploadedAt: "desc" }],
  });
  const storage = getStorageAdapter();
  return Promise.all(
    docs.map(async (d) => ({
      ...d,
      fileUrl: await storage.getSignedUrl(d.fileKey),
    }))
  );
}

export async function uploadDocument(
  studentId: string,
  data: DocumentUploadInput,
  fileKey: string,
  mimeType: string,
  sizeBytes: number,
  actorId: string,
) {
  const doc = await prisma.document.create({
    data: {
      studentId,
      type: data.type,
      name: data.name,
      fileKey,
      mimeType,
      sizeBytes,
      status: "PENDING",
    },
  });

  await writeAuditLog({
    userId: actorId,
    action: "CREATE",
    entity: "Document",
    entityId: doc.id,
    newValues: { studentId, type: data.type, name: data.name },
  });

  return doc;
}

export async function deleteDocument(id: string, studentId: string, actorId: string) {
  const doc = await prisma.document.findFirstOrThrow({ where: { id, studentId } });
  await getStorageAdapter().delete(doc.fileKey).catch(() => {});
  await prisma.document.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "Document", entityId: id });
}

/** Admin: verify, reject, or request re-upload */
export async function adminVerifyDocument(
  id: string,
  data: DocumentVerifyInput,
  actorId: string,
) {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id } });

  const updated = await prisma.document.update({
    where: { id },
    data: {
      status: data.action,
      adminNote: data.adminNote || null,
      verifiedAt: data.action === "VERIFIED" ? new Date() : null,
      verifiedBy: data.action === "VERIFIED" ? actorId : null,
    },
    include: {
      student: {
        select: {
          id: true,
          enrollmentNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await writeAuditLog({
    userId: actorId,
    action: "STATUS_CHANGE",
    entity: "Document",
    entityId: id,
    oldValues: { status: doc.status },
    newValues: { status: data.action, adminNote: data.adminNote },
  });

  // A rejection or re-upload request needs the student to act — tell them.
  if (data.action === "REJECTED" || data.action === "RE_UPLOAD_REQUESTED") {
    await PlacementNotifications.documentRequested(
      updated.studentId,
      updated.name,
      data.adminNote || "No reason given — contact the placement cell."
    );
  } else if (data.action === "VERIFIED") {
    await notify({
      studentId: updated.studentId,
      subject: `Document verified: ${updated.name}`,
      message: `Your document "${updated.name}" has been verified.`,
      channels: ["in_app"],
      priority: "low",
      category: "documents",
      entityType: "document",
      entityId: id,
      link: "/student/documents",
    });
  }

  return updated;
}

/** Admin: list all documents with optional filters */
export async function listDocuments(opts: {
  studentId?: string;
  status?: string;
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const { studentId, status, type, search, page = 1, pageSize = 20 } = opts;
  const where: any = {};
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { student: { enrollmentNumber: { contains: search, mode: "insensitive" } } },
      { student: { firstName: { contains: search, mode: "insensitive" } } },
      { student: { lastName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            enrollmentNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { uploadedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.document.count({ where }),
  ]);

  const storage = getStorageAdapter();
  const enriched = await Promise.all(
    items.map(async (d) => ({
      ...d,
      fileUrl: await storage.getSignedUrl(d.fileKey),
    }))
  );

  return { items: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
