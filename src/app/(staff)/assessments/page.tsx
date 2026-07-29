import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import Link from "next/link";

import { AssessmentForm } from "@/components/assessment-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/authz";
import { listProgrammes } from "@/lib/queries/students";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Assessments — SMS" };

export default async function AssessmentsPage() {
  const actor = await requireStaff();

  const [assessments, programmes] = await Promise.all([
    prisma.assessment.findMany({
      orderBy: { deadline: "desc" },
      select: {
        id: true,
        title: true,
        module: true,
        deadline: true,
        programme: { select: { name: true } },
        _count: { select: { submissions: true, results: true } },
        submissions: { where: { isLate: true }, select: { id: true } },
      },
    }),
    listProgrammes(),
  ]);

  const canCreate = actor.staffRole === "ACADEMIC";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Assessments</h1>
        <p className="text-muted-foreground text-sm">
          Late work is accepted and flagged, never refused — the deadline changes how a submission is labelled, not
          whether it is allowed.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All assessments</CardTitle>
          </CardHeader>
          <CardContent>
            {assessments.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Nothing set yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="text-right">Submissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((a) => {
                    const closed = isPast(a.deadline);
                    return (
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
                        <TableCell className="text-sm">
                          <div>{format(a.deadline, "d MMM yyyy HH:mm")}</div>
                          <div className="text-muted-foreground text-xs">
                            {closed ? "closed" : `in ${formatDistanceToNowStrict(a.deadline)}`}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="tabular-nums">{a._count.submissions}</span>
                          {a.submissions.length > 0 ? (
                            <Badge variant="destructive" className="ml-2">
                              {a.submissions.length} late
                            </Badge>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">New assessment</CardTitle>
            <CardDescription>
              {canCreate ? "Students submit against this." : "Creating assessments is an academic function."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canCreate ? (
              <AssessmentForm programmes={programmes} />
            ) : (
              <p className="text-muted-foreground text-sm">
                You are signed in as Registry staff, so this is read-only for you.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
