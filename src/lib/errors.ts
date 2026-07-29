/**
 * Deliberately dependency-free.
 *
 * These are thrown on the server but their *types* are needed by
 * `action-result.ts`, which client components import for `idleState`. Keeping
 * them in their own module stops that import chain from dragging
 * `next/headers` and the Prisma client into the browser bundle.
 */

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "You must be signed in.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}
