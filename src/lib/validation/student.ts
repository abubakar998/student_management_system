import { z } from "zod";

const MIN_AGE_YEARS = 15;
const MAX_AGE_YEARS = 100;

function yearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

export const enrolmentStatusSchema = z.enum(["ENROLLED", "DEFERRED", "WITHDRAWN", "COMPLETED"]);

export const studentSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the student's full name.")
    .max(120, "That name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  dateOfBirth: z.coerce
    .date({ error: "Enter a valid date of birth." })
    // A date of birth in the future is a typo, not a student.
    .max(yearsAgo(MIN_AGE_YEARS), `Students must be at least ${MIN_AGE_YEARS} years old.`)
    .min(yearsAgo(MAX_AGE_YEARS), "That date of birth looks wrong — please check it."),
  programmeId: z.string().min(1, "Choose a programme."),
  academicYear: z.coerce
    .number()
    .int()
    .min(1, "Academic year must be 1 or more.")
    .max(7, "Academic year looks too high."),
  status: enrolmentStatusSchema.default("ENROLLED"),
});

export type StudentInput = z.infer<typeof studentSchema>;

export const studentFilterSchema = z.object({
  q: z.string().trim().optional(),
  programmeId: z.string().optional(),
  status: enrolmentStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});
