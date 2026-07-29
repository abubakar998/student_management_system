import { cookies } from "next/headers";
import { cache } from "react";

import type { EnrolmentStatus, Role, StaffRole } from "@/generated/prisma/enums";

import { SESSION_COOKIE, verifySession } from "./jwt";
import { prisma } from "./prisma";

export type Actor = {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  /** Set for staff only. */
  staffRole: StaffRole | null;
  /** Set for students only. */
  student: {
    id: string;
    studentId: string;
    fullName: string;
    status: EnrolmentStatus;
  } | null;
};

/**
 * Resolve the signed-in user, or null.
 *
 * The token only tells us *who* the request claims to be. Role, staff
 * department, and enrolment status are always read fresh from the database —
 * that is what makes a withdrawal or a role change take effect on the very
 * next request, rather than whenever the token happens to expire. A
 * self-contained token would leave a student we withdrew on Monday with a
 * working session until Friday.
 *
 * Wrapped in React's `cache` so the lookup happens once per request even
 * though layouts, pages, and guards all call it.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySession(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      staffRole: true,
      student: {
        select: { id: true, studentId: true, fullName: true, status: true, archivedAt: true },
      },
    },
  });

  // Deleted user, or a student record that has since been archived.
  if (!user) return null;
  if (user.student?.archivedAt) return null;

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    staffRole: user.staffRole,
    student: user.student
      ? {
          id: user.student.id,
          studentId: user.student.studentId,
          fullName: user.student.fullName,
          status: user.student.status,
        }
      : null,
  };
});
