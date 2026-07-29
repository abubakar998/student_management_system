import type { Prisma } from "@/generated/prisma/client";

export const STUDENT_ID_PREFIX = "SMS";

/**
 * Format a registry number: SMS-2025-0001.
 */
export function formatStudentId(year: number, sequence: number): string {
  return `${STUDENT_ID_PREFIX}-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Allocate the next student ID for the given year.
 *
 * Must be called inside a transaction. The counter row is updated atomically,
 * so two administrators enrolling at the same instant get different numbers —
 * `count() + 1` would hand both of them the same one.
 *
 * The sequence is per-year, so it restarts at 0001 each January.
 */
export async function allocateStudentId(
  tx: Prisma.TransactionClient,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const counter = await tx.studentIdCounter.upsert({
    where: { year },
    create: { year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });

  return formatStudentId(year, counter.lastValue);
}
