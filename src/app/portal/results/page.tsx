import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStudent } from "@/lib/authz";
import { type Classification, classificationLabel, classify } from "@/lib/classification";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "My results — SMS" };

const STYLE: Record<Classification, string> = {
  DISTINCTION: "border-violet-600/30 bg-violet-600/10 text-violet-700 dark:text-violet-400",
  MERIT: "border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-400",
  PASS: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  FAIL: "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400",
};

export default async function PortalResultsPage() {
  const actor = await requireStudent();

  /**
   * `isPublished: true` is part of the *query*, not a display condition.
   *
   * This is the single most important line in the student-facing app. Filtering
   * in the component would still ship the withheld score inside the rendered
   * payload, where anyone can read it in devtools. Filtering here means an
   * unreleased mark never leaves the database.
   */
  const results = await prisma.result.findMany({
    where: { studentId: actor.student.id, isPublished: true },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      score: true,
      publishedAt: true,
      assessment: { select: { title: true, module: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My results</h1>
        <p className="text-muted-foreground text-sm">
          Results appear here once released by staff. Marks that have been entered but not yet released are not shown.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marksheet</CardTitle>
          <CardDescription>Pass is 40 and above, Merit 60, Distinction 70.</CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Nothing has been released yet. Once your work is marked and published, it will appear here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Released</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => {
                  const c = classify(r.score);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.assessment.title}</TableCell>
                      <TableCell className="text-sm">{r.assessment.module}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.score ?? <span className="text-muted-foreground text-sm">absent</span>}
                      </TableCell>
                      <TableCell>
                        {c ? (
                          <Badge variant="outline" className={STYLE[c]}>
                            {classificationLabel(c)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Recorded as absent</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {r.publishedAt ? format(r.publishedAt, "d MMM yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
