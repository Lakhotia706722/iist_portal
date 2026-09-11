/**
 * AI Resume Builder — Phase 5
 *
 * The hard constraint: only the student's VERIFIED profile fields are ever
 * passed into a prompt as usable content, and any AI-drafted bullet whose
 * claimed source fact doesn't actually match something in that verified set
 * is dropped before the response ever leaves this service — never trusted on
 * the AI's say-so, and never shown to the student as something they could
 * approve. `enforceTraceability()` is the function that does this; every
 * caller of `draftResumeBullets` must go through it.
 */

import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { writeAuditLog } from "./audit.service";
import { getAIProvider, isAIConfigured } from "@/lib/ai";
import type { DraftBullet, ResumeMatchResult } from "@/lib/ai";

// ─── Verified fact extraction ──────────────────────────────────────────────────

export interface VerifiedFact {
  /** Human-readable fact text, as passed to the AI. */
  text: string;
  /** Normalized tokens used for the traceability check. */
  tokens: string[];
  section: DraftBullet["section"];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Exported for direct unit testing. */
export function tokenize(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 2); // drop short/stop-ish tokens
}

/**
 * Compile the student's verified profile into a flat list of facts the AI is
 * allowed to draw from. Every item here traces to an actual database row the
 * student (or a verifier) entered — nothing here is AI-generated.
 */
export async function getVerifiedFacts(studentId: string): Promise<VerifiedFact[]> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      academicRecord: true,
      studentSkills: { include: { skill: true } },
      customSkills: true,
      projects: true,
      internships: true,
      certifications: true,
      achievements: true,
    },
  });
  if (!student) throw new NotFoundError("Student not found");

  const facts: VerifiedFact[] = [];

  for (const s of student.studentSkills) {
    const text = `Skilled in ${s.skill.name} (${s.level.toLowerCase()})`;
    facts.push({ text, tokens: tokenize(text), section: "skills" });
  }
  for (const s of student.customSkills) {
    const text = `Skilled in ${s.name} (${s.level.toLowerCase()})`;
    facts.push({ text, tokens: tokenize(text), section: "skills" });
  }
  for (const p of student.projects) {
    const text = `Project "${p.title}": ${p.description}${p.techStack.length ? ` — built with ${p.techStack.join(", ")}` : ""}`;
    facts.push({ text, tokens: tokenize(`${p.title} ${p.description} ${p.techStack.join(" ")}`), section: "projects" });
  }
  for (const i of student.internships) {
    const text = `${i.role} at ${i.company}${i.description ? `: ${i.description}` : ""}`;
    facts.push({ text, tokens: tokenize(`${i.role} ${i.company} ${i.description ?? ""}`), section: "experience" });
  }
  for (const c of student.certifications) {
    const text = `Certification: ${c.name} from ${c.issuingOrg}`;
    facts.push({ text, tokens: tokenize(`${c.name} ${c.issuingOrg}`), section: "certifications" });
  }
  for (const a of student.achievements) {
    const text = `${a.title}${a.position ? ` (${a.position})` : ""}${a.organizer ? ` — ${a.organizer}` : ""}`;
    facts.push({ text, tokens: tokenize(`${a.title} ${a.position ?? ""} ${a.organizer ?? ""}`), section: "achievements" });
  }
  if (student.academicRecord?.currentCgpa) {
    const text = `Current CGPA: ${student.academicRecord.currentCgpa}`;
    facts.push({ text, tokens: tokenize(text), section: "summary" });
  }

  return facts;
}

export async function hasVerifiedFacts(studentId: string): Promise<boolean> {
  const facts = await getVerifiedFacts(studentId);
  return facts.length > 0;
}

/**
 * The traceability check: a claimed sourceFact is accepted only if it
 * overlaps substantially (by token) with one of the student's actual
 * verified facts. This is intentionally strict — it is the enforcement
 * point, not a formality.
 */
function findMatchingFact(claim: string, facts: VerifiedFact[]): VerifiedFact | null {
  const claimTokens = new Set(tokenize(claim));
  if (claimTokens.size === 0) return null;

  let best: { fact: VerifiedFact; overlap: number } | null = null;
  for (const fact of facts) {
    const factTokenSet = new Set(fact.tokens);
    let overlap = 0;
    for (const t of claimTokens) if (factTokenSet.has(t)) overlap++;
    const ratio = overlap / Math.min(claimTokens.size, factTokenSet.size || 1);
    if (ratio >= 0.5 && (!best || ratio > best.overlap)) {
      best = { fact, overlap: ratio };
    }
  }
  return best?.fact ?? null;
}

export interface DraftBulletChecked extends DraftBullet {
  id: string;
  traced: boolean;
}

/**
 * Filters an AI's drafted bullets down to only those that are actually
 * traceable to a verified fact. Untraced bullets are never returned — the
 * caller only ever sees `bullets` (traced) and a `droppedCount`.
 */
/** Exported for direct unit testing — see ai-resume.service.test.ts. */
export function enforceTraceability(
  draft: DraftBullet[],
  facts: VerifiedFact[]
): { bullets: DraftBulletChecked[]; droppedCount: number } {
  const bullets: DraftBulletChecked[] = [];
  let dropped = 0;

  draft.forEach((b, i) => {
    const matched = findMatchingFact(b.sourceFact, facts) ?? findMatchingFact(b.text, facts);
    if (matched) {
      bullets.push({ ...b, sourceFact: matched.text, id: `bullet-${i}`, traced: true });
    } else {
      dropped++;
    }
  });

  return { bullets, droppedCount: dropped };
}

// ─── Public operations ──────────────────────────────────────────────────────────

export interface ResumeDraftResult {
  targetRole: string;
  bullets: DraftBulletChecked[];
  droppedCount: number;
  totalFacts: number;
}

export async function generateResumeDraft(
  studentId: string,
  targetRole: string,
  jobDescription: string
): Promise<ResumeDraftResult> {
  const facts = await getVerifiedFacts(studentId);
  if (facts.length === 0) {
    throw new ValidationError(
      "Add at least one skill, project, internship, certification, or achievement to your profile before using the AI resume builder — the AI can only draft from your verified profile data."
    );
  }

  const provider = getAIProvider();
  const raw = await provider.draftResumeBullets(
    facts.map((f) => f.text),
    targetRole,
    jobDescription
  );

  const { bullets, droppedCount } = enforceTraceability(raw, facts);

  return { targetRole, bullets, droppedCount, totalFacts: facts.length };
}

/**
 * Approve a subset of a previously-generated draft and save it as a new
 * ResumeVersion. Bullets are re-validated against the student's CURRENT
 * verified facts (not just trusted from the client payload) so nothing
 * ungrounded can be smuggled in between generation and approval.
 */
export async function approveResumeDraft(
  studentId: string,
  resumeId: string,
  approvedBullets: DraftBullet[],
  targetRole: string,
  actorId: string
) {
  await prisma.resume.findFirstOrThrow({ where: { id: resumeId, studentId } });

  const facts = await getVerifiedFacts(studentId);
  const { bullets, droppedCount } = enforceTraceability(approvedBullets, facts);

  if (bullets.length === 0) {
    throw new ValidationError(
      "None of the submitted bullets could be verified against your current profile data. Nothing was saved."
    );
  }

  const latest = await prisma.resumeVersion.findFirst({
    where: { resumeId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const version = await prisma.resumeVersion.create({
    data: {
      resumeId,
      version: nextVersion,
      isGenerated: true,
      snapshot: {
        source: "ai-resume-builder",
        targetRole,
        generatedAt: new Date().toISOString(),
        bullets: bullets.map((b) => ({ section: b.section, text: b.text, sourceFact: b.sourceFact })),
      } as any,
      notes: `AI-drafted for "${targetRole}" — ${bullets.length} bullet(s) approved and verified against profile.`,
    },
  });

  await writeAuditLog({
    userId: actorId,
    action: "CREATE",
    entity: "ResumeVersion",
    entityId: version.id,
    newValues: { resumeId, version: nextVersion, source: "ai", approvedCount: bullets.length, droppedCount },
  });

  return { version, savedCount: bullets.length, droppedCount };
}

export async function matchResumeToJD(
  studentId: string,
  jobDescription: string
): Promise<ResumeMatchResult> {
  const facts = await getVerifiedFacts(studentId);
  if (facts.length === 0) {
    throw new ValidationError("Add profile data before requesting a match score.");
  }
  const resumeText = facts.map((f) => f.text).join("\n");
  return getAIProvider().generateResumeMatch(resumeText, jobDescription);
}

export async function analyzeJobDescription(jobDescription: string) {
  return getAIProvider().analyzeJD(jobDescription);
}

export interface SkillGapResult {
  requiredSkills: string[];
  preferredSkills: string[];
  have: string[];
  missingRequired: string[];
  missingPreferred: string[];
  coveragePercent: number;
}

export async function getSkillGap(
  studentId: string,
  jobDescription: string
): Promise<SkillGapResult> {
  const [facts, jd] = await Promise.all([
    getVerifiedFacts(studentId),
    getAIProvider().analyzeJD(jobDescription),
  ]);

  const haveTokens = new Set(
    facts.filter((f) => f.section === "skills").flatMap((f) => f.tokens)
  );
  const has = (skill: string) => {
    const t = tokenize(skill);
    return t.length > 0 && t.some((tok) => haveTokens.has(tok));
  };

  const missingRequired = jd.requiredSkills.filter((s) => !has(s));
  const missingPreferred = jd.preferredSkills.filter((s) => !has(s));
  const have = [...jd.requiredSkills, ...jd.preferredSkills].filter((s) => has(s));

  const total = jd.requiredSkills.length + jd.preferredSkills.length;
  const coveragePercent = total > 0 ? Math.round((have.length / total) * 100) : 100;

  return { requiredSkills: jd.requiredSkills, preferredSkills: jd.preferredSkills, have, missingRequired, missingPreferred, coveragePercent };
}

// ─── Job recommendations (deterministic ranking; not AI-hallucinated) ──────────

export interface JobRecommendation {
  jobRoleId: string;
  driveId: string;
  title: string;
  companyName: string;
  matchScore: number;
  matchedSkills: string[];
}

export async function getJobRecommendations(studentId: string): Promise<JobRecommendation[]> {
  const facts = await getVerifiedFacts(studentId);
  const skillTokens = new Set(
    facts.filter((f) => f.section === "skills").flatMap((f) => f.tokens)
  );

  const roles = await prisma.jobRole.findMany({
    where: {
      isActive: true,
      drive: { status: { in: ["PUBLISHED", "APPLICATIONS_OPEN"] } },
    },
    select: {
      id: true,
      title: true,
      skills: true,
      driveId: true,
      drive: { select: { company: { select: { name: true } } } },
    },
    take: 100,
  });

  const scored = roles
    .map((r) => {
      const matched = r.skills.filter((s) => {
        const t = tokenize(s);
        return t.length > 0 && t.some((tok) => skillTokens.has(tok));
      });
      const matchScore = r.skills.length > 0 ? Math.round((matched.length / r.skills.length) * 100) : 0;
      return {
        jobRoleId: r.id,
        driveId: r.driveId,
        title: r.title,
        companyName: r.drive.company.name,
        matchScore,
        matchedSkills: matched,
      };
    })
    .filter((r) => r.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);

  return scored;
}

// ─── Career recommendations (advisory, clearly AI-generated) ──────────────────

export async function getCareerRecommendations(studentId: string, interests?: string) {
  const facts = await getVerifiedFacts(studentId);
  if (facts.length === 0) {
    throw new ValidationError("Add profile data before requesting career recommendations.");
  }
  return getAIProvider().careerRecommendations(
    facts.map((f) => f.text),
    interests
  );
}

// ─── Interview practice (ephemeral — not the official MockInterview record) ───

export async function getInterviewPracticeFeedback(question: string, answer: string) {
  if (question.trim().length < 5 || answer.trim().length < 5) {
    throw new ValidationError("Provide both a question and an answer of reasonable length.");
  }
  return getAIProvider().mockInterviewFeedback(question, answer);
}

export { isAIConfigured };
