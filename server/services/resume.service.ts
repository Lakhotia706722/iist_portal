import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import { getStorageAdapter } from "@/lib/storage";
import type { ResumeInput } from "@/lib/validations/profile";

// ─── Resume CRUD ──────────────────────────────────────────────────────────────

export async function getResumes(studentId: string) {
  return prisma.resume.findMany({
    where: { studentId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1, // latest version only in list view
      },
      _count: { select: { versions: true } },
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createResume(studentId: string, data: ResumeInput, actorId: string) {
  // If first resume or isDefault requested, clear other defaults
  if (data.isDefault) {
    await prisma.resume.updateMany({ where: { studentId }, data: { isDefault: false } });
  }
  const resume = await prisma.resume.create({ data: { studentId, name: data.name, isDefault: data.isDefault } });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "Resume", entityId: resume.id, newValues: { studentId, name: data.name } });
  return resume;
}

export async function updateResume(
  id: string, studentId: string, data: Partial<ResumeInput>, actorId: string
) {
  await prisma.resume.findFirstOrThrow({ where: { id, studentId } });
  if (data.isDefault) {
    await prisma.resume.updateMany({ where: { studentId }, data: { isDefault: false } });
  }
  const resume = await prisma.resume.update({ where: { id }, data });
  await writeAuditLog({ userId: actorId, action: "UPDATE", entity: "Resume", entityId: id });
  return resume;
}

export async function deleteResume(id: string, studentId: string, actorId: string) {
  const resume = await prisma.resume.findFirstOrThrow({ where: { id, studentId }, include: { versions: true } });
  // Delete all stored files for versions
  const storage = getStorageAdapter();
  await Promise.all(
    resume.versions
      .filter((v) => v.fileKey)
      .map((v) => storage.delete(v.fileKey!).catch(() => {}))
  );
  await prisma.resume.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "Resume", entityId: id });
}

// ─── Resume Versions ──────────────────────────────────────────────────────────

export async function getResumeVersions(resumeId: string, studentId: string) {
  // Verify ownership
  await prisma.resume.findFirstOrThrow({ where: { id: resumeId, studentId } });
  const versions = await prisma.resumeVersion.findMany({
    where: { resumeId },
    orderBy: { version: "desc" },
  });
  const storage = getStorageAdapter();
  return Promise.all(
    versions.map(async (v) => ({
      ...v,
      fileUrl: v.fileKey ? await storage.getSignedUrl(v.fileKey) : null,
    }))
  );
}

/** Create a new version by uploading a PDF file */
export async function addResumeVersionFromUpload(
  resumeId: string,
  studentId: string,
  fileKey: string,
  notes: string | undefined,
  actorId: string,
) {
  await prisma.resume.findFirstOrThrow({ where: { id: resumeId, studentId } });
  const nextVersion = await getNextVersionNumber(resumeId);
  const version = await prisma.resumeVersion.create({
    data: { resumeId, version: nextVersion, fileKey, isGenerated: false, notes: notes || null },
  });
  // Bump parent resume updatedAt
  await prisma.resume.update({ where: { id: resumeId }, data: { updatedAt: new Date() } });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "ResumeVersion", entityId: version.id, newValues: { resumeId, version: nextVersion } });
  return version;
}

/** Create a new version generated from profile snapshot */
export async function addResumeVersionFromProfile(
  resumeId: string,
  studentId: string,
  notes: string | undefined,
  actorId: string,
) {
  await prisma.resume.findFirstOrThrow({ where: { id: resumeId, studentId } });
  const snapshot = await buildProfileSnapshot(studentId);
  const nextVersion = await getNextVersionNumber(resumeId);
  const version = await prisma.resumeVersion.create({
    data: { resumeId, version: nextVersion, isGenerated: true, snapshot, notes: notes || null },
  });
  await prisma.resume.update({ where: { id: resumeId }, data: { updatedAt: new Date() } });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "ResumeVersion", entityId: version.id, newValues: { resumeId, version: nextVersion, generated: true } });
  return version;
}

async function getNextVersionNumber(resumeId: string): Promise<number> {
  const latest = await prisma.resumeVersion.findFirst({
    where: { resumeId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

/** Build a JSON snapshot of the student's career profile for generated resumes */
async function buildProfileSnapshot(studentId: string) {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      user: { select: { email: true, name: true } },
      branch: { include: { department: true, course: true } },
      batch: true,
      academicRecord: { include: { sgpaRecords: { orderBy: { semester: "asc" } } } },
      studentSkills: { include: { skill: true } },
      customSkills: true,
      projects: true,
      internships: true,
      certifications: true,
      achievements: true,
      socialProfiles: true,
    },
  });
  return student as any;
}
