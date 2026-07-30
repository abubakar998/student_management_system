import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";
import type { Actor } from "@/lib/session";

type NavItem = { href: string; label: string };

const REGISTRY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/students", label: "Students" },
  { href: "/fees", label: "Fees" },
  { href: "/assessments", label: "Assessments" },
  { href: "/marksheet", label: "Marksheet" },
];

const ACADEMIC_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assessments", label: "Assessments" },
  { href: "/marksheet", label: "Marksheet" },
  { href: "/students", label: "Students" },
];

const STUDENT_NAV: NavItem[] = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/fees", label: "My fees" },
  { href: "/portal/assessments", label: "Assessments" },
  { href: "/portal/results", label: "Results" },
];

function navFor(actor: Actor): NavItem[] {
  if (actor.role === "STUDENT") return STUDENT_NAV;
  // Both departments can read everything; the order puts each one's own work
  // first. Write permissions are enforced in the actions, not the navigation.
  return actor.staffRole === "ACADEMIC" ? ACADEMIC_NAV : REGISTRY_NAV;
}

function roleLabel(actor: Actor): string {
  if (actor.role === "STUDENT") return "Student";
  return actor.staffRole === "ACADEMIC" ? "Academic staff" : "Registry staff";
}

export function AppShell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const nav = navFor(actor);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background sticky top-0 z-10 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href={actor.role === "STAFF" ? "/dashboard" : "/portal"} className="font-semibold">
            SMS <span className="text-muted-foreground font-normal">Registry</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:bg-accent rounded-md px-3 py-1.5 text-sm transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="text-right leading-tight">
              <p className="text-sm font-medium">{actor.displayName}</p>
              <p className="text-muted-foreground text-xs">
                {actor.student ? (
                  <>
                    {actor.student.studentId}{" "}
                    <Badge variant="outline" className="ml-1 align-middle text-[10px]">
                      {actor.student.status.toLowerCase()}
                    </Badge>
                  </>
                ) : (
                  roleLabel(actor)
                )}
              </p>
            </div>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
