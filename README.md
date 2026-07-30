# Student Management System — Registry Module

A focused implementation of the four workflows a Registry Administrator uses every day: **student enrolment**, **fees & payments**, **assessment submission**, and **marksheet & results**.

Built for the PEN Global technical assessment ([brief](doc/SMS_Technical_Assessment_.pdf) · [derived requirements](doc/REQUIREMENTS.md)).

**Reviewing this?** [doc/TESTING.md](doc/TESTING.md) is a step-by-step walkthrough with expected results for every check, tied to the seeded data.

**Stack:** Next.js 16 (App Router) · PostgreSQL · Prisma 7 · TypeScript · Tailwind 4 · shadcn/ui · Zod

Light and dark themes are both supported, following the operating system until you click the toggle in the header (also available on the login page). `next-themes` sets the class on `<html>` from a blocking script, so there is no flash of the wrong theme on load.

---

## Running it locally

### 1. Install

```bash
git clone <this-repo>
cd student_management_system
npm install          # postinstall runs `prisma generate`
```

### 2. Get a PostgreSQL database

Any Postgres works — `DATABASE_URL` is the only thing that changes. Pick whichever is least effort:

| Option | Command | Notes |
|---|---|---|
| **Prisma local** | `npx prisma dev` | Zero install. Prints a connection string. Easiest. |
| **Neon** | [neon.tech](https://neon.tech) → new project | Free tier, no install. Also set `DIRECT_URL` (below). |
| **Native install** | `winget install PostgreSQL.PostgreSQL.17` | Works offline. |
| **Docker** | `docker run -d --name sms-db -p 5432:5432 -e POSTGRES_PASSWORD=sms -e POSTGRES_DB=sms postgres:17` | If you already have Docker. |

> **If you choose `npx prisma dev`:** it is Postgres compiled to WASM and cannot service the migration engine's shadow-database step, so `prisma migrate dev` fails against it. Use `npx prisma db push` instead. Everything else works normally.

### 3. Configure

```bash
cp .env.example .env
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. The running app uses this. |
| `DIRECT_URL` | Neon/Supabase only | The **unpooled** endpoint (same host with `-pooler` removed). Prisma Migrate needs a direct connection because PgBouncer does not support the advisory locks and session state the migration engine relies on. |
| `JWT_SECRET` | yes | Signs session tokens. Minimum 32 characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Coursework uploads go to `./uploads` (gitignored). That path is a literal in [`src/lib/storage.ts`](src/lib/storage.ts) rather than an env var: a dynamic path joined onto `process.cwd()` makes Turbopack's file tracer pull the entire project into the build output.

Add `uselibpqcompat=true` alongside `sslmode` for any hosted Postgres — node-postgres 8.16 changed what `sslmode` means and warns loudly without it.

The app validates its environment at boot ([`src/lib/env.ts`](src/lib/env.ts)) and fails with a clear message rather than a confusing 500 on first login.

### 4. Migrate, seed, run

```bash
npx prisma migrate deploy   # or `npm run db:migrate` in development
npm run db:seed
npm run dev                 # http://localhost:3000
```

### Demo accounts

All seeded accounts share the password **`Password123!`**. The login page has one-click buttons for each.

| Email | Role | What it demonstrates |
|---|---|---|
| `registry@sms.test` | Registry staff | Enrolment, fees, dashboard |
| `academic@sms.test` | Academic staff | Assessments, marksheet, publishing |
| `amara.okafor@student.sms.test` | Student | Overdue balance, published distinction |
| `ben.whitfield@student.sms.test` | Student | Late submission, **withheld** result |
| `farhan.iqbal@student.sms.test` | Student | Withdrawn — blocked from submitting |

### Scripts

```bash
npm run db:studio      # browse the data
npm run db:reset       # wipe and re-seed
npm run typecheck      # tsc --noEmit
npm run build          # production build

# End-to-end checks (dev server must be running)
npx tsx scripts/verify-auth.ts               # 13 auth / authorisation assertions
npx tsx scripts/smoke-students.ts            # 13 enrolment assertions
npx tsx scripts/smoke-workflows.ts           # 29 fees / submission / marksheet assertions
npx tsx scripts/check-rsc-serialization.ts   # scans every route for server→client serialisation errors
```

---

## How the data model reflects Registry work

```
Programme ──┬── Student ──┬── FeeRecord      (charges)
            │             ├── Payment        (receipts)
            │             ├── Submission     (uploaded work)
            │             └── Result         (marks)
            └── Assessment ────────┘
User ─── Student (optional 1-1)   — login accounts
StudentIdCounter                  — race-safe SMS-YYYY-NNNN sequence
```

Decisions that matter more than the diagram:

- **Money is `Decimal(10,2)`, never `Float`.** Binary floating point cannot represent `0.10` exactly; a fee ledger built on it drifts.
- **Balances are never stored.** `computeBalance()` derives them from charges minus payments every time. A stored total is a second source of truth that goes stale the moment a payment is corrected.
- **`FeeRecord.amount` snapshots the programme fee** when the charge is raised. Raising next year's tuition must not retroactively change what a current student was billed.
- **`Submission.isLate` is persisted at upload time**, not derived on read. If it were derived, moving a deadline would silently rewrite whether work was late.
- **Composite unique keys on `(assessmentId, studentId)`** for both `Submission` and `Result`. "One submission per student per assessment" is a database constraint, not UI logic, so a double-submit race cannot produce two rows.
- **Student IDs come from a counter row incremented inside the enrolment transaction.** `count() + 1` would hand two simultaneous enrolments the same number.
- **Deletion is a soft archive.** A registry does not erase a person; hard deletion would take the fee and grade history with it.

---

## Decisions & trade-offs

The brief is deliberately underspecified in places. Each gap is resolved explicitly rather than guessed at silently.

### 1. "Overdue" is never defined — so we defined it

The brief asks to flag overdue balances but gives fees no due date. We added `FeeRecord.dueDate` (30 days from enrolment) and define **overdue = money still owed AND a due date already passed**.

Further, **payments are allocated oldest-charge-first**, the way a finance office settles an account. This has a visible consequence: Ben has a charge that fell due 45 days ago, but he paid it — so he is *not* overdue. A naïve "any past due date + any balance" rule would wrongly chase him.

### 2. Withdrawn students keep their debt but leave the chase list

The brief says nothing about non-active students. Real registries do not write off money because someone left, so withdrawn and completed students keep their charges and still count in the outstanding total. But they are excluded from the dashboard's **chase list** — pursuing an active-student workflow against someone who has left is a different process. Farhan is seeded to demonstrate exactly this.

### 3. Resubmission after the deadline is allowed

The brief says "allow resubmission before the deadline" and, separately, that late submissions are accepted. Read strictly, those conflict. We accept late resubmissions, because refusing one would be *stricter* than refusing a first late submission — which the brief explicitly permits. Late work is always flagged, never refused.

### 4. A blank score means absent, not zero

Marking a student who never submitted is not the same as awarding zero. `Result.score` is nullable and renders as "Absent"; zero remains a real mark a student can earn. The marksheet lists the whole cohort rather than only those who submitted, so non-submission is recorded rather than quietly ignored.

### 5. Registry staff and academic staff are separate departments

The brief uses "Registry team" and "staff" interchangeably and only requires a Staff/Student split. A real institution separates them: Registry owns enrolment and money, academics own assessments and marks. Registry cannot enter a grade here; academics cannot record a payment. Both retain **read** access across the app — only write paths are shaped by department.

### 6. Real authentication, though the brief allows a toggle

The brief says a role toggle is fine. We implemented JWT login anyway, and the deciding argument was this app's own domain: **it withdraws students.** With a self-contained token, a student withdrawn on Monday would keep a working session until the token expired on Friday.

So the token carries **only the user id**. Role, department, and enrolment status are read from the database on every request. Withdrawal takes effect on the *existing* session — [`scripts/verify-auth.ts`](scripts/verify-auth.ts) asserts precisely this.

The trade-off accepted: one indexed lookup per request, which the page was already paying for, in exchange for immediate revocation. A stateless JWT would be faster and wrong for this domain.

Other auth details: `jose` rather than `jsonwebtoken` because the proxy runs on the Edge runtime; the algorithm is pinned on verification to block `alg` confusion attacks; the cookie is `httpOnly` + `sameSite=lax`; failed logins return one generic message so accounts cannot be enumerated, and still pay the hashing cost so a missing account is not detectably faster to reject.

### 7. Withheld results are filtered in the query, not the view

The single most important line in the student-facing app:

```ts
// src/app/portal/results/page.tsx
where: { studentId: actor.student.id, isPublished: true }
```

Hiding an unpublished mark in the component would still ship the score inside the rendered payload, readable in devtools. Filtering in the query means it never leaves the database. Verified: Ben's withheld 55 produces **zero rows** in his response.

### 8. Uploads are not served statically

Coursework is written outside `public/` and served through [an authorised route handler](src/app/api/submissions/%5Bid%5D/route.ts). Anything in `public/` is served with no authorisation at all, so a guessed filename would expose another student's work. Files are stored under a server-generated UUID — a client-supplied name like `../../.env` is never used to build a path — uploads validate declared MIME *and* extension, and downloads are sent as `attachment` so a PDF cannot execute against our origin.

---

## How AI was used

This project was built with **Claude Opus 5** (Claude Code) throughout. Being specific, since the brief asks:

**Where it did the heavy lifting**

- **Turning the brief into a spec.** The PDF was extracted into [doc/REQUIREMENTS.md](doc/REQUIREMENTS.md), which surfaced the ambiguities above *before* any code existed. That framing shaped the whole build.
- **Schema and boilerplate.** The Prisma schema, CRUD pages, form components, and Zod schemas were largely AI-drafted — the work it is genuinely fastest at.
- **Adversarial test scripts.** The three `scripts/` files were AI-written and are arguably the most valuable artefact here: they assert things invisible in the UI, like a withheld mark not appearing in a response payload, or a student being unable to download someone else's file.

**Where I had to overrule it or dig in**

- **Next.js 16 and Prisma 7 are newer than the model's training data.** It reached for v6 conventions initially. The fix was treating the installed packages as ground truth: `prisma init`'s own output revealed the new `prisma.config.ts`, the `prisma-client` generator, and the required driver adapter. Docs were fetched for the `middleware` → `proxy` rename rather than guessed at.
- **Its first instinct on auth was the role toggle the brief permits.** The domain argument for real auth — that this app withdraws students — was the reason to overrule that.
- **It suggested `docker-compose.yml` reflexively.** Challenged on why, there was no good answer; the brief never mentions Docker. Dropped in favour of documenting four interchangeable database options.
- **Three of its own test assertions were wrong in the same way** — too crude, passing or failing for the wrong reason. A bare `"55"` matched `rgba(255,255,255,.3)`; a regex for the overdue badge broke on React's `<!-- -->` text-node separators; an assertion that "Merit" was absent failed against the page's own legend text. Each time the feature was correct and the *test* was the bug. Worth stating plainly: AI-written tests need the same scepticism as AI-written code, and a green suite proves nothing if the assertions are vacuous.
- **One real bug it introduced, caught via a 500 on every page:** `action-result.ts` imported error classes from `authz.ts`, which reaches `next/headers`. A client component importing `idleState` therefore dragged server-only code into the browser bundle. Fixed by extracting [`src/lib/errors.ts`](src/lib/errors.ts) with no dependencies.
- **A second bug that every automated check missed.** `listProgrammes()` returned whole `Programme` rows, including `feeAmount` — a Prisma `Decimal`, which is a class instance React cannot serialise to a client component. The page still returned **200 and still rendered**, so status-code and content assertions were blind to it; it only appeared as a console error when a human opened the page. The fix was to select just the fields the dropdown needs, but the more useful outcome was [`scripts/check-rsc-serialization.ts`](scripts/check-rsc-serialization.ts), which visits every route and scans the server log for serialisation errors. **I confirmed it fails by reintroducing the bug** — a check that has never been seen to fail is not evidence of anything, which was the lesson from the three bad assertions above.

**Honest summary:** AI compressed several days into hours, and was most useful on schema design, boilerplate, and writing tests I would otherwise have been too lazy to write. It was least trustworthy on anything past its knowledge cutoff, and on judging whether its own tests actually tested anything. The product decisions above are mine; AI helped me articulate and pressure-test them.

---

## Known limitations

- **Fee assignment is one charge per student at enrolment.** A real registry raises charges per academic year with instalment plans. The model supports multiple `FeeRecord` rows; the UI only creates the first.
- **Balances are computed in application code**, not SQL. Correct and readable at a few thousand students; beyond that the oldest-charge-first allocation would move into a database view.
- **File storage is local disk.** Fine here, wrong for a deployment with more than one instance. Confined to [`src/lib/storage.ts`](src/lib/storage.ts) so swapping in S3 touches one file.
- **No automated test runner.** The `scripts/` checks are assertion scripts against a running server, not a Vitest/Playwright suite. Given the time available I chose breadth of real assertions over test infrastructure.
- **`npm audit` reports 3 high-severity advisories** in `postcss` and `sharp`, both transitive dependencies of Next.js 16 itself. `npm audit fix --force` "resolves" them by downgrading to Next 9, which would break the brief's Next 14+ requirement. Left in place deliberately.
