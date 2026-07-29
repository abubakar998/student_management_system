"use client";

import { useActionState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState } from "@/lib/action-result";
import { recordPayment } from "@/lib/actions/payments";

type StudentOption = { id: string; studentId: string; fullName: string };

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p className="text-destructive text-xs" role="alert">
      {errors[0]}
    </p>
  );
}

export function PaymentForm({
  students,
  defaultStudentId,
}: {
  students: StudentOption[];
  defaultStudentId?: string;
}) {
  const [state, formAction, pending] = useActionState(recordPayment, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a successful entry so the next receipt can be keyed
  // straight away without stale values being resubmitted.
  if (state.status === "success" && formRef.current) {
    formRef.current.reset();
  }

  const errors = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.status === "success" ? (
        <p className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}

      {state.status === "error" && state.message ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="studentId">Student</Label>
        <select
          id="studentId"
          name="studentId"
          required
          defaultValue={defaultStudentId ?? ""}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value="" disabled>
            Choose a student…
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.studentId} — {s.fullName}
            </option>
          ))}
        </select>
        <FieldError errors={errors.studentId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (£)</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
          <FieldError errors={errors.amount} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paidAt">Date received</Label>
          <Input id="paidAt" name="paidAt" type="date" max={today} defaultValue={today} required />
          <FieldError errors={errors.paidAt} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reference">Reference</Label>
          <Input id="reference" name="reference" required placeholder="e.g. PAY-0007" />
          <FieldError errors={errors.reference} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="method">Method</Label>
          <select
            id="method"
            name="method"
            defaultValue="BANK_TRANSFER"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
            <option value="BURSARY">Bursary</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" maxLength={280} />
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
      <p className="text-muted-foreground text-xs">
        References are unique, so re-keying a receipt that is already on file is rejected rather than double-counted.
      </p>
    </form>
  );
}
