import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/fees";
import { getDashboardData } from "@/lib/queries/dashboard";

export const metadata = { title: "Dashboard — SMS Registry" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0">
          <p className="text-muted-foreground text-xs">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Registry dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Where the Registry team starts the day: who owes money, what is overdue, and what needs marking.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Students"
          value={String(data.totalStudents)}
          hint={`${data.byStatus.ENROLLED ?? 0} enrolled · ${data.byStatus.DEFERRED ?? 0} deferred · ${
            data.byStatus.WITHDRAWN ?? 0
          } withdrawn · ${data.byStatus.COMPLETED ?? 0} completed`}
        />
        <Stat
          label="Outstanding"
          value={formatMoney(data.totals.outstanding)}
          hint={`${formatMoney(data.totals.paid)} collected of ${formatMoney(data.totals.billed)} billed`}
        />
        <Stat
          label="Overdue accounts"
          value={String(data.overdue.length)}
          hint={
            data.overdueExcluded.length > 0
              ? `${data.overdueExcluded.length} more overdue but withdrawn or completed`
              : "Enrolled and deferred students only"
          }
        />
        <Stat
          label="Awaiting release"
          value={String(data.unpublishedResults)}
          hint={`${data.lateSubmissions} late submission${data.lateSubmissions === 1 ? "" : "s"} on record`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overdue balances</CardTitle>
          <CardDescription>
            Owing money past a due date. Withdrawn and completed students are excluded here — their debt is not
            written off, it is just not an active-student chase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.overdue.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nothing overdue. Every active account is settled or still within its due date.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Programme</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Overdue by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overdue.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/students/${row.id}`} className="font-medium hover:underline">
                        {row.fullName}
                      </Link>
                      <div className="text-muted-foreground text-xs">{row.studentId}</div>
                    </TableCell>
                    <TableCell className="text-sm">{row.programme}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status.toLowerCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(row.balance.outstanding)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">{row.balance.daysOverdue} days</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming deadlines</CardTitle>
          <CardDescription>Open assessments and how many students have submitted so far.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.assessments.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No assessments are currently open.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Programme</TableHead>
                  <TableHead className="text-right">Submitted</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assessments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/assessments/${a.id}`} className="font-medium hover:underline">
                        {a.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{a.module}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {a.programme?.name ?? "All programmes"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{a._count.submissions}</TableCell>
                    <TableCell className="text-muted-foreground text-right text-sm">
                      in {formatDistanceToNowStrict(a.deadline)}
                    </TableCell>
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
