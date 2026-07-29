import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // Optional. `npx prisma dev` exposes a second server for the shadow
    // database; a hosted Postgres normally lets Prisma create one itself.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
