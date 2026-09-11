/**
 * Static check: every exported HTTP handler under app/api must perform an
 * auth/authorization check before doing work.
 *
 * Run: npx tsx scripts/audit-route-guards.ts
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(process.cwd(), "app", "api");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/** Routes that are intentionally public. */
const PUBLIC_ROUTES = [
  "auth/[...nextauth]/route.ts",
  "auth/forgot-password/route.ts",
  "auth/reset-password/route.ts",
];

const GUARD_PATTERNS = [
  /requirePermission\s*\(/,
  /requireRole\s*\(/,
  /requireAuth\s*\(/,
  /if\s*\(\s*!session\??\.\w*user/,
  /getServerAuthSession/,
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return entry === "route.ts" || entry === "route.tsx" ? [full] : [];
  });
}

/** Extract the body of each exported handler by brace matching. */
function handlerBodies(src: string): Array<{ method: string; body: string }> {
  const out: Array<{ method: string; body: string }> = [];
  for (const method of METHODS) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      // Skip the parameter list first — destructured params like ({ params })
      // contain braces that would otherwise be mistaken for the body.
      let p = m.index + m[0].length - 1; // at "("
      let parenDepth = 0;
      for (; p < src.length; p++) {
        if (src[p] === "(") parenDepth++;
        else if (src[p] === ")") {
          parenDepth--;
          if (parenDepth === 0) break;
        }
      }
      const open = src.indexOf("{", p);
      if (open === -1) continue;
      let depth = 0;
      let i = open;
      for (; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      out.push({ method, body: src.slice(open, i + 1) });
    }
  }
  return out;
}

let unguarded = 0;
let checked = 0;

console.log("\n=== API route guard audit ===\n");

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (PUBLIC_ROUTES.includes(rel)) {
    console.log(`  ~ ${rel} (public by design)`);
    continue;
  }
  const src = readFileSync(file, "utf8");
  for (const { method, body } of handlerBodies(src)) {
    checked++;
    const guarded = GUARD_PATTERNS.some((p) => p.test(body));
    if (!guarded) {
      unguarded++;
      console.error(`  ✗ ${rel} :: ${method} — no auth guard found`);
    }
  }
}

console.log(
  `\n${checked} handlers checked, ${unguarded} unguarded.\n` +
    (unguarded === 0 ? "=== All handlers guarded ===\n" : "=== UNGUARDED HANDLERS PRESENT ===\n")
);
process.exitCode = unguarded === 0 ? 0 : 1;
