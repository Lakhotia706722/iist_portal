/**
 * User & Role management — Phase 12
 *
 * Backs the "Users & Roles" nav page, which had zero backend before this
 * phase (`app/api/admin/users` was an empty directory). Staff accounts only
 * (TP_ADMIN / FACULTY / HOD / COMPANY_REP) — see the comment on
 * createUserSchema in lib/validations/admin.ts for why STUDENT is excluded.
 *
 * New accounts get a random temporary password and `mustChangePassword:
 * true` — the same mechanism the app's forced-change middleware guard
 * already enforces (middleware.ts redirects to /settings/change-password
 * until that flag clears), so this reuses an existing enforced flow rather
 * than inventing an invite-email system.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { writeAuditLog } from "./audit.service";
import type { CreateUserInput, UpdateUserInput } from "@/lib/validations/admin";

export interface UserListFilters {
  search?: string;
  role?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export async function listUsers(filters: UserListFilters = {}) {
  const where: any = {};
  if (filters.role) where.role = filters.role;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true, isActive: true,
        mustChangePassword: true, lastLoginAt: true, createdAt: true,
        facultyProfile: { select: { employeeId: true, designation: true, department: { select: { name: true } } } },
        hodProfile: { select: { employeeId: true, department: { select: { name: true } } } },
        companyRepProfile: { select: { companyName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: filters.offset ?? 0,
      take: filters.limit ?? 50,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

/** Generates a random 12-character temporary password (upper/lower/digit). */
function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "x") + "A1!";
}

export async function createStaffUser(data: CreateUserInput, actorId: string) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ValidationError("A user with this email already exists");

  if (data.role === "HOD" && data.departmentId) {
    const existingHod = await prisma.hodProfile.findUnique({ where: { departmentId: data.departmentId } });
    if (existingHod) throw new ValidationError("This department already has a HOD assigned");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      passwordHash,
      mustChangePassword: true,
      ...(data.role === "FACULTY" && {
        facultyProfile: {
          create: { employeeId: data.employeeId!, designation: data.designation!, departmentId: data.departmentId! },
        },
      }),
      ...(data.role === "HOD" && {
        hodProfile: { create: { employeeId: data.employeeId!, departmentId: data.departmentId! } },
      }),
      ...(data.role === "COMPANY_REP" && {
        companyRepProfile: { create: { companyName: data.designation || data.name, companyId: data.companyId || null } },
      }),
    },
    select: { id: true, name: true, email: true, role: true },
  });

  await writeAuditLog({
    userId: actorId,
    action: "CREATE",
    entity: "User",
    entityId: user.id,
    newValues: { name: user.name, email: user.email, role: user.role },
  });

  return { user, tempPassword };
}

export async function updateUser(id: string, data: UpdateUserInput, actorId: string) {
  const old = await prisma.user.findUnique({ where: { id } });
  if (!old) throw new NotFoundError("User not found");

  const user = await prisma.user.update({ where: { id }, data });

  await writeAuditLog({
    userId: actorId,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    oldValues: { name: old.name, isActive: old.isActive },
    newValues: data as any,
  });

  return user;
}

export async function setUserActive(id: string, isActive: boolean, actorId: string) {
  const old = await prisma.user.findUnique({ where: { id }, select: { isActive: true, role: true } });
  if (!old) throw new NotFoundError("User not found");
  if (old.role === "TP_ADMIN" && !isActive) {
    const activeAdmins = await prisma.user.count({ where: { role: "TP_ADMIN", isActive: true } });
    if (activeAdmins <= 1) throw new ValidationError("Cannot deactivate the last active T&P Admin account");
  }

  const user = await prisma.user.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    userId: actorId,
    action: "STATUS_CHANGE",
    entity: "User",
    entityId: id,
    oldValues: { isActive: old.isActive },
    newValues: { isActive },
  });
  return user;
}
