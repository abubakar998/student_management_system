import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import type { EnrolmentStatus } from "@/generated/prisma/enums";
import { updateStudentStatus } from "@/lib/actions/students";

const STATUSES: EnrolmentStatus[] = ["ENROLLED", "DEFERRED", "WITHDRAWN", "COMPLETED"];

/**
 * Registry-only status change. Withdrawing takes effect on the student's next
 * request — their existing session immediately loses the right to submit
 * coursework, because role and status are read from the database rather than
 * trusted from their token.
 */
export function StudentStatusControl({ id, status }: { id: string; status: EnrolmentStatus }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Enrolment status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <form action={updateStudentStatus} className="flex gap-2">
          <input type="hidden" name="id" value={id} />
          <select
            name="status"
            defaultValue={status}
            aria-label="Enrolment status"
            className="border-input bg-background h-8 flex-1 rounded-md border px-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" size="sm">
            Update
          </Button>
        </form>
        <p className="text-muted-foreground text-xs">
          Withdrawing blocks new submissions immediately, on the student&apos;s existing session. Fees already owed
          are not written off.
        </p>
      </CardContent>
    </Card>
  );
}
