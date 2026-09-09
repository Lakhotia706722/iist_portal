/**
 * Audit Log Viewer — Phase 5 (read-only)
 * The AuditLog table has been written correctly since Phase 1; this is the
 * first UI to search/filter it.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listAuditLogs(filters: AuditLogFilters = {}) {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.action ? { action: filters.action as any } : {}),
    ...(filters.entity ? { entity: filters.entity } : {}),
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { entity: { contains: filters.search, mode: "insensitive" } },
            { entityId: { contains: filters.search, mode: "insensitive" } },
            { user: { name: { contains: filters.search, mode: "insensitive" } } },
            { user: { email: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [logs, total, entities, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);

  return {
    logs,
    total,
    entities: entities.map((e) => e.entity),
    actions: actions.map((a) => a.action),
  };
}

export async function getAuditLogById(id: string) {
  return prisma.auditLog.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
}
