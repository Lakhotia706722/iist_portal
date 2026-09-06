/**
 * Eligibility Engine — Phase 3
 *
 * evaluateEligibility(studentId, jobRoleId) is the single source of truth.
 * The same function is called:
 *   1. Student-facing "can I apply?" check (display only)
 *   2. Backend application gate (before persisting the application)
 *
 * This ensures the client display can never drift from server enforcement.
 */

import { prisma } from "@/lib/prisma";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RuleResult {
  ruleId:   string;
  label:    string;
  field:    string;
  passed:   boolean;
  reason:   string;   // human-readable explanation shown to student
}

export interface EligibilityResult {
  eligible: boolean;
  results:  RuleResult[];
}

// ─── Main evaluator ───────────────────────────────────────────────────────────

export async function evaluateEligibility(
  studentId: string,
  jobRoleId:  string,
): Promise<EligibilityResult> {
  // Load student with all needed sub-relations in one query
  const [student, rules] = await Promise.all([
    prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: {
        batch:  { include: { branch: { include: { course: true } } } },
        academicRecord: true,
        applications: {
          where: {
            status: {
              in: ["SELECTED"],
            },
          },
          select: { id: true },
        },
      },
    }),
    prisma.eligibilityRule.findMany({
      where: { jobRoleId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (rules.length === 0) {
    // No rules → open to all eligible students
    return { eligible: true, results: [] };
  }

  const results: RuleResult[] = rules.map((rule) =>
    evaluateRule(rule, student)
  );

  return {
    eligible: results.every((r) => r.passed),
    results,
  };
}

// ─── Per-rule evaluator ───────────────────────────────────────────────────────

function evaluateRule(
  rule: {
    id: string;
    label: string;
    field: string;
    operator: string;
    value: string;
  },
  student: any,
): RuleResult {
  const base = { ruleId: rule.id, label: rule.label, field: rule.field };

  try {
    switch (rule.field) {
      case "CGPA": {
        const cgpa = student.academicRecord?.currentCgpa ?? 0;
        const threshold = parseFloat(rule.value);
        const passed = compare(cgpa, rule.operator, threshold);
        return {
          ...base,
          passed,
          reason: passed
            ? `CGPA ${cgpa.toFixed(2)} meets requirement (${humanOp(rule.operator)} ${threshold})`
            : `CGPA ${cgpa.toFixed(2)} does not meet minimum requirement of ${threshold}`,
        };
      }

      case "ACTIVE_BACKLOGS": {
        const backlogs = student.academicRecord?.activeBacklogs ?? 0;
        const threshold = parseInt(rule.value, 10);
        const passed = compare(backlogs, rule.operator, threshold);
        return {
          ...base,
          passed,
          reason: passed
            ? `Active backlogs (${backlogs}) within allowed limit`
            : `Active backlogs (${backlogs}) exceed the allowed limit of ${threshold}`,
        };
      }

      case "TOTAL_BACKLOGS": {
        const backlogs = student.academicRecord?.totalBacklogs ?? 0;
        const threshold = parseInt(rule.value, 10);
        const passed = compare(backlogs, rule.operator, threshold);
        return {
          ...base,
          passed,
          reason: passed
            ? `Total backlogs (${backlogs}) within allowed limit`
            : `Total backlogs (${backlogs}) exceed the allowed limit of ${threshold}`,
        };
      }

      case "TENTH_PERCENTAGE": {
        const pct = student.academicRecord?.tenthPercentage ?? 0;
        const threshold = parseFloat(rule.value);
        const passed = compare(pct, rule.operator, threshold);
        return {
          ...base,
          passed,
          reason: passed
            ? `10th percentage ${pct}% meets requirement`
            : `10th percentage ${pct}% does not meet minimum of ${threshold}%`,
        };
      }

      case "TWELFTH_PERCENTAGE": {
        const pct = student.academicRecord?.twelfthPercentage ?? 0;
        const threshold = parseFloat(rule.value);
        const passed = compare(pct, rule.operator, threshold);
        return {
          ...base,
          passed,
          reason: passed
            ? `12th percentage ${pct}% meets requirement`
            : `12th percentage ${pct}% does not meet minimum of ${threshold}%`,
        };
      }

      case "CURRENT_SEMESTER": {
        const sem = student.academicRecord?.currentSemester ?? 0;
        const threshold = parseInt(rule.value, 10);
        const passed = compare(sem, rule.operator, threshold);
        return {
          ...base,
          passed,
          reason: passed
            ? `Current semester (${sem}) meets requirement`
            : `Must be in semester ${humanOp(rule.operator)} ${threshold} (currently semester ${sem})`,
        };
      }

      case "BATCH": {
        const allowed = rule.value.split(",").map((s) => s.trim());
        const batchYear = student.batch?.academicYear ?? "";
        const passed = listCheck(batchYear, rule.operator, allowed);
        return {
          ...base,
          passed,
          reason: passed
            ? `Batch ${batchYear} is eligible`
            : `Batch ${batchYear} is not eligible. Allowed: ${allowed.join(", ")}`,
        };
      }

      case "BRANCH": {
        const allowed = rule.value.split(",").map((s) => s.trim());
        const branchCode = student.batch?.branch?.code ?? student.branch?.code ?? "";
        const passed = listCheck(branchCode, rule.operator, allowed);
        return {
          ...base,
          passed,
          reason: passed
            ? `Branch ${branchCode} is eligible`
            : `Branch ${branchCode} is not eligible. Allowed: ${allowed.join(", ")}`,
        };
      }

      case "COURSE": {
        const allowed = rule.value.split(",").map((s) => s.trim());
        const courseCode =
          student.batch?.branch?.course?.code ??
          student.branch?.course?.code ?? "";
        const passed = listCheck(courseCode, rule.operator, allowed);
        return {
          ...base,
          passed,
          reason: passed
            ? `Course ${courseCode} is eligible`
            : `Course ${courseCode} is not eligible. Allowed: ${allowed.join(", ")}`,
        };
      }

      case "GENDER": {
        const allowed = rule.value.split(",").map((s) => s.trim());
        const gender = student.gender ?? "";
        const passed = listCheck(gender, rule.operator, allowed);
        return {
          ...base,
          passed,
          reason: passed
            ? `Gender eligibility met`
            : `This role is restricted to: ${allowed.join(", ")}`,
        };
      }

      case "CATEGORY": {
        const allowed = rule.value.split(",").map((s) => s.trim());
        const category = student.category ?? "";
        const passed = listCheck(category, rule.operator, allowed);
        return {
          ...base,
          passed,
          reason: passed
            ? `Category eligibility met`
            : `Category ${category} is not in allowed list: ${allowed.join(", ")}`,
        };
      }

      case "PLACEMENT_STATUS": {
        // rule.value = "NOT_PLACED" means student must not already be selected
        const alreadyPlaced = student.applications.length > 0;
        const requireNotPlaced = rule.value === "NOT_PLACED";
        const passed = requireNotPlaced ? !alreadyPlaced : true;
        return {
          ...base,
          passed,
          reason: passed
            ? `Placement status eligibility met`
            : `Already placed — not eligible to apply for further drives`,
        };
      }

      case "PROFILE_STATUS": {
        const requiredStatus = rule.value; // e.g. "VERIFIED"
        const passed = student.profileStatus === requiredStatus;
        return {
          ...base,
          passed,
          reason: passed
            ? `Profile is ${student.profileStatus}`
            : `Profile must be ${requiredStatus} (currently ${student.profileStatus}). Complete your profile first.`,
        };
      }

      default:
        return {
          ...base,
          passed: true,
          reason: `Rule field "${rule.field}" not evaluated (unknown)`,
        };
    }
  } catch {
    return {
      ...base,
      passed: false,
      reason: `Could not evaluate rule — please contact admin`,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function compare(actual: number, op: string, threshold: number): boolean {
  switch (op) {
    case "GTE":    return actual >= threshold;
    case "LTE":    return actual <= threshold;
    case "EQ":     return actual === threshold;
    default:       return false;
  }
}

function listCheck(actual: string, op: string, allowed: string[]): boolean {
  const normalised = actual.toUpperCase();
  const normList   = allowed.map((a) => a.toUpperCase());
  switch (op) {
    case "IN":     return normList.includes(normalised);
    case "NOT_IN": return !normList.includes(normalised);
    case "EQ":     return normList.length === 1 && normList[0] === normalised;
    default:       return false;
  }
}

function humanOp(op: string): string {
  const map: Record<string, string> = {
    GTE: "≥", LTE: "≤", EQ: "=", IN: "in", NOT_IN: "not in",
  };
  return map[op] ?? op;
}
