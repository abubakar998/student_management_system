import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

import { env } from "./env";

/**
 * Session tokens.
 *
 * We use `jose` rather than `jsonwebtoken` because middleware runs on the Edge
 * runtime, where `jsonwebtoken`'s dependency on Node's crypto module breaks.
 *
 * The token carries the user id and nothing else. A JWT is *signed, not
 * encrypted* — anyone holding it can base64-decode the payload — so roles,
 * grades, and personal data stay out of it. Everything the app authorises on
 * is read from the database on each request.
 */

const ALGORITHM = "HS256";
export const SESSION_COOKIE = "sms_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const secret = new TextEncoder().encode(env.JWT_SECRET);

const claimsSchema = z.object({
  sub: z.string().min(1),
});

export type SessionClaims = z.infer<typeof claimsSchema>;

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

/**
 * Returns null for anything untrustworthy — bad signature, expired, tampered,
 * or an unexpected payload shape. Callers treat null as "not signed in";
 * a malformed token must never surface as a 500.
 */
export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      // Pinning the algorithm blocks "alg" confusion attacks, where a token
      // claiming alg:none or a different scheme is offered up for verification.
      algorithms: [ALGORITHM],
    });

    const parsed = claimsSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
