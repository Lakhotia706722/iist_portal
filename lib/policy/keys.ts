/**
 * Policy key registry — Phase 5
 *
 * Every placement policy value the portal enforces is listed here, with a
 * type and a safe default. `PolicyRule` rows are optional overrides; when a
 * batch (or the institute-wide default) has no row for a key, the default
 * below is used so the system never breaks on an unconfigured policy.
 *
 * Add new policy values here first — the admin UI and service are both
 * driven by this list, not by hardcoded knowledge of individual keys.
 */

export type PolicyValueType = "NUMBER" | "BOOLEAN" | "STRING";

export interface PolicyKeyDefinition {
  key: string;
  label: string;
  description: string;
  type: PolicyValueType;
  /** Stored/returned as a string, like PolicyRule.value; parse per `type`. */
  defaultValue: string;
  category: string;
  /** For NUMBER types: a human unit shown in the admin UI ("%", "LPA", "offers"). */
  unit?: string;
}

export const POLICY_KEYS: PolicyKeyDefinition[] = [
  {
    key: "skillup_required",
    label: "SkillUp required before applying",
    description:
      "If enabled, a student must have at least one SkillUp result on record before they can be marked Eligible.",
    type: "BOOLEAN",
    defaultValue: "false",
    category: "SkillUp",
  },
  {
    key: "min_skillup_score",
    label: "Minimum SkillUp average",
    description:
      "Baseline SkillUp average percentage a student must meet for their compliance status. Individual job roles may set stricter eligibility rules of their own.",
    type: "NUMBER",
    defaultValue: "0",
    category: "SkillUp",
    unit: "%",
  },
  {
    key: "high_package_threshold",
    label: "High-package threshold",
    description:
      "CTC (LPA) at or above which an offer is flagged as a high-package placement in analytics and reports.",
    type: "NUMBER",
    defaultValue: "10",
    category: "Offers",
    unit: "LPA",
  },
  {
    key: "max_offers_per_student",
    label: "Maximum active offers per student",
    description:
      "A student cannot hold more than this many non-withdrawn, non-declined offers at once. Set to 0 for no limit.",
    type: "NUMBER",
    defaultValue: "1",
    category: "Offers",
    unit: "offers",
  },
  {
    key: "min_ctc_difference",
    label: "Minimum CTC difference between offers",
    description:
      "A student's second (or later) offer must exceed their best existing offer's CTC by at least this many LPA, unless it is a core-vs-non-core exception. Set to 0 to disable.",
    type: "NUMBER",
    defaultValue: "0",
    category: "Offers",
    unit: "LPA",
  },
  {
    key: "min_attendance_percentage",
    label: "Minimum placement-round attendance",
    description:
      "Minimum percentage of scheduled placement rounds a student must attend (Present or Late) to remain in good standing.",
    type: "NUMBER",
    defaultValue: "0",
    category: "Attendance",
    unit: "%",
  },
  {
    key: "withdrawal_allowed_after_shortlist",
    label: "Allow withdrawal after shortlisting",
    description:
      "If disabled, a student cannot withdraw an application once they have been shortlisted for that role.",
    type: "BOOLEAN",
    defaultValue: "true",
    category: "Applications",
  },
  {
    key: "document_verification_required",
    label: "Document verification required",
    description:
      "If enabled, a student must have every uploaded document VERIFIED (none PENDING/REJECTED/RE_UPLOAD_REQUESTED) to be marked Eligible.",
    type: "BOOLEAN",
    defaultValue: "false",
    category: "Documents",
  },
  {
    key: "already_placed_statuses",
    label: "Application statuses that count as \"already placed\"",
    description:
      "Comma-separated ApplicationStatus values. A student with any application in one of these statuses is treated as already placed by the eligibility engine's PLACEMENT_STATUS rule.",
    type: "STRING",
    defaultValue: "SELECTED",
    category: "Eligibility",
  },
  {
    key: "profile_completion_weights",
    label: "Profile completion weights",
    description:
      "JSON object mapping profile section keys to their point weight (must sum to 100). Falls back to the built-in weight table if unset or invalid.",
    type: "STRING",
    defaultValue: "",
    category: "Profile",
  },
];

export const POLICY_KEY_MAP = new Map(POLICY_KEYS.map((k) => [k.key, k]));

export function getPolicyKeyDefinition(key: string): PolicyKeyDefinition | undefined {
  return POLICY_KEY_MAP.get(key);
}

/** Parse a raw string value per its declared type, falling back safely. */
export function parsePolicyValue(
  def: PolicyKeyDefinition,
  raw: string | undefined
): number | boolean | string {
  const value = raw ?? def.defaultValue;
  switch (def.type) {
    case "NUMBER": {
      const n = Number(value);
      return Number.isFinite(n) ? n : Number(def.defaultValue) || 0;
    }
    case "BOOLEAN":
      return value === "true" || value === "1";
    default:
      return value;
  }
}
