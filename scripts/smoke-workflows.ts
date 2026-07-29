import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { signSession, SESSION_COOKIE } from "../src/lib/jwt";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function get(path: string, token?: string) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {} });
  const body = res.status === 200 ? (await res.text()).replace(/<!--.*?-->/g, "") : "";
  return { status: res.status, location: res.headers.get("location"), body };
}
function check(name: string, pass: boolean, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!pass) process.exitCode = 1;
}

async function main() {
  const reg = await prisma.user.findUniqueOrThrow({ where: { email: "registry@sms.test" } });
  const aca = await prisma.user.findUniqueOrThrow({ where: { email: "academic@sms.test" } });
  const ben = await prisma.user.findUniqueOrThrow({ where: { email: "ben.whitfield@student.sms.test" } });
  const amara = await prisma.user.findUniqueOrThrow({ where: { email: "amara.okafor@student.sms.test" } });
  const [rT, aT, bT, amT] = await Promise.all([reg, aca, ben, amara].map(u => signSession(u.id)));

  // --- FEES ---
  const fees = await get("/fees", rT);
  check("fees page renders", fees.status === 200, `status ${fees.status}`);
  check("fees shows credit balance for overpaid student", fees.body.includes("credit"));
  check("fees shows 'not yet due' for future-dated debt", fees.body.includes("not yet due"));
  check("registry sees the payment form", fees.body.includes("Record payment"));
  const feesAca = await get("/fees", aT);
  check("academic staff get read-only fees", feesAca.status === 200 && !feesAca.body.includes("Record payment"));

  // --- ASSESSMENTS ---
  const asmts = await get("/assessments", aT);
  check("assessments page renders", asmts.status === 200, `status ${asmts.status}`);
  check("late submission counted on list", /\d+ late/.test(asmts.body));
  check("academic sees create form", asmts.body.includes("Create assessment"));
  const asmtsReg = await get("/assessments", rT);
  check("registry gets read-only assessments", !asmtsReg.body.includes("Create assessment"));

  const closed = await prisma.assessment.findFirstOrThrow({ where: { module: "CS201" } });
  const detail = await get(`/assessments/${closed.id}`, aT);
  check("assessment detail renders", detail.status === 200, `status ${detail.status}`);
  check("detail flags the late submission", detail.body.includes("Late"));
  check("detail counts non-submitters", detail.body.includes("Not submitted"));

  // --- MARKSHEET ---
  const ms = await get(`/marksheet?assessmentId=${closed.id}`, aT);
  check("marksheet renders", ms.status === 200, `status ${ms.status}`);
  check("marksheet shows Distinction for 78", ms.body.includes("Distinction"));
  check("marksheet shows withheld mark to staff", ms.body.includes("Publish"));
  check("marksheet lists absent student", ms.body.includes("Absent"));
  const msReg = await get(`/marksheet?assessmentId=${closed.id}`, rT);
  check("registry gets read-only marksheet", msReg.status === 200 && msReg.body.includes("read-only"));

  // --- STUDENT PORTAL: the withheld-result boundary ---
  const benRes = await get("/portal/results", bT);
  check("student results page renders", benRes.status === 200, `status ${benRes.status}`);
  // Asserting on the absence of "Merit"/"Pass" is useless here: the page's own
  // legend says "Pass is 40 and above, Merit 60, Distinction 70". The real
  // check is that the query returned nothing, so the table has no data rows.
  const benRows = Math.max(0, (benRes.body.match(/<tr/g) ?? []).length - 1);
  check("Ben's withheld mark produces ZERO result rows", benRows === 0, `data rows=${benRows}`);
  check("student sees the empty-state message instead", benRes.body.includes("Nothing has been released yet"));

  const amRes = await get("/portal/results", amT);
  check("Amara's published 78 IS visible to her", amRes.body.includes("78") && amRes.body.includes("Distinction"));

  const benAsmt = await get("/portal/assessments", bT);
  check("student assessments render", benAsmt.status === 200, `status ${benAsmt.status}`);
  check("student sees own late flag", benAsmt.body.includes("Submitted late"));

  const benFees = await get("/portal/fees", bT);
  check("student fees render", benFees.status === 200 && benFees.body.includes("Settled in full"));

  // --- withdrawn student cannot submit ---
  const farhan = await prisma.user.findUniqueOrThrow({ where: { email: "farhan.iqbal@student.sms.test" } });
  const fT = await signSession(farhan.id);
  const fAsmt = await get("/portal/assessments", fT);
  check("withdrawn student sees no upload form", fAsmt.status === 200 && fAsmt.body.includes("cannot submit new work"));

  // --- cross-student access ---
  const otherSub = await prisma.submission.findFirstOrThrow({ where: { student: { fullName: "Amara Okafor" } } });
  const steal = await fetch(`${BASE}/api/submissions/${otherSub.id}`, { headers: { cookie: `${SESSION_COOKIE}=${bT}` } });
  check("student cannot download another student's file", steal.status === 403, `status ${steal.status}`);
  const staffDl = await fetch(`${BASE}/api/submissions/${otherSub.id}`, { headers: { cookie: `${SESSION_COOKIE}=${rT}` } });
  check("staff can download any student's file", staffDl.status === 200, `status ${staffDl.status}`);
  check("download is sent as an attachment, not rendered inline",
    (staffDl.headers.get("content-disposition") ?? "").startsWith("attachment"),
    staffDl.headers.get("content-disposition") ?? "no header");
  const anonDl = await fetch(`${BASE}/api/submissions/${otherSub.id}`, { redirect: "manual" });
  check("anonymous download blocked", anonDl.status === 401 || anonDl.status === 307, `status ${anonDl.status}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
