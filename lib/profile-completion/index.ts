import { prisma } from "@/lib/prisma";
import { getPolicyValue } from "@/server/services/policy.service";

// ─── Section structure ─────────────────────────────────────────────────────────
// Section identity (key/label/group) is structural — it corresponds to actual
// profile fields evaluated below and doesn't belong in policy. The *weight*
// each section is worth is policy-driven (Phase 5): see the
// "profile_completion_weights" key in lib/policy/keys.ts. Falls back to these
// defaults when no policy override is configured or it fails to parse.

export const SECTION_META = [
  { key: "personal_info",    label: "Personal Information",     group: "Core" },
  { key: "academic_info",    label: "Academic Details & SGPA",  group: "Core" },
  { key: "skills",           label: "Skills",                   group: "Career" },
  { key: "projects",         label: "Projects",                 group: "Career" },
  { key: "internships",      label: "Internship / Experience",  group: "Career" },
  { key: "certifications",   label: "Certifications",           group: "Career" },
  { key: "achievements",     label: "Achievements",             group: "Career" },
  { key: "social_profiles",  label: "Social Profiles",          group: "Online" },
  { key: "video_profile",    label: "Video Profile",            group: "Online" },
  { key: "resume_uploaded",  label: "Resume Uploaded",          group: "Documents" },
  { key: "documents",        label: "Key Documents",            group: "Documents" },
] as const;

export type SectionKey = typeof SECTION_META[number]["key"];

/** Coded fallback — used whenever no valid policy override exists. */
export const DEFAULT_WEIGHTS: Record<SectionKey, number> = {
  personal_info: 15,
  academic_info: 15,
  skills: 10,
  projects: 10,
  internships: 10,
  certifications: 8,
  achievements: 7,
  social_profiles: 8,
  video_profile: 7,
  resume_uploaded: 5,
  documents: 5,
};

/** Retained for compatibility with any existing callers that read weights directly. */
export const COMPLETION_SECTIONS = SECTION_META.map((s) => ({
  ...s,
  weight: DEFAULT_WEIGHTS[s.key],
}));

export interface CompletionSection {
  key: SectionKey;
  label: string;
  weight: number;
  group: string;
  isComplete: boolean;
  hint?: string;
}

export interface ProfileCompletion {
  score: number;        // 0–100
  sections: CompletionSection[];
  nextSteps: string[];  // top 3 incomplete sections by weight desc
}

/**
 * Resolve the effective weight table: the policy value for
 * "profile_completion_weights" (a JSON object of {sectionKey: weight}),
 * scoped to the student's batch, merged over the coded defaults for any
 * section it doesn't mention. Falls back entirely to defaults if unset,
 * invalid JSON, or the weights don't sum to 100.
 */
async function resolveWeights(batchId: string | null): Promise<Record<SectionKey, number>> {
  let raw: string;
  try {
    raw = await getPolicyValue<string>("profile_completion_weights", batchId);
  } catch {
    return DEFAULT_WEIGHTS;
  }
  if (!raw) return DEFAULT_WEIGHTS;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const merged: Record<SectionKey, number> = { ...DEFAULT_WEIGHTS };
    let total = 0;
    for (const s of SECTION_META) {
      const v = parsed[s.key];
      const n = typeof v === "number" ? v : Number(v);
      merged[s.key] = Number.isFinite(n) && n >= 0 ? n : DEFAULT_WEIGHTS[s.key];
      total += merged[s.key];
    }
    // A materially broken configuration (doesn't sum near 100) is safer to
    // ignore than to silently mis-score every student's profile.
    if (Math.abs(total - 100) > 1) return DEFAULT_WEIGHTS;
    return merged;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

// ─── Main calculation ─────────────────────────────────────────────────────────

export async function calculateProfileCompletion(studentId: string): Promise<ProfileCompletion> {
  // Fetch everything in one round-trip
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      academicRecord: true,
      studentSkills: { take: 1 },
      customSkills:  { take: 1 },
      projects:      { take: 1 },
      internships:   { take: 1 },
      certifications:{ take: 1 },
      achievements:  { take: 1 },
      socialProfiles:{ take: 1 },
      videoProfile:  true,
      resumes:       { take: 1 },
      documents:     { take: 1 },
    },
  });

  const weights = await resolveWeights(student.batchId ?? null);

  const checks: Record<SectionKey, { complete: boolean; hint?: string }> = {
    personal_info: {
      complete: Boolean(
        student.firstName && student.lastName && student.dateOfBirth &&
        student.phoneNumber && student.currentAddress
      ),
      hint: "Add your personal details: name, DOB, phone, address",
    },
    academic_info: {
      complete: Boolean(student.academicRecord?.currentCgpa && student.academicRecord?.currentSemester),
      hint: "Fill in your academic record and semester SGPA",
    },
    skills: {
      complete: student.studentSkills.length > 0 || student.customSkills.length > 0,
      hint: "Add at least one skill to your profile",
    },
    projects: {
      complete: student.projects.length > 0,
      hint: "Add at least one project",
    },
    internships: {
      complete: student.internships.length > 0,
      hint: "Add any internship or work experience",
    },
    certifications: {
      complete: student.certifications.length > 0,
      hint: "Add a certification or course completion",
    },
    achievements: {
      complete: student.achievements.length > 0,
      hint: "Add a hackathon, award, or other achievement",
    },
    social_profiles: {
      complete: student.socialProfiles.length > 0,
      hint: "Link your LinkedIn or GitHub profile",
    },
    video_profile: {
      complete: Boolean(student.videoProfile && student.videoProfile.status !== "NOT_UPLOADED"),
      hint: "Upload or link a 60-second video introduction",
    },
    resume_uploaded: {
      complete: student.resumes.length > 0,
      hint: "Upload or create a resume in the Resume Center",
    },
    documents: {
      complete: student.documents.length > 0,
      hint: "Upload key documents (College ID, marksheets, etc.)",
    },
  };

  const sections: CompletionSection[] = SECTION_META.map((s) => ({
    ...s,
    weight: weights[s.key],
    isComplete: checks[s.key].complete,
    hint: checks[s.key].complete ? undefined : checks[s.key].hint,
  }));

  const score = sections.reduce((acc, s) => acc + (s.isComplete ? s.weight : 0), 0);

  const nextSteps = sections
    .filter((s) => !s.isComplete)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((s) => s.hint ?? s.label);

  return { score, sections, nextSteps };
}
