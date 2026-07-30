import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStudent } from "@/lib/authz";
import { computeBalance, formatMoney } from "@/lib/fees";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "My record — SMS" };

export default async function PortalPage() {
  const actor = await requireStudent();

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: actor.student.id },
    select: {
      studentId: true,
      fullName: true,
      academicYear: true,
      status: true,
      programme: { select: { name: true } },
      feeRecords: { select: { amount: true, dueDate: true } },
      payments: { select: { amount: true, paidAt: true } },
      _count: { select: { submissions: true } },
    },
  });

  // Only published results are counted — an unpublished mark must not even
  // reach this page as a number.
  const publishedResults = await prisma.result.count({
    where: { studentId: actor.student.id, isPublished: true },
  });

  const balance = computeBalance(student.feeRecords, student.payments);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{student.fullName}</h1>
        <p className="text-muted-foreground text-sm">
          {student.studentId} · {student.programme.name} · Year {student.academicYear}{" "}
          <Badge variant="outline" className="ml-1 align-middle">
            {student.status.toLowerCase()}
          </Badge>
        </p>
      </div>

      {student.status !== "ENROLLED" ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Your enrolment status is <strong>{student.status.toLowerCase()}</strong>. You can still view your record,
          but you cannot submit new coursework. Contact the Registry if this looks wrong.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Balance</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {balance.credit.gt(0) ? formatMoney(balance.credit) : formatMoney(balance.outstanding)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {balance.credit.gt(0) ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">In credit — nothing to pay.</p>
            ) : balance.isOverdue ? (
              <p className="text-destructive text-xs">Overdue by {balance.daysOverdue} days.</p>
            ) : balance.outstanding.gt(0) ? (
              <p className="text-muted-foreground text-xs">Not yet due.</p>
            ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Settled in full.</p>
            )}
            <Link href="/portal/fees" className="mt-2 inline-block text-xs underline">
              View fees and payments
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Submissions</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{student._count.submissions}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Link href="/portal/assessments" className="text-xs underline">
              View assessments
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Published results</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{publishedResults}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-muted-foreground text-xs">Results appear once released by staff.</p>
            <Link href="/portal/results" className="mt-2 inline-block text-xs underline">
              View marksheet
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
