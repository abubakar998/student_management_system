import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/authz";

/** Every page in this group is staff-only; the guard runs before they render. */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireStaff();
  return <AppShell actor={actor}>{children}</AppShell>;
}
