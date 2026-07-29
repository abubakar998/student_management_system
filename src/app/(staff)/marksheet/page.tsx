import { format } from "date-fns";
import Link from "next/link";

import { GradeRow, type GradeRowData } from "@/components/grade-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/authz";
import { classify } from "@/lib/classification";
import { publishAllForAssessment } from "@/lib/actions/results";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Marksheet — SMS" };

export default async function MarksheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireStaff();
  const raw = await searchParams;
  const requested = typeof raw.assessmentId === "string" ? raw.assessmentId : undefined;

  const assessments = await prisma.assessment.findMany({
    orderBy: { deadline: "desc" },
    select: { id: true, title: true, module: true, deadline: true, programmeId: true },
  });

  const selected = assessments.find((a) => a.id === requested) ?? assessments[0];
  const canEdit = actor.staffRole === "ACADEMIC";

  if (!selected) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Marksheet</h1>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              No assessments exist yet. Create one first, then marks can be entered here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Everyone expected to be marked: the cohort, not just those who submitted,
  // so a non-submission can be recorded as absent rather than silently ignored.
  const [students, results, submissions] = await Promise.all([
    prisma.student.findMany({
      where: {
        archivedAt: null,
        status: { in: ["ENROLLED", "COMPLETED"] },
        ...(selected.programmeId ? { programmeId: selected.programmeId } : {}),
      },
      orderBy: { studentId: "asc" },
      select: { id: true, studentId: true, fullName: true },
    }),
    prisma.result.findMany({ where: { assessmentId: selected.id } }),
    prisma.submission.findMany({
      where: { assessmentId: selected.id },
      select: { studentId: true, isLate: true },
    }),
  ]);

  const resultByStudent = new Map(results.map((r) => [r.studentId, r]));
  const submissionByStudent = new Map(submissions.map((s) => [s.studentId, s]));

  const rows: GradeRowData[] = students.map((s) => {
    const result = resultByStudent.get(s.id);
    const submission = submissionByStudent.get(s.id);
    return {
      resultId: result?.id ?? null,
      studentId: s.id,
      studentNumber: s.studentId,
      studentName: s.fullName,
      score: result?.score ?? null,
      classification: classify(result?.score ?? null),
      isPublished: result?.isPublished ?? false,
      hasSubmission: Boolean(submission),
      isLate: submission?.isLate ?? false,
      canEdit,
    };
  });

  const withheld = rows.filter((r) => r.resultId && !r.isPublished).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Marksheet</h1>
        <p className="text-muted-foreground text-sm">
          Marks stay hidden from students until released. A blank score means absent, which is not the same as a mark
          of zero.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {assessments.map((a) => (
          <Link
            key={a.id}
            href={`/marksheet?assessmentId=${a.id}`}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              a.id === selected.id ? "bg-primary text-primary-foreground border-transparent" : "hover:bg-accent"
            }`}
          >
            {a.module} · {a.title}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{selected.title}</CardTitle>
              <CardDescription>
                {selected.module} · deadline {format(selected.deadline, "d MMM yyyy HH:mm")} ·{" "}
                {withheld} withheld
              </CardDescription>
            </div>
            {canEdit && withheld > 0 ? (
              <form action={publishAllForAssessment}>
                <input type="hidden" name="assessmentId" value={selected.id} />
                <Button type="submit" size="sm">
                  Publish all {withheld}
                </Button>
              </form>
            ) : null}
          </div>
          {!canEdit ? (
            <p className="text-muted-foreground text-xs">
              Entering and releasing marks is an academic function — this is read-only for Registry staff.
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Submission</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Classification</TableHead>
                <TableHead className="text-right">Visible to student</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <GradeRow key={row.studentId} assessmentId={selected.id} row={row} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
