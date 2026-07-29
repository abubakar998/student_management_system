/**
 * Grade classification per the brief: Pass ≥ 40, Merit ≥ 60, Distinction ≥ 70.
 * Anything below 40 is a Fail — the brief doesn't name it, but a marksheet
 * needs a label for it.
 *
 * Always derived from the score, never stored. A stored copy drifts the moment
 * a boundary changes or a grade is corrected.
 */

export const CLASSIFICATIONS = ["FAIL", "PASS", "MERIT", "DISTINCTION"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const MIN_SCORE = 0;
export const MAX_SCORE = 100;

const BOUNDARIES = { DISTINCTION: 70, MERIT: 60, PASS: 40 } as const;

/**
 * Returns null for an ungraded result (student absent or not yet marked),
 * which is distinct from a score of 0 — that is a real mark of zero.
 */
export function classify(score: number | null | undefined): Classification | null {
  if (score === null || score === undefined) return null;
  if (score >= BOUNDARIES.DISTINCTION) return "DISTINCTION";
  if (score >= BOUNDARIES.MERIT) return "MERIT";
  if (score >= BOUNDARIES.PASS) return "PASS";
  return "FAIL";
}

export function classificationLabel(c: Classification | null): string {
  if (c === null) return "Not graded";
  return c.charAt(0) + c.slice(1).toLowerCase();
}

export function isValidScore(score: number): boolean {
  return Number.isInteger(score) && score >= MIN_SCORE && score <= MAX_SCORE;
}
