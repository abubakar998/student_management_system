"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/actions/auth";
import { idleState } from "@/lib/action-result";

/**
 * Demo accounts created by `prisma db seed`. Listed here so a reviewer can
 * switch persona in one click instead of typing credentials — the login is
 * still a real one, this only fills the form.
 */
const DEMO_ACCOUNTS = [
  { label: "Registry staff", email: "registry@sms.test", hint: "enrolment, fees, dashboard" },
  { label: "Academic staff", email: "academic@sms.test", hint: "assessments, marksheet" },
  { label: "Student — Amara", email: "amara.okafor@student.sms.test", hint: "overdue balance, distinction" },
  { label: "Student — Ben", email: "ben.whitfield@student.sms.test", hint: "late submission, result withheld" },
] as const;

const DEMO_PASSWORD = "Password123!";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, idleState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@sms.test"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {state.status === "error" && state.message ? (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.message}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="space-y-3 rounded-lg border border-dashed p-4">
        <div>
          <p className="text-sm font-medium">Demo accounts</p>
          <p className="text-muted-foreground text-xs">
            Click one to fill the form, then sign in. Password for all: <code>{DEMO_PASSWORD}</code>
          </p>
        </div>
        <div className="grid gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
              }}
              className="hover:bg-accent flex flex-col items-start rounded-md border px-3 py-2 text-left text-sm transition-colors"
            >
              <span className="font-medium">{account.label}</span>
              <span className="text-muted-foreground text-xs">{account.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
