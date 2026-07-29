import { AppShell } from "@/components/app-shell";
import { requireStudent } from "@/lib/authz";

/** Student-facing portal. Staff are redirected to their own dashboard. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireStudent();
  return <AppShell actor={actor}>{children}</AppShell>;
}
