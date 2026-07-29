import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { StudentStatusControl } from "@/components/student-status-control";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { classificationLabel, classify } from "@/lib/classification";
import { requireStaff } from "@/lib/authz";
import { computeBalance, formatMoney } from "@/lib/fees";
import { getStudentDetail } from "@/lib/queries/students";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaff();
  const { id } = await params;

  const student = await getStudentDetail(id);
  if (!student || student.archivedAt) notFound();

  const balance = computeBalance(student.feeRecords, student.payments);
  const canEdit = actor.staffRole === "REGISTRY";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/students" className="text-muted-foreground text-sm hover:underline">
          ← Students
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{student.fullName}</h1>
          <StatusBadge status={student.status} />
        </div>
        <p className="text-muted-foreground text-sm">
          <span className="font-mono">{student.studentId}</span> · {student.email} · {student.programme.name} · Year{" "}
          {student.academicYear} · born {format(student.dateOfBirth, "d MMM yyyy")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {balance.credit.gt(0) ? `${formatMoney(balance.credit)} cr` : formatMoney(balance.outstanding)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {balance.isOverdue ? (
              <Badge variant="destructive">
                {balance.daysOverdue} days overdue since {format(balance.overdueSince!, "d MMM yyyy")}
              </Badge>
            ) : balance.credit.gt(0) ? (
              <p className="text-xs text-emerald-600">Overpaid — held as credit.</p>
            ) : balance.outstanding.gt(0) ? (
              <p className="text-muted-foreground text-xs">Owed, but not yet due.</p>
            ) : (
              <p className="text-xs text-emerald-600">Settled in full.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Billed / paid</CardDescription>
            <CardTitle className="text-lg tabular-nums">
              {formatMoney(balance.billed)} / {formatMoney(balance.paid)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-muted-foreground text-xs">
              {student.payments.length} payment{student.payments.length === 1 ? "" : "s"} recorded
            </p>
          </CardContent>
        </Card>

        {canEdit ? (
          <StudentStatusControl id={student.id} status={student.status} />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Enrolment status</CardDescription>
              <CardTitle className="text-lg">{student.status.toLowerCase()}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-muted-foreground text-xs">Only Registry staff can change this.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="fees">
        <TabsList>
          <TabsTrigger value="fees">Fees &amp; payments</TabsTrigger>
          <TabsTrigger value="submissions">Submissions ({student.submissions.length})</TabsTrigger>
          <TabsTrigger value="results">Results ({student.results.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="fees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Charges</CardTitle>
              <CardDescription>
                Each charge stores the fee as it stood when raised, so a later change to the programme price does not
                rewrite history.
              </CardDescription>
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
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {student.payments.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">Nothing paid yet.</p>
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
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardContent className="pt-6">
              {student.submissions.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">Nothing submitted yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.submissions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <span className="font-medium">{s.assessment.title}</span>
                          <div className="text-muted-foreground text-xs">{s.assessment.module}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.originalName}
                          {s.version > 1 ? (
                            <span className="text-muted-foreground text-xs"> (v{s.version})</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">{format(s.submittedAt, "d MMM yyyy HH:mm")}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(s.assessment.deadline, "d MMM yyyy HH:mm")}
                        </TableCell>
                        <TableCell>{s.isLate ? <Badge variant="destructive">Late</Badge> : null}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardDescription>
                Staff see every mark. The student sees only those that have been published.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {student.results.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">Nothing marked yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Marked by</TableHead>
                      <TableHead>Visible to student</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.results.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <span className="font-medium">{r.assessment.title}</span>
                          <div className="text-muted-foreground text-xs">{r.assessment.module}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.score ?? <span className="text-muted-foreground text-sm">absent</span>}
                        </TableCell>
                        <TableCell className="text-sm">{classificationLabel(classify(r.score))}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {r.gradedBy?.displayName ?? "—"}
                        </TableCell>
                        <TableCell>
                          {r.isPublished ? (
                            <Badge variant="outline" className="border-emerald-600/30 text-emerald-700">
                              Published
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-600/30 text-amber-700">
                              Withheld
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
