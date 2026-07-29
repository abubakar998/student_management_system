"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { idleState } from "@/lib/action-result";
import { submitAssessment } from "@/lib/actions/assessments";

export function SubmissionForm({
  assessmentId,
  isResubmission,
  deadlinePassed,
}: {
  assessmentId: string;
  isResubmission: boolean;
  deadlinePassed: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitAssessment, idleState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="assessmentId" value={assessmentId} />

      {state.status === "success" ? (
        <p className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm">{state.message}</p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="file"
          name="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          className="max-w-xs"
          aria-label="Coursework file"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : isResubmission ? "Replace submission" : "Submit"}
        </Button>
      </div>

      {errors.file?.length ? (
        <p className="text-destructive text-xs" role="alert">
          {errors.file[0]}
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs">
        PDF or DOCX, up to 10 MB.{" "}
        {deadlinePassed
          ? "The deadline has passed — your work will still be accepted, but flagged as late."
          : isResubmission
            ? "Replacing your file keeps the same submission and increments its version."
            : "You can replace your file any time."}
      </p>
    </form>
  );
}
