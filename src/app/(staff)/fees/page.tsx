import { format } from "date-fns";
import Link from "next/link";

import { PaymentForm } from "@/components/payment-form";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Prisma } from "@/generated/prisma/client";
import { requireStaff } from "@/lib/authz";
import { computeBalance, formatMoney } from "@/lib/fees";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Fees — SMS Registry" };

export default async function FeesPage() {
  const actor = await requireStaff();

  const students = await prisma.student.findMany({
    where: { archivedAt: null },
    orderBy: { studentId: "asc" },
    select: {
      id: true,
      studentId: true,
      fullName: true,
      status: true,
      feeRecords: { select: { amount: true, dueDate: true } },
      payments: { select: { amount: true, paidAt: true } },
    },
  });

  const rows = students.map((s) => ({ ...s, balance: computeBalance(s.feeRecords, s.payments) }));

  const zero = new Prisma.Decimal(0);
  const totals = rows.reduce(
    (acc, r) => ({
      billed: acc.billed.plus(r.balance.billed),
      paid: acc.paid.plus(r.balance.paid),
      outstanding: acc.outstanding.plus(r.balance.outstanding),
    }),
    { billed: zero, paid: zero, outstanding: zero },
  );

  const canRecord = actor.staffRole === "REGISTRY";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fees &amp; payments</h1>
        <p className="text-muted-foreground text-sm">
          Balances are derived from charges minus payments every time they are shown — never stored, so nothing can
          drift out of step.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Billed</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatMoney(totals.billed)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Collected</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatMoney(totals.paid)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatMoney(totals.outstanding)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/students/${r.id}`} className="font-medium hover:underline">
                        {r.fullName}
                      </Link>
                      <div className="text-muted-foreground font-mono text-xs">{r.studentId}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.balance.billed)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.balance.paid)}</TableCell>
                    <TableCell className="text-right">
                      {r.balance.credit.gt(0) ? (
                        <span className="text-sm text-emerald-600">{formatMoney(r.balance.credit)} credit</span>
                      ) : r.balance.outstanding.lte(0) ? (
                        <span className="text-muted-foreground text-sm">Settled</span>
                      ) : (
                        <div className="space-y-1">
                          <div className="tabular-nums">{formatMoney(r.balance.outstanding)}</div>
                          {r.balance.isOverdue ? (
                            <Badge variant="destructive">
                              {r.balance.daysOverdue}d · since {format(r.balance.overdueSince!, "d MMM")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">not yet due</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Record a payment</CardTitle>
            <CardDescription>
              {canRecord
                ? "Payments are allocated to the oldest unpaid charge first."
                : "Recording payments is a Registry function."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canRecord ? (
              <PaymentForm students={rows.map((r) => ({ id: r.id, studentId: r.studentId, fullName: r.fullName }))} />
            ) : (
              <p className="text-muted-foreground text-sm">
                You are signed in as academic staff, so this form is read-only for you.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
