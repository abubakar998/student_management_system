# Student Management System — Registry Module

**Source:** PEN Global (concern of PEN Group) — Technical Assessment ([doc/SMS_Technical_Assessment_.pdf](doc/SMS_Technical_Assessment_.pdf))
**Deadline:** within 7 working days
**Deliverable:** GitHub repository + README (no zip files)

---

## 1. Overview

Build a focused web application covering the **core Registry function** of a student management system. This is *not* a full platform — it is the **four workflows a Registry Administrator uses every day**.

The assessment explicitly values *how you think* over *how much you build*: deliberate product decisions, edge-case handling, and documented reasoning. AI tool usage is encouraged, but must be documented and owned.

---

## 2. Tech Stack

### Required (non-negotiable)

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Required. No other backend framework permitted. |
| Database | **PostgreSQL** | Real database required — no `useState` mock data. |
| ORM | **Prisma** | `schema.prisma` must be committed. |
| API | Next.js Route Handlers / Server Actions | Must live inside the Next.js app. |

### Recommended / chosen

| Concern | Choice | Rationale |
|---|---|---|
| Styling | **Tailwind CSS** | Required-or-equivalent; pairs with Shadcn. |
| Component library | **Shadcn UI** | Explicitly "preferred" in the brief. |
| Language | **TypeScript** | Type safety across schema → API → UI. |
| Validation | **Zod** | Shared client/server validation of forms and API payloads. |
| Forms | **react-hook-form** + Zod resolver | Standard Shadcn pairing. |
| File storage | Local `/uploads` dir (dev) with a storage adapter | Assessment submissions; adapter keeps cloud storage swappable. |
| Money handling | Prisma `Decimal` | Never floats for fees/payments. |
| Seeding | `prisma/seed.ts` (`tsx`) | Required deliverable. |
| Local DB | Docker Compose Postgres | Reviewer can run it in one command. |
| Icons | lucide-react | Ships with Shadcn. |

### Constraints

- ❌ Do **not** use a different backend framework (no Express, Nest, Fastify, etc.).
- ❌ Do **not** mock data in `useState` — a real database is required.
- ✅ Provide a `.env.example` file. **Never commit credentials.**
- ✅ Commit `schema.prisma`.

---

## 3. Functional Requirements

### 3.1 Student Enrolment

> The Registry team needs to add and manage student records.

| # | Requirement |
|---|---|
| SE-1 | Create a student record with: **full name, email, date of birth, programme, academic year, enrolment status**. |
| SE-2 | **Auto-generate a unique Student ID** in the format `SMS-2025-0001` (prefix + year + zero-padded sequence). |
| SE-3 | Enrolment statuses: **Enrolled, Deferred, Withdrawn, Completed**. |
| SE-4 | **Search and filter** students by name, ID, programme, or status. |

**Edge cases to handle deliberately**
- Uniqueness of email and Student ID (DB-level unique constraints, not just UI checks).
- Student ID sequence must be race-safe (transaction / DB sequence — not `count() + 1`).
- Year rollover in the ID (`SMS-2025-0001` → `SMS-2026-0001`).
- Date of birth validation (not in the future; plausible age range).
- Status transitions — a *Withdrawn* or *Completed* student should not behave like an active one (e.g. excluded from active-cohort counts, blocked from new submissions).
- Editing a student vs. deleting: prefer soft-archive over hard delete so fee/grade history survives.
- Empty search results and pagination for large lists.

### 3.2 Fees & Payments

> The Registry needs to track what each student owes and what they have paid.

| # | Requirement |
|---|---|
| FP-1 | Assign a **fee amount to each student based on their programme**. |
| FP-2 | Record **payment transactions**: amount, date, reference number. |
| FP-3 | Show **outstanding balance in real time**. |
| FP-4 | **Flag students with an overdue balance** on the Registry dashboard. |

**Edge cases to handle deliberately**
- Balance = total fees charged − total payments recorded. Compute from transactions; do not store a mutable balance that can drift.
- Use `Decimal`, never `Float`, for currency.
- Overpayment (credit balance) and zero-balance students.
- Payment reference number uniqueness; prevent accidental duplicate entry.
- Payments dated in the future should be rejected.
- **Overdue definition** — fees need a *due date*; overdue = balance > 0 **and** past due date. Document the rule chosen.
- Programme fee changes must not retroactively rewrite an existing student's charge — snapshot the fee onto the student's fee record at assignment time.
- Deferred/Withdrawn students: decide and document whether they still accrue overdue flags.

### 3.3 Assessment Submission

> Students submit work against assessments created by staff.

| # | Requirement |
|---|---|
| AS-1 | **Staff creates an assessment**: title, module, submission deadline. |
| AS-2 | **Students upload a file (PDF or DOCX)** against an open assessment. |
| AS-3 | **One submission per student per assessment**; allow **resubmission before the deadline**. |
| AS-4 | **Late submissions are accepted but visually flagged.** |

**Edge cases to handle deliberately**
- Enforce one-submission-per-student-per-assessment with a **composite unique constraint** `(studentId, assessmentId)`; resubmission overwrites/versions the same row.
- Resubmission *after* the deadline: brief says resubmit "before the deadline" — decide and document (block, or accept-and-flag).
- MIME type **and** extension validation (PDF/DOCX only), plus a max file size.
- Late flag derived at submission time (`submittedAt > deadline`), persisted so it doesn't change if the deadline is later edited.
- Editing an assessment deadline after submissions exist — recompute or preserve? Document.
- Withdrawn students should not be able to submit.
- Safe filename handling — never trust the client-supplied name for the storage path.

### 3.4 Marksheet & Results

> Staff enter grades; students see results only when published.

| # | Requirement |
|---|---|
| MR-1 | Staff enter a **numeric grade (0–100)** per student per assessment. |
| MR-2 | Apply classification: **Pass ≥ 40, Merit ≥ 60, Distinction ≥ 70** (below 40 = Fail). |
| MR-3 | Staff can **publish or withhold results per student**. |
| MR-4 | Students see their marksheet **only after it has been published**. |

**Edge cases to handle deliberately**
- Grade bounds enforced at DB, API, and UI layers (0–100 inclusive).
- Classification derived, not stored as free text (a stored copy will drift from the boundaries).
- **Publication is per student per result** — the visibility check must live in the *server* query, not be hidden client-side. An unpublished grade must never reach the student's browser payload.
- Grading a student who never submitted (absent / non-submission) — allow a null grade or explicit "Not submitted" state.
- Un-publishing a previously published result.
- Audit trail: who entered/changed a grade and when.

---

## 4. Cross-Cutting Requirements

### 4.1 Roles

- **Basic role separation: a Staff view and a Student view.**
- Auth is **optional** — a simple role toggle is acceptable.
- Even with a toggle, **authorisation must be enforced server-side**: a student-role request must not be able to fetch unpublished results or another student's data by changing an ID in the URL.

| Capability | Staff | Student |
|---|---|---|
| Create/edit students | ✅ | ❌ |
| Search/filter students | ✅ | ❌ |
| Assign fees, record payments | ✅ | View own balance |
| Create assessments | ✅ | ❌ |
| Upload submission | ❌ | ✅ (own only) |
| Enter grades, publish/withhold | ✅ | ❌ |
| View marksheet | All | Own, published only |

### 4.2 Registry Dashboard

The brief requires overdue students to be flagged on a Registry dashboard. Suggested content:
- Total students by enrolment status.
- **Students with overdue balances** (the required flag), with amount and days overdue.
- Total fees billed vs. collected vs. outstanding.
- Upcoming assessment deadlines and submission counts.
- Late submissions awaiting marking; unpublished results pending release.

### 4.3 Technical Quality

- Clean, normalised Prisma schema with proper relations, enums, indexes, and unique constraints.
- Working API routes with meaningful HTTP status codes.
- Basic error handling: validation errors surfaced to the user, server errors logged not leaked.
- Loading and empty states in the UI.
- Transactions where multi-row consistency matters (ID generation, payment + balance read).

---

## 5. Deliverables Checklist

- [ ] GitHub repository, **all code committed** (no zip files).
- [ ] `README.md` covering:
  - [ ] How to run it locally.
  - [ ] Your `.env` variables.
  - [ ] **A short section on how you used AI during the build.**
- [ ] `prisma/schema.prisma` committed.
- [ ] `.env.example` committed; **no credentials in git**.
- [ ] **Seed script** loading demo data: **≥ 5 students, 2 programmes, fees, and sample grades** (plus assessments and payments to exercise overdue/late/withheld states).
- [ ] Staff view and Student view with role separation.

---

## 6. Assessment Rubric

| Dimension | Weight | What it means here |
|---|---|---|
| **Stakeholder understanding** | 30% | Does the data model and UI reflect how a Registry team actually works? |
| **Feature intuition** | 30% | Were edge cases handled *without being told* — overdue fees, late submissions, withheld results? |
| **Technical quality** | 25% | Clean schema, working API routes, basic error handling. |
| **AI usage** | 15% | Was AI used effectively, and can you articulate how in the README? |

> The highest-weighted 60% is **judgement**, not volume. Prefer four polished workflows with well-reasoned edge cases over a broader, shallower build. Where the brief is ambiguous (overdue definition, post-deadline resubmission, deferred-student fees), **make a decision and document the reasoning** — an explained trade-off scores where a silent guess does not.

---

## 7. Proposed Data Model (draft)

```
Programme      id, name, code, feeAmount (Decimal), durationYears
Student        id, studentId (unique, SMS-YYYY-NNNN), fullName, email (unique),
               dateOfBirth, programmeId, academicYear, status (enum), createdAt
FeeRecord      id, studentId, programmeId, amount (Decimal, snapshot), dueDate,
               description, academicYear
Payment        id, studentId, amount (Decimal), paidAt, reference (unique), method, note
Assessment     id, title, module, deadline, programmeId?, maxScore (100), createdAt
Submission     id, assessmentId, studentId, filePath, originalName, mimeType, sizeBytes,
               submittedAt, isLate (bool), version    -- unique(assessmentId, studentId)
Result         id, assessmentId, studentId, score (0-100, nullable), isPublished (bool),
               publishedAt, gradedBy, gradedAt        -- unique(assessmentId, studentId)
```

**Enums**
- `EnrolmentStatus` — `ENROLLED | DEFERRED | WITHDRAWN | COMPLETED`
- `Classification` — derived: `FAIL (<40) | PASS (40–59) | MERIT (60–69) | DISTINCTION (≥70)`

---

## 8. Suggested Route Map

**Staff**
- `/dashboard` — Registry overview, overdue flags
- `/students`, `/students/new`, `/students/[id]` — enrolment + student detail (fees, submissions, results)
- `/fees` — fee assignment and payment recording
- `/assessments`, `/assessments/new`, `/assessments/[id]` — submissions list, late flags
- `/marksheet` — grade entry, publish/withhold

**Student**
- `/portal` — own overview
- `/portal/fees` — balance and payment history
- `/portal/assessments` — open assessments, upload/resubmit
- `/portal/results` — published results only
