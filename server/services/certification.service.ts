import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import { getStorageAdapter } from "@/lib/storage";
import type { CertificationInput } from "@/lib/validations/profile";

export async function getCertifications(studentId: string) {
  const items = await prisma.certification.findMany({
    where: { studentId },
    orderBy: [{ issueDate: "desc" }],
  });
  const storage = getStorageAdapter();
  return Promise.all(
    items.map(async (c) => ({
      ...c,
      certificateUrl: c.certificateKey ? await storage.getSignedUrl(c.certificateKey) : null,
    }))
  );
}

export async function createCertification(
  studentId: string, data: CertificationInput, actorId: string, certificateKey?: string
) {
  const item = await prisma.certification.create({
    data: {
      studentId,
      name: data.name,
      issuingOrg: data.issuingOrg,
      issueDate: new Date(data.issueDate),
      expiryDate: data.doesNotExpire ? null : data.expiryDate ? new Date(data.expiryDate) : null,
      doesNotExpire: data.doesNotExpire,
      credentialId: data.credentialId || null,
      credentialUrl: data.credentialUrl || null,
      certificateKey: certificateKey ?? null,
    },
  });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "Certification", entityId: item.id, newValues: { studentId, name: data.name } });
  return item;
}

export async function updateCertification(
  id: string, studentId: string, data: Partial<CertificationInput>, actorId: string, certificateKey?: string
) {
  await prisma.certification.findFirstOrThrow({ where: { id, studentId } });
  const item = await prisma.certification.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.issuingOrg !== undefined && { issuingOrg: data.issuingOrg }),
      ...(data.issueDate !== undefined && { issueDate: new Date(data.issueDate) }),
      ...(data.doesNotExpire !== undefined && { doesNotExpire: data.doesNotExpire }),
      ...(data.expiryDate !== undefined && {
        expiryDate: data.doesNotExpire ? null : data.expiryDate ? new Date(data.expiryDate) : null,
      }),
      ...(data.credentialId !== undefined && { credentialId: data.credentialId || null }),
      ...(data.credentialUrl !== undefined && { credentialUrl: data.credentialUrl || null }),
      ...(certificateKey !== undefined && { certificateKey }),
    },
  });
  await writeAuditLog({ userId: actorId, action: "UPDATE", entity: "Certification", entityId: id });
  return item;
}

export async function deleteCertification(id: string, studentId: string, actorId: string) {
  const item = await prisma.certification.findFirstOrThrow({ where: { id, studentId } });
  if (item.certificateKey) {
    await getStorageAdapter().delete(item.certificateKey).catch(() => {});
  }
  await prisma.certification.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "Certification", entityId: id });
}
