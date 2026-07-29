import { Badge } from "@/components/ui/badge";
import type { EnrolmentStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const STYLES: Record<EnrolmentStatus, string> = {
  ENROLLED: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  DEFERRED: "border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  WITHDRAWN: "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400",
  COMPLETED: "border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-400",
};

const LABELS: Record<EnrolmentStatus, string> = {
  ENROLLED: "Enrolled",
  DEFERRED: "Deferred",
  WITHDRAWN: "Withdrawn",
  COMPLETED: "Completed",
};

export function StatusBadge({ status }: { status: EnrolmentStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[status])}>
      {LABELS[status]}
    </Badge>
  );
}
