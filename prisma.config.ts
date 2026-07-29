import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations run over the direct connection where one is configured.
    // Neon (and most serverless Postgres) pool with PgBouncer, which does not
    // support the advisory locks and session state the migration engine needs.
    // The running app still uses the pooled DATABASE_URL.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
