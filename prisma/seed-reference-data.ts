/**
 * Reference / bootstrap data — Phase 13.
 *
 * Safe to run against production. This is the "a fresh install genuinely
 * needs *some* starting values" category (Departments, Courses, Branches,
 * Batches, the Skill catalog, SkillUp TestType categories, default
 * PolicyRule values) — real IIST structure, not "Department A"/"Test
 * Course" placeholders, and every one of these is editable afterward
 * through the real admin UI (Departments/Skills Catalog/Policy Rules
 * pages) — this script only establishes a starting point, it doesn't own
 * the data going forward.
 *
 * Idempotent: every write is an upsert (or an existence check before
 * create), so running this again — including against a database that
 * already has these rows, with admin edits on top — never creates
 * duplicates and never clobbers an admin's changes to a description/value.
 *
 * Run: npx tsx prisma/seed-reference-data.ts
 *
 * Contains NO user accounts, students, companies, or any other row a real
 * person's data would collide with — see seed-test-fixtures.ts for that
 * (and read its guard comment before ever running it near production).
 */

import { PrismaClient } from "@prisma/client";
import { SKILL_CATEGORIES } from "../lib/validations/profile";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding reference data...");

  // ── Departments (real IIST academic departments) ────────────────────────
  const departments = [
    { name: "Computer Science & Engineering", code: "CSE", description: "Dept of CS & Engineering" },
    { name: "Aerospace Engineering", code: "AE", description: "Dept of Aerospace Engineering" },
    { name: "Avionics", code: "AVI", description: "Dept of Avionics" },
    { name: "Physics", code: "PHY", description: "Dept of Physics" },
    { name: "Chemistry", code: "CHEM", description: "Dept of Chemistry" },
    { name: "Earth & Space Sciences", code: "ESS", description: "Dept of Earth and Space Sciences" },
    { name: "Mathematics", code: "MATH", description: "Dept of Mathematics" },
  ];
  const deptByCode: Record<string, { id: string }> = {};
  for (const d of departments) {
    deptByCode[d.code] = await prisma.department.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
  }
  console.log(`  ✓ ${departments.length} departments`);

  // ── Courses ──────────────────────────────────────────────────────────────
  const courses = [
    { name: "Bachelor of Technology", code: "BTECH", durationYears: 4 },
    { name: "Master of Technology", code: "MTECH", durationYears: 2 },
    { name: "Dual Degree (B.Tech + M.Tech)", code: "DUAL", durationYears: 5 },
  ];
  const courseByCode: Record<string, { id: string }> = {};
  for (const c of courses) {
    courseByCode[c.code] = await prisma.course.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }
  console.log(`  ✓ ${courses.length} courses`);

  // ── Branches — the B.Tech programs offered against each department ─────
  const branches = [
    { name: "Computer Science & Engineering", code: "BTECH-CSE", deptCode: "CSE", courseCode: "BTECH" },
    { name: "Aerospace Engineering", code: "BTECH-AE", deptCode: "AE", courseCode: "BTECH" },
    { name: "Avionics", code: "BTECH-AVI", deptCode: "AVI", courseCode: "BTECH" },
    { name: "Engineering Physics", code: "BTECH-PHY", deptCode: "PHY", courseCode: "BTECH" },
  ];
  const branchByCode: Record<string, { id: string }> = {};
  for (const b of branches) {
    branchByCode[b.code] = await prisma.branch.upsert({
      where: { code: b.code },
      update: {},
      create: {
        name: b.name,
        code: b.code,
        departmentId: deptByCode[b.deptCode].id,
        courseId: courseByCode[b.courseCode].id,
      },
    });
  }
  console.log(`  ✓ ${branches.length} branches`);

  // ── Batches — a placement-eligible current batch per branch ─────────────
  // Deliberately just the current final-year-track batch per branch, not a
  // full historical run — an admin extends this every admission cycle
  // through the real Batches UI, exactly as intended.
  const currentYear = new Date().getFullYear();
  const batches = branches.map((b) => ({
    id: `batch-${b.code.toLowerCase()}-${currentYear - 4}`,
    name: `B.Tech ${b.code.replace("BTECH-", "")} ${currentYear - 4}-${currentYear}`,
    academicYear: `${currentYear - 4}-${currentYear}`,
    branchCode: b.code,
    startYear: currentYear - 4,
    endYear: currentYear,
  }));
  for (const batch of batches) {
    await prisma.batch.upsert({
      where: { id: batch.id },
      update: {},
      create: {
        id: batch.id,
        name: batch.name,
        academicYear: batch.academicYear,
        branchId: branchByCode[batch.branchCode].id,
        startYear: batch.startYear,
        endYear: batch.endYear,
      },
    });
  }
  console.log(`  ✓ ${batches.length} batches`);

  // ── Skill catalog ────────────────────────────────────────────────────────
  const SKILLS: Array<{ name: string; category: (typeof SKILL_CATEGORIES)[number] }> = [
    { name: "C", category: "PROGRAMMING" }, { name: "C++", category: "PROGRAMMING" },
    { name: "Python", category: "PROGRAMMING" }, { name: "Java", category: "PROGRAMMING" },
    { name: "JavaScript", category: "PROGRAMMING" }, { name: "TypeScript", category: "PROGRAMMING" },
    { name: "MATLAB", category: "PROGRAMMING" },
    { name: "React", category: "FRAMEWORKS" }, { name: "Node.js", category: "FRAMEWORKS" },
    { name: "Django", category: "FRAMEWORKS" }, { name: "Spring Boot", category: "FRAMEWORKS" },
    { name: "PostgreSQL", category: "DATABASES" }, { name: "MySQL", category: "DATABASES" },
    { name: "MongoDB", category: "DATABASES" },
    { name: "Machine Learning", category: "AI_ML" }, { name: "Deep Learning", category: "AI_ML" },
    { name: "Computer Vision", category: "AI_ML" }, { name: "Natural Language Processing", category: "AI_ML" },
    { name: "Git", category: "TOOLS" }, { name: "Docker", category: "TOOLS" }, { name: "AWS", category: "TOOLS" },
    { name: "Linux", category: "TOOLS" },
    { name: "Communication", category: "SOFT_SKILLS" }, { name: "Teamwork", category: "SOFT_SKILLS" },
    { name: "Leadership", category: "SOFT_SKILLS" }, { name: "Problem Solving", category: "SOFT_SKILLS" },
    { name: "English", category: "LANGUAGES" }, { name: "Hindi", category: "LANGUAGES" }, { name: "Malayalam", category: "LANGUAGES" },
  ];
  for (const s of SKILLS) {
    const existing = await prisma.skill.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.skill.create({ data: { name: s.name, category: s.category, isActive: true } });
    }
  }
  console.log(`  ✓ ${SKILLS.length} catalog skills`);

  // ── SkillUp assessment categories ───────────────────────────────────────
  const TEST_TYPES = [
    { name: "Aptitude", slug: "aptitude", sortOrder: 1 },
    { name: "Logical Reasoning", slug: "logical-reasoning", sortOrder: 2 },
    { name: "Technical", slug: "technical", sortOrder: 3 },
    { name: "Coding", slug: "coding", sortOrder: 4 },
    { name: "Communication", slug: "communication", sortOrder: 5 },
  ];
  for (const t of TEST_TYPES) {
    await prisma.testType.upsert({
      where: { slug: t.slug },
      update: {},
      create: { ...t, isActive: true },
    });
  }
  console.log(`  ✓ ${TEST_TYPES.length} SkillUp test-type categories`);

  // ── Policy engine defaults ───────────────────────────────────────────────
  // Institute-wide rows (batchId = null) matching the coded defaults in
  // lib/policy/keys.ts — seeding them as real rows makes policy visibly
  // "configured" instead of silently defaulted, and gives admins something
  // to see and adjust in the Policy Rules UI from day one.
  const POLICY_DEFAULTS: Array<{ key: string; value: string; type: "NUMBER" | "BOOLEAN" | "STRING"; description: string }> = [
    { key: "skillup_required", value: "false", type: "BOOLEAN", description: "A student must have at least one SkillUp result before being marked Eligible." },
    { key: "min_skillup_score", value: "0", type: "NUMBER", description: "Baseline SkillUp average percentage for compliance." },
    { key: "high_package_threshold", value: "10", type: "NUMBER", description: "CTC (LPA) at or above which an offer is a high-package placement." },
    { key: "max_offers_per_student", value: "1", type: "NUMBER", description: "Maximum active (non-withdrawn/declined) offers a student may hold." },
    { key: "min_ctc_difference", value: "0", type: "NUMBER", description: "Minimum CTC increase (LPA) required between a student's offers." },
    { key: "min_attendance_percentage", value: "0", type: "NUMBER", description: "Minimum percentage of scheduled placement rounds a student must attend." },
    { key: "withdrawal_allowed_after_shortlist", value: "true", type: "BOOLEAN", description: "Whether a student may withdraw an application after being shortlisted." },
    { key: "document_verification_required", value: "false", type: "BOOLEAN", description: "Whether every document must be VERIFIED for Eligible status." },
    { key: "already_placed_statuses", value: "SELECTED", type: "STRING", description: "Application statuses that count as already placed." },
  ];
  // Policy rows require an updatedById (a real user) — on a genuinely
  // empty production DB there is no admin yet, so these are only written
  // if at least one TP_ADMIN already exists (created via the app's own
  // first-admin bootstrap, not by this script). Safe to re-run once one
  // does: it backfills any still-missing defaults without touching rows an
  // admin has already customized.
  const firstAdmin = await prisma.user.findFirst({ where: { role: "TP_ADMIN" }, orderBy: { createdAt: "asc" } });
  if (firstAdmin) {
    let created = 0;
    for (const p of POLICY_DEFAULTS) {
      const existing = await prisma.policyRule.findFirst({ where: { key: p.key, batchId: null } });
      if (!existing) {
        await prisma.policyRule.create({ data: { ...p, batchId: null, updatedById: firstAdmin.id } });
        created++;
      }
    }
    console.log(`  ✓ ${created} policy defaults created (${POLICY_DEFAULTS.length - created} already present)`);
  } else {
    console.log("  ⏭  Skipped policy defaults — no TP_ADMIN user exists yet; re-run this script after creating the first admin account.");
  }

  console.log("\n✅ Reference data seed complete.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
