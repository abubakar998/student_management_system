# End-to-end manual walkthrough

One continuous scenario, done entirely in the browser. No scripts, no terminal, and **nothing relies on the seeded demo data** — you create a brand-new student and follow that single record through enrolment, fees, submission, marking, publication, and withdrawal.

This complements [TESTING.md](TESTING.md), which is a checklist of independent checks. This document is the story.

**Time:** about 15 minutes.

---

## Before you start

1. App running at `http://localhost:3000` (`npm run dev`).
2. **Two browser windows.** One normal, one private/incognito. You need two sessions live at the same time — a staff one and a student one — to see revocation and publication take effect without logging in and out repeatedly.
   - Window **A** = staff
   - Window **B** = student
3. **A PDF file to upload.** Any PDF works. If you have none to hand, the seed wrote some to `uploads/` — e.g. `uploads/seed-amara-cs201.pdf`.
4. Staff logins (password `Password123!`):
   - `registry@sms.test` — Registry
   - `academic@sms.test` — Academic

Throughout, **✅** marks what you should see.

---

## Act 1 · Registry enrols a new student

**Window A**, sign in as `registry@sms.test`.

**1.** Land on the dashboard.
✅ Note the **Students** count and the **Outstanding** total. You'll compare against these later.

**2.** Go to **Students → Enrol student**. Fill in:

| Field | Value |
|---|---|
| Full name | `Priya Sharma` |
| Email | `priya.sharma@student.sms.test` |
| Date of birth | any date making her ~20 |
| Academic year | `1` |
| Programme | **BSc Computer Science** |
| Status | Enrolled |

**3.** Submit.
✅ Success message containing a **new registry number** continuing the sequence — `SMS-2026-0007` if the seed is untouched.
✅ A **temporary password**, stated as shown only once.

> **Write both down now.** The password is not recoverable — only its hash is stored. That is deliberate, and you'll use it in Act 4.

**4.** Try to enrol a second student using **the same email**.
✅ A field-level error: *"A student with this email already exists."* Not a crash, not a stack trace. The uniqueness is enforced by the database, so two people submitting at the same instant cannot both get through.

**5.** Set the date of birth to **tomorrow** and submit.
✅ Rejected. A birth date in the future is a typo, not a student.

**6.** Go back to **Students** and search `priya`.
✅ She appears. Search `SMS-2026-0007` instead — ✅ same result. One box covers name, ID and email.

**7.** Open her record.
✅ A tuition charge was raised automatically at the programme's current price (**£9,250.00**).
✅ Balance reads **"Owed, but not yet due"** — no overdue badge. Her due date is 30 days out.

> This is the first edge case: owing money is not the same as being overdue. The brief never defined "overdue", so this app does: *money outstanding **and** a due date already passed.*

**8.** Return to the **dashboard**.
✅ Students count went up by one.
✅ Outstanding total rose by £9,250.
✅ She is **not** in the overdue table.

---

## Act 2 · Money moves

**9.** Go to **Fees**. In *Record a payment*: Priya, amount `2000`, today's date, reference `E2E-001`.
✅ Success, and her outstanding **immediately** shows **£7,250.00**.

> Nothing stored a balance. It is recomputed from charges minus payments every time it is displayed, so a correction can never leave a stale total behind.

**10.** Submit **exactly the same reference again** (`E2E-001`, any amount).
✅ Rejected: *"This reference is already on file."* Re-keying a receipt cannot silently double-count a payment.

**11.** Try a payment dated **tomorrow**.
✅ Rejected. Money cannot have arrived in the future.

**12.** Record `-50` with reference `E2E-002`.
✅ Rejected. A payment must be positive; a refund would be a separate concept.

**13.** To see an **overpayment** handled, open seeded student **Elena Petrova**.
✅ **£250.00 credit** — shown as credit, not as a negative number pretending to be a debt.

> Deliberately *not* done to Priya: she needs to keep owing money for Act 6 to mean anything, and payments cannot be deleted through the UI.

✅ Priya should still owe **£7,250.00** at this point. Check before continuing.

---

## Act 3 · Academic staff set the work

**Window A**, sign out, sign in as `academic@sms.test`.

**14.** Go to **Fees**.
✅ You can see the table, but there is **no payment form** — *"Recording payments is a Registry function."*

**15.** Type `/students/new` into the address bar directly.
✅ Redirected away. Enrolment is Registry-only, and that is enforced on the server, not by hiding a button.

**16.** Go to **Assessments** and create:

| Field | Value |
|---|---|
| Title | `E2E Open Paper` |
| Module | `CS900` |
| Deadline | **a few hours from now** |
| Programme | BSc Computer Science |

✅ Created, listed as open.

**17.** Create a second one:

| Field | Value |
|---|---|
| Title | `E2E Closed Paper` |
| Module | `CS901` |
| Deadline | **yesterday** |
| Programme | BSc Computer Science |

✅ Accepted. A backdated deadline is legitimate — staff often record an assessment after the fact.

---

## Act 4 · The student arrives

**Window B** (private/incognito), go to `http://localhost:3000`.

**18.** Sign in as `priya.sharma@student.sms.test` with **the temporary password from step 3**.
✅ You reach her portal. *The credential handover in Act 1 actually works.*

**19.** Deliberately try a wrong password first.
✅ *"Invalid email or password."* It never tells you which half was wrong — that would let someone confirm which accounts exist.

**20.** Open **My fees**.
✅ Both your payments listed, with the £2,750 credit.

**21.** Open **Assessments**.
✅ **CS900** and **CS901** are both listed, alongside the seeded Computer Science papers (CS201, CS310).
✅ **BM220 Business Strategy Essay is absent** — it belongs to Business Management. She sees her own programme's work, plus anything set for all programmes.

**22.** Upload your PDF to **E2E Open Paper**.
✅ Accepted, badged **Submitted** — no late flag.

**23.** Upload a **different** PDF to the same paper.
✅ Still one submission, now **version 2**. Resubmission replaces; it never creates a second row. That is a database constraint, not UI logic.

**24.** Upload to **E2E Closed Paper** (deadline was yesterday).
✅ **Accepted — and flagged Late.**

> The second edge case: late work is never *refused*. The brief says late submissions are accepted but flagged, so the deadline changes the label, not the permission.

**25.** Try uploading a `.txt`, `.png`, or `.zip`.
✅ Rejected: *"Upload a .pdf or .docx file."*

**26.** Open **My results**.
✅ *"Nothing has been released yet."* Nothing has been marked.

---

## Act 5 · Marking and the publication boundary

Back to **Window A** (academic).

**27.** Go to **Marksheet** and select **E2E Closed Paper**.
✅ Priya is listed, with her submission shown as **Late**.
✅ The whole cohort appears — not just those who submitted — so a non-submission can be recorded rather than ignored.

**28.** Enter `101` in her score box and save.
✅ Rejected. Scores are 0–100, checked on the server as well as in the input.

**29.** Enter `65` and save.
✅ Classification reads **Merit**. Try `39` → Fail, `40` → Pass, `70` → Distinction. Set it back to `65`.
✅ Her row shows a **Publish** button, meaning the mark is currently **withheld**.

**30. — the one that matters.** In **Window B**, reload **My results**.
✅ Still *"Nothing has been released yet."* Her 65 exists and is not visible.

**31.** Still in Window B, open **devtools → Elements**, and inspect the results card.
✅ The results **table has no data rows at all** — the empty-state message is rendered in its place. There is no hidden row, no `display:none`, nothing to un-hide.

> **Do not test this by searching the page source for `65` or `Merit`.** Both give false positives, and I hit both while building this:
> - `Merit` appears in the card's own legend — *"Pass is 40 and above, Merit 60, Distinction 70."*
> - A bare two-digit number matches CSS and React chunk ids. Searching for `55` on this page hits `rgba(255,255,255,.3)`.
>
> The row count is the honest signal. That is exactly what [`scripts/check-rsc-serialization.ts`](../scripts/check-rsc-serialization.ts) and the assertion in `smoke-workflows.ts` check.

This is the difference between a result that is *hidden* and one that was *never sent*. Anything in the payload is readable by anyone who opens devtools, so the filter belongs in the query — and it is: `where: { studentId, isPublished: true }`.

**32.** In **Window A**, clear her score entirely and save.
✅ Recorded as **Absent** — deliberately distinct from a mark of zero, which is a real grade a student can earn. Put `65` back.

**33.** Click **Publish** on her row.

**34.** In **Window B**, reload **My results**.
✅ **65 · Merit**, with its release date. Only now does it exist as far as she is concerned.

**35.** In Window A, click **Withhold** again, then reload Window B.
✅ It disappears. A mark released by mistake can be pulled back.

Publish it again before moving on.

---

## Act 6 · Withdrawal, and why the session is not stateless

**36.** In **Window B**, confirm Priya still has an **upload form** on her Assessments page. Leave that tab open — *do not sign out*.

**37.** In **Window A**, sign out and back in as `registry@sms.test`. Open Priya's record and set **Enrolment status → Withdrawn**.

**38.** Go back to **Window B** and simply **refresh**. No re-login.

✅ The upload form is **gone**, replaced by a notice that her status blocks new submissions.

> This is the whole reason the session token carries only a user id. Role and enrolment status are read from the database on every request. A self-contained token would have left her able to submit for up to seven days after being withdrawn — in an app whose core job is withdrawing students.

**39.** Still in Window B, open **My fees**.
✅ She still owes **£7,250.00**. Withdrawal does not write off money.

**40.** In **Window A**, open the **dashboard**.
✅ Her £7,250 is still counted in the **Outstanding** total.

Priya is not overdue — her due date is 30 days out — so to see the chase-list rule, look at seeded **Farhan Iqbal**: withdrawn, genuinely overdue, and deliberately **absent from the overdue table** while the summary notes *"1 more overdue but withdrawn or completed."*

> Two different decisions, modelled separately: a registry doesn't pursue someone who has left through the active-student process, but it doesn't forgive the debt either.

**41.** Go to **Marksheet → E2E Closed Paper**.
✅ She has dropped out of the marking cohort — withdrawn students are no longer expected to be marked. Her result still exists on her student record.

---

## Act 7 · Cross-account access

**42.** In **Window B** (still Priya, still withdrawn), go to **My results**, right-click a link and copy any `/api/submissions/<id>` URL you can find. Then hand-edit the id to a different value, or grab another student's submission id from Window A.
✅ **403 Forbidden.** A student can only ever read their own work.

**43.** In Window B, type `/dashboard` into the address bar.
✅ Redirected to `/portal`. The staff area is not reachable by URL.

**44.** In Window A (staff), type `/portal`.
✅ Redirected to `/dashboard`.

**45.** In Window B, open **devtools → Application → Cookies**.
✅ `sms_session` is marked **HttpOnly** — no script on the page can read it.

**46.** Edit a single character of that cookie value and reload.
✅ Bounced to `/login`. A tampered signature fails cleanly; it does not produce a 500.

---

## Act 8 · Tidy up

**47.** In Window A, set Priya back to **Enrolled**, or reset everything:

```bash
npm run db:reset
```

✅ Back to the original six seeded students.

---

## What this proves

Following one record end to end exercises every judgement call the app makes:

| Seen in | Behaviour |
|---|---|
| Steps 7, 8 | Owed ≠ overdue — "overdue" needed defining, and was |
| Steps 9–13 | Balances derived not stored, duplicate receipts refused, overpayment shown as credit |
| Steps 14, 15 | Registry and academic staff are different departments, enforced server-side |
| Steps 22–24 | Late work accepted and flagged; resubmission replaces rather than duplicates |
| Steps 30, 31 | A withheld mark never enters the response payload |
| Step 32 | Absent is not zero |
| Steps 38–41 | Withdrawal takes effect instantly, without erasing debt or history |
| Steps 42–46 | Authorisation is server-side, not a hidden button |
