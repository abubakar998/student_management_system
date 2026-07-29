"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { type ActionState, errorState } from "@/lib/action-result";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/jwt";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Enter your email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return errorState("Enter your email address and password.");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, role: true },
  });

  // One message for "no such user" and "wrong password" alike. Distinguishing
  // them would let an attacker enumerate which accounts exist.
  const invalid = errorState("Invalid email or password.");
  if (!user) {
    // Still spend the hashing time so a missing account isn't detectably
    // faster to reject than a wrong password.
    await verifyPassword(parsed.data.password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    return invalid;
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return invalid;

  const token = await signSession(user.id);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // unreadable from client-side JavaScript
    sameSite: "lax", // mitigates CSRF on state-changing requests
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect(user.role === "STAFF" ? "/dashboard" : "/portal");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
