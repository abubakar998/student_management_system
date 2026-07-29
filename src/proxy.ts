import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/jwt";

/**
 * Cheap gate that bounces signed-out visitors to /login before a page renders.
 * (Next.js 16 renamed the `middleware` convention to `proxy`.)
 *
 * This is a convenience, not the security boundary. Proxy runs on the Edge
 * runtime and cannot reach the database, so it can only confirm that a token
 * is well-formed and correctly signed — it cannot know whether the user still
 * exists, still holds the role, or has since been withdrawn. Those checks live
 * in `getActor()` and the guards in `lib/authz.ts`, which every page and
 * action calls.
 *
 * `jose` is used here precisely because it works on the Edge runtime;
 * `jsonwebtoken` depends on Node's crypto module and would fail.
 */
const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifySession(token) : null;

  if (!claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so login can send them back.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals, the favicon, and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
