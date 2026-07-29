"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState } from "@/lib/action-result";
import { createAssessment } from "@/lib/actions/assessments";

type Programme = { id: string; name: string; code: string };

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p className="text-destructive text-xs" role="alert">
      {errors[0]}
    </p>
  );
}

export function AssessmentForm({ programmes }: { programmes: Programme[] }) {
  const [state, formAction, pending] = useActionState(createAssessment, idleState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "success" ? (
        <p className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm">{state.message}</p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required placeholder="e.g. Data Structures Coursework" />
        <FieldError errors={errors.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="module">Module code</Label>
        <Input id="module" name="module" required placeholder="e.g. CS201" />
        <FieldError errors={errors.module} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deadline">Submission deadline</Label>
        <Input id="deadline" name="deadline" type="datetime-local" required />
        <FieldError errors={errors.deadline} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="programmeId">Programme</Label>
        <select
          id="programmeId"
          name="programmeId"
          defaultValue=""
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value="">All programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create assessment"}
      </Button>
    </form>
  );
}
