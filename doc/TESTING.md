# How to test this app

Every step below has an **expected result** tied to the seeded demo data, so you can tell a pass from a fail without knowing the codebase.

> Prefer to follow **one student through the whole lifecycle** instead of running independent checks? See [E2E-WALKTHROUGH.md](E2E-WALKTHROUGH.md) — a single continuous browser-only scenario that creates a new student and takes them through enrolment, fees, submission, marking, publication and withdrawal. This document is the checklist; that one is the story.

All accounts use the password **`Password123!`**

> Day counts ("overdue by N days") are relative to when you last seeded, so they grow over time. The figures below are the ones that matter and don't drift: amounts, statuses, and which students appear where.

---

## 0. One-time setup

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL and JWT_SECRET
npx prisma migrate deploy
npm run db:seed
npm run dev                 # http://localhost:3000
```

**Expected:** the seed prints a summary — 2 programmes, 6 students, 3 assessments, 3 submissions (one late), 3 results (one published, one withheld, one absent).

If you ever want a clean slate: `npm run db:reset`.

---

## 1. Automated checks (fastest way to see it works)

With the dev server running, in a second terminal:

```bash
npx tsx scripts/verify-auth.ts               # 13 assertions
npx tsx scripts/smoke-students.ts            # 13 assertions
npx tsx scripts/smoke-workflows.ts           # 29 assertions
npx tsx scripts/check-rsc-serialization.ts   # scans all 13 routes
```

**Expected:** every line prints `PASS`, and the last script prints *"no server/client serialisation errors across all routes"*.

These cover things that are invisible in the browser — most importantly that a withheld mark never enters a student's response payload, and that withdrawing a student takes effect on their existing session.

Also worth running:

```bash
npm run lint && npm run typecheck && npm run build
```

**Expected:** all three clean, with no warnings.

---

## 2. Registry staff — enrolment and money

Sign in as **`registry@sms.test`**.

| # | Do this | Expected |
|---|---|---|
| 2.1 | Land on `/dashboard` | 6 students · outstanding total · **2 overdue accounts** · "1 more overdue but withdrawn or completed" |
| 2.2 | Look at the overdue table | **Amara Okafor** and **Chloe Nguyen** only. **Farhan is absent** — he's withdrawn, so he's off the chase list even though he owes money |
| 2.3 | Go to **Students** | 6 rows, each with a status badge and a balance |
| 2.4 | Type `chloe` in search → Search | Only Chloe Nguyen |
| 2.5 | Search `SMS-` instead | All students — the same box searches name, ID **and** email |
| 2.6 | Filter status → **Withdrawn** | Only Farhan Iqbal |
| 2.7 | Copy the URL and open it in a new tab | Same filtered result — filters live in the URL, so a filtered roster is shareable |
| 2.8 | Open **Ben Whitfield** | Balance **Settled in full**, despite a due date well in the past — his payment cleared it. This is the oldest-charge-first allocation working |
| 2.9 | Open **Elena Petrova** | Shows a **£250.00 credit**, not a negative balance |
| 2.10 | Open **Daniel Osei** | Owes £7,800 but reads **"Owed, but not yet due"** — no overdue badge |

### Enrol a student

| # | Do this | Expected |
|---|---|---|
| 2.11 | **Students → Enrol student**, fill it in, submit | Success message with a new ID continuing the sequence (`SMS-2026-0007`), plus a **temporary password shown once** |
| 2.12 | Enrol another immediately | Next number, `…0008`. IDs never collide |
| 2.13 | Try to enrol using an email that already exists | Field-level error *"A student with this email already exists"* — not a crash |
| 2.14 | Try a date of birth in the future | Rejected with a clear message |

### Record a payment

| # | Do this | Expected |
|---|---|---|
| 2.15 | **Fees** → choose Chloe, £1,000, today, reference `TEST-001` | Success. Her outstanding **immediately drops** to £6,800 |
| 2.16 | Submit `TEST-001` again | *"This reference is already on file"* — duplicate receipts are rejected by the database |
| 2.17 | Try a payment dated tomorrow | Rejected — the date field won't accept a future date |
| 2.18 | Pay Chloe more than she owes | Balance flips to a **credit**, not a negative |

---

## 3. Academic staff — assessments and marks

Sign out, sign in as **`academic@sms.test`**.

| # | Do this | Expected |
|---|---|---|
| 3.1 | Go to **Fees** | Table is visible but **no payment form** — *"Recording payments is a Registry function"* |
| 3.2 | Go to **Students → Enrol student** by URL (`/students/new`) | Redirected back to the roster. Enrolment is Registry-only |
| 3.3 | Go to **Assessments** | 3 assessments. "Data Structures Coursework" shows a **1 late** badge |
| 3.4 | Open **Data Structures Coursework** | Submitted 2 / 3 · **1 late** · 1 not submitted. Ben's row carries a red **Late** badge |
| 3.5 | Click Ben's filename | The PDF downloads |
| 3.6 | Create a new assessment with a deadline in the past | Accepted — a deadline can legitimately be backdated |

### Marksheet

| # | Do this | Expected |
|---|---|---|
| 3.7 | **Marksheet** → Data Structures Coursework | The whole cohort is listed, including students who never submitted |
| 3.8 | Check Amara's row | 78 · **Distinction** · **Withhold** button (already published) |
| 3.9 | Check Ben's row | 55 · **Pass** · **Publish** button (currently withheld) |
| 3.10 | Check Elena's row | Score blank, classification **Absent** — not treated as zero |
| 3.11 | Enter `101` in any score box and save | Rejected — scores are 0–100 |
| 3.12 | Enter `39` then `40` then `60` then `70` | Fail → Pass → Merit → Distinction |
| 3.13 | Clear a score entirely and save | Recorded as **Absent**, which is distinct from a mark of 0 |
| 3.14 | Press **Publish all** | Every withheld mark for that assessment is released at once |

---

## 4. Student view — and the important one

Sign out, sign in as **`ben.whitfield@student.sms.test`**.

| # | Do this | Expected |
|---|---|---|
| 4.1 | **My results** | *"Nothing has been released yet"*. His mark of 55 exists but is withheld |
| 4.2 | **Open devtools → Network → reload → inspect the response** | **The number 55 appears nowhere in the payload.** It is filtered in the database query, not hidden with CSS |
| 4.3 | **Assessments** | His Data Structures submission carries **Submitted late** |
| 4.4 | **My fees** | Settled in full, with his payment listed |

Now sign in as **`amara.okafor@student.sms.test`**:

| # | Do this | Expected |
|---|---|---|
| 4.5 | **My results** | 78 · **Distinction** — hers *was* published |
| 4.6 | **My fees** | £6,250 outstanding, flagged overdue |
| 4.7 | **Assessments** → upload a PDF to *Systems Analysis Report* | Accepted. Re-uploading replaces the file and shows **version 2** |
| 4.8 | Upload to *Data Structures Coursework* (deadline passed) | **Accepted, and flagged late.** Late work is never refused |
| 4.9 | Try uploading a `.txt` or `.png` | Rejected — *"Upload a .pdf or .docx file"* |

Then **`farhan.iqbal@student.sms.test`** (withdrawn):

| # | Do this | Expected |
|---|---|---|
| 4.10 | **Assessments** | An amber notice, and **no upload form at all** |
| 4.11 | **My fees** | He still owes £6,800 — withdrawal does not write off debt |

---

## 5. Security checks

| # | Do this | Expected |
|---|---|---|
| 5.1 | Sign out, visit `/dashboard` directly | Redirected to `/login` |
| 5.2 | As a **student**, visit `/dashboard` | Redirected to `/portal` |
| 5.3 | As **staff**, visit `/portal` | Redirected to `/dashboard` |
| 5.4 | As Ben, open another student's file: `/api/submissions/<id>` | **403 Forbidden** |
| 5.5 | Devtools → Application → Cookies | `sms_session` is **HttpOnly** — unreadable by scripts |
| 5.6 | Edit one character of that cookie and reload | Bounced to `/login`, not a 500 |
| 5.7 | Enter a wrong password | *"Invalid email or password"* — never reveals which field was wrong |

### The revocation test (why the JWT isn't stateless)

1. Sign in as **Amara** in one browser. Confirm she *can* submit work.
2. In another browser, sign in as **`registry@sms.test`**, open Amara, set status → **Withdrawn**.
3. Back in Amara's browser, **just refresh** — no re-login.

**Expected:** the upload form is gone immediately.

This is the whole reason role and enrolment status are read from the database on every request rather than trusted from the token. A self-contained token would have left her able to submit for up to 7 days.

Set her back to **Enrolled** afterwards, or run `npm run db:reset`.

---

## 6. Theme

| # | Do this | Expected |
|---|---|---|
| 6.1 | Click the sun/moon icon in the header | Switches light ↔ dark |
| 6.2 | Reload the page | Theme persists, **with no flash** of the wrong theme |
| 6.3 | In a fresh private window, before clicking anything | Matches your operating system's theme |

---

## Things that are known not to work

- **Uploaded files do not persist on a serverless host** (Vercel/Netlify). Storage is local disk — fine locally, ephemeral in the cloud. See Known Limitations in the [README](../README.md).
- **Fee assignment creates one charge at enrolment.** Instalment plans are modelled but not exposed in the UI.
- **`npm audit` reports 3 high-severity advisories** inside Next.js's own dependencies. The "fix" downgrades to Next 9, which would break the brief's Next 14+ requirement.
