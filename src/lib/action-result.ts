import { z } from "zod";

import { ForbiddenError, UnauthenticatedError } from "./errors";

/**
 * Shape returned by every Server Action, consumed by `useActionState`.
 * Keeping one shape means forms render errors the same way everywhere.
 */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  /** Keyed by form field name, so inputs can show their own error. */
  fieldErrors?: Record<string, string[]>;
};

export const idleState: ActionState = { status: "idle" };

export function successState(message?: string): ActionState {
  return { status: "success", message };
}

export function errorState(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return { status: "error", message, fieldErrors };
}

export function fromZodError(error: z.ZodError): ActionState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

/**
 * Turn a thrown error into a message the user can act on, without leaking
 * internals. Authorisation failures are intentional and safe to show; anything
 * else is logged server-side and reported generically.
 */
export function toActionState(error: unknown): ActionState {
  if (error instanceof ForbiddenError || error instanceof UnauthenticatedError) {
    return errorState(error.message);
  }
  console.error("Unhandled action error:", error);
  return errorState("Something went wrong. Please try again.");
}
