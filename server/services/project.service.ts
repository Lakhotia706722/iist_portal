import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "./audit.service";
import { getStorageAdapter } from "@/lib/storage";
import type { ProjectInput } from "@/lib/validations/profile";

export async function getProjects(studentId: string) {
  const projects = await prisma.project.findMany({
    where: { studentId },
    orderBy: [{ isOngoing: "desc" }, { startDate: "desc" }, { createdAt: "desc" }],
  });
  const storage = getStorageAdapter();
  return Promise.all(
    projects.map(async (p) => ({
      ...p,
      imageUrl: p.imageKey ? await storage.getSignedUrl(p.imageKey) : null,
    }))
  );
}

export async function createProject(studentId: string, data: ProjectInput, actorId: string, imageKey?: string) {
  const project = await prisma.project.create({
    data: {
      studentId,
      title: data.title,
      description: data.description,
      techStack: data.techStack,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.isOngoing ? null : data.endDate ? new Date(data.endDate) : null,
      isOngoing: data.isOngoing,
      githubUrl: data.githubUrl || null,
      liveUrl: data.liveUrl || null,
      imageKey: imageKey ?? null,
    },
  });
  await writeAuditLog({ userId: actorId, action: "CREATE", entity: "Project", entityId: project.id, newValues: { studentId, title: data.title } });
  return project;
}

export async function updateProject(
  id: string, studentId: string, data: Partial<ProjectInput>, actorId: string, imageKey?: string
) {
  await prisma.project.findFirstOrThrow({ where: { id, studentId } });
  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.techStack !== undefined && { techStack: data.techStack }),
      ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
      ...(data.endDate !== undefined && { endDate: data.isOngoing ? null : data.endDate ? new Date(data.endDate) : null }),
      ...(data.isOngoing !== undefined && { isOngoing: data.isOngoing }),
      ...(data.githubUrl !== undefined && { githubUrl: data.githubUrl || null }),
      ...(data.liveUrl !== undefined && { liveUrl: data.liveUrl || null }),
      ...(imageKey !== undefined && { imageKey }),
    },
  });
  await writeAuditLog({ userId: actorId, action: "UPDATE", entity: "Project", entityId: id });
  return project;
}

export async function deleteProject(id: string, studentId: string, actorId: string) {
  const project = await prisma.project.findFirstOrThrow({ where: { id, studentId } });
  if (project.imageKey) {
    await getStorageAdapter().delete(project.imageKey).catch(() => {});
  }
  await prisma.project.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: "DELETE", entity: "Project", entityId: id });
}
