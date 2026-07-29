"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { type ActionState, errorState, fromZodError, successState, toActionState } from "@/lib/action-result";
import { assertRegistry } from "@/lib/authz";
import { formatMoney } from "@/lib/fees";
import { prisma } from "@/lib/prisma";
import { paymentSchema } from "@/lib/validation/payment";

const UNIQUE_VIOLATION = "P2002";

/**
 * Record a payment against a student's account.
 *
 * Nothing here writes a balance. The outstanding figure is always recomputed
 * from charges minus payments, so a correction to any transaction is reflected
 * everywhere immediately and no stored total can drift out of step.
 */
export async function recordPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertRegistry();

    const parsed = paymentSchema.safeParse({
      studentId: formData.get("studentId"),
      amount: formData.get("amount"),
      paidAt: formData.get("paidAt"),
      reference: formData.get("reference"),
      method: formData.get("method") || undefined,
      note: formData.get("note") || undefined,
    });

    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, fullName: true, archivedAt: true },
    });
    if (!student || student.archivedAt) {
      return errorState("That student record no longer exists.", { studentId: ["Choose a student."] });
    }

    await prisma.payment.create({
      data: {
        studentId: student.id,
        // Passed as a string so the value goes to Postgres NUMERIC without a
        // round trip through binary floating point.
        amount: new Prisma.Decimal(input.amount.toFixed(2)),
        paidAt: input.paidAt,
        reference: input.reference,
        method: input.method,
        note: input.note || null,
      },
    });

    revalidatePath("/fees");
    revalidatePath("/dashboard");
    revalidatePath(`/students/${student.id}`);
    revalidatePath("/portal/fees");

    return successState(
      `${formatMoney(input.amount)} recorded for ${student.fullName} (ref ${input.reference}).`,
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
      // Duplicate reference. Caught from the database rather than a pre-check,
      // so two clerks keying the same receipt at once cannot both succeed.
      return errorState("That payment reference has already been recorded.", {
        reference: ["This reference is already on file — check whether the payment was entered twice."],
      });
    }
    return toActionState(error);
  }
}
