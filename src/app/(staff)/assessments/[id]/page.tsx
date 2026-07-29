import { format, isPast } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      module: true,
      deadline: true,
      programme: { select: { id: true, name: true } },
      submissions: {
        orderBy: { submittedAt: "asc" },
        select: {
          id: true,
          originalName: true,
          submittedAt: true,
          isLate: true,
          version: true,
          sizeBytes: true,
          student: { select: { id: true, studentId: true, fullName: true, status: true } },
        },
      },
    },
  });

  if (!assessment) notFound();

  // Who was expected to submit: everyone on the programme, or everyone if the
  // assessment is not programme-specific.
  const expected = await prisma.student.count({
    where: {
      archivedAt: null,
      status: "ENROLLED",
      ...(assessment.programme ? { programmeId: assessment.programme.id } : {}),
    },
  });

  const lateCount = assessment.submissions.filter((s) => s.isLate).length;
  const closed = isPast(assessment.deadline);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/assessments" className="text-muted-foreground text-sm hover:underline">
          ← Assessments
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{assessment.title}</h1>
        <p className="text-muted-foreground text-sm">
          {assessment.module} · {assessment.programme?.name ?? "All programmes"} · deadline{" "}
          {format(assessment.deadline, "d MMM yyyy HH:mm")} {closed ? "(closed)" : "(open)"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Submitted</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {assessment.submissions.length}
              <span className="text-muted-foreground text-base"> / {expected}</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Late</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{lateCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Not submitted</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {Math.max(0, expected - assessment.submissions.length)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
          <CardDescription>
            The late flag is recorded when the file arrives, so moving the deadline afterwards does not rewrite it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessment.submissions.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Nothing submitted yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessment.submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/students/${s.student.id}`} className="font-medium hover:underline">
                        {s.student.fullName}
                      </Link>
                      <div className="text-muted-foreground font-mono text-xs">{s.student.studentId}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <a href={`/api/submissions/${s.id}`} className="underline">
                        {s.originalName}
                      </a>
                      {s.version > 1 ? (
                        <span className="text-muted-foreground text-xs"> (v{s.version})</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{format(s.submittedAt, "d MMM yyyy HH:mm")}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {(s.sizeBytes / 1024).toFixed(0)} KB
                    </TableCell>
                    <TableCell>{s.isLate ? <Badge variant="destructive">Late</Badge> : null}</TableCell>
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
