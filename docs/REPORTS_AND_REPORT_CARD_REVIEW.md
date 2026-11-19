# Task Mentor — Reports & Report Card Review

**Date:** 19 Nov 2026
**Scope:** `nga-task-mentor` at `main` (`ed8294e`): every report surface, and the report-card module end to end (data model, grading, workflow, permissions, PDF, student view).
**Benchmark:** `Term 2 Performance_All.pdf` at the repo root. This is the card NGA issues today from an external tool (academicbridge.xyz). A Task Mentor card has to be at least as complete as this before the school can switch to it.

---

## 1. Executive summary

The report card works as a **calculator**: it maps assessments to CW/HW/MD/EOT, weights them 15/10/25/50 and prints a PDF with a QR code. It does not work as a **managed, approved document** yet. The main problems:

1. **Approval does not lock anything.** No write endpoint (`saveBuilder`, `saveSubjectMapping`, `saveAttributes`, manual score entry) checks the card's status. An approved card can be edited by any teacher with edit rights.
2. **Approved cards are not frozen.** Grades are recomputed from live marks on every read, PDF download and public QR verification. If a quiz is regraded, a mark corrected or an assignment re-scoped after approval, the "approved" card changes without anyone noticing. A printed copy and its QR check can then disagree.
3. **"Approved" also means "published".** The status enum is `draft | saved | approved`. As soon as a card is approved, students see it. There is no review step, no "approved but not yet released" state and no scheduled release. A `REPORT_CARDS_PUBLISH` permission exists in the catalog, but no state uses it.
4. **No audit trail.** Nobody records who reviewed, approved or reverted a card, when, or why. There is no `approved_by`, no `approved_at` and no status history.
5. **Approval happens per student, from a subject screen.** A subject teacher's dashboard has the Approve button for the **whole multi-subject card**. There is no class-level workbench, no bulk actions and no check that every subject is complete.
6. **The card falls short of the school's current card.** It has no class, reg. no., subject teacher, class average, overall average, position, module grouping (core/specific), signatures, or next-term date. It uses a 5-band A–F scale where the school uses a 9-band A*–U scale. Attendance is a single Present/Absent/Late flag rather than day counts.
7. **The analytics are thin.** There is no gender breakdown, no grade distribution, no pass/fail rates, no term-over-term trend and no class/stream comparison (see §5).

Sections 3–4 cover the report card. Section 5 covers the other reports. Section 6 proposes the target workflow (**Draft → Reviewed → Approved → Published**). Section 8 gives a phased plan.

---

## 2. How report cards are built today

### 2.1 Data model

| Table | Purpose | Notes |
|---|---|---|
| `report_cards` | One row per student × term × academic_year | `status ENUM(draft,saved,approved)`, class-teacher comment, 3 attendance ints, `uuid`, `pdf_path`. **No unique index** on `(student_id, term, academic_year)`: there are only plain indexes ([create-report-card-tables.js:61-62](../server/migrations/20260607000000-create-report-card-tables.js#L61-L62)). |
| `report_card_assessments` | Per-card mapping of assessment → subject + category | Rewritten by the subject-mapping fan-out. |
| `subject_assessment_mappings` | Canonical mapping per subject × term × year | Edited by the builder. |
| `report_card_attributes` | 6 behaviour attributes × rating (Excellent / Very good / Good) | Names hard-coded in the client ([GeneralAttributesForm.tsx:29-36](../client/src/components/ReportCard/GeneralAttributesForm.tsx#L29-L36)). |

Term and year are stored as **free strings** (`"Term 2"`, `"2025-2026"`), not MIS ids. Lookups match on those strings, so if MIS renames a term, cards become orphaned.

### 2.2 Build flow

```
Subject teacher                     Class teacher                    Admin
──────────────                      ─────────────                    ─────
Builder: drag quizzes/assignments/  General Attributes page:         Subject dashboard or
manual marks into CW/HW/MD/EOT      6 attributes, comment (AI        Course panel: Approve
  → POST /subject-mapping/save      draft available), attendance      → PATCH /:id/status
  → fans out to every enrolled        → POST /attributes/save           (approved = visible
    student; creates draft cards      (creates card if missing)          to student)
Subject dashboard: "Mark complete"
  → PATCH /:id/status saved
```

* **Grades are not stored.** `aggregateReportCardData` ([reportCard.controller.ts:768](../server/src/controllers/reportCard.controller.ts#L768)) loads the mappings, fetches the student's current best quiz attempt, assignment grade and manual scores, then calls `calculateSubjectGrade`. Every read path (student view, PDF, annual, admin summary, verification) recomputes from live data.
* **Weights and grade scale are hard-coded** in `reportCardGrader.service.ts` (CW 15 / HW 10 / MD 25 / EOT 50; A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 45, F).
* **The annual card** averages each subject's term totals equally across whichever terms have a card.

### 2.3 Status rules today

`updateStatus` ([reportCard.controller.ts:686-766](../server/src/controllers/reportCard.controller.ts#L686-L766)):

| From → To | Who |
|---|---|
| draft ↔ saved | `REPORT_CARDS_EDIT` (in v2 enforce mode: scoped to class, or to a subject×class on the card) |
| any → approved | `REPORT_CARDS_APPROVE` (+ `PUBLISH` in v2 enforce mode) |
| approved → draft/saved | `REPORT_CARDS_APPROVE` |

Students and parents only receive `approved` cards ([reportCard.controller.ts:837-839](../server/src/controllers/reportCard.controller.ts#L837-L839)). Public QR verification only confirms `approved` cards.

---

## 3. Report card — gaps and defects

Severity: **Critical** = the card can be wrong or tampered with after approval; **High** = blocks replacing the current tool; **Medium** = correctness or usability; **Low** = polish.

### 3.1 Workflow and integrity

| # | Sev | Finding | Evidence |
|---|---|---|---|
| RC-01 | Critical | **No edit lock after approval.** `saveBuilder`, `saveSubjectMapping` (the fan-out rewrites every student's mappings, approved cards included), `saveAttributes` and manual score entry never read `status`. | [reportCard.controller.ts:143](../server/src/controllers/reportCard.controller.ts#L143), [:276](../server/src/controllers/reportCard.controller.ts#L276), [:387](../server/src/controllers/reportCard.controller.ts#L387); `manualAssessment.controller.ts` has no `ReportCard` reference |
| RC-02 | Critical | **No snapshot.** An approved card recomputes from live marks, so a regrade, a late mark, a quiz soft-delete (removed from the card by `loadStudentScores`) or a change of an assignment's marks status silently changes an approved/published card. | `aggregateReportCardData` + `loadStudentScores` ([reportCardScores.ts](../server/src/utils/reportCardScores.ts)) |
| RC-03 | Critical | **QR verification checks live data, not the issued document.** `verifyReportCard` recomputes the average on each scan. The `pdf_path` file is overwritten on every download. A printed card can therefore disagree with its own QR check, and no hash of the issued PDF is kept. | [reportCard.controller.ts:1593](../server/src/controllers/reportCard.controller.ts#L1593), `generatePdf` → `saveReportCardPdf` on every call |
| RC-04 | High | **Approved = published.** There is no review stage and no hold before release. A card becomes visible to the student as soon as an approver clicks Approve, even by mistake. `REPORT_CARDS_PUBLISH` exists but no state uses it. | status enum; route comment [reportCards.ts:126-129](../server/src/routes/reportCards.ts#L126-L129) |
| RC-05 | High | **Steps can be skipped.** An approver can go straight from draft to approved. Approval has no preconditions: no check that every subject is complete, that a comment exists or that attendance is recorded. | `updateStatus` validates only the permission |
| RC-06 | High | **"Saved" is ambiguous.** The UI calls it "Marked as complete — ready for admin review". It is set **per student, from one subject's dashboard**, so whichever subject teacher clicks first marks the whole multi-subject card complete. | [SubjectReportCardDashboard.tsx:183-197](../client/src/components/ReportCard/SubjectReportCardDashboard.tsx#L183-L197) |
| RC-07 | High | **No audit trail.** There are no `reviewed_by/at`, `approved_by/at`, `published_at` or transition history, and no reason is recorded when a card is reverted. | model |
| RC-08 | High | **Approval is per student only.** No bulk approve or publish exists for a class. Approving 40 students means 40 clicks. | UI + API (single-id PATCH) |
| RC-09 | Medium | **Duplicate cards are possible.** Without a unique index, two teachers saving subject mappings at the same time can both `findOrCreate` the same student × term. | migration indexes |
| RC-10 | Medium | **Student id ambiguity.** Cards are keyed on the MIS id by the fan-out and on the local `users.id` by the legacy builder. `getStudentReportCard` and `annual` query `student_id = :id` only, so a legacy-keyed card is invisible from the MIS id. The preview handles both ids, but these endpoints do not. | [reportCard.controller.ts:841](../server/src/controllers/reportCard.controller.ts#L841) vs preview [:924-931](../server/src/controllers/reportCard.controller.ts#L924-L931) |
| RC-11 | Medium | **Wrong name risk on PDF, bulk list and verification.** `ReportCard BelongsTo User via student_id` joins `users.id`. For an MIS-keyed card this is the wrong table key, so the PDF can print `Student #id` or another local user's name. `reportCardScores.ts` documents this collision for scores, but the name lookups were never fixed. | [ReportCard.model.ts:148](../server/src/models/ReportCard.model.ts#L148); `generatePdf`, `listReportCardStudents`, `verifyReportCard` *(inferred from the code; confirm with a prod sample)* |
| RC-12 | Medium | **The builder's read-only mode is dead code.** `ReportCardBuilder` accepts `readOnly`, but no caller passes it, so the UI never shows a card as locked. | `grep readOnly=` → only internal |
| RC-13 | Medium | **No notifications.** Teachers aren't told that marks are due or a card was returned. Students and parents aren't told that a card was published. | — |
| RC-14 | Low | Approve and revert errors show a generic toast ("Failed to approve.") and drop the server's message. | SubjectReportCardDashboard |

### 3.2 Grading and content

| # | Sev | Finding |
|---|---|---|
| RC-20 | High | **The grade scale doesn't match the school's.** Task Mentor uses A/B/C/D/F (90/75/60/45). The school's card uses **A\* 90–100, A 80–89, B 70–79, C 60–69, D 50–59, E 40–49, F 30–39, G 20–29, U 0–19**. A student with 85 gets B on Task Mentor and A on the official card. |
| RC-21 | High | **Weights and scale are hard-coded.** They should be configurable per school/tenant and per level, now that Task Mentor is multi-tenant. |
| RC-22 | High | **Missing work is silently skipped.** An unrecorded quiz is left out of the category average (`if (!score) continue`), so a student who skips a hard test is not penalised. A whole missing category (e.g. no EOT yet) leaves the total out of fewer than 100 points with no "incomplete" marker on the card. There is no **absent / exempt / excused** mark. |
| RC-23 | High | **Missing header data.** The card has no class/stream, registration number, photo, date of birth or school logo block. The benchmark shows CLASS and REG. NO. |
| RC-24 | High | **Missing per-subject columns:** class average (CA), subject teacher name, and core/specific module grouping. |
| RC-25 | High | **Missing summary rows:** overall average %, total marks, position in class (and out of how many), and number of subjects passed/failed. |
| RC-26 | High | **Attendance is a single flag.** The UI records one term-level Present/Absent/Late status, saved as 1/0/0 ([GeneralAttributesForm.tsx:707-709](../client/src/components/ReportCard/GeneralAttributesForm.tsx#L707-L709)). The school's card shows **day counts and percentages for Present, Absent, Excused absence, Late and Sick**. The discipline-attendance app already holds those registers, so the card should pull them automatically. |
| RC-27 | Medium | **Only 6 attributes, hard-coded.** The benchmark has 8: Punctuality, Obedience, Responsibility towards work, Responsibility to school/personal property, Devotion/Meditation, Co-operation & Teamwork, Ability to work independently, Commitment to society. The list should be configurable. |
| RC-28 | Medium | **No per-subject teacher remark.** There is only one class-teacher comment, and no head-teacher comment. |
| RC-29 | Medium | **No signatures, no "next term begins" date and no school contact footer.** The benchmark has all three. |
| RC-30 | Medium | **No promotion decision** (Promoted / Repeat / Conditional) on the annual card, and annual weights are fixed at equal per term. |
| RC-31 | Medium | **`missing_terms` only appears if the client sends `academic_year_id`.** Terms are sorted as strings (`"Term 10" < "Term 2"`). |
| RC-32 | Low | The PDF doesn't watermark draft or unapproved previews ("PROVISIONAL"), so a staff download of a draft looks official. |

### 3.3 Performance

| # | Sev | Finding |
|---|---|---|
| RC-40 | Medium | `getAdminSummary` aggregates cards one at a time in a loop (4–6 queries each) and silently caps at **300 cards**, so a whole-school summary is truncated. `getSubjectOverview` fires them all in parallel. Both go away once approved cards read from a snapshot and drafts are computed in batches. |
| RC-41 | Low | `resolveSubjectNames` fetches the whole MIS subject catalogue (`limit 200`) on every card read. |

---

## 4. What the student actually sees today

* `/student/:id` returns the **latest approved** card for the current term, recomputed live (RC-02).
* There is no notification when it appears, and nothing shows when it was issued or by whom.
* The PDF download is allowed only for approved cards, and each download regenerates and overwrites the stored file (RC-03).
* Parents: access exists only through the v2 `VIEW_OWN` scope (children). There is no parent-facing screen in Task Mentor (MIS `/family` is the natural home).

---

## 5. Other reports (analytics)

### 5.1 Inventory

| Report | Route / API | Gate | Filters | What it shows | Export |
|---|---|---|---|---|---|
| **School admin reports** (Insights, Subjects, Students) | `GET /api/dashboard/admin/{insights,subjects,students}` ([dashboard.ts:80-82](../server/src/routes/dashboard.ts#L80-L82)) | `DASHBOARD_VIEW_ADMIN` + subject scope "all"; rank column needs `RANKINGS_VIEW_ALL` | App-bar period. Subjects: search, health, programme, class group, teacher, flags. Students: search, class group, programme, subject, status, attention, **gender** | Per subject: average, pass rate, participation, late rate, missing, at-risk, overdue grading, health. Per student: average, rank, band, weakest subject, reasons. Insights: teachers, class groups, programmes, coverage gaps, report-card readiness | **None**; no charts |
| **Course report** | `/courses/:id/reports` → `GET /courses/:id/grades` | `REPORT_CARDS_VIEW_OWN\|ALL` + `COURSES_VIEW_GRADES` | Period, search, band, assessment, incomplete only | Per assessment: average, highest, lowest, failing. Per class: average, median, pass rate, at-risk, band distribution, outstanding marks. Charts | CSV |
| **Subject assessment report** | `/grades/subjects/:id/report` | `COURSES_VIEW_GRADES` | Same as the course report | Same builder (CSV code duplicated) | CSV |
| **Student "My reports"** | `/reports` → `GET /courses/my-grades` | `REPORT_CARDS_VIEW_OWN` | Period | Per-subject %, pass/fail, overall average, strongest and weakest subject, chart | None |
| **Overall ranking** | `/ranking`, `/users/:id/standing` | `RANKINGS_VIEW_OWN\|ALL` | Subject, kind, class group, grade | Rank within class group | None |
| **Report card admin summary** | `GET /api/report-cards/admin/summary` | `REPORT_CARDS_VIEW_ALL` | Term/year | Status counts, category and subject averages (capped at 300 cards) | None |
| *(dead code)* | `getAdminStats`, `getAdminGradingSummary` | no client calls them | | | |

### 5.2 Reports the school needs but doesn't have

| # | Sev | Missing report | Notes |
|---|---|---|---|
| AN-01 | High | **Gender-based performance.** Average, pass rate, grade distribution and at-risk counts by gender, per subject, class group, programme and school, with the gender gap highlighted. | MIS already sends `UserProfile.gender` on class-group rosters, and `schoolDirectory.ts:231` keeps it. Today it is only a **filter** on the admin students list. The subject roster (`fetchEnrolledStudents`) and the TM `User` model carry no gender. Mostly an aggregation job. |
| AN-02 | High | **Term performance report (class broadsheet).** Students × subjects matrix with totals, average, position, grade counts per subject (A*…U), subject means and highest/lowest. This is what heads of school print after every term. | Should read **report-card snapshots** so the numbers match the published cards. |
| AN-03 | High | **Grade distribution on the school scale.** Counts per A*–U band per subject, class and school. | Today the bands are 80/65/50, a third scale besides the card's (A–F) and the school's (A*–U). |
| AN-04 | High | **Term-over-term and year trends** per student, subject, class and school, with improvement/value-added ("most improved", "dropped > 10 points"). | Nothing exists. Snapshots per term make this cheap. |
| AN-05 | High | **Exports from admin reports.** Excel/CSV and PDF for every admin table and the broadsheet. | Admin reports have no export at all. |
| AN-06 | Medium | **Subject comparison.** Subjects side by side (mean, pass rate, spread) for a class or school, plus a "hardest subjects" view. | Today only a sortable list. |
| AN-07 | Medium | **Teacher/subject-allocation performance.** Results per teacher × class (not per subject), grading timeliness, marks submitted on time per report cycle. | Co-teachers currently get identical numbers ([adminReports.service.ts:549-600](../server/src/services/adminReports.service.ts#L549-L600)). |
| AN-08 | Medium | **At-risk joined to attendance and discipline.** Low marks combined with low attendance or discipline incidents gives an early-warning list for mentors and safeguarding. | No report reads the discipline-attendance data, and competency evidence is pushed to MIS but never read back. |
| AN-09 | Medium | **Report-cycle progress.** Per class: % of subjects submitted, cards per status, overdue teachers. | Becomes the workbench header (§6.6). |
| AN-10 | Low | Age / date of birth, programme and boarding breakdowns. | MIS sends no date of birth to TM today. |

### 5.3 Correctness defects in existing reports

| # | Sev | Finding | Evidence |
|---|---|---|---|
| AN-20 | High | **Three different "average" formulas.** Admin and ranking use the mean of item % per subject, then the mean of subjects. Course and my-grades use the sum of points over the sum of max points. The report card uses category-weighted totals. The same student shows different averages on different screens. | `overallRanking.ts:262-325`, `course.controller.ts:1032-1053, 1386-1396` |
| AN-21 | High | **Subject average leaves out recorded (manual) marks, but class-group and student averages include them**, so the subject table and the class table disagree. | `instructorOverview.service.ts:449-505` |
| AN-22 | High | **`/courses/my-grades` (student view):** no status filter on assignments, quizzes or quiz attempts. Draft and removed work appears, and the *first* attempt is used rather than the best, so an abandoned attempt counts as marked (`total_score \|\| 0`). | `course.controller.ts:1234, 1246, 1277, 1324, 1346` |
| AN-23 | High | **Quiz rules are inconsistent.** The course report includes only `published` quizzes (a "completed" quiz drops out) and only `completed` attempts (it drops `timed_out`). It and `markSources` ignore `grade_status`, so quizzes waiting for manual grading count at their partial score. | `course.controller.ts:740, 798`; `markSources.ts:56` vs `instructorOverview.service.ts:302-303` |
| AN-24 | Medium | **"Missing" and participation span every stream of a subject.** Tasks have no class-group target, so one stream's task counts the other streams' students as missing. | `instructorOverview.service.ts:390, 513-528` |
| AN-25 | Medium | **Work with no term counts in every term** (`academic_term_id: null` is OR-ed into every term filter). | `instructorOverview.controller.ts:226`, `markSources.ts:18`, `course.controller.ts:704` |
| AN-26 | Medium | **Inactive students are counted** in the course and subject reports' averages, pass rate and roster size. Admin reports exclude them. | `course.controller.ts:1100`, `subjectReportApi.ts:287-325` |
| AN-27 | Medium | **The admin rank is school-wide**, which contradicts the class-group rule on `/ranking`. | `adminReports.controller.ts:119`, `adminReports.service.ts:242` |
| AN-28 | Medium | **Empty states show 0% instead of "—"** (average, median, pass rate; the CSV writes 0% for students with no marks). | `subjectReportApi.ts:291-308` |
| AN-29 | Medium | *(inferred)* `getCourseGrades` has no "teaches this subject" check. Any `COURSES_VIEW_GRADES` holder can read any course id. | `course.controller.ts:911-960` |
| AN-30 | Low | **CSV:** no formula-injection escaping (`=`, `+`, `-`, `@`) and no UTF-8 BOM (accented names break in Excel). | CourseReportsPage / SubjectAssessmentReportPage |

### 5.4 Performance

* **Admin bundle:** two full school-wide scans per rebuild (`computeOverview`, then `loadMarkSources`), and `computeOverview` runs *before* the 60 s cache check ([adminReports.controller.ts:71-79](../server/src/controllers/adminReports.controller.ts#L71-L79)).
* **`getCourseGrades`:** `find`/`filter` inside student × assessment loops makes it O(students × assessments × submissions). Index submissions by key first.
* **GradesPage:** two client calls per subject (an MIS roster call plus the mapping), so about 2N calls for an admin.

### 5.5 Recommendations

1. **One metrics layer.** Put a single `metrics` service (one average definition, one set of quiz/assignment eligibility rules, one active-students rule, one term rule, the tenant's grading scheme) behind every report, then delete the per-screen formulas (AN-20…AN-26).
2. **Published numbers come from snapshots.** Term reports, the broadsheet, gender and trend reports read `report_card_snapshots` (§6). Live dashboards keep reading live data and are labelled "provisional".
3. **Carry demographics on the roster.** Keep `gender` (and later date of birth, programme, boarding) on the directory entries used by every report, and add a **Group by** control (gender / class group / programme) to the admin Subjects, Students and Insights views and to the broadsheet.
4. **Build a Reports hub** (`/reports/school`) with tabs: Broadsheet · Performance (distribution, pass rates, subject comparison) · Gender · Trends · At-risk · Report-cycle progress. Every tab exports to Excel, CSV and PDF.

---

## 6. Target workflow: Draft → Reviewed → Approved → Published

### 6.1 Principles

1. **One rule for locks, on the server.** A card can be edited only while it is **Draft**. Every write path (mapping fan-out, attributes and comment, manual marks, attendance import) calls one guard, `assertCardEditable(cardIds)`. The UI then mirrors the guard (lock icon, read-only builder, disabled inputs).
2. **Approval freezes the card.** On approval the server computes the card once and stores a **snapshot**: all numbers, names, teacher names, class averages, position, attendance and attributes, plus the PDF and its SHA-256 hash. Every read of an Approved or Published card serves the snapshot. Nothing is recomputed.
3. **The only way back is to Draft.** Reopening needs a reason. It keeps the old snapshot as a superseded version and bumps `version`. Re-approval creates a new version, and QR verification names the version.
4. **Manage by class, not by student.** The unit of work is a *class × term* "report cycle". Actions apply in bulk to selected or all students, and blockers are listed rather than discovered one by one.
5. **Subjects sign off; the card is reviewed.** Each subject teacher **submits** their subject for the class. The card moves to Reviewed only after all its subjects are submitted and the class teacher's part is done.

### 6.2 State machine

```
                 submit subjects + class-teacher part complete
   ┌─────────┐   ── REVIEW (class teacher / DoS) ──▶   ┌──────────┐
   │  DRAFT  │                                          │ REVIEWED │
   │ editable│ ◀── RETURN (reason) ──────────────────── │  locked  │
   └─────────┘                                          └──────────┘
        ▲                                                     │ APPROVE (head / DoS)
        │ REOPEN (reason, new version)                         ▼   → snapshot + PDF + hash
        │                                               ┌──────────┐
        ├────────────────────────────────────────────── │ APPROVED │  frozen, not visible
        │                                               └──────────┘  to students
        │                                                     │ PUBLISH (now or scheduled)
        │                                                     ▼   → notify student/parent
        │                                               ┌──────────┐
        └────────────────────────────────────────────── │PUBLISHED │  student + parent view,
                         REOPEN (reason)                └──────────┘  QR verifies this version
                                                              │ UNPUBLISH (reason) → APPROVED
```

| Transition | Who (capability) | Preconditions | Side effects |
|---|---|---|---|
| Draft → Reviewed (**review**) | `REPORT_CARDS_REVIEW` (new) over the class group: class teacher or DoS | Every enrolled subject is **submitted** by its teacher. Comment present. Attendance imported. All attributes rated. No duplicate card. | Locks the card. Records `reviewed_by/at`. Notifies approvers. |
| Reviewed → Draft (**return**) | `REVIEW` or `APPROVE` | Reason required. Optionally names the subject(s) at fault. | Unlocks. Re-opens the named subjects' sign-off. Notifies those teachers with the reason. |
| Reviewed → Approved (**approve**) | `REPORT_CARDS_APPROVE` (head / DoS) | Card is Reviewed. Optionally four-eyes: approver ≠ reviewer. | **Snapshot + PDF + hash**, `version` + 1, `approved_by/at`. |
| Approved → Published (**publish**) | `REPORT_CARDS_PUBLISH` | Card is Approved. Optional `publish_at` for a scheduled release of a whole class. | `published_by/at`. Student and parent see the snapshot. Notification via Reminder Hub/Tupo. |
| Published → Approved (**unpublish**) | `PUBLISH` | Reason required | Hidden from student. Snapshot unchanged. |
| Approved/Published → Draft (**reopen**) | `APPROVE` | Reason required | Snapshot marked *superseded* (kept). QR for the old version reports "superseded by v2". The card becomes editable. |

Subject sign-off, per subject × class × term:

| State | Who | Meaning |
|---|---|---|
| `open` | subject teacher | Mapping and marks editable |
| `submitted` | subject teacher (`REPORT_CARDS_EDIT` over subject × class) | "My marks for this class are final." Lists students with missing marks first and needs an *absent/exempt* choice for each. |
| (reopened) | reviewer via **return** | Back to `open` with a reason |

### 6.3 What "locked" means for each data source

| Change after lock | Behaviour |
|---|---|
| Mapping save on a subject | Fan-out **skips** locked cards and reports "applied to 28, skipped 12 locked (Reviewed/Approved)" |
| Manual mark edit, quiz regrade, assignment grade change | Allowed (Task Mentor's own grade books stay live). Approved and published cards **don't change** because they read the snapshot. The workbench flags "*3 marks changed since approval*" with a diff, and the approver decides whether to reopen. |
| Attributes, comment, attendance | Rejected with 409 `CARD_LOCKED` unless the card is Draft |

### 6.4 Data model changes

```sql
-- report_cards
ALTER TABLE report_cards
  MODIFY status ENUM('draft','reviewed','approved','published') NOT NULL DEFAULT 'draft',
  ADD version INT NOT NULL DEFAULT 0,
  ADD class_group_id INT NULL, ADD term_id INT NULL, ADD academic_year_id INT NULL,
  ADD reviewed_by INT NULL, ADD reviewed_at DATETIME NULL,
  ADD approved_by INT NULL, ADD approved_at DATETIME NULL,
  ADD published_by INT NULL, ADD published_at DATETIME NULL, ADD publish_at DATETIME NULL,
  ADD head_teacher_comment TEXT NULL,
  ADD UNIQUE KEY uq_report_card (student_id, term, academic_year);   -- after de-duplication

CREATE TABLE report_card_snapshots (            -- one per approval
  id, report_card_id, version, payload JSON,    -- the full rendered card
  pdf_path, pdf_sha256, approved_by, approved_at,
  superseded_at NULL, superseded_reason NULL
);

CREATE TABLE report_card_transitions (          -- audit trail
  id, report_card_id, from_status, to_status, actor_id, reason NULL, created_at
);

CREATE TABLE report_cycles (                    -- class × term management unit
  id, class_group_id, term_id, academic_year_id,
  marks_due_at, review_due_at, publish_at, next_term_begins_on,
  grading_scheme_id
);

CREATE TABLE report_cycle_subject_signoffs (
  cycle_id, subject_id, status ENUM('open','submitted'), submitted_by, submitted_at,
  returned_reason NULL
);

CREATE TABLE grading_schemes (                  -- per tenant/level, replaces hard-coding
  id, name, category_weights JSON,              -- {"CW":15,"HW":10,"MD":25,"EOT":50}
  bands JSON,                                   -- [{"min":90,"letter":"A*"}, …, {"min":0,"letter":"U"}]
  pass_mark, attributes JSON,                   -- the 8 behaviour attributes
  attendance_statuses JSON
);
```

Plus `ManualAssessmentScore.status ENUM('scored','absent','exempt')` for RC-22.

**Migrating existing data:** `saved` → `draft`, with the subject sign-off set to submitted for subjects that have marks. `approved` → `published` (that is what it means today), with a snapshot generated by the migration script so published cards freeze from that moment. Before adding the unique key, de-duplicate and re-key legacy local-id cards to the MIS id (RC-09/10).

### 6.5 API

```
GET   /api/report-cycles?term_id&year_id                → my cycles (by scope) + counts per status
GET   /api/report-cycles/:id/workbench                  → students × subjects matrix, blockers, status
POST  /api/report-cycles/:id/subjects/:subjectId/submit | /reopen
POST  /api/report-cards/transition   { card_ids[], action: review|return|approve|publish|unpublish|reopen,
                                       reason?, publish_at? }      → per-card result (ok / blocked: why)
GET   /api/report-cards/:id/history                      → transitions + versions
GET   /api/report-cards/:id/diff                         → live vs snapshot ("changed since approval")
GET   /api/public/verify/report-card/:uuid?v=2           → snapshot of that version + superseded flag
```

The existing `PATCH /:id/status` is kept as a thin wrapper for one release, then removed.

### 6.6 UX: making it easy to manage

**Report Card Workbench** (one page per class × term, reached from Course → Report cards and from the admin Reports menu):

* **Header:** cycle deadlines, a progress bar (Draft / Reviewed / Approved / Published) and a **Blockers** panel ("Math: 4 students missing EOT · Kinyarwanda not submitted · 2 comments empty"). Clicking a blocker jumps to the fix.
* **Matrix:** students × subjects, each cell showing the subject total with a ✓ submitted or ⚠ missing-marks dot. Further columns for comment, attendance, attributes and card status.
* **Bulk bar:** select all or filter by status, then *Review selected / Return with reason / Approve / Publish now / Schedule publish*. Actions that don't apply are disabled with a tooltip explaining why. The server answers per card, so partial success is shown clearly: "35 approved, 5 blocked — see why".
* **Subject teacher view:** "My subjects × my classes" with one **Submit marks** button per class, which first lists missing marks with absent/exempt choices.
* **Locked cards** show a lock badge, a read-only builder, and a **Reopen to draft** button for approvers only (reason dialog).
* **Card drawer:** preview (provisional watermark while Draft or Reviewed), **History** tab (who did what and why), **Changed since approval** tab.
* **Student/parent:** a "New report card published" notification. The card page shows the snapshot with version and issue date, plus a PDF download of the stored, hashed file.

Notifications (Reminder Hub source, already integrated): marks-due reminders to subject teachers, "card returned" to the named teacher, "ready for approval" to approvers, "published" to students and parents.

### 6.7 Permissions

| Capability | Default holder | Status |
|---|---|---|
| `REPORT_CARDS_EDIT` | subject teacher (subject × class) | exists |
| `REPORT_CARDS_COMMENT` | class teacher (class group) | exists |
| `REPORT_CARDS_REVIEW` | class teacher / Director of Studies | **new** |
| `REPORT_CARDS_APPROVE` | head teacher / DoS | exists (today admin only) |
| `REPORT_CARDS_PUBLISH` | head teacher / admin | exists, **wire it up** |
| `REPORT_CARDS_REOPEN` | head teacher | optional split from APPROVE |

---

## 7. Benchmark parity checklist (vs `Term 2 Performance_All.pdf`)

| Element | School card | Task Mentor today |
|---|---|---|
| Name, Class, Reg. No., Year/Term | ✓ | Name, term, year only |
| Core / Specific module groups | ✓ | ✗ |
| CW/15 HW/10 MD/25 EOT/50 TOT/100 | ✓ | ✓ |
| Grade A*–U (9 bands) | ✓ | A–F (5 bands, different cut-offs) |
| Class average per subject | ✓ | ✗ (computed in the dashboard only, not on the card) |
| Subject teacher | ✓ | ✗ |
| Overall average % | ✓ | ✗ |
| Attendance counts + % (Present / Absent / Excused / Late / Sick) | ✓ | one flag (P/A/L) |
| 8 general attributes | ✓ | 6 |
| Class teacher comment | ✓ | ✓ (+ AI draft) |
| Signatures (Principal, Class Teacher) | ✓ | ✗ |
| Grading-scale legend & abbreviations | ✓ | partial |
| Next term begins | ✓ | ✗ |
| QR verification | ✗ | ✓ (needs snapshot, RC-03) |
| Position in class | ✗ | ✗ (common request, recommended as optional) |

---

## 8. Phased plan

| Phase | Content | Size |
|---|---|---|
| **P0 — Stop the bleeding** | `assertCardEditable` guard on every write path (RC-01). Fan-out skips locked cards. Unique key + de-dupe + re-key legacy ids (RC-09/10/11). Fix the student-name lookup through the MIS id. Watermark non-approved PDFs. | S |
| **P1 — Workflow** | New status enum + migration. Transitions table. `POST /transition` (bulk). Subject sign-off. Snapshot + stored PDF + hash on approve. Snapshot-based reads and verification. Reopen with reason and versioning. `REVIEW`/`PUBLISH` wired. Notifications. | L |
| **P2 — Workbench UI** | Class × term workbench, blockers, bulk bar, history and diff drawers, read-only builder, subject-teacher submit flow. | M–L |
| **P3 — Card content parity** | Grading schemes per tenant (A*–U, weights, attributes). Header data from MIS (class, reg. no.). Class average, teacher, module groups, overall average, optional position. Attendance auto-import from discipline-attendance. Absent/exempt marks. Signatures and next-term date from the cycle. Head-teacher comment. | M |
| **P4 — Analytics** | See §5 recommendations (gender, distributions, trends, at-risk, exports), built on snapshot data so published numbers are stable. | M–L |

**Tests to add with P0/P1:** a write on a locked card returns 409 for each endpoint; a regrade after approval leaves snapshot reads unchanged; reopen creates v2 and old-version QR reports superseded; bulk transition gives partial results; concurrent fan-out creates no duplicates; a student never receives a Reviewed or Approved card.

---

## 9. Implementation status (19 Nov 2026, branch `feat/report-card-workflow`)

All five phases are implemented. Tendo has a companion branch, `feat/report-card-attendance`.

| Phase | What shipped | Where |
|---|---|---|
| P0 | Edit lock on every write path (`rejectLocked`, 409 `CARD_LOCKED`). The fan-out skips locked cards and keeps absent/exempt resolutions. Unique key, de-duplication and re-keying to MIS ids (migration). FK to `users.id` dropped. Names resolved through the MIS id. PROVISIONAL watermark on unissued PDFs. Legacy "own" read limited to the caller's own card. | `migrations/20261119100000-report-card-workflow.js`, `utils/reportCardAccess.ts`, `controllers/reportCard.controller.ts` |
| P1 | Status enum draft/reviewed/approved/published. Bulk `POST /api/report-cards/transition`. Subject sign-off. Snapshot + stored PDF + SHA-256 on approve. Reads, PDF and QR serve the snapshot. Reopen supersedes (versions, `?v=` on verification). `REPORT_CARDS_REVIEW` added and `PUBLISH` wired. Scheduled release (`publish_at` + 1-minute sweep). Bell and MIS Home alerts. | `services/reportCardWorkflow.ts`, `reportCardDocument.ts`, `reportCardSnapshot.service.ts`, `reportCardPublishSweep.ts`, `reportCardAlerts.ts`, `controllers/reportCardWorkflow.controller.ts`, `routes/reportCycles.ts` |
| P2 | `/report-cards` (classes and progress, dates), `/report-cards/:classGroupId` workbench (blockers, sign-off, matrix, bulk bar, reasons, schedule, per-card results, history/diff drawer), `/report-cards/:id/comments` (class-teacher part), Submit-marks dialog | `client/src/pages/ReportCards*.tsx`, `ClassCommentsPage.tsx`, `components/ReportCard/SubmitMarksDialog.tsx` |
| P3 | Per-school scheme (weights, pass mark, 8 attributes, subject groups, display switches, head title, four-eyes). NGA A*–U scale is the primary-tenant default. Card shows class, reg. no., groups, CA, teacher, average/position, attendance days and % (imported from Tendo), comments, scale, signatures, next term. Absent/exempt marks. | `services/tenantSettings.ts`, `reportCardDocumentPdf.ts`, `ReportCardDocumentView.tsx`, `pages/ReportCardSettingsPage.tsx`, Tendo `GET /api/integration/attendance/class/:id/term` |
| P4 | `GET /api/reports/school` + `/reports/school` hub: broadsheet, performance (distribution, subject/class comparison), gender (gaps by subject/class), trends (term-over-term, improvement), at-risk. CSV (Excel-safe) and print/PDF on every tab. Fixes AN-22/23/26/28/30 and exempt marks excluded from rankings. | `services/reportAnalytics.service.ts`, `controllers/reportAnalytics.controller.ts`, `client/src/pages/SchoolReportsPage.tsx`, `utils/csvExport.ts` |

**Deploy notes**
- Run the migration in every tenant DB. Prod `npm run migrate` can't run there, so apply it as on earlier releases.
- Set `ATTENDANCE_APP_URL` (the Tendo base URL) in TM's env.
- Grant `REPORT_CARDS_REVIEW` to class-teacher / DoS roles. Only admin gets it by default.
- Republish the access manifest (`npm run access:publish`).
- Existing `approved` cards become `published` and freeze on first read (`backfilled` snapshot). `saved` cards become `draft`.

**Not done / follow-ups:** Excel .xlsx export (CSV only). AN-20 (one average formula across every screen) and AN-24/25/27/29 are still open. Parent-facing screen (MIS `/family`).
