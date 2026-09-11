/**
 * Policy Engine service — Phase 5
 *
 * `PolicyRule` rows are optional overrides on top of the defaults in
 * `lib/policy/keys.ts`. Resolution order for a given key: batch-specific row
 * → institute-wide row (batchId null) → the coded default. Nothing in the
 * system should ever throw because a policy row is missing.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { writeAuditLog, type AuditParams } from "./audit.service";
import {
  POLICY_KEYS,
  getPolicyKeyDefinition,
  parsePolicyValue,
  type PolicyValueType,
} from "@/lib/policy/keys";

type RequestMeta = Pick<AuditParams, "ipAddress" | "userAgent">;

// ─── Resolution (read path — used throughout the app) ─────────────────────────

/** In-request cache so a single operation doesn't hit the DB once per key. */
type PolicyCache = Map<string, string | undefined>;

async function loadRulesForKey(key: string): Promise<{ global?: string; byBatch: Map<string, string> }> {
  const rows = await prisma.policyRule.findMany({ where: { key } });
  const byBatch = new Map<string, string>();
  let global: string | undefined;
  for (const r of rows) {
    if (r.batchId) byBatch.set(r.batchId, r.value);
    else global = r.value;
  }
  return { global, byBatch };
}

/**
 * Resolve a single policy value, typed. Pass `batchId` to prefer a
 * batch-specific override; falls back to the institute-wide row, then the
 * coded default.
 */
export async function getPolicyValue<T = string | number | boolean>(
  key: string,
  batchId?: string | null
): Promise<T> {
  const def = getPolicyKeyDefinition(key);
  if (!def) throw new NotFoundError(`Unknown policy key: ${key}`);

  const { global, byBatch } = await loadRulesForKey(key);
  const raw = (batchId && byBatch.get(batchId)) ?? global;
  return parsePolicyValue(def, raw) as T;
}

/** Resolve several keys at once, sharing the batch/global lookups. */
export async function getPolicyValues(
  keys: string[],
  batchId?: string | null
): Promise<Record<string, number | boolean | string>> {
  const entries = await Promise.all(
    keys.map(async (key) => [key, await getPolicyValue(key, batchId)] as const)
  );
  return Object.fromEntries(entries);
}

// ─── Admin CRUD ────────────────────────────────────────────────────────────────

export interface PolicyRuleView {
  key: string;
  label: string;
  description: string;
  type: PolicyValueType;
  category: string;
  unit?: string;
  /** The effective value after resolution (batch override, else global, else default). */
  effectiveValue: number | boolean | string;
  /** The institute-wide override row, if one exists. */
  global: { id: string; value: string; updatedAt: Date; updatedById: string | null } | null;
  /** Per-batch overrides for this key. */
  batchOverrides: Array<{
    id: string;
    batchId: string;
    batchName: string;
    value: string;
    updatedAt: Date;
  }>;
  isDefault: boolean;
}

/** Every known policy key, merged with whatever rows exist in the DB. */
export async function listPolicyRules(): Promise<PolicyRuleView[]> {
  const rows = await prisma.policyRule.findMany({
    include: { batch: { select: { id: true, name: true, academicYear: true } } },
    orderBy: [{ key: "asc" }],
  });

  const byKey = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byKey.get(r.key) ?? [];
    list.push(r);
    byKey.set(r.key, list);
  }

  return POLICY_KEYS.map((def) => {
    const rowsForKey = byKey.get(def.key) ?? [];
    const global = rowsForKey.find((r) => !r.batchId) ?? null;
    const batchOverrides = rowsForKey
      .filter((r) => r.batchId)
      .map((r) => ({
        id: r.id,
        batchId: r.batchId!,
        batchName: r.batch ? `${r.batch.name} (${r.batch.academicYear})` : r.batchId!,
        value: r.value,
        updatedAt: r.updatedAt,
      }));

    return {
      key: def.key,
      label: def.label,
      description: def.description,
      type: def.type,
      category: def.category,
      unit: def.unit,
      effectiveValue: parsePolicyValue(def, global?.value),
      global: global
        ? { id: global.id, value: global.value, updatedAt: global.updatedAt, updatedById: global.updatedById }
        : null,
      batchOverrides,
      isDefault: !global,
    };
  });
}

function validateValueForType(type: PolicyValueType, value: string): void {
  if (type === "NUMBER" && !Number.isFinite(Number(value))) {
    throw new ValidationError(`Value must be a number`);
  }
  if (type === "BOOLEAN" && value !== "true" && value !== "false") {
    throw new ValidationError(`Value must be "true" or "false"`);
  }
}

/** Create or update the rule for `key` at the given scope (global if batchId is omitted). */
export async function setPolicyRule(
  key: string,
  value: string,
  batchId: string | null | undefined,
  actorId: string,
  meta: RequestMeta = {}
) {
  const def = getPolicyKeyDefinition(key);
  if (!def) throw new NotFoundError(`Unknown policy key: ${key}`);
  validateValueForType(def.type, value);

  if (def.key === "profile_completion_weights" && value) {
    validateCompletionWeightsJson(value);
  }

  const scopeBatchId = batchId ?? null;

  // Manual uniqueness check: Postgres treats (key, NULL) as distinct rows,
  // so a DB unique constraint can't enforce "one global row per key".
  const existing = await prisma.policyRule.findFirst({
    where: { key, batchId: scopeBatchId },
  });

  if (scopeBatchId) {
    const batch = await prisma.batch.findUnique({ where: { id: scopeBatchId } });
    if (!batch) throw new NotFoundError("Batch not found");
  }

  const before = existing?.value;

  const rule = existing
    ? await prisma.policyRule.update({
        where: { id: existing.id },
        data: { value, updatedById: actorId },
      })
    : await prisma.policyRule.create({
        data: {
          key,
          value,
          type: def.type,
          description: def.description,
          batchId: scopeBatchId,
          updatedById: actorId,
        },
      });

  await writeAuditLog({
    userId: actorId,
    action: existing ? "UPDATE" : "CREATE",
    entity: "PolicyRule",
    entityId: rule.id,
    oldValues: existing ? { key, batchId: scopeBatchId, value: before } : undefined,
    newValues: { key, batchId: scopeBatchId, value },
    ...meta,
  });

  return rule;
}

export async function deletePolicyRule(id: string, actorId: string, meta: RequestMeta = {}) {
  const rule = await prisma.policyRule.findUnique({ where: { id } });
  if (!rule) throw new NotFoundError("Policy rule not found");

  await prisma.policyRule.delete({ where: { id } });

  await writeAuditLog({
    userId: actorId,
    action: "DELETE",
    entity: "PolicyRule",
    entityId: id,
    oldValues: { key: rule.key, batchId: rule.batchId, value: rule.value },
    metadata: { reason: "reverted to default" },
    ...meta,
  });
}

function validateCompletionWeightsJson(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("profile_completion_weights must be valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError("profile_completion_weights must be a JSON object of {sectionKey: weight}");
  }
  const total = Object.values(parsed as Record<string, unknown>).reduce((sum: number, v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      throw new ValidationError("Every weight must be a non-negative number");
    }
    return sum + n;
  }, 0);
  if (Math.round(total) !== 100) {
    throw new ValidationError(`Weights must sum to 100 (currently ${total})`);
  }
}
