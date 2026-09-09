export type AppRole = "STUDENT" | "TP_ADMIN" | "FACULTY" | "HOD" | "COMPANY_REP";

export type Permission =
  | "student:read:own" | "student:write:own" | "student:read:all" | "student:write:all" | "student:debar"
  | "department:read" | "department:write"
  | "course:read" | "course:write"
  | "branch:read" | "branch:write"
  | "batch:read" | "batch:write"
  | "user:read" | "user:write" | "user:create" | "user:delete"
  | "audit:read" | "report:read"
  // Phase 2: Career Profile
  | "profile:read:own" | "profile:write:own"
  | "profile:read:all"
  | "profile:visibility:write"
  | "video:verify"
  | "skill:read" | "skill:write"
  | "document:read:own" | "document:write:own"
  | "document:read:all" | "document:verify"
  | "resume:read:own" | "resume:write:own"
  | "resume:read:all"
  // Phase 3: Companies & Drives
  | "company:read" | "company:write"
  | "drive:read" | "drive:write"
  | "drive:publish"                    // publish / change status
  | "jobrole:read" | "jobrole:write"
  | "eligibility:read" | "eligibility:write"
  // Phase 3: Applications
  | "application:read:own" | "application:write:own"
  | "application:read:all" | "application:write:all"
  | "application:status:write"         // change application status
  // Phase 3: Rounds
  | "round:read" | "round:write"
  | "round:participant:write"
  // Phase 3: Shortlisting
  | "shortlist:read" | "shortlist:write"
  // Phase 3: Attendance
  | "attendance:read" | "attendance:write"
  // Phase 3: Offers
  | "offer:read" | "offer:read:all" | "offer:write"
  // Phase 3: Misc
  | "skillup:read" | "skillup:read:all" | "skillup:write"
  | "interview:read" | "interview:read:all" | "interview:write"
  // Phase 4
  | "notification:read:own" | "notification:write:own"
  | "notification:template:read" | "notification:template:write"
  | "calendar:read" | "calendar:write"
  // Phase 5: Policy engine
  | "policy:read" | "policy:write"
  // Phase 5: Compliance
  | "compliance:read:own" | "compliance:read:all" | "compliance:write"
  | "incident:read" | "incident:write"
  // Phase 5: AI (self-service, always scoped to the caller's own data)
  | "ai:use"
  // Phase 5: Analytics, reports, search, audit
  | "analytics:read"
  | "search:read"
  // Phase 7: Company Rep portal — deliberately distinct from offer:read /
  // application:read:all (which mean "unrestricted") so a company-rep grant
  // can never accidentally inherit cross-company visibility.
  | "company:read:own" | "drive:read:own"
  | "application:read:company" | "offer:read:company";

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  STUDENT: [
    "student:read:own", "student:write:own",
    "department:read", "course:read", "branch:read", "batch:read",
    "profile:read:own", "profile:write:own",
    "skill:read",
    "document:read:own", "document:write:own",
    "resume:read:own", "resume:write:own",
    // Phase 3
    "company:read", "drive:read", "jobrole:read", "eligibility:read",
    "application:read:own", "application:write:own",
    "offer:read",
    // Students read their own SkillUp/interview records; staff record them.
    "skillup:read", "interview:read",
    "notification:read:own", "notification:write:own",
    "calendar:read",
    "compliance:read:own", "ai:use",
  ],
  FACULTY: [
    "student:read:all",
    "department:read", "course:read", "branch:read", "batch:read",
    "profile:read:all", "skill:read", "document:read:all", "resume:read:all",
    // Phase 3
    "company:read", "drive:read", "jobrole:read", "eligibility:read",
    "application:read:all",
    "round:read", "attendance:read", "shortlist:read",
    "offer:read", "offer:read:all", "report:read",
    "skillup:read", "skillup:read:all", "skillup:write",
    "interview:read", "interview:read:all", "interview:write",
    "notification:read:own", "notification:write:own",
    "calendar:read", "calendar:write",
    "compliance:read:all", "incident:read",
    "analytics:read", "search:read",
  ],
  HOD: [
    "student:read:all", "student:write:all",
    "department:read", "course:read", "branch:read", "batch:read",
    "profile:read:all", "skill:read", "document:read:all", "resume:read:all",
    "audit:read", "report:read",
    // Phase 3
    "company:read", "drive:read", "drive:write", "drive:publish",
    "jobrole:read", "jobrole:write", "eligibility:read", "eligibility:write",
    "application:read:all", "application:write:all", "application:status:write",
    "round:read", "round:write", "round:participant:write",
    "shortlist:read", "shortlist:write",
    "attendance:read", "attendance:write",
    "offer:read", "offer:read:all", "offer:write",
    "skillup:read", "skillup:read:all", "skillup:write",
    "interview:read", "interview:read:all", "interview:write",
    "notification:read:own", "notification:write:own",
    "calendar:read", "calendar:write",
    "compliance:read:all", "incident:read", "incident:write",
    "analytics:read", "search:read",
  ],
  TP_ADMIN: [
    "student:read:all", "student:write:all", "student:debar",
    "department:read", "department:write", "course:read", "course:write",
    "branch:read", "branch:write", "batch:read", "batch:write",
    "user:read", "user:write", "user:create", "user:delete",
    "audit:read", "report:read",
    "profile:read:all", "profile:visibility:write",
    "skill:read", "skill:write",
    "video:verify",
    "document:read:all", "document:verify",
    "resume:read:all",
    // Phase 3 — full access
    "company:read", "company:write",
    "drive:read", "drive:write", "drive:publish",
    "jobrole:read", "jobrole:write",
    "eligibility:read", "eligibility:write",
    "application:read:all", "application:write:all", "application:status:write",
    "round:read", "round:write", "round:participant:write",
    "shortlist:read", "shortlist:write",
    "attendance:read", "attendance:write",
    "offer:read", "offer:read:all", "offer:write",
    "skillup:read", "skillup:read:all", "skillup:write",
    "interview:read", "interview:read:all", "interview:write",
    "notification:read:own", "notification:write:own",
    "notification:template:read", "notification:template:write",
    "calendar:read", "calendar:write",
    "policy:read", "policy:write",
    "compliance:read:all", "compliance:write",
    "incident:read", "incident:write",
    "analytics:read", "search:read",
  ],
  // Phase 7: deliberately does NOT hold company:read / drive:read /
  // jobrole:read / application:read:all / shortlist:read — those are the
  // *unrestricted* variants used by admin-facing routes, and a company rep
  // holding them was the exact cross-company leak this phase closes (see
  // ARCHITECTURE.md). Everything a company rep needs is served through
  // /api/company/* routes gated on the :own / :company variants below, each
  // of which resolves the caller's companyId server-side from their own
  // CompanyRepProfile — never from a client-supplied value.
  COMPANY_REP: [
    "company:read:own", "drive:read:own",
    "application:read:company",
    "offer:read:company", "offer:write",
    "notification:read:own", "notification:write:own",
    "calendar:read",
  ],
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

export function checkPermission(role: string, permission: Permission): boolean {
  return hasPermission(role, permission);
}
