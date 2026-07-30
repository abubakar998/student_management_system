import "dotenv/config";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { SESSION_COOKIE, signSession } from "../src/lib/jwt";

/**
 * Catches values that cannot cross the server/client boundary.
 *
 * This exists because of a bug the HTTP smoke tests could not see: a page
 * passed a Prisma `Decimal` to a client component. React cannot serialise a
 * class instance, so it logs
 *
 *   "Only plain objects can be passed to Client Components ...
 *    Decimal objects are not supported."
 *
 * The page still returns 200 and still renders, so asserting on status codes
 * or page content will never catch it. The only signal is the server log.
 *
 * Run against the dev server:  npx tsx scripts/check-rsc-serialization.ts
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LOG_DIR = path.join(process.cwd(), ".next", "dev", "logs");

const SERIALISATION_MARKERS = [
  "Only plain objects can be passed to Client Components",
  "cannot be passed to Client Components",
  "objects are not supported",
  "Functions cannot be passed directly to Client Components",
];

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function readAllLogs(): Promise<string> {
  try {
    const files = await readdir(LOG_DIR);
    const contents = await Promise.all(
      files.map((f) => readFile(path.join(LOG_DIR, f), "utf8").catch(() => "")),
    );
    return contents.join("\n");
  } catch {
    return "";
  }
}

async function main() {
  const [registry, academic, student] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "registry@sms.test" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "academic@sms.test" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "amara.okafor@student.sms.test" } }),
  ]);

  const [regT, acaT, stuT] = await Promise.all([registry, academic, student].map((u) => signSession(u.id)));
  const anyStudent = await prisma.student.findFirstOrThrow({ where: { fullName: "Amara Okafor" } });
  const anyAssessment = await prisma.assessment.findFirstOrThrow();

  const routes: Array<[string, string]> = [
    ["/login", ""],
    ["/dashboard", regT],
    ["/students", regT],
    ["/students/new", regT],
    [`/students/${anyStudent.id}`, regT],
    ["/fees", regT],
    ["/assessments", acaT],
    [`/assessments/${anyAssessment.id}`, acaT],
    [`/marksheet?assessmentId=${anyAssessment.id}`, acaT],
    ["/portal", stuT],
    ["/portal/fees", stuT],
    ["/portal/assessments", stuT],
    ["/portal/results", stuT],
  ];

  console.log(`Visiting ${routes.length} routes…`);
  for (const [route, token] of routes) {
    const res = await fetch(BASE + route, {
      headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
    });
    if (res.status !== 200) {
      console.log(`  FAIL  ${route} returned ${res.status}`);
      process.exitCode = 1;
    }
    await res.text(); // drain so the server finishes rendering
  }

  // Give the server a moment to flush its log.
  await new Promise((r) => setTimeout(r, 2500));

  const logs = await readAllLogs();
  if (!logs) {
    console.log("\nWARNING: no dev logs found at .next/dev/logs — cannot verify. Is the dev server running?");
    process.exitCode = 1;
    return;
  }

  const hits = SERIALISATION_MARKERS.flatMap((marker) =>
    logs
      .split("\n")
      .filter((line) => line.includes(marker))
      .map((line) => line.trim()),
  );

  if (hits.length > 0) {
    console.log(`\nFAIL  ${hits.length} serialisation error(s) in the server log:`);
    for (const hit of [...new Set(hits)].slice(0, 10)) console.log(`   ${hit.slice(0, 200)}`);
    process.exitCode = 1;
  } else {
    console.log("\nPASS  no server/client serialisation errors across all routes.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
