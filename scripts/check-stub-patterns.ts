/**
 * Phase 12 Step 3 — standing stub-pattern scan.
 *
 * Phase 9 grepped for these by hand once, on a fixed set of pages, and
 * threw the result away after fixing what it found. This is the same set
 * of patterns turned into a script that runs every time — on the whole
 * app/ + components/ tree, not just the pages someone remembered to check
 * — so the next stub gets caught by CI instead of by the next multi-day
 * audit phase.
 *
 * Patterns (each looks for a *symptom* of a fake feature, not a keyword
 * ban — see ALLOWLIST below for the legitimate matches this codebase
 * already has and why each one is fine):
 *
 *   1. `setTimeout` used where a real async call belongs — heuristically:
 *      a setTimeout whose callback sets state that looks like a fabricated
 *      API result, with no `fetch`/`await`/mutate call in the same
 *      function. (Debounce timers and post-success UI delays are legitimate
 *      — those are allowlisted by file+line below rather than by pattern,
 *      since "is this one fake" isn't reliably answerable by regex alone.)
 *   2. TODO / FIXME comments — a marker for known-incomplete code.
 *   3. "coming soon" strings outside the sidebar's own disabled-badge
 *      mechanism (nav-config.tsx / sidebar.tsx) — that's the ONE place
 *      that string is the honest, correct thing to render.
 *   4. Empty event handlers: `onClick={() => {}}` and equivalents — a
 *      button that visibly does nothing.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "components", "server", "lib"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

// file (relative to repo root, forward slashes) → line-content substrings
// that are known-legitimate and should NOT fail the build. Every entry here
// needs a reason — this list is reviewed, not just appended to.
const ALLOWLIST: Record<string, string[]> = {
  // The sidebar's actual disabled-"Soon"-badge mechanism — the one place
  // this string is supposed to exist.
  "components/layout/sidebar.tsx": ["coming soon", "Coming soon"],
  // Debounce timer — real, has nothing to do with faking an API response.
  "components/layout/global-search.tsx": ["setTimeout(() => setDebounced(value), delay)"],
  // Both real network calls (mutation/fetch already happened); the
  // setTimeout only delays a post-success UI transition.
  "components/auth/change-password-form.tsx": ["setTimeout(() => { router.push"],
  "components/admin/users-roles-client.tsx": ["setTimeout(() => setCopied(false), 1500)"],
};

type Finding = { file: string; line: number; text: string; rule: string };

function isAllowlisted(relFile: string, lineText: string): boolean {
  const entries = ALLOWLIST[relFile];
  if (!entries) return false;
  return entries.some((snippet) => lineText.includes(snippet));
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

const RULES: { rule: string; pattern: RegExp }[] = [
  { rule: "TODO/FIXME comment", pattern: /\b(TODO|FIXME)\b/ },
  { rule: '"coming soon" string literal', pattern: /coming soon/i },
  { rule: "empty event handler", pattern: /on[A-Z]\w*=\{?\s*\(\)\s*=>\s*\{\s*\}\s*\}?/ },
  { rule: "setTimeout faking an async result", pattern: /setTimeout\s*\(\s*\(\)\s*=>\s*set\w+\(/ },
];

const findings: Finding[] = [];

for (const dir of SCAN_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const relFile = path.relative(ROOT, file).replace(/\\/g, "/");
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((lineText, idx) => {
      for (const { rule, pattern } of RULES) {
        if (pattern.test(lineText) && !isAllowlisted(relFile, lineText)) {
          findings.push({ file: relFile, line: idx + 1, text: lineText.trim(), rule });
        }
      }
    });
  }
}

if (findings.length) {
  console.error(`\n❌ ${findings.length} stub-pattern match(es) found:\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.rule}]`);
    console.error(`    ${f.text}`);
  }
  console.error(
    "\nIf a match is a genuine false positive, add it to ALLOWLIST in scripts/check-stub-patterns.ts with a one-line reason — don't just delete the finding."
  );
  process.exit(1);
}

console.log("✅ No stub patterns found.");
