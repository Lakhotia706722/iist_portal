import { z } from "zod";

/**
 * Phase 10 — shared across lib/validations/*.ts. react-hook-form's
 * `valueAsNumber: true` (used by every numeric input across the app) reads
 * the DOM's `input.valueAsNumber`, which is `NaN` — not `undefined` — for
 * a blank optional number field. `z.coerce.number().optional()` alone
 * accepts `undefined` but not `NaN` (Zod treats NaN as an invalid number,
 * same as any other bad number), so any field built that way silently
 * blocks submission the moment a user leaves it blank, despite having no
 * required marker in the UI. Found via Phase 10's real-browser onboarding
 * test (annualFamilyIncome), then swept to every other numeric-optional
 * field sharing the same shape. Wraps the inner number schema so
 * blank/NaN is treated as "not provided" before the number check runs.
 */
export function optionalNumber<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess(
    (val) => (val === "" || val === null || (typeof val === "number" && Number.isNaN(val)) ? undefined : val),
    inner.optional()
  );
}
