export type AppRole = "STUDENT" | "TP_ADMIN" | "FACULTY" | "HOD" | "COMPANY_REP";

export type Permission =
  | "student:read:own" | "student:write:own" | "student:read:all" | "student:write:all" | "student:debar"
  | "department:read" | "department:write"
  | "course:read" | "course:write"
  | "branch:read" | "branch:write"
  | "batch:read" | "batch:write"
  | "user:read" | "user:write" | "user:create" | "user:delete"
  | "audit:read" | "report:read"
  | "company:read" | "company:write"
  | "drive:read" | "drive:write"
  | "application:read:own" | "application:write:own" | "application:read:all" | "application:write:all"
  | "offer:read" | "offer:write"
  | "skillup:read" | "skillup:write"
  | "interview:read" | "interview:write"
  // Phase 2: Career Profile
  | "profile:read:own" | "profile:write:own"
  | "profile:read:all"         // admin / faculty / hod can view all profiles
  | "profile:visibility:write" // admin can toggle per-section visibility
  | "video:verify"             // admin can verify/reject video profiles
  // Phase 2: Skills catalog
  | "skill:read" | "skill:write"
  // Phase 2: Documents
  | "document:read:own" | "document:write:own"
  | "document:read:all" | "document:verify"
  // Phase 2: Resumes
  | "resume:read:own" | "resume:write:own"
  | "resume:read:all";

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  STUDENT: [
    "student:read:own", "student:write:own", "department:read", "course:read",
    "branch:read", "batch:read", "company:read", "drive:read",
    "application:read:own", "application:write:own", "offer:read",
    "skillup:read", "interview:read", "interview:write",
    // Phase 2
    "profile:read:own", "profile:write:own",
    "skill:read",
    "document:read:own", "document:write:own",
    "resume:read:own", "resume:write:own",
  ],
  FACULTY: [
    "student:read:all", "department:read", "course:read", "branch:read",
    "batch:read", "drive:read", "application:read:all", "offer:read",
    "report:read", "skillup:read", "interview:read",
    // Phase 2
    "profile:read:all", "skill:read", "document:read:all", "resume:read:all",
  ],
  HOD: [
    "student:read:all", "student:write:all", "department:read", "course:read",
    "branch:read", "batch:read", "company:read", "drive:read", "drive:write",
    "application:read:all", "application:write:all", "offer:read", "offer:write",
    "report:read", "audit:read", "skillup:read", "skillup:write", "interview:read",
    // Phase 2
    "profile:read:all", "skill:read", "document:read:all", "resume:read:all",
  ],
  TP_ADMIN: [
    "student:read:all", "student:write:all", "student:debar",
    "department:read", "department:write", "course:read", "course:write",
    "branch:read", "branch:write", "batch:read", "batch:write",
    "user:read", "user:write", "user:create", "user:delete",
    "audit:read", "report:read", "company:read", "company:write",
    "drive:read", "drive:write", "application:read:all", "application:write:all",
    "offer:read", "offer:write", "skillup:read", "skillup:write",
    "interview:read", "interview:write",
    // Phase 2
    "profile:read:all", "profile:visibility:write",
    "skill:read", "skill:write",
    "video:verify",
    "document:read:all", "document:verify",
    "resume:read:all",
  ],
  COMPANY_REP: ["company:read", "drive:read", "application:read:all", "offer:read", "offer:write"],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role as AppRole]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function getRolePermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as AppRole] ?? [];
}
