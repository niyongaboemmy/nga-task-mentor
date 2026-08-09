# Report Card Module — End-User Setup Guide

**Platform:** NGA Task Mentor (School MIS)
**Audience:** Instructors, Class Teachers, School Administrators

---

## Overview

The Report Card module lets instructors map assessments to grading categories, class teachers record attendance and behavior ratings, and students download their official A4 report card as a PDF.

The full workflow has three steps:

| Step | Who | What |
|------|-----|-------|
| 1. Build the report card | Instructor | Drag quizzes/assignments into grading categories |
| 2. Add general attributes | Class Teacher | Record attendance, behavior ratings, and comments |
| 3. View & download | Student / Admin | Preview the A4 document and export as PDF |

---

## Prerequisites

- You must be logged in via NGA Central MIS (SSO).
- The course must already exist with enrolled students.
- Quizzes and/or assignments must be created inside the course before building a report card.

---

## Step 1 — Build the Report Card (Instructor)

**Route:** `/courses/:courseId/report-card-builder?studentId=&term=&year=`

### Grade categories and weights

| Category | Code | Weight |
|----------|------|--------|
| Continuous Work | CW | 15% |
| Homework | HW | 10% |
| Mid-term | MD | 25% |
| End of Term | EOT | 50% |

Total always sums to **100%**.

### Grade scale

| Score | Letter | Remark |
|-------|--------|--------|
| 90 – 100 | A | Distinction |
| 75 – 89 | B | Merit |
| 60 – 74 | C | Credit |
| 45 – 59 | D | Pass |
| 0 – 44 | F | Fail |

### How to build

1. Open the course and choose a student from the dropdown.
2. Select a **subject** from the subject selector at the top of the builder.
3. The left panel shows all available quizzes and assignments for that subject.
4. **Drag** each item from the left panel and **drop** it into the correct category column (CW, HW, MD, or EOT).
   - A card can only appear in one category at a time.
   - To move it, drag it to a different column.
   - To remove it, click the **×** on the dropped card.
5. Repeat for each subject.
6. Click **Save** (floppy-disk icon). A success toast confirms the mapping was saved.
7. Repeat the entire process for each student in the course, or use the Bulk Export panel after all students are done (see Step 3).

> **Tip:** You do not need to fill every category. Leave a column empty if no assessment applies for that term.

---

## Step 2 — Add General Attributes (Class Teacher)

**Route:** `/courses/:courseId/report-card-attributes?term=&year=`

This step records each student's behavior and attendance for the term.

### Attributes rated

- Punctuality
- Obedience
- Neatness
- Participation
- Cooperation
- Responsibility

### Ratings available

| Rating | Meaning |
|--------|---------|
| Excellent | Consistently exceeds expectations |
| Very good | Frequently meets expectations |
| Good | Generally meets expectations |

### How to fill in general attributes

1. Navigate to the course's **Report Card Attributes** page.
2. The page shows one row per enrolled student.
3. For each student:
   a. **Attendance** — click the pill that matches the student's usual status for the term: **Present**, **Absent**, or **Late**.
   b. **Attributes** — select a rating (Excellent / Very good / Good) for each of the six attributes using the radio buttons in the table.
   c. **Comment** — type an optional class teacher comment in the text area at the bottom of the row (e.g., "Shows great improvement in mathematics").
4. Click **Save** on the student's row. The row turns green with a checkmark on success.
5. Once all rows are filled, click **Save All** to submit any unsaved rows in one action.

> **Note:** At least one attribute must be rated before the Save button becomes active for a student.

---

## Step 3 — View and Download (Student)

Students can view and download their own report card from the **Student Dashboard**.

1. Log in as a student.
2. On the dashboard, scroll to the **My Report Cards** section.
3. Click **View** to open the A4 preview in a full-screen overlay.
4. To save as PDF:
   - Click **Download PDF** in the preview toolbar — the server generates a clean PDF and downloads it automatically.
   - Alternatively, click **Print** in the toolbar to use the browser's native print dialog (set paper size to A4, margins to None).
5. Click **Close** or press **Esc** to exit the preview.

### What appears on the report card

- School header (NGA logo, school name, address)
- Student information (name, class, term, academic year)
- Subject grades table — scaled scores per category and a total out of 100
- Letter grade and remark for each subject
- General attributes table (all six behavior ratings)
- Attendance summary (present / absent / late days)
- Class teacher comment
- Grade key legend
- Teacher and principal signature lines
- QR code for official verification

---

## Step 4 — Report Cards Center (Admin)

Administrators can preview analytics and generate PDFs by class, or across an entire term/year.

1. Log in as an admin.
2. Open the **Admin Dashboard**.
3. Scroll to the **Report Cards Center** panel.
4. Choose a mode:
   - **By Class** — select a course; the enrolled student list loads automatically.
   - **By Term / Year** — pick an academic year and term. This loads every student across every class who has a report card for that period, plus a summary: total report cards, status counts (draft/saved/approved), overall average, per-category (CW/HW/MD/EOT) averages, and per-subject averages.
5. Click **Preview** next to any student to open their report card in the same preview used elsewhere in the app, without leaving the page.
6. Click **Export All** (or **Download All PDFs**) to generate PDFs for every listed student sequentially (one every ~600 ms).
7. A progress bar shows overall completion. Each row shows its status:
   - **Pending** — queued
   - **Done** — PDF saved successfully
   - **Error** — generation failed
8. If any rows show **Error**, click **Retry N failed** to re-attempt only those students.

> **Class-group filtering:** there is currently no "download by class group" filter, since the MIS does not expose a bulk "students in class group X" endpoint. Use **By Class** (course/subject) as the closest equivalent, or **By Term / Year** and cross-reference the roster manually.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| Save button is greyed out (builder) | No items dropped in any category | Drag at least one assessment into a category |
| Save button is greyed out (attributes) | No attribute rated yet | Select a rating for at least one attribute |
| "Student has no report card for this term" | Step 1 was not completed | The instructor must build the report card first |
| PDF download shows a blank page | `uuid` column missing from database | Run the composite migration: `20260607-report-card-composite.sql` |
| Bulk export row stuck at Pending | Server timeout or network error | Click Retry on the failed row |
| QR code does not resolve | `verificationBaseUrl` not configured | Contact the system administrator to set the base URL in the environment config |

---

## Database Setup (System Administrator)

If you are setting up a new environment (e.g., cPanel shared hosting), run **all three** migrations below, in order, before any user accesses the module. Running only the first one leaves the module's "Manual Assessments" feature broken — inserts with `assessment_type = 'manual'` will fail against the database's `ENUM` even though the application code allows it.

```sql
-- 1. server/migrations/20260607-report-card-composite.sql
--    Creates report_cards, report_card_attributes, report_card_assessments.
--    Compatible with MySQL 5.7+ / MariaDB 10.3+; safe to re-run (IF NOT EXISTS guards).

-- 2. server/src/migrations/add_manual_assessments.sql
--    Extends report_card_assessments.assessment_type to include 'manual', and
--    creates manual_assessments / manual_assessment_scores.

-- 3. server/migrations/20260608000000-add-grade-columns-to-manual-assessments.js
--    Adds assessment_type, assessment_date, add_to_final_grade to manual_assessments.
--    Run via `npx sequelize-cli db:migrate` (or apply its SQL manually if running
--    outside Sequelize CLI — see the file for the exact ALTER TABLE statements).
```

1. Log in to cPanel → **phpMyAdmin**.
2. Select your application database.
3. Click **Import**, choose `server/migrations/20260607-report-card-composite.sql`, and click **Go**.
4. Repeat **Import** for `server/src/migrations/add_manual_assessments.sql`.
5. Apply `server/migrations/20260608000000-add-grade-columns-to-manual-assessments.js` — run `npx sequelize-cli db:migrate` from `server/` if you have shell access, or translate its `queryInterface.addColumn` calls into `ALTER TABLE manual_assessments ADD COLUMN ...` statements and run those via phpMyAdmin if you don't.
6. Confirm the following tables exist: `report_cards`, `report_card_attributes`, `report_card_assessments`, `manual_assessments`, `manual_assessment_scores`.
7. Confirm `report_card_assessments.assessment_type` accepts `'manual'` (check the column definition — it should be `ENUM('quiz','assignment','manual')`).
8. Confirm `SequelizeMeta` contains all relevant migration entries:
   - `20260607000000-create-report-card-tables.js`
   - `20260607120000-add-uuid-pdf-to-report-cards.js`
   - `20260608000000-add-grade-columns-to-manual-assessments.js`

---

## Quick Reference — URL Patterns

| Page | URL | Roles |
|------|-----|-------|
| Report Card Builder | `/courses/:courseId/report-card-builder?studentId=&term=&year=` | Instructor, Admin |
| General Attributes | `/courses/:courseId/report-card-attributes?term=&year=` | Instructor, Admin |
| Student Dashboard | `/dashboard` | Student |
| Admin Dashboard | `/dashboard` (admin role) | Admin |
