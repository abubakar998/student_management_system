import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { signSession, SESSION_COOKIE } from "../src/lib/jwt";

/**
 * End-to-end checks for authentication and authorisation.
 *
 * Run the dev server first, then:  npx tsx scripts/verify-auth.ts
 * Point at another port with:      BASE_URL=http://localhost:3001 npx tsx scripts/verify-auth.ts
 *
 * These assert the properties that are easy to get wrong and invisible in the
 * UI — chiefly that a withheld result never enters the student's response
 * payload, and that withdrawing a student takes effect on their existing
 * session rather than at token expiry.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function get(path: string, token?: string) {
  const res = await fetch(BASE + path, {
    redirect: "manual",
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
  });
  const body = res.status < 300 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), body };
}

function check(name: string, pass: boolean, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!pass) process.exitCode = 1;
}

async function main() {
  // --- anonymous ---
  const anonRoot = await get("/");
  check("anonymous / redirects to login", anonRoot.status === 307 && !!anonRoot.location?.includes("/login"), `${anonRoot.status} -> ${anonRoot.location}`);

  const anonDash = await get("/dashboard");
  check("anonymous /dashboard redirects to login", anonDash.status === 307 && !!anonDash.location?.includes("/login"), `${anonDash.status}`);

  const loginPage = await get("/login");
  check("login page renders", loginPage.status === 200 && loginPage.body.includes("Sign in"));

  // --- tampered token ---
  const registry = await prisma.user.findUniqueOrThrow({ where: { email: "registry@sms.test" } });
  const goodToken = await signSession(registry.id);
  const tampered = goodToken.slice(0, -3) + "aaa";
  const tamperedRes = await get("/dashboard", tampered);
  check("tampered token rejected (not a 500)", tamperedRes.status === 307, `status ${tamperedRes.status}`);

  // --- staff ---
  const dash = await get("/dashboard", goodToken);
  check("registry staff reaches dashboard", dash.status === 200, `status ${dash.status}`);
  check("dashboard shows overdue students", dash.body.includes("Amara Okafor") && dash.body.includes("Chloe Nguyen"));
  check("dashboard excludes withdrawn student from chase list", !dash.body.includes("Farhan Iqbal"));

  // --- student: the withheld-result test ---
  const ben = await prisma.user.findUniqueOrThrow({ where: { email: "ben.whitfield@student.sms.test" } });
  const benToken = await signSession(ben.id);

  const benPortal = await get("/portal", benToken);
  check("student reaches portal", benPortal.status === 200, `status ${benPortal.status}`);
  // Only meaningful if the page actually rendered — an empty error body would
  // otherwise "pass" by containing nothing at all. A bare "55" is too crude to
  // assert on: it matches rgba(255,255,255,.3) and RSC chunk refs like $55.
  // Ben's only result is withheld, so the count must be 0 and no
  // classification label may appear anywhere in the payload.
  const rendered = benPortal.status === 200 && benPortal.body.length > 500;
  const noClassification = !/\b(Merit|Distinction|Pass|Fail)\b/.test(benPortal.body);
  const countIsZero = /Published results[\s\S]{0,200}?>0</.test(benPortal.body);
  check(
    "withheld result absent from student payload",
    rendered && noClassification && countIsZero,
    `rendered=${rendered} noClassification=${noClassification} countIsZero=${countIsZero}`,
  );

  const studentOnStaffPage = await get("/dashboard", benToken);
  check("student blocked from staff dashboard", studentOnStaffPage.status === 307, `-> ${studentOnStaffPage.location}`);

  const staffOnPortal = await get("/portal", goodToken);
  check("staff redirected away from student portal", staffOnPortal.status === 307, `-> ${staffOnPortal.location}`);

  // --- revocation: withdraw the student, session must lose submit rights immediately ---
  const amara = await prisma.user.findUniqueOrThrow({ where: { email: "amara.okafor@student.sms.test" } });
  const amaraToken = await signSession(amara.id);
  const before = await get("/portal", amaraToken);
  check("enrolled student portal ok", before.status === 200 && !before.body.includes("cannot submit new coursework"));

  await prisma.student.update({ where: { id: amara.studentId! }, data: { status: "WITHDRAWN" } });
  const after = await get("/portal", amaraToken);
  check("withdrawal takes effect on the SAME token", after.body.includes("cannot submit new coursework"), "no re-login needed");
  await prisma.student.update({ where: { id: amara.studentId! }, data: { status: "ENROLLED" } });
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
