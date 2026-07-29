import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { StudentFilters } from "@/components/student-filters";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/authz";
import { formatMoney } from "@/lib/fees";
import { PAGE_SIZE, listProgrammes, listStudents } from "@/lib/queries/students";
import { cn } from "@/lib/utils";
import { studentFilterSchema } from "@/lib/validation/student";

export const metadata = { title: "Students — SMS Registry" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireStaff();
  const raw = await searchParams;

  // Unparseable filters fall back to defaults rather than throwing — a
  // hand-edited URL should not produce an error page.
  const parsed = studentFilterSchema.safeParse(raw);
  const filter = parsed.success ? parsed.data : { page: 1 };

  const [{ rows, total, pageCount }, programmes] = await Promise.all([
    listStudents(filter),
    listProgrammes(),
  ]);

  const canEnrol = actor.staffRole === "REGISTRY";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Students</h1>
          <p className="text-muted-foreground text-sm">
            {total} record{total === 1 ? "" : "s"}
            {filter.q || filter.status || filter.programmeId ? " matching your filters" : ""}.
          </p>
        </div>
        {canEnrol ? (
          <Link href="/students/new" className={buttonVariants({ size: "lg" })}>
            Enrol student
          </Link>
        ) : (
          <p className="text-muted-foreground text-xs">Enrolment is a Registry function.</p>
        )}
      </div>

      <StudentFilters programmes={programmes} />

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              No students match those filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Programme</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.studentId}</TableCell>
                    <TableCell>
                      <Link href={`/students/${s.id}`} className="font-medium hover:underline">
                        {s.fullName}
                      </Link>
                      <div className="text-muted-foreground text-xs">{s.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{s.programme.name}</TableCell>
                    <TableCell className="text-sm">{s.academicYear}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {s.balance.credit.gt(0) ? (
                        <span className="text-sm text-emerald-600">
                          {formatMoney(s.balance.credit)} credit
                        </span>
                      ) : s.balance.outstanding.lte(0) ? (
                        <span className="text-muted-foreground text-sm">Settled</span>
                      ) : (
                        <span className="space-x-2">
                          <span className="tabular-nums">{formatMoney(s.balance.outstanding)}</span>
                          {s.balance.isOverdue ? (
                            <Badge variant="destructive">{s.balance.daysOverdue}d overdue</Badge>
                          ) : null}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pageCount > 1 ? (
        <Pagination page={filter.page} pageCount={pageCount} total={total} raw={raw} />
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  total,
  raw,
}: {
  page: number;
  pageCount: number;
  total: number;
  raw: Record<string, string | string[] | undefined>;
}) {
  function href(target: number) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string" && k !== "page") search.set(k, v);
    }
    search.set("page", String(target));
    return `/students?${search.toString()}`;
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-muted-foreground text-sm">
        Page {page} of {pageCount} · {total} student{total === 1 ? "" : "s"} · {PAGE_SIZE} per page
      </p>
      <div className="flex gap-2">
        {/* A link cannot be "disabled" — at the ends we render inert text so
            keyboard and screen-reader users aren't offered a dead control. */}
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Previous
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}>
            Previous
          </span>
        )}
        {page < pageCount ? (
          <Link href={href(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Next
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}>
            Next
          </span>
        )}
      </div>
    </div>
  );
}
