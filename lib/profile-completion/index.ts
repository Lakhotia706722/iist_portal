import { prisma } from "@/lib/prisma";

// ─── Weight table ─────────────────────────────────────────────────────────────
// Total possible = 100 points. Each section earns its weight when complete.

export const COMPLETION_SECTIONS = [
  // Core (Phase 1)
  { key: "personal_info",    label: "Personal Information",     weight: 15, group: "Core" },
  { key: "academic_info",    label: "Academic Details & SGPA",  weight: 15, group: "Core" },
  // Phase 2 profile sections
  { key: "skills",           label: "Skills",                   weight: 10, group: "Career" },
  { key: "projects",         label: "Projects",                 weight: 10, group: "Career" },
  { key: "internships",      label: "Internship / Experience",  weight: 10, group: "Career" },
  { key: "certifications",   label: "Certifications",           weight:  8, group: "Career" },
  { key: "achievements",     label: "Achievements",             weight:  7, group: "Career" },
  { key: "social_profiles",  label: "Social Profiles",          weight:  8, group: "Online" },
  { key: "video_profile",    label: "Video Profile",            weight:  7, group: "Online" },
  // Documents
  { key: "resume_uploaded",  label: "Resume Uploaded",          weight:  5, group: "Documents" },
  { key: "documents",        label: "Key Documents",            weight:  5, group: "Documents" },
] as const;

export type SectionKey = typeof COMPLETION_SECTIONS[number]["key"];

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

  const sections: CompletionSection[] = COMPLETION_SECTIONS.map((s) => ({
    ...s,
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
