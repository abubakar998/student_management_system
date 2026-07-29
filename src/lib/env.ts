import { z } from "zod";

/**
 * Fail fast and loudly on misconfiguration. A missing JWT_SECRET should stop
 * the server at boot, not surface as a confusing 500 on first login.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is not set — copy .env.example to .env"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}\n`);
}

export const env = parsed.data;
