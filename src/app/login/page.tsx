import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActor } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in — Student Management System" };

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(actor.role === "STAFF" ? "/dashboard" : "/portal");

  return (
    <main className="relative flex min-h-svh items-center justify-center p-4">
      {/* Available before signing in, so the theme can be set on arrival. */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Student Management System</CardTitle>
          <CardDescription>Registry module — sign in to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
