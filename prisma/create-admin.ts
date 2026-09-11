/**
 * First-admin bootstrap — Phase 13.
 *
 * Not covered by seed-reference-data.ts (that script deliberately contains
 * no user accounts) and not seed-test-fixtures.ts (fake data, never safe in
 * production) — this is the third, previously-missing thing: a way to
 * create exactly one REAL TP_ADMIN account on a genuinely empty production
 * database, using real details the operator provides. Every other user
 * account after this one can be created through the app itself (Admin →
 * Users & Roles, built in Phase 12) — this script exists only to solve the
 * chicken-and-egg problem of the very first login.
 *
 * Safe to run against production: it takes real values, creates nothing
 * but the one account requested, and is idempotent by email (re-running
 * with the same email updates nothing and just confirms the account
 * exists, rather than erroring or duplicating).
 *
 * Usage:
 *   npx tsx prisma/create-admin.ts --name "Jane Doe" --email jane@iist.ac.in --password "TempPass123!"
 *
 * The created account has mustChangePassword: true, so the temporary
 * password above only works to log in once, before the real admin is
 * forced to set their own.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const name = arg("name");
  const email = arg("email");
  const password = arg("password");

  if (!name || !email || !password) {
    console.error("Usage: npx tsx prisma/create-admin.ts --name \"Full Name\" --email admin@iist.ac.in --password \"TempPass123!\"");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters — it's a one-time temporary password the admin changes on first login, not the long-term one.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "TP_ADMIN") {
      console.error(`A user with email ${email} already exists with role ${existing.role}, not TP_ADMIN. Refusing to overwrite — use a different email or the Users & Roles page instead.`);
      process.exit(1);
    }
    console.log(`✓ ${email} already exists as TP_ADMIN — nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: { name, email, passwordHash, role: "TP_ADMIN", isActive: true, mustChangePassword: true },
  });

  console.log(`✅ Created TP_ADMIN ${admin.email}. They must change their password on first login.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
