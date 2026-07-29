"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type ActionState, errorState, successState, toActionState } from "@/lib/action-result";
import { assertAcademic } from "@/lib/authz";
import { MAX_SCORE, MIN_SCORE } from "@/lib/classification";
import { prisma } from "@/lib/prisma";

const gradeSchema = z.object({
  assessmentId: z.string().min(1),
  studentId: z.string().min(1),
  // Blank means "absent / not submitted", which is deliberately different from
  // a mark of zero. Zero is a real grade a student can earn.
  score: z
    .union([z.literal(""), z.coerce.number().int().min(MIN_SCORE).max(MAX_SCORE)])
    .transform((v) => (v === "" ? null : v)),
});

export async function saveGrade(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertAcademic();

    const parsed = gradeSchema.safeParse({
      assessmentId: formData.get("assessmentId"),
      studentId: formData.get("studentId"),
      score: formData.get("score") ?? "",
    });

    if (!parsed.success) {
      return errorState(`Enter a whole number between ${MIN_SCORE} and ${MAX_SCORE}, or leave blank for absent.`);
    }

    const { assessmentId, studentId, score } = parsed.data;

    await prisma.result.upsert({
      where: { assessmentId_studentId: { assessmentId, studentId } },
      create: {
        assessmentId,
        studentId,
        score,
        // A newly entered mark is withheld until someone chooses to release it.
        isPublished: false,
        gradedById: actor.userId,
        gradedAt: new Date(),
      },
      update: {
        score,
        gradedById: actor.userId,
        gradedAt: new Date(),
      },
    });

    revalidatePath("/marksheet");
    revalidatePath(`/students/${studentId}`);
    revalidatePath("/dashboard");

    return successState("Mark saved.");
  } catch (error) {
    return toActionState(error);
  }
}

/**
 * Release or withhold a single student's result.
 *
 * Publication is per student per assessment, so a cohort can be released while
 * one disputed mark is held back. Withholding a published result works too —
 * a mark released in error has to be retractable.
 */
export async function setResultPublished(formData: FormData): Promise<void> {
  const actor = await assertAcademic();

  const id = String(formData.get("id") ?? "");
  const publish = formData.get("publish") === "true";

  await prisma.result.update({
    where: { id },
    data: {
      isPublished: publish,
      publishedAt: publish ? new Date() : null,
      gradedById: actor.userId,
    },
  });

  revalidatePath("/marksheet");
  revalidatePath("/dashboard");
}

/** Release every marked result for an assessment in one go. */
export async function publishAllForAssessment(formData: FormData): Promise<void> {
  await assertAcademic();

  const assessmentId = String(formData.get("assessmentId") ?? "");

  await prisma.result.updateMany({
    where: { assessmentId, isPublished: false },
    data: { isPublished: true, publishedAt: new Date() },
  });

  revalidatePath("/marksheet");
  revalidatePath("/dashboard");
}
