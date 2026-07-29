import bcrypt from "bcryptjs";

/**
 * `bcryptjs` is pure JavaScript. The native `bcrypt` and `argon2` packages are
 * stronger but need a C++ build toolchain, which is a common failure on
 * Windows and would make this project harder to run than it needs to be.
 */
const COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
