/**
 * Phase 12 Step 3 — standing nav-to-route reconciliation.
 *
 * Fails (exit 1) if:
 *   1. Any nav item (any role) points to a route with no page.tsx on disk —
 *      the literal dead-link case.
 *   2. Any nav item flagged `comingSoon: true` DOES have a page.tsx on disk
 *      — the inverse mistake: a stale flag left on a page that's actually
 *      finished. This is exactly how Phase 12 found its gaps in reverse —
 *      by checking the filesystem against nav-config.tsx instead of
 *      trusting the flag — so this check closes the loophole for good
 *      instead of relying on the next person to remember to do it by hand.
 *
 * Static/offline — no dev server, no auth, no DB, runs in seconds. It can't
 * see a route that exists but 500s at runtime; that's
 * e2e/flows/nav-route-check.spec.ts's job (it actually requests each page
 * as each role). Run both — this one first, since it's near-instant.
 */
import fs from "node:fs";
import path from "node:path";
import {
  STUDENT_NAV,
  ADMIN_NAV,
  FACULTY_NAV,
  HOD_NAV,
  COMPANY_NAV,
} from "../components/layout/nav-config";
import type { NavGroup } from "../components/layout/sidebar";

const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");

function findPageFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findPageFiles(full, acc);
    } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
      acc.push(full);
    }
  }
  return acc;
}

/** app/(admin)/admin/students/page.tsx → /admin/students (route groups don't count). */
function fileToRoute(file: string): string {
  let rel = path.relative(APP_DIR, file).replace(/\\/g, "/");
  rel = rel.replace(/\/page\.tsx?$/, "");
  const segments = rel.split("/").filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  const route = "/" + segments.join("/");
  return route === "//" ? "/" : route;
}

const validRoutes = new Set(findPageFiles(APP_DIR).map(fileToRoute));

const ALL_NAVS: Record<string, NavGroup[]> = {
  Student: STUDENT_NAV,
  "T&P Admin": ADMIN_NAV,
  Faculty: FACULTY_NAV,
  HOD: HOD_NAV,
  "Company Rep": COMPANY_NAV,
};

const deadLinks: string[] = [];
const staleFlags: string[] = [];
let itemCount = 0;

for (const [role, groups] of Object.entries(ALL_NAVS)) {
  for (const group of groups) {
    for (const item of group.items) {
      itemCount++;
      const exists = validRoutes.has(item.href);
      if (item.comingSoon) {
        if (exists) {
          staleFlags.push(
            `${role}: "${item.label}" (${item.href}) is flagged comingSoon but a page.tsx already exists — remove the flag, or remove the page if it's not actually ready.`
          );
        }
      } else if (!exists) {
        deadLinks.push(`${role}: "${item.label}" (${item.href}) has no page.tsx on disk — dead link.`);
      }
    }
  }
}

if (deadLinks.length) {
  console.error("\n❌ Dead nav links (route has no page):");
  deadLinks.forEach((l) => console.error("  " + l));
}
if (staleFlags.length) {
  console.error('\n❌ Stale "comingSoon" flags (page already exists):');
  staleFlags.forEach((l) => console.error("  " + l));
}

if (deadLinks.length || staleFlags.length) {
  console.error(`\n${deadLinks.length + staleFlags.length} nav integrity issue(s) found out of ${itemCount} nav items checked.`);
  process.exit(1);
}

console.log(`✅ Nav integrity OK — ${itemCount} nav items checked across ${Object.keys(ALL_NAVS).length} roles.`);
