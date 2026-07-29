"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { idleState } from "@/lib/action-result";
import { saveGrade, setResultPublished } from "@/lib/actions/results";
import { type Classification, classificationLabel } from "@/lib/classification";

const CLASSIFICATION_STYLE: Record<Classification, string> = {
  DISTINCTION: "border-violet-600/30 bg-violet-600/10 text-violet-700 dark:text-violet-400",
  MERIT: "border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-400",
  PASS: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  FAIL: "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400",
};

export type GradeRowData = {
  resultId: string | null;
  studentId: string;
  studentNumber: string;
  studentName: string;
  score: number | null;
  classification: Classification | null;
  isPublished: boolean;
  hasSubmission: boolean;
  isLate: boolean;
  canEdit: boolean;
};

export function GradeRow({ assessmentId, row }: { assessmentId: string; row: GradeRowData }) {
  const [state, formAction, pending] = useActionState(saveGrade, idleState);

  return (
    <TableRow>
      <TableCell>
        <span className="font-medium">{row.studentName}</span>
        <div className="text-muted-foreground font-mono text-xs">{row.studentNumber}</div>
      </TableCell>

      <TableCell>
        {row.hasSubmission ? (
          row.isLate ? (
            <Badge variant="destructive">Late</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">On time</span>
          )
        ) : (
          <span className="text-muted-foreground text-sm">No submission</span>
        )}
      </TableCell>

      <TableCell>
        {row.canEdit ? (
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <input type="hidden" name="studentId" value={row.studentId} />
            <Input
              name="score"
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={row.score ?? ""}
              placeholder="absent"
              className="w-24"
              aria-label={`Score for ${row.studentName}`}
            />
            <Button type="submit" variant="secondary" size="sm" disabled={pending}>
              {pending ? "…" : "Save"}
            </Button>
          </form>
        ) : (
          <span className="tabular-nums">{row.score ?? "—"}</span>
        )}
        {state.status === "error" && state.message ? (
          <p className="text-destructive mt-1 text-xs" role="alert">
            {state.message}
          </p>
        ) : null}
      </TableCell>

      <TableCell>
        {row.classification ? (
          <Badge variant="outline" className={CLASSIFICATION_STYLE[row.classification]}>
            {classificationLabel(row.classification)}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">
            {row.score === null && row.resultId ? "Absent" : "—"}
          </span>
        )}
      </TableCell>

      <TableCell className="text-right">
        {row.resultId ? (
          row.canEdit ? (
            <form action={setResultPublished} className="inline">
              <input type="hidden" name="id" value={row.resultId} />
              <input type="hidden" name="publish" value={String(!row.isPublished)} />
              <Button type="submit" variant={row.isPublished ? "outline" : "default"} size="sm">
                {row.isPublished ? "Withhold" : "Publish"}
              </Button>
            </form>
          ) : (
            <Badge variant="outline">{row.isPublished ? "Published" : "Withheld"}</Badge>
          )
        ) : (
          <span className="text-muted-foreground text-xs">Not marked</span>
        )}
      </TableCell>
    </TableRow>
  );
}
