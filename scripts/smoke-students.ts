import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { signSession, SESSION_COOKIE } from "../src/lib/jwt";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function get(path: string, token: string) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: { cookie: `${SESSION_COOKIE}=${token}` } });
  return { status: res.status, location: res.headers.get("location"), body: res.status === 200 ? await res.text() : "" };
}
function check(name: string, pass: boolean, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!pass) process.exitCode = 1;
}

async function main() {
  const registry = await prisma.user.findUniqueOrThrow({ where: { email: "registry@sms.test" } });
  const academic = await prisma.user.findUniqueOrThrow({ where: { email: "academic@sms.test" } });
  const rTok = await signSession(registry.id);
  const aTok = await signSession(academic.id);

  const list = await get("/students", rTok);
  check("students list renders", list.status === 200, `status ${list.status}`);
  check("list shows all six seeded students", ["Amara","Ben Whitfield","Chloe","Daniel","Elena","Farhan"].every(n => list.body.includes(n)));
  check("balances rendered", list.body.includes("£6,250.00") && list.body.includes("credit"));

  const filtered = await get("/students?status=WITHDRAWN", rTok);
  check("status filter works", filtered.body.includes("Farhan") && !filtered.body.includes("Amara Okafor"));

  const searched = await get("/students?q=chloe", rTok);
  check("name search works", searched.body.includes("Chloe") && !searched.body.includes("Daniel Osei"));

  const byId = await get("/students?q=SMS-", rTok);
  check("student ID search works", byId.body.includes("Amara"));

  const newPage = await get("/students/new", rTok);
  check("registry can open enrol form", newPage.status === 200, `status ${newPage.status}`);

  const academicNew = await get("/students/new", aTok);
  check("academic staff blocked from enrol form", academicNew.status === 307, `-> ${academicNew.location}`);

  const amara = await prisma.student.findFirstOrThrow({ where: { fullName: "Amara Okafor" } });
  const detail = await get(`/students/${amara.id}`, rTok);
  check("student detail renders", detail.status === 200, `status ${detail.status}`);
  // React separates adjacent text nodes with <!-- -->, so strip comments
  // before matching rendered prose.
  const detailText = detail.body.replace(/<!--.*?-->/g, "");
  check("detail shows overdue badge", /\d+ days overdue since/.test(detailText));
  check("detail shows charges and payments", detail.body.includes("PAY-0001"));

  const ben = await prisma.student.findFirstOrThrow({ where: { fullName: "Ben Whitfield" } });
  const benDetail = await get(`/students/${ben.id}`, rTok);
  check("staff DO see the withheld mark (55) on the staff page", benDetail.body.includes("Withheld"));

  const missing = await get("/students/does-not-exist", rTok);
  check("unknown student id 404s rather than 500s", missing.status === 404, `status ${missing.status}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
