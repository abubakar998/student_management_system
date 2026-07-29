import { differenceInCalendarDays, startOfDay } from "date-fns";

import { Prisma } from "@/generated/prisma/client";

type Decimal = Prisma.Decimal;
const D = Prisma.Decimal;

export type FeeLike = { amount: Decimal; dueDate: Date; description?: string };
export type PaymentLike = { amount: Decimal; paidAt: Date };

export type BalanceSummary = {
  /** Total charged across all fee records. */
  billed: Decimal;
  /** Total of every payment received. */
  paid: Decimal;
  /** billed − paid. Negative means the student has overpaid. */
  outstanding: Decimal;
  /** True when money is owed and a due date has already passed. */
  isOverdue: boolean;
  /** Days past the oldest still-unsettled due date; 0 when not overdue. */
  daysOverdue: number;
  /** The due date `daysOverdue` is measured from, for display. */
  overdueSince: Date | null;
  /** Credit held on the account when the student has overpaid. */
  credit: Decimal;
};

const ZERO = new D(0);

/**
 * Derive a student's financial position from their charges and payments.
 *
 * The balance is never stored — a stored balance drifts the moment a payment
 * is corrected or a fee is amended. It is always recomputed from transactions.
 *
 * Payments are allocated oldest-charge-first, which is how a finance office
 * actually settles an account. That matters for `daysOverdue`: a student who
 * has paid enough to clear their oldest invoice is not overdue on it, even if
 * a newer invoice remains outstanding.
 */
export function computeBalance(
  fees: readonly FeeLike[],
  payments: readonly PaymentLike[],
  today: Date = new Date(),
): BalanceSummary {
  const billed = fees.reduce<Decimal>((sum, f) => sum.plus(f.amount), ZERO);
  const paid = payments.reduce<Decimal>((sum, p) => sum.plus(p.amount), ZERO);
  const outstanding = billed.minus(paid);

  // Allocate the payment pool across charges, oldest due date first.
  const ordered = [...fees].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  let pool = paid;
  let overdueSince: Date | null = null;
  const cutoff = startOfDay(today);

  for (const fee of ordered) {
    const applied = D.min(pool, fee.amount) as Decimal;
    pool = pool.minus(applied);
    const stillOwed = fee.amount.minus(applied);

    if (stillOwed.gt(ZERO) && startOfDay(fee.dueDate) < cutoff) {
      overdueSince = fee.dueDate;
      break; // oldest unsettled overdue charge wins
    }
  }

  const isOverdue = overdueSince !== null && outstanding.gt(ZERO);

  return {
    billed,
    paid,
    outstanding,
    isOverdue,
    daysOverdue: isOverdue && overdueSince ? differenceInCalendarDays(cutoff, startOfDay(overdueSince)) : 0,
    overdueSince: isOverdue ? overdueSince : null,
    credit: outstanding.lt(ZERO) ? outstanding.abs() : ZERO,
  };
}

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** Format money for display. Accepts Prisma Decimal, string, or number. */
export function formatMoney(value: Decimal | string | number): string {
  return gbp.format(Number(value.toString()));
}
