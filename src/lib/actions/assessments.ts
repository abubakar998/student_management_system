"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type ActionState, errorState, fromZodError, successState, toActionState } from "@/lib/action-result";
import { assertAcademic, assertSubmittingStudent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, isAllowedMime, deleteSubmissionFile, storeSubmissionFile } from "@/lib/storage";

const assessmentSchema = z.object({
  title: z.string().trim().min(3, "Give the assessment a title.").max(160),
  module: z.string().trim().min(2, "Enter the module code.").max(32),
  deadline: z.coerce.date({ error: "Enter a submission deadline." }),
  programmeId: z.string().optional(),
});

export async function createAssessment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertAcademic();

    const parsed = assessmentSchema.safeParse({
      title: formData.get("title"),
      module: formData.get("module"),
      deadline: formData.get("deadline"),
      programmeId: formData.get("programmeId") || undefined,
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const assessment = await prisma.assessment.create({
      data: {
        title: parsed.data.title,
        module: parsed.data.module.toUpperCase(),
        deadline: parsed.data.deadline,
        // Empty means it applies to every programme.
        programmeId: parsed.data.programmeId || null,
      },
    });

    revalidatePath("/assessments");
    revalidatePath("/dashboard");
    return successState(`"${assessment.title}" created.`);
  } catch (error) {
    return toActionState(error);
  }
}

/**
 * Accept a student's file against an assessment.
 *
 * Three judgements are baked in here:
 *
 * 1. Late work is accepted, never refused. The brief says late submissions are
 *    accepted but flagged, so the deadline changes how a submission is
 *    *labelled*, not whether it is allowed.
 * 2. `isLate` is computed once, now, and stored. Deriving it on read would let
 *    a staff member move a deadline and silently rewrite history.
 * 3. Resubmission reuses the same row and bumps `version`, which is what the
 *    unique (assessmentId, studentId) constraint requires. Resubmitting after
 *    the deadline is allowed — refusing it would be stricter than refusing a
 *    first late submission, which the brief explicitly permits.
 */
export async function submitAssessment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    // Also rejects deferred, withdrawn and completed students.
    const actor = await assertSubmittingStudent();

    const assessmentId = String(formData.get("assessmentId") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return errorState("Choose a file to upload.", { file: ["No file was selected."] });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return errorState("That file is too large.", {
        file: [`Maximum size is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`],
      });
    }

    // Check the declared type *and* the extension. Either alone is trivial to
    // spoof; requiring both agree raises the bar on an accidental .exe rename.
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!isAllowedMime(file.type) || ALLOWED_TYPES[file.type] !== extension) {
      return errorState("Only PDF and DOCX files are accepted.", {
        file: ["Upload a .pdf or .docx file."],
      });
    }

    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) return errorState("That assessment no longer exists.");

    const submittedAt = new Date();
    const isLate = submittedAt > assessment.deadline;

    const stored = await storeSubmissionFile(file, file.type);

    const existing = await prisma.submission.findUnique({
      where: { assessmentId_studentId: { assessmentId, studentId: actor.student.id } },
    });

    await prisma.submission.upsert({
      where: { assessmentId_studentId: { assessmentId, studentId: actor.student.id } },
      create: {
        assessmentId,
        studentId: actor.student.id,
        storedName: stored.storedName,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: stored.sizeBytes,
        submittedAt,
        isLate,
      },
      update: {
        storedName: stored.storedName,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: stored.sizeBytes,
        submittedAt,
        isLate,
        version: { increment: 1 },
      },
    });

    // Only after the row points at the new file, so a failure above leaves the
    // previous submission intact rather than losing both.
    if (existing) await deleteSubmissionFile(existing.storedName);

    revalidatePath("/portal/assessments");
    revalidatePath(`/assessments/${assessmentId}`);
    revalidatePath("/dashboard");

    return successState(
      isLate
        ? `Submitted after the deadline — accepted, but flagged as late.${existing ? " This replaces your previous file." : ""}`
        : `Submitted.${existing ? " This replaces your previous file." : ""}`,
    );
  } catch (error) {
    return toActionState(error);
  }
}
