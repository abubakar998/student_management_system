import type { Prisma } from "@/generated/prisma/client";
import { computeBalance } from "@/lib/fees";
import { prisma } from "@/lib/prisma";
import type { StudentFilter } from "@/lib/validation/student";

export const PAGE_SIZE = 10;

/**
 * Search and filter the roster.
 *
 * The brief asks to search "by name, ID, programme, or status". Name and
 * student ID are a free-text box (a registrar types either without thinking
 * about which); programme and status are filters, because they are closed
 * sets. Paginated server-side so the query stays bounded.
 */
export async function listStudents(filter: StudentFilter) {
  const q = filter.q?.trim();

  const where: Prisma.StudentWhereInput = {
    archivedAt: null,
    ...(filter.programmeId ? { programmeId: filter.programmeId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { studentId: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { studentId: "asc" },
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        studentId: true,
        fullName: true,
        email: true,
        academicYear: true,
        status: true,
        programme: { select: { id: true, name: true } },
        feeRecords: { select: { amount: true, dueDate: true } },
        payments: { select: { amount: true, paidAt: true } },
      },
    }),
    prisma.student.count({ where }),
  ]);

  return {
    rows: rows.map((s) => ({ ...s, balance: computeBalance(s.feeRecords, s.payments) })),
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getStudentDetail(id: string) {
  return prisma.student.findUnique({
    where: { id },
    select: {
      id: true,
      studentId: true,
      fullName: true,
      email: true,
      dateOfBirth: true,
      academicYear: true,
      status: true,
      createdAt: true,
      archivedAt: true,
      programme: { select: { id: true, name: true, code: true } },
      feeRecords: { orderBy: { dueDate: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
      submissions: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          originalName: true,
          submittedAt: true,
          isLate: true,
          version: true,
          sizeBytes: true,
          assessment: { select: { id: true, title: true, module: true, deadline: true } },
        },
      },
      results: {
        select: {
          id: true,
          score: true,
          isPublished: true,
          publishedAt: true,
          gradedAt: true,
          gradedBy: { select: { displayName: true } },
          assessment: { select: { id: true, title: true, module: true } },
        },
      },
    },
  });
}

/**
 * Programmes for dropdowns.
 *
 * Explicitly selected rather than returning the whole row. Every caller passes
 * this straight to a client component, and `Programme.feeAmount` is a Prisma
 * `Decimal` — a class instance, not a plain object, so React cannot serialise
 * it across the server/client boundary. Selecting only the fields a `<select>`
 * needs keeps the payload serialisable and smaller.
 *
 * If a caller ever needs the fee, fetch it server-side and pass a formatted
 * string, never the Decimal itself.
 */
export function listProgrammes() {
  return prisma.programme.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
}
