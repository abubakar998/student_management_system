import { z } from "zod";

import { endOfDay } from "date-fns";

export const paymentMethodSchema = z.enum(["BANK_TRANSFER", "CARD", "CASH", "BURSARY"]);

export const paymentSchema = z.object({
  studentId: z.string().min(1, "Choose a student."),
  amount: z.coerce
    .number({ error: "Enter an amount." })
    .positive("A payment must be more than zero.")
    // Guards against a mistyped amount wiping out an account.
    .max(1_000_000, "That amount looks wrong — please check it.")
    .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, {
      message: "Amounts can have at most two decimal places.",
    }),
  paidAt: z.coerce
    .date({ error: "Enter the payment date." })
    // A payment cannot have been received tomorrow.
    .max(endOfDay(new Date()), "A payment date cannot be in the future."),
  reference: z
    .string()
    .trim()
    .min(3, "Enter the payment reference.")
    .max(64, "That reference is too long."),
  method: paymentMethodSchema.default("BANK_TRANSFER"),
  note: z.string().trim().max(280).optional().or(z.literal("")),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
