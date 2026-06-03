# Academic Year & Term Scoping — Status Report
**Project:** NGA Task Mentor  
**Date:** 2026-06-03  
**Author:** Senior Backend Developer Review  
**Scope:** All features that must be isolated per academic year and term sourced from NGA Central MIS

---

## 1. Executive Summary

The application partially implements academic year/term scoping. Foundational data — courses, student enrolment, and scheme of work — is properly fetched from MIS using the active term. However, several core educational features (Quizzes, Assignments, Proctoring, Reports) have **no database-level, API-level, or client-level term enforcement**, creating a high risk of cross-term data leakage as the system moves into multi-term operation.

---

## 2. How Academic Year & Term Flow from MIS

### Source of Truth
MIS returns `currentAcademicYear` and `currentAcademicTerms[]` on every successful authentication. The active term is identified by `is_current === 1` or `status === "ACTIVE"`.

### Flow
```
MIS /auth/verify-otp  (or /sso/token → MIS /users/me)
    ↓ currentAcademicYear, currentAcademicTerms[]
server/src/controllers/auth.controller.ts
    ↓ extracts activeTermId
    ↓ encodes into local JWT (termId claim)
server/src/utils/misUtils.ts → getCurrentTermId(req)
    ↓ reads termId from JWT, falls back to MIS /users/me, then hardcoded id=4
client/src/contexts/AuthContext.tsx
    ↓ stores user.currentAcademicYear + user.currentAcademicTerm
Components  →  useAuth().user.currentAcademicTerm.academic_term_id
```

### Known Fallback Risk
`getCurrentTermId()` falls back to `termId = 4` when all resolution paths fail. This hardcoded fallback is dangerous in production if MIS is temporarily unreachable — all data writes would silently attach to term 4.

---

## 3. Feature-by-Feature Status

### 3.1 Courses ✅ COMPLIANT
| Layer | Status | Detail |
|-------|--------|--------|
| Database | ✅ | Managed entirely by MIS; no local table |
| Backend | ✅ | `course.controller.ts` calls `getCurrentTermId(req)` before every MIS fetch |
| Frontend | ✅ | `Students.tsx` passes `user.currentAcademicTerm.academic_term_id` as `termId` param |

Instructors see only subjects assigned to them in the current term. Students see only enrolled subjects for the current term. **No action required.**

---

### 3.2 Student Enrolment ✅ COMPLIANT
| Layer | Status | Detail |
|-------|--------|--------|
| Database | ✅ | Managed by MIS |
| Backend | ✅ | `GET /academics/students/:id/enrolled-subjects` called with `termId` |
| Frontend | ✅ | Term injected from `AuthContext` |

**No action required.**

---

### 3.3 Scheme of Work ✅ COMPLIANT
| Layer | Status | Detail |
|-------|--------|--------|
| Database | ✅ | MIS-owned, scoped by `academic_term_id` |
| Backend | ✅ | `GET /scheme-of-work/entries` requires `academic_term_id` query param |
| Frontend | ✅ | `QuestionBankModal.tsx` and `QuestionBankList.tsx` pass `academic_term_id` |

**No action required.**

---

### 3.4 Quizzes ⚠️ PARTIALLY COMPLIANT — HIGH RISK
| Layer | Status | Detail |
|-------|--------|--------|
| Database | ❌ | `Quiz` model has **no** `academic_term_id` column |
| Backend | ❌ | `quiz.controller.ts` — `getQuizzes()`, `createQuiz()`, `getAvailableQuizzes()` ignore term entirely |
| Frontend | ❌ | Quiz list pages do not filter by or display term |

**Impact:** A quiz created in Term 1 is visible and accessible in Term 2. Students can attempt quizzes from previous terms. If the same course is taught across multiple terms, quiz results mix.

**Required fixes:**
1. Add `academic_term_id INTEGER NOT NULL` column to `Quiz` model + migration.
2. Populate on `createQuiz()` using `getCurrentTermId(req)`.
3. Filter on `getQuizzes()` and `getAvailableQuizzes()` with a `WHERE academic_term_id = ?` clause.
4. Client must include current term in quiz list fetch calls.

---

### 3.5 Assignments ❌ NON-COMPLIANT — CRITICAL RISK
| Layer | Status | Detail |
|-------|--------|--------|
| Database | ❌ | `Assignment` model has **no** `academic_term_id` column |
| Backend | ❌ | `getCourseAssignments()` returns all assignments for a course, no term filter |
| Frontend | ❌ | No term-based filtering in assignment list components |

**Impact:** Assignments from every past term surface in the current term view. Submissions and grades from multiple terms are mixed. Students may be shown — or could attempt — stale assignments.

**Required fixes:**
1. Add `academic_term_id INTEGER NOT NULL` column to `Assignment` model + migration.
2. Populate on `createAssignment()` using `getCurrentTermId(req)`.
3. Add `WHERE academic_term_id = ?` filter to `getCourseAssignments()`.
4. Client passes current term when fetching assignment lists.

---

### 3.6 Question Bank ⚠️ PARTIAL — MEDIUM RISK
| Layer | Status | Detail |
|-------|--------|--------|
| Database | ❌ | `QuestionBank` model has **no** `academic_term_id` column |
| Backend | ✅ (indirect) | Filtered via `scheme_of_work_entry_id`; SOW entries are term-scoped |
| Frontend | ✅ (indirect) | Components pass `academic_term_id` when fetching SOW entries |

**Impact:** Questions that are **not linked to a SOW entry** are returned with no term context and visible across all terms. AI-generated questions saved directly to the bank without a SOW link are also unscoped.

**Required fixes:**
1. Add optional `academic_term_id` column to `QuestionBank` table (nullable for legacy rows).
2. Populate on creation when a SOW entry is available.
3. Apply `WHERE academic_term_id = ?` as a secondary filter in `getQuestions()`.

---

### 3.7 Proctoring ❌ NON-COMPLIANT — HIGH RISK
| Layer | Status | Detail |
|-------|--------|--------|
| Database | ❌ | `ProctoringSession` and `ProctoringEvent` models have **no** `academic_term_id` |
| Backend | ❌ | Sessions are only scoped to a quiz ID; inherit no term from the quiz |
| Frontend | ❌ | Proctoring dashboard shows all sessions regardless of term |

**Impact:** Since quizzes are also unscoped (see 3.4), proctoring sessions compound the problem. Historical proctoring data from previous terms remains active in the dashboard.

**Required fixes:**
1. Add `academic_term_id` to `ProctoringSession` model + migration.
2. Populate when session is created, sourced from the associated quiz's term (once Quiz is fixed) or via `getCurrentTermId(req)`.
3. Filter session queries by term.

---

### 3.8 Reports & Analytics ❌ NON-COMPLIANT — MEDIUM RISK
| Layer | Status | Detail |
|-------|--------|--------|
| Database | ❌ | Aggregations run on raw submission/result tables with no term filter |
| Backend | ❌ | No `academic_term_id` query param accepted in report endpoints |
| Frontend | ❌ | `CourseReportsPage.tsx` and `StudentReportsPage.tsx` fetch course-wide data |

**Impact:** Grade averages, completion rates, and leaderboards aggregate data across all terms. A student who took a quiz in Term 1 and Term 2 will have both results counted in a single term report.

**Required fixes:**
1. Accept `academic_term_id` query param on all report endpoints.
2. Pass it as a WHERE clause to aggregation queries once Quiz/Assignment have their columns.
3. Client should pass the active term when loading report pages.

---

## 4. Database Migration Checklist

| Table | Column to Add | Type | Nullable | Source |
|-------|--------------|------|----------|--------|
| `Quizzes` | `academic_term_id` | INTEGER | NOT NULL | `getCurrentTermId(req)` at creation |
| `Assignments` | `academic_term_id` | INTEGER | NOT NULL | `getCurrentTermId(req)` at creation |
| `QuestionBank` | `academic_term_id` | INTEGER | NULLABLE | SOW entry or `getCurrentTermId(req)` |
| `ProctoringSession` | `academic_term_id` | INTEGER | NOT NULL | Inherited from quiz or JWT |

All migrations must include a **backfill strategy** for existing rows (e.g., set to term 4 as the known active term, or NULL for historical data, with a migration note).

---

## 5. Backend Middleware Gap

No middleware currently enforces term context globally. Each controller decides independently whether to use term data. This inconsistency is the root cause of all gaps above.

**Recommended:** Add a `resolveAcademicTerm` middleware that:
1. Calls `getCurrentTermId(req)` once per request.
2. Attaches `req.academicTermId` to the request object.
3. Applied to all data-mutation and data-read routes as a standard concern.

This eliminates per-controller duplication and ensures no endpoint is accidentally left unscoped.

---

## 6. Hardcoded Fallback — Immediate Action Required

**File:** `server/src/utils/misUtils.ts`  
**Issue:** Final fallback resolves term to hardcoded `id = 4` when MIS is unreachable.

```typescript
// Current (dangerous)
return 4; // fallback

// Should be
throw new AppError('Unable to resolve academic term from MIS', 503);
// or return null and let callers decide whether to abort or proceed
```

Silently attaching data to term 4 during a MIS outage corrupts term integrity without any visible error.

---

## 7. Priority Matrix

| Priority | Item | Effort | Risk if Deferred |
|----------|------|--------|-----------------|
| 🔴 CRITICAL | Assignment — add `academic_term_id` + DB migration | Medium | Cross-term assignment leakage grows every term |
| 🔴 CRITICAL | Quiz — add `academic_term_id` + DB migration | Medium | Cross-term quiz access; grade data mixing |
| 🔴 CRITICAL | Remove hardcoded fallback `return 4` in misUtils | Low | Silent data corruption during MIS outages |
| 🟠 HIGH | Proctoring — add `academic_term_id` | Medium | Exam integrity reports span multiple terms |
| 🟠 HIGH | Add `resolveAcademicTerm` middleware | Low | Continued inconsistent enforcement |
| 🟡 MEDIUM | Reports — add term filter param | Medium | Analytics are misleading |
| 🟡 MEDIUM | QuestionBank — add nullable `academic_term_id` | Low | Unlinked questions remain unscoped |

---

## 8. What Is Working Well

- MIS integration for authentication correctly extracts and persists the active term.
- `getCurrentTermId()` utility centralises resolution logic and handles multiple fallback paths.
- Scheme of Work, Courses, and Student Enrolment are fully term-scoped because they delegate entirely to MIS — no local state to drift.
- The frontend `AuthContext` makes the active term available application-wide; components that need it can access it consistently.

---

## 9. Conclusion

The application has a solid foundation for academic year/term awareness at the authentication and MIS-integration layer. The gap is at the **local data layer**: models, controllers, and client pages for Quizzes, Assignments, Proctoring, and Reports were built without term columns or term filters. As the platform enters its second (or third) academic term, these gaps will produce visible data mixing that undermines academic integrity.

The fixes are well-defined and incremental — each feature can be patched independently with a database migration, a controller update, and a client-side query param addition. The highest leverage change is adding the `resolveAcademicTerm` middleware so future features automatically inherit correct scoping.
