import Link from "next/link";
import { redirect } from "next/navigation";

import { StudentForm } from "@/components/student-form";
import { requireStaff } from "@/lib/authz";
import { listProgrammes } from "@/lib/queries/students";

export const metadata = { title: "Enrol student — SMS Registry" };

export default async function NewStudentPage() {
  const actor = await requireStaff();
  // Enrolment is Registry work; academic staff are sent back to the roster.
  if (actor.staffRole !== "REGISTRY") redirect("/students");

  const programmes = await listProgrammes();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/students" className="text-muted-foreground text-sm hover:underline">
          ← Students
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Enrol a student</h1>
        <p className="text-muted-foreground text-sm">
          A registry number is allocated automatically in the form SMS-{new Date().getFullYear()}-0001.
        </p>
      </div>

      <StudentForm programmes={programmes} />
    </div>
  );
}
