import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStudent } from "@/lib/authz";
import { computeBalance, formatMoney } from "@/lib/fees";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "My fees — SMS" };

export default async function PortalFeesPage() {
  const actor = await requireStudent();

  // Scoped to the signed-in student by id, taken from the session rather than
  // from the URL — there is no id here for anyone to tamper with.
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: actor.student.id },
    select: {
      feeRecords: { orderBy: { dueDate: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });

  const balance = computeBalance(student.feeRecords, student.payments);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My fees</h1>
        <p className="text-muted-foreground text-sm">Everything charged to your account and everything received.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Charged</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatMoney(balance.billed)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatMoney(balance.paid)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{balance.credit.gt(0) ? "In credit" : "Outstanding"}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {balance.credit.gt(0) ? formatMoney(balance.credit) : formatMoney(balance.outstanding)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {balance.isOverdue ? (
              <Badge variant="destructive">
                Overdue by {balance.daysOverdue} days
              </Badge>
            ) : balance.credit.gt(0) ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">You have overpaid — this is held as credit.</p>
            ) : balance.outstanding.gt(0) ? (
              <p className="text-muted-foreground text-xs">Not yet due.</p>
            ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Settled in full — thank you.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Charges</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {student.feeRecords.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-sm">{f.description}</TableCell>
                  <TableCell className="text-sm">{format(f.dueDate, "d MMM yyyy")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(f.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments received</CardTitle>
        </CardHeader>
        <CardContent>
          {student.payments.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No payments recorded yet. Contact the Registry if you believe this is wrong.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                    <TableCell className="text-sm">{format(p.paidAt, "d MMM yyyy")}</TableCell>
                    <TableCell className="text-sm">{p.method.replace("_", " ").toLowerCase()}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
