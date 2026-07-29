"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState } from "@/lib/action-result";
import { createStudent } from "@/lib/actions/students";

type Programme = { id: string; name: string; code: string };

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p className="text-destructive text-xs" role="alert">
      {errors[0]}
    </p>
  );
}

export function StudentForm({ programmes }: { programmes: Programme[] }) {
  const [state, formAction, pending] = useActionState(createStudent, idleState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {state.status === "success" ? (
        <div className="space-y-1 rounded-md border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-sm">
          <p>{state.message}</p>
          <Link href="/students" className="inline-block underline">
            Back to the roster
          </Link>
        </div>
      ) : null}

      {state.status === "error" && state.message ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-4 py-3 text-sm">
          {state.message}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" required />
        <FieldError errors={errors.fullName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
        <FieldError errors={errors.email} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
          <FieldError errors={errors.dateOfBirth} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="academicYear">Academic year</Label>
          <Input id="academicYear" name="academicYear" type="number" min={1} max={7} defaultValue={1} required />
          <FieldError errors={errors.academicYear} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="programmeId">Programme</Label>
        <select
          id="programmeId"
          name="programmeId"
          required
          defaultValue=""
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value="" disabled>
            Choose a programme…
          </option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          The programme&apos;s current fee is copied onto the student&apos;s account as a one-off charge, due in 30
          days. Changing the programme price later will not alter it.
        </p>
        <FieldError errors={errors.programmeId} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Enrolment status</Label>
        <select
          id="status"
          name="status"
          defaultValue="ENROLLED"
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value="ENROLLED">Enrolled</option>
          <option value="DEFERRED">Deferred</option>
          <option value="WITHDRAWN">Withdrawn</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <FieldError errors={errors.status} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Enrolling…" : "Enrol student"}
        </Button>
        <Link href="/students" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
