/**
 * Notification read-model + email template admin — Phase 4
 *
 * Delivery lives in lib/notifications; this service is the per-user inbox and
 * the admin-editable template store.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { writeAuditLog, type AuditParams } from "./audit.service";
import { EMAIL_TEMPLATES, getBuiltInTemplate } from "@/lib/email/templates";

type RequestMeta = Pick<AuditParams, "ipAddress" | "userAgent">;

// ─── Per-user inbox ───────────────────────────────────────────────────────────

export async function listNotifications(
  userId: string,
  opts: { unreadOnly?: boolean; limit?: number; cursor?: string } = {}
) {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(opts.unreadOnly ? { readAt: null } : {}),
  };

  const [items, unreadCount, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 20,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return {
    notifications: items,
    unreadCount,
    total,
    nextCursor: items.length === (opts.limit ?? 20) ? items[items.length - 1].id : null,
  };
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Scoped by userId so a viewer can only ever mark their own as read. */
export async function markAsRead(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
  if (result.count === 0) throw new NotFoundError("Notification not found");
  return { updated: result.count };
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

// ─── Email templates (admin CRUD) ─────────────────────────────────────────────

/**
 * Built-in defaults merged with any DB overrides, so the admin UI always shows
 * the full set of templates the system can send.
 */
export async function listEmailTemplates() {
  const overrides = await prisma.emailTemplate.findMany();
  const byKey = new Map(overrides.map((t) => [t.key, t]));

  const merged = EMAIL_TEMPLATES.map((builtIn) => {
    const override = byKey.get(builtIn.key);
    return {
      key: builtIn.key,
      name: override?.name ?? builtIn.name,
      description: override?.description ?? builtIn.description,
      subject: override?.subject ?? builtIn.subject,
      bodyHtml: override?.bodyHtml ?? builtIn.bodyHtml,
      bodyText: override?.bodyText ?? null,
      variables: builtIn.variables,
      isActive: override?.isActive ?? true,
      isCustomised: !!override,
      id: override?.id ?? null,
      updatedAt: override?.updatedAt ?? null,
    };
  });

  // Templates created by an admin that aren't built in.
  for (const o of overrides) {
    if (!EMAIL_TEMPLATES.some((b) => b.key === o.key)) {
      merged.push({
        key: o.key,
        name: o.name,
        description: o.description ?? "",
        subject: o.subject,
        bodyHtml: o.bodyHtml,
        bodyText: o.bodyText,
        variables: o.variables,
        isActive: o.isActive,
        isCustomised: true,
        id: o.id,
        updatedAt: o.updatedAt,
      });
    }
  }

  return merged;
}

export async function upsertEmailTemplate(
  key: string,
  data: {
    name: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string | null;
    description?: string | null;
    variables?: string[];
    isActive?: boolean;
  },
  updatedById: string,
  meta: RequestMeta = {}
) {
  const builtIn = getBuiltInTemplate(key);
  const before = await prisma.emailTemplate.findUnique({ where: { key } });

  const template = await prisma.emailTemplate.upsert({
    where: { key },
    update: {
      name: data.name,
      subject: data.subject,
      bodyHtml: data.bodyHtml,
      bodyText: data.bodyText ?? null,
      description: data.description ?? null,
      ...(data.variables ? { variables: data.variables } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      updatedById,
    },
    create: {
      key,
      name: data.name,
      subject: data.subject,
      bodyHtml: data.bodyHtml,
      bodyText: data.bodyText ?? null,
      description: data.description ?? null,
      variables: data.variables ?? builtIn?.variables ?? [],
      isActive: data.isActive ?? true,
      updatedById,
    },
  });

  await writeAuditLog({
    userId: updatedById,
    action: before ? "UPDATE" : "CREATE",
    entity: "EmailTemplate",
    entityId: template.id,
    oldValues: before ? { subject: before.subject, isActive: before.isActive } : undefined,
    newValues: { key, subject: template.subject, isActive: template.isActive },
    ...meta,
  });

  return template;
}

/** Revert a customised template back to the built-in default. */
export async function resetEmailTemplate(
  key: string,
  updatedById: string,
  meta: RequestMeta = {}
) {
  if (!getBuiltInTemplate(key)) {
    throw new ConflictError("This template has no built-in default to reset to");
  }
  const existing = await prisma.emailTemplate.findUnique({ where: { key } });
  if (!existing) throw new NotFoundError("Template is already at its default");

  await prisma.emailTemplate.delete({ where: { key } });

  await writeAuditLog({
    userId: updatedById,
    action: "DELETE",
    entity: "EmailTemplate",
    entityId: existing.id,
    oldValues: { key, subject: existing.subject },
    metadata: { reason: "reset to built-in default" },
    ...meta,
  });

  return { reset: true };
}
