import { Prisma } from "@/generated/prisma/client";
import type { EnrolmentStatus } from "@/generated/prisma/enums";
import { type BalanceSummary, computeBalance } from "@/lib/fees";
import { prisma } from "@/lib/prisma";

export type OverdueRow = {
  id: string;
  studentId: string;
  fullName: string;
  programme: string;
  status: EnrolmentStatus;
  balance: BalanceSummary;
};

/**
 * Statuses the Registry actively chases for money. Withdrawn and completed
 * students are excluded from the chase list — their debt is NOT written off
 * (it still counts in the totals below), but pursuing an active-student
 * workflow against someone who has left is a different process.
 */
const CHASEABLE: EnrolmentStatus[] = ["ENROLLED", "DEFERRED"];

export async function getDashboardData() {
  const [statusGroups, students, assessments, lateSubmissions, unpublishedResults] = await Promise.all([
    prisma.student.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { archivedAt: null },
    }),
    prisma.student.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        studentId: true,
        fullName: true,
        status: true,
        programme: { select: { name: true } },
        feeRecords: { select: { amount: true, dueDate: true } },
        payments: { select: { amount: true, paidAt: true } },
      },
    }),
    prisma.assessment.findMany({
      where: { deadline: { gte: new Date() } },
      orderBy: { deadline: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        module: true,
        deadline: true,
        programme: { select: { name: true } },
        _count: { select: { submissions: true } },
      },
    }),
    prisma.submission.count({ where: { isLate: true } }),
    prisma.result.count({ where: { isPublished: false } }),
  ]);

  const byStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])) as Record<
    EnrolmentStatus,
    number | undefined
  >;

  // Balances are derived per student rather than aggregated in SQL because the
  // oldest-charge-first allocation that decides "overdue" is business logic,
  // not arithmetic. At a few thousand students this is fine; beyond that it
  // would move into a database view.
  const rows: OverdueRow[] = students.map((s) => ({
    id: s.id,
    studentId: s.studentId,
    fullName: s.fullName,
    programme: s.programme.name,
    status: s.status,
    balance: computeBalance(s.feeRecords, s.payments),
  }));

  const overdue = rows
    .filter((r) => r.balance.isOverdue && CHASEABLE.includes(r.status))
    .sort((a, b) => b.balance.daysOverdue - a.balance.daysOverdue);

  const overdueExcluded = rows.filter((r) => r.balance.isOverdue && !CHASEABLE.includes(r.status));

  const zero = new Prisma.Decimal(0);
  const totals = rows.reduce(
    (acc, r) => ({
      billed: acc.billed.plus(r.balance.billed),
      paid: acc.paid.plus(r.balance.paid),
      outstanding: acc.outstanding.plus(r.balance.outstanding),
    }),
    { billed: zero, paid: zero, outstanding: zero },
  );

  return {
    byStatus,
    totalStudents: rows.length,
    overdue,
    overdueExcluded,
    totals,
    assessments,
    lateSubmissions,
    unpublishedResults,
  };
}
