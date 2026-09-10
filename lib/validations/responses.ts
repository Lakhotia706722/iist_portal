/**
 * API *response* schemas — Phase 10.
 *
 * Companion to the request-validation schemas elsewhere in lib/validations/:
 * those validate what the client sends the server; these validate what the
 * server sends back, at the exact call sites Phase 9 found broken (plus new
 * Phase 10 code). See lib/api-client.ts's fetchJson() and ARCHITECTURE.md's
 * "Runtime-validated API responses" section for the policy this implements.
 *
 * Deliberately not full 1:1 mirrors of every service-layer TS type — just
 * the fields the consuming component actually reads. A schema that's
 * stricter than what a component needs just creates false-positive
 * breakage the next time the backend adds an unrelated field.
 */

import { z } from "zod";

// ─── GET /api/student/resumes ──────────────────────────────────────────────
// Consumed by application-flow.tsx, resume-center-client.tsx,
// ai-resume-builder-client.tsx. A bare array — not { resumes: [...] } — see
// the comment in application-flow.tsx for why that distinction mattered.

export const resumeListResponseSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    isDefault: z.boolean(),
    updatedAt: z.string(),
    versions: z.array(
      z.object({
        id: z.string(),
        fileKey: z.string().nullable(),
        createdAt: z.string(),
      })
    ),
  })
);

// ─── GET /api/student/opportunities/[id] ───────────────────────────────────

export const opportunityDetailResponseSchema = z.object({
  opportunity: z.object({
    id: z.string(),
    title: z.string(),
    company: z.object({
      name: z.string(),
      industry: z.string(),
      logoKey: z.string().nullable().optional(),
    }),
    contactInfo: z.object({
      name: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      designation: z.string().nullable(),
    }),
    jobRoles: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        eligibilityRules: z.array(z.unknown()),
      })
    ),
  }),
  eligibility: z.record(z.string(), z.unknown()),
});

// ─── GET /api/admin/drives/[id]/shortlist ──────────────────────────────────

export const shortlistApplicantsResponseSchema = z.object({
  applications: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      appliedAt: z.string(),
      student: z.object({
        id: z.string(),
        enrollmentNumber: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        batch: z.object({
          academicYear: z.string(),
          branch: z.object({ code: z.string(), name: z.string() }),
        }),
        academicRecord: z.object({ currentCgpa: z.number().nullable() }).nullable(),
      }),
      jobRole: z.object({ id: z.string(), title: z.string() }),
      resumeVersion: z
        .object({ fileKey: z.string().nullable(), fileUrl: z.string().nullable() })
        .nullable(),
    })
  ),
  pagination: z.object({ total: z.number() }),
});

// ─── GET/POST /api/admin/drives/[id]/rounds ────────────────────────────────

const roundResponseSchema = z.object({
  id: z.string(),
  roundNumber: z.number(),
  title: z.string(),
  type: z.string(),
  mode: z.string(),
  durationMins: z.number().nullable(),
});

export const roundListResponseSchema = z.object({
  rounds: z.array(roundResponseSchema),
});

export const roundCreateResponseSchema = z.object({
  message: z.string(),
  round: roundResponseSchema,
});

// ─── GET /api/admin/rounds/[id]/participants (default, no ?action) ────────
// The round's current participants — drive-rounds.tsx's own inline
// "Attendance & Results" panel. Had no route handler at all before Phase
// 10; the round.service.ts query it now calls also had its own separate,
// real bug (an invalid Prisma select), found only once this became
// reachable for the first time.

export const roundParticipantsResponseSchema = z.object({
  participants: z.array(
    z.object({
      id: z.string(),
      result: z.string().nullable(),
      remarks: z.string().nullable(),
      application: z.object({
        student: z.object({
          enrollmentNumber: z.string(),
          firstName: z.string().nullable(),
          lastName: z.string().nullable(),
        }),
      }),
      attendance: z.object({ status: z.string() }).nullable(),
    })
  ),
});

// ─── GET /api/admin/rounds/[id]/participants?action=eligible ──────────────
// New in Phase 10 — the round-participant picker this phase adds.

export const roundEligibleApplicationsResponseSchema = z.object({
  applications: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      student: z.object({
        id: z.string(),
        enrollmentNumber: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        batch: z.object({ branch: z.object({ code: z.string() }) }),
      }),
      jobRole: z.object({ title: z.string() }),
    })
  ),
});

// ─── GET /api/admin/applications ───────────────────────────────────────────
// Phase 12 — cross-drive applications list (Admin + Faculty top-level pages).

export const allApplicationsResponseSchema = z.object({
  applications: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      appliedAt: z.string(),
      student: z.object({
        id: z.string(),
        enrollmentNumber: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        batch: z.object({
          academicYear: z.string(),
          branch: z.object({ code: z.string(), name: z.string() }),
        }),
        academicRecord: z.object({ currentCgpa: z.number().nullable() }).nullable(),
      }),
      jobRole: z.object({
        id: z.string(),
        title: z.string(),
        drive: z.object({ id: z.string(), title: z.string(), company: z.object({ name: z.string() }) }),
      }),
    })
  ),
  pagination: z.object({ total: z.number() }),
});

// ─── GET /api/admin/drives (read-only consumers: Faculty drives list) ─────
// Phase 12.

export const drivesListResponseSchema = z.object({
  drives: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      academicYear: z.string(),
      status: z.string(),
      company: z.object({ name: z.string() }),
      _count: z.object({ jobRoles: z.number(), applications: z.number() }),
    })
  ),
  pagination: z.object({ total: z.number() }),
});

// ─── GET /api/admin/attendance ─────────────────────────────────────────────
// Phase 12 — cross-drive rounds/attendance overview (Admin + Faculty).

export const attendanceOverviewResponseSchema = z.object({
  rounds: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
      scheduledAt: z.string().nullable(),
      isCompleted: z.boolean(),
      drive: z.object({ id: z.string(), title: z.string(), company: z.object({ name: z.string() }) }),
      participantCount: z.number(),
      markedCount: z.number(),
      presentCount: z.number(),
    })
  ),
  pagination: z.object({ total: z.number() }),
});

// ─── GET /api/admin/rounds ──────────────────────────────────────────────────
// Phase 12 — cross-drive rounds overview (Admin-only).

export const roundsOverviewResponseSchema = z.object({
  rounds: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
      mode: z.string(),
      scheduledAt: z.string().nullable(),
      venue: z.string().nullable(),
      isCompleted: z.boolean(),
      drive: z.object({ id: z.string(), title: z.string(), company: z.object({ name: z.string() }) }),
      participantCount: z.number(),
    })
  ),
  pagination: z.object({ total: z.number() }),
});

// ─── GET /api/hod/applications ─────────────────────────────────────────────
// Phase 12.

export const hodApplicationsResponseSchema = z.object({
  applications: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      appliedAt: z.string(),
      student: z.object({
        id: z.string(),
        enrollmentNumber: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        batch: z.object({
          academicYear: z.string(),
          branch: z.object({ code: z.string(), name: z.string() }),
        }),
        academicRecord: z.object({ currentCgpa: z.number().nullable() }).nullable(),
      }),
      jobRole: z.object({
        id: z.string(),
        title: z.string(),
        drive: z.object({ id: z.string(), title: z.string(), company: z.object({ name: z.string() }) }),
      }),
    })
  ),
  pagination: z.object({ total: z.number() }),
});

// ─── GET /api/hod/offers ────────────────────────────────────────────────────
// Phase 12.

export const hodOffersResponseSchema = z.object({
  offers: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      ctc: z.number().nullable(),
      stipend: z.number().nullable(),
      offerDate: z.string(),
      student: z.object({
        id: z.string(),
        enrollmentNumber: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        batch: z.object({ branch: z.object({ code: z.string() }) }),
      }),
      company: z.object({ name: z.string() }),
      jobRole: z.object({ title: z.string() }),
    })
  ),
  pagination: z.object({ total: z.number() }),
});
