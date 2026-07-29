import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { addDays, subDays } from "date-fns";

import { PrismaClient } from "../src/generated/prisma/client";
import { formatStudentId } from "../src/lib/student-id";

/**
 * Demo data for the Registry module.
 *
 * The brief asks for "at least 5 students, 2 programmes, fees, and sample
 * grades". This goes further on purpose: every row exists to put one of the
 * app's edge cases on screen the moment you log in — an overdue account, a
 * credit balance, a late submission, a withheld result, and a student who was
 * marked absent rather than given a zero.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Shared across every seeded account. Documented in the README. */
const DEMO_PASSWORD = "Password123!";

const today = new Date();
const YEAR = today.getFullYear();

/**
 * Seeded submissions point at real files on disk, so the download route works
 * out of the box for a reviewer. Without these the record would exist with no
 * bytes behind it and every download would 404.
 */
async function writePlaceholderFile(storedName: string, title: string): Promise<number> {
  // Must match UPLOAD_DIR in src/lib/storage.ts.
  const dir = path.join(process.cwd(), "uploads");
  await mkdir(dir, { recursive: true });

  // A minimal but structurally valid single-page PDF, so it actually opens.
  const body = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 90>>stream
BT /F1 14 Tf 60 760 Td (${title.replace(/[()\\]/g, "")}) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF
`;

  const buffer = Buffer.from(body, "latin1");
  await writeFile(path.join(dir, storedName), buffer);
  return buffer.byteLength;
}

async function main() {
  console.log("Seeding Student Management System…");

  // Order matters: children before parents.
  await prisma.result.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.feeRecord.deleteMany();
  await prisma.user.deleteMany();
  await prisma.student.deleteMany();
  await prisma.programme.deleteMany();
  await prisma.studentIdCounter.deleteMany();

  // Imported lazily so the hashing cost is paid once, after the wipe.
  const { hashPassword } = await import("../src/lib/password");
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // --- programmes ----------------------------------------------------------

  const cs = await prisma.programme.create({
    data: { name: "BSc Computer Science", code: "CS", feeAmount: "9250.00", durationYears: 3 },
  });
  const bm = await prisma.programme.create({
    data: { name: "BA Business Management", code: "BM", feeAmount: "7800.00", durationYears: 3 },
  });

  // --- students ------------------------------------------------------------

  const roster = [
    {
      fullName: "Amara Okafor",
      email: "amara.okafor@student.sms.test",
      dateOfBirth: new Date("2003-04-12"),
      programme: cs,
      academicYear: 2,
      status: "ENROLLED" as const,
      // Owes money past its due date -> appears on the overdue chase list.
      fee: { amount: "9250.00", dueDate: subDays(today, 45) },
      payments: [{ amount: "3000.00", paidAt: subDays(today, 50), reference: "PAY-0001" }],
    },
    {
      fullName: "Ben Whitfield",
      email: "ben.whitfield@student.sms.test",
      dateOfBirth: new Date("2002-11-30"),
      programme: cs,
      academicYear: 2,
      status: "ENROLLED" as const,
      // Settled in full -> must not appear as overdue despite a past due date.
      fee: { amount: "9250.00", dueDate: subDays(today, 45) },
      payments: [{ amount: "9250.00", paidAt: subDays(today, 40), reference: "PAY-0002" }],
    },
    {
      fullName: "Chloe Nguyen",
      email: "chloe.nguyen@student.sms.test",
      dateOfBirth: new Date("2004-01-22"),
      programme: bm,
      academicYear: 1,
      status: "ENROLLED" as const,
      // Nothing paid at all -> the worst case on the dashboard.
      fee: { amount: "7800.00", dueDate: subDays(today, 30) },
      payments: [],
    },
    {
      fullName: "Daniel Osei",
      email: "daniel.osei@student.sms.test",
      dateOfBirth: new Date("2003-07-08"),
      programme: bm,
      academicYear: 2,
      status: "DEFERRED" as const,
      // Owes money but the due date is in the future -> owed, NOT overdue.
      fee: { amount: "7800.00", dueDate: addDays(today, 60) },
      payments: [],
    },
    {
      fullName: "Elena Petrova",
      email: "elena.petrova@student.sms.test",
      dateOfBirth: new Date("2001-09-15"),
      programme: cs,
      academicYear: 3,
      status: "COMPLETED" as const,
      // Overpaid -> the balance must read as a credit, not a negative bug.
      fee: { amount: "9250.00", dueDate: subDays(today, 200) },
      payments: [{ amount: "9500.00", paidAt: subDays(today, 195), reference: "PAY-0003" }],
    },
    {
      fullName: "Farhan Iqbal",
      email: "farhan.iqbal@student.sms.test",
      dateOfBirth: new Date("2002-02-19"),
      programme: bm,
      academicYear: 2,
      status: "WITHDRAWN" as const,
      // Still owes a genuinely overdue debt, but withdrawn students are kept
      // off the active chase list. The money is not written off.
      fee: { amount: "7800.00", dueDate: subDays(today, 90) },
      payments: [{ amount: "1000.00", paidAt: subDays(today, 100), reference: "PAY-0004" }],
    },
  ];

  const students: Record<string, { id: string; studentId: string }> = {};

  for (const [index, entry] of roster.entries()) {
    const studentId = formatStudentId(YEAR, index + 1);

    const student = await prisma.student.create({
      data: {
        studentId,
        fullName: entry.fullName,
        email: entry.email,
        dateOfBirth: entry.dateOfBirth,
        academicYear: entry.academicYear,
        status: entry.status,
        programmeId: entry.programme.id,
        feeRecords: {
          create: {
            programmeId: entry.programme.id,
            amount: entry.fee.amount,
            description: `${entry.programme.name} — tuition ${YEAR}/${String(YEAR + 1).slice(2)}`,
            academicYear: entry.academicYear,
            dueDate: entry.fee.dueDate,
          },
        },
        payments: { create: entry.payments.map((p) => ({ ...p, method: "BANK_TRANSFER" as const })) },
      },
    });

    students[entry.fullName] = { id: student.id, studentId: student.studentId };

    await prisma.user.create({
      data: {
        email: entry.email,
        passwordHash,
        displayName: entry.fullName,
        role: "STUDENT",
        studentId: student.id,
      },
    });
  }

  // Keep the counter in step so the next enrolment continues the sequence.
  await prisma.studentIdCounter.create({ data: { year: YEAR, lastValue: roster.length } });

  // --- staff accounts ------------------------------------------------------

  const registryUser = await prisma.user.create({
    data: {
      email: "registry@sms.test",
      passwordHash,
      displayName: "Rachel Adeyemi",
      role: "STAFF",
      staffRole: "REGISTRY",
    },
  });

  const academicUser = await prisma.user.create({
    data: {
      email: "academic@sms.test",
      passwordHash,
      displayName: "Dr Tom Hargreaves",
      role: "STAFF",
      staffRole: "ACADEMIC",
    },
  });

  // --- assessments ---------------------------------------------------------

  const closedAssessment = await prisma.assessment.create({
    data: {
      title: "Data Structures Coursework",
      module: "CS201",
      programmeId: cs.id,
      deadline: subDays(today, 10), // already closed — late submissions visible
    },
  });

  const openAssessment = await prisma.assessment.create({
    data: {
      title: "Systems Analysis Report",
      module: "CS310",
      programmeId: cs.id,
      deadline: addDays(today, 5), // open now
    },
  });

  await prisma.assessment.create({
    data: {
      title: "Business Strategy Essay",
      module: "BM220",
      programmeId: bm.id,
      deadline: addDays(today, 21), // not yet started
    },
  });

  // --- submissions ---------------------------------------------------------

  const amaraCs201Size = await writePlaceholderFile(
    "seed-amara-cs201.pdf",
    "Amara Okafor - Data Structures Coursework",
  );
  await prisma.submission.create({
    data: {
      assessmentId: closedAssessment.id,
      studentId: students["Amara Okafor"].id,
      storedName: "seed-amara-cs201.pdf",
      originalName: "amara-okafor-data-structures.pdf",
      mimeType: "application/pdf",
      sizeBytes: amaraCs201Size,
      submittedAt: subDays(today, 12),
      isLate: false,
    },
  });

  // Handed in two days after the deadline: accepted, but permanently flagged.
  const benCs201Size = await writePlaceholderFile(
    "seed-ben-cs201.pdf",
    "Ben Whitfield - Data Structures Coursework (late)",
  );
  await prisma.submission.create({
    data: {
      assessmentId: closedAssessment.id,
      studentId: students["Ben Whitfield"].id,
      storedName: "seed-ben-cs201.pdf",
      originalName: "ben-whitfield-data-structures.pdf",
      mimeType: "application/pdf",
      sizeBytes: benCs201Size,
      submittedAt: subDays(today, 8),
      isLate: true,
      version: 2,
    },
  });

  const amaraCs310Size = await writePlaceholderFile(
    "seed-amara-cs310.pdf",
    "Amara Okafor - Systems Analysis Report",
  );
  await prisma.submission.create({
    data: {
      assessmentId: openAssessment.id,
      studentId: students["Amara Okafor"].id,
      storedName: "seed-amara-cs310.pdf",
      originalName: "amara-okafor-systems-analysis.pdf",
      mimeType: "application/pdf",
      sizeBytes: amaraCs310Size,
      submittedAt: subDays(today, 1),
      isLate: false,
    },
  });

  // --- results -------------------------------------------------------------

  await prisma.result.create({
    data: {
      assessmentId: closedAssessment.id,
      studentId: students["Amara Okafor"].id,
      score: 78, // Distinction
      isPublished: true,
      publishedAt: subDays(today, 3),
      gradedById: academicUser.id,
      gradedAt: subDays(today, 4),
    },
  });

  // Marked but deliberately withheld — the student must not see this yet.
  await prisma.result.create({
    data: {
      assessmentId: closedAssessment.id,
      studentId: students["Ben Whitfield"].id,
      score: 55, // Pass
      isPublished: false,
      gradedById: academicUser.id,
      gradedAt: subDays(today, 4),
    },
  });

  // Absent: a null score is not the same as a mark of zero.
  await prisma.result.create({
    data: {
      assessmentId: closedAssessment.id,
      studentId: students["Elena Petrova"].id,
      score: null,
      isPublished: true,
      publishedAt: subDays(today, 3),
      gradedById: academicUser.id,
      gradedAt: subDays(today, 4),
    },
  });

  console.log(`
Seed complete.

  Programmes   2
  Students     ${roster.length}  (enrolled, deferred, withdrawn, completed)
  Assessments  3  (one closed, one open, one upcoming)
  Submissions  3  (one of them late)
  Results      3  (one published, one withheld, one absent)

  Sign in with any of these — password: ${DEMO_PASSWORD}

    ${registryUser.email}   Registry staff
    ${academicUser.email}   Academic staff
    ${roster[0].email}      Student (overdue balance, distinction)
    ${roster[1].email}      Student (paid up, result withheld)
`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
