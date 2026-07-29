"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { type ActionState, errorState, fromZodError, successState, toActionState } from "@/lib/action-result";
import { assertRegistry } from "@/lib/authz";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { allocateStudentId } from "@/lib/student-id";
import { enrolmentStatusSchema, studentSchema } from "@/lib/validation/student";

/** Postgres unique-violation code, surfaced by Prisma as P2002. */
const UNIQUE_VIOLATION = "P2002";

export async function createStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertRegistry();

    const parsed = studentSchema.safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      dateOfBirth: formData.get("dateOfBirth"),
      programmeId: formData.get("programmeId"),
      academicYear: formData.get("academicYear"),
      status: formData.get("status") || undefined,
    });

    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const programme = await prisma.programme.findUnique({ where: { id: input.programmeId } });
    if (!programme) return errorState("That programme no longer exists.", { programmeId: ["Choose a programme."] });

    // A temporary password is issued with the record, the way a registry hands
    // over credentials. Shown once, then only its hash is stored.
    const temporaryPassword = randomBytes(6).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);

    const student = await prisma.$transaction(async (tx) => {
      // Inside the transaction so a concurrent enrolment cannot take the same
      // number, and so a later failure rolls the sequence back with it.
      const studentId = await allocateStudentId(tx);

      const created = await tx.student.create({
        data: {
          studentId,
          fullName: input.fullName,
          email: input.email,
          dateOfBirth: input.dateOfBirth,
          academicYear: input.academicYear,
          status: input.status,
          programmeId: programme.id,
          feeRecords: {
            create: {
              programmeId: programme.id,
              // Snapshot: changing the programme's price later must not rewrite
              // what this student was charged.
              amount: programme.feeAmount,
              description: `${programme.name} — tuition year ${input.academicYear}`,
              academicYear: input.academicYear,
              // The brief never defines a due date, so we set one: fees fall due
              // 30 days after enrolment. "Overdue" needs something to measure.
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
      });

      await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.fullName,
          role: "STUDENT",
          studentId: created.id,
        },
      });

      return created;
    });

    revalidatePath("/students");
    revalidatePath("/dashboard");

    return successState(
      `${student.fullName} enrolled as ${student.studentId}. Temporary password: ${temporaryPassword} — shown once, note it now.`,
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
      // The database rejected it, not a pre-check — so a race can't slip past.
      const target = (error.meta?.target as string[] | undefined)?.join(", ") ?? "";
      if (target.includes("email")) {
        return errorState("That email is already registered.", {
          email: ["A student with this email already exists."],
        });
      }
      return errorState("That record conflicts with an existing one.");
    }
    return toActionState(error);
  }
}

export async function updateStudentStatus(formData: FormData): Promise<void> {
  await assertRegistry();

  const id = String(formData.get("id") ?? "");
  const status = enrolmentStatusSchema.parse(formData.get("status"));

  await prisma.student.update({ where: { id }, data: { status } });

  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  revalidatePath("/dashboard");
}

/**
 * Soft archive. Fee history, submissions, and grades must survive — a registry
 * does not erase a person, and a hard delete would take the audit trail too.
 */
export async function archiveStudent(formData: FormData): Promise<void> {
  await assertRegistry();

  const id = String(formData.get("id") ?? "");
  await prisma.student.update({ where: { id }, data: { archivedAt: new Date() } });

  revalidatePath("/students");
  revalidatePath("/dashboard");
}
