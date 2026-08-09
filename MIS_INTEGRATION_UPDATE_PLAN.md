# NGA Task Mentor — Central MIS Integration Update Plan

**Date:** 2026-08-09
**Author:** Senior Backend Developer Review
**Scope:** Everything `nga-task-mentor` consumes from `nga_central_mis`, checked against the MIS's current source code (not just its docs), with concrete required/recommended changes.

Companion docs updated as part of this review (kept in sync between both repos):
- `MIS_API_DOCS.md` / `nga_central_mis/API_DOCS.md`
- `SSO_CLIENT_INTEGRATION.md` (both repos)

---

## 1. How task-mentor actually talks to MIS today (verified from source)

There is **no local username/password auth in the running app**. `client/src/components/Auth/Login.tsx` renders a single "Sign in with NGA MIS" button — the entire production login path is the OAuth2-style SSO flow:

```
Login.tsx (handleSSOLogin)
  → redirect to MIS login (VITE_MIS_LOGIN_URL) with client_id + redirect_uri
MIS login → redirects back with ?code=...
Callback.tsx
  → POST /auth/sso/callback { code }  (task-mentor backend)
server/src/controllers/auth.controller.ts: ssoCallback()
  → POST {NGA_MIS_BASE_URL}/sso/token   { code, client_id, client_secret }
  → GET  {NGA_MIS_BASE_URL}/users/me    (Bearer misToken)   -- hydrates profile/roles/assignedPrograms/assignedGrades/academic year+terms/systems
  → creates/updates local User row keyed on mis_user_id
  → issues local tm_auth_token + returns misToken to client
Callback.tsx → loginWithSSOData(response) → AuthContext sets user state directly
```

Session re-checks go through `GET /auth/me` (`getMe` in `auth.controller.ts:772`), which re-proxies `GET /users/me` every time — so profile/roles/assignedGrades/systems are always freshly pulled from MIS on every app load, not just at login.

Besides this, task-mentor calls these MIS endpoints directly (all read-only except password reset/theme, all verified present and unchanged in current MIS routes):

| Area | Endpoints used | Status |
|---|---|---|
| Academics (read) | `/academics/subjects`, `/academics/subjects/:id`, `/academics/subjects/:id/terms/:termId/students`, `/academics/my-assigned-subjects`, `/academics/class-groups`, `/academics/students/:id/enrolled-subjects` | ✅ Compliant — matches current routes exactly |
| Scheme of Work | `/scheme-of-work/entries?subject_id&class_group_id&academic_term_id` | ✅ Compliant |
| Users | `/users/:id`, `/users/`, `/users/me`, `/users/me/profile`, `/users/me/theme` | ✅ Compliant |
| Auth/SSO | `/sso/token`, `/sso/authorize`, `/auth/change-password` | ✅ Compliant |
| Legacy direct auth | `/auth/login`, `/auth/verify-otp` | ⚠️ Dead code path — see §2.1 |

**Conclusion:** the MIS's recent academics-module changes (teacher/student assignment moving from term-scoped to year-scoped, `ClassGroup` becoming a permanent per-grade label instead of a per-year record — see the updated `API_DOCS.md` §"Class Groups"/"Teacher-Subject Assignments") **do not break task-mentor**, because task-mentor only *reads* these resources and never calls the mutating endpoints (`assign-subject`, `enroll-subject`, `assign-class-group`, `promote-year`, etc.). Those mutations are performed exclusively through the MIS's own admin UI.

---

## 2. Findings that do require action

### 2.1 Dead legacy login path returns an incomplete MIS response shape (Low priority — cleanup or fix)

`server/src/controllers/auth.controller.ts`:
- `login()` (line 14) → `POST {MIS}/auth/login`
- `verifyOtp()` (line 68) → `POST {MIS}/auth/verify-otp`, destructures `assignedGrades` from the response (line 110, 144)

**Problem:** MIS's `POST /auth/verify-otp` (`authController.completeLogin`) never returns `assignedGrades` — only `GET /users/me` does. This is intentional on the MIS side (confirmed in source, now documented). So if this path were ever hit, `assignedGrades` would always be `undefined`/empty on first login until the next `GET /auth/me` session refresh.

**But:** grepping the entire `client/src` finds **zero references** to `verify-otp` or an OTP input form. `Login.tsx` only exposes the SSO button. This code path appears unreachable from the shipped web client — it may be leftover from before the SSO migration, or intended for a future mobile client.

**Recommendation (pick one, confirm with the team first):**
- If genuinely unused: delete `login`/`verifyOtp` from `auth.controller.ts` and their routes, to stop maintaining a second, subtly-incomplete auth path.
- If kept for a future client: after `verifyOtp()` completes, add a follow-up `GET {MIS}/users/me` call (mirroring exactly what `ssoCallback()` already does at line 424) before building the response, so `assignedGrades`/`systems`/academic context are complete on first login too.

### 2.2 Hardcoded term fallback is a latent data-integrity risk (Pre-existing, unrelated to this MIS update, but worth bundling)

`server/src/utils/misUtils.ts:143` — `getCurrentTermId()` returns a hardcoded `4` when it can't resolve a term from the JWT or from `GET /users/me`. This was already flagged in `ACADEMIC_YEAR_TERM_SCOPING_REPORT.md` (2026-06-03). Since this plan already touches the exact code path that talks to `/users/me`, it's efficient to fix alongside item 2.1:
- Replace the hardcoded `4` with a thrown/handled error (fail the request, don't silently mis-attribute data to term 4) or a value sourced from MIS's `currentAcademicYear`/`currentAcademicTerms` with no match instead of a literal ID.

### 2.3 Documentation was stale/incomplete (Fixed as part of this review)

`MIS_API_DOCS.md` and `SSO_CLIENT_INTEGRATION.md` (both repos) have been corrected:
- SSO authorization code TTL corrected from an incorrect "60s" to the actual **5 minutes**.
- `POST /sso/token` response documented accurately as `{ token, user, permissions }` only, with an explicit note that `GET /users/me` must be called next — this is exactly what `ssoCallback()` already does, so the doc now matches the working implementation instead of contradicting it.
- `POST /auth/verify-otp` response documented with an explicit warning that `assignedGrades` is absent (relevant directly to §2.1).
- Academics module: documented the year-scoping migration (`academic_term_id` → `academic_year_id` on teacher-subject assignment, student-subject enrollment, student class-group assignment) and that `ClassGroup` is now a permanent per-grade label with no year field. Added the previously-undocumented `/scheme-of-work/*` endpoint family (actively used by task-mentor) and `/users/grade-assignments*`.

No task-mentor code references the now-corrected fields incorrectly (confirmed via grep — task-mentor never sends `academic_term_id` to any of the mutating academics endpoints, since it never calls them), so this was a documentation-only fix, not a code fix.

---

## 3. Action items

| # | Item | File(s) | Priority | Type |
|---|---|---|---|---|
| 1 | Decide fate of legacy `/auth/login` + `/auth/verify-otp` path; delete or fix per §2.1 | `server/src/controllers/auth.controller.ts`, `server/src/routes/auth.routes.ts` | Low | Cleanup/bugfix |
| 2 | Remove hardcoded `termId = 4` fallback in `getCurrentTermId()` | `server/src/utils/misUtils.ts:143` | Medium | Bugfix (pre-existing, bundled here) |
| 3 | No action needed on academics/scheme-of-work integration — verified compliant with current MIS contract | n/a | — | Verified safe |
| 4 | Spot-check MIS `System` registration for task-mentor's `client_id` has the correct redirect URIs registered for both dev (`http://localhost:5173/taskmentor/sso/callback`) and prod | MIS Admin Dashboard (operational, not code) | Low | Ops check |
| 5 | If/when task-mentor ever builds admin screens for teacher/student/class-group assignment, use `academic_year_id` (not `academic_term_id`) and treat `class_group_id` as year-independent, per updated `MIS_API_DOCS.md` | Future work | — | Forward guidance |

## 4. Verification plan (for items 1–2 if implemented)

1. With the SSO flow (the only live path), confirm `assigned_grades` on `AuthContext`'s `user` object is populated immediately after login for a class-teacher account, and again after a page refresh (`GET /auth/me`).
2. If the legacy path is fixed rather than deleted: manually POST to `/auth/login` + `/auth/verify-otp` with a test account and confirm the response now includes non-empty `assignedGrades` for a class-teacher.
3. If the legacy path is deleted: confirm no build errors, and grep confirms no remaining client references.
4. For the `getCurrentTermId` fix: force a token without `currentAcademicTerms` and confirm the app now surfaces a clear error/empty-state instead of silently writing data against term `4`.
