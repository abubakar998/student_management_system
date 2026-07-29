import { format, formatDistanceToNowStrict, isPast } from "date-fns";

import { SubmissionForm } from "@/components/submission-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStudent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Assessments — SMS" };

export default async function PortalAssessmentsPage() {
  const actor = await requireStudent();

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: actor.student.id },
    select: { programmeId: true },
  });

  // Assessments for this student's programme, plus any that apply to everyone.
  const assessments = await prisma.assessment.findMany({
    where: { OR: [{ programmeId: student.programmeId }, { programmeId: null }] },
    orderBy: { deadline: "asc" },
    select: {
      id: true,
      title: true,
      module: true,
      deadline: true,
      submissions: {
        where: { studentId: actor.student.id },
        select: { id: true, originalName: true, submittedAt: true, isLate: true, version: true },
      },
    },
  });

  const canSubmit = actor.student.status === "ENROLLED";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Assessments</h1>
        <p className="text-muted-foreground text-sm">
          One submission per assessment. Uploading again replaces your file and keeps the same submission.
        </p>
      </div>

      {!canSubmit ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Your enrolment status is <strong>{actor.student.status.toLowerCase()}</strong>, so you cannot submit new
          work. Existing submissions are still shown below.
        </div>
      ) : null}

      {assessments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">No assessments have been set for your programme yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assessments.map((a) => {
            const submission = a.submissions[0];
            const closed = isPast(a.deadline);

            return (
              <Card key={a.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{a.title}</CardTitle>
                      <CardDescription>
                        {a.module} · deadline {format(a.deadline, "d MMM yyyy HH:mm")}{" "}
                        {closed ? "· closed" : `· in ${formatDistanceToNowStrict(a.deadline)}`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {submission ? (
                        submission.isLate ? (
                          <Badge variant="destructive">Submitted late</Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-600/30 text-emerald-700">
                            Submitted
                          </Badge>
                        )
                      ) : closed ? (
                        <Badge variant="destructive">Missed</Badge>
                      ) : (
                        <Badge variant="outline">Not submitted</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {submission ? (
                    <p className="text-sm">
                      <a href={`/api/submissions/${submission.id}`} className="underline">
                        {submission.originalName}
                      </a>{" "}
                      <span className="text-muted-foreground">
                        · uploaded {format(submission.submittedAt, "d MMM yyyy HH:mm")}
                        {submission.version > 1 ? ` · version ${submission.version}` : ""}
                      </span>
                    </p>
                  ) : null}

                  {canSubmit ? (
                    <SubmissionForm
                      assessmentId={a.id}
                      isResubmission={Boolean(submission)}
                      deadlinePassed={closed}
                    />
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
