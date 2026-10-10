# TMCode Projects API (Task Mentor server, P1)

Implements PROJECTS_PLAN.md §1–§3. Everything lives under `/api/tmcode`. Code:
`controllers/projects.controller.ts`, `controllers/tmcodeUser.controller.ts`,
`middleware/tmcodeUserAuth.ts`, `tmcode/userToken.ts`, `tmcode/projects/*`,
`models/Project.model.ts`, and migrations `20261006100000-create-projects.js` and
`20261006110000-add-projects-permissions.js`. Tests are in
`tests/projects.integration.spec.ts` and `tmcode/projects/__tests__/*`.

## Conventions

- **Auth.** Send `Authorization: Bearer <token>`. The token is either a TMCode user token (from `/auth/exchange`) or a normal TM web JWT. The web pages may instead rely on the `tm_auth_token` cookie, which is how `EventSource` streams authenticate.
- **Errors** are `{error_code, message, ...extra}`. The 401 codes are `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED` and `SESSION_ENDED` (after an MIS sign-out, judged by the token's `iat`). On any of them TMCode forgets both tokens.
- **Projects you can't see** answer `404 PROJECT_NOT_FOUND`, never 403, so the response doesn't reveal that a project exists.
- **Users** are always LOCAL Task Mentor user ids. Dates are ISO strings and sizes are bytes.
- **The MIS token for scoping.** `GET /activities/linkable` and `POST …/links` decide course scope through MIS, as the TM pages do. The web sends the `misToken` cookie. **TMCode must send `X-MIS-Token: <MIS JWT>`** on those two calls; without it the scope is empty, so the list is empty and linking returns `403 ACTIVITY_NOT_IN_SCOPE`.

## Permissions

| Key | Default roles | Grants |
|---|---|---|
| `PROJECTS_USE` | every role (the migration grants it to all roles, custom ones included) | everything on your own projects: create, sync, presence, git, links, members |
| `PROJECTS_VIEW_ALL` | admin | `scope=all`, and reading any project and revision (read-only) |
| `PROJECTS_MONITOR` | instructor, admin, and custom roles with `QUIZZES_GRADE` or `SUBMISSIONS_GRADE` | `/monitor/live`, `/activities/:type/:id/projects`, and reading linked projects |

## Endpoints

| Method and path | Who | Success response |
|---|---|---|
| `POST /auth/exchange` | MIS Bearer | `200 {token, expires_at, user}` |
| `GET /auth/me` | any token | `200 {user, token_kind: "tmcode-user"\|"web", expires_at}` |
| `GET /projects?scope=mine\|shared\|all&q=&kind=tm\|github&archived=exclude\|include\|only` | USE (`all`: VIEW_ALL) | `200 {projects: ProjectRow[], stats}` |
| `POST /projects` `{name, description?, language?, kind?, visibility?, repo_url?, default_branch?, github_username?}` | USE | `201 {project: ProjectDetails}` |
| `GET /projects/:id` | reader | `200 {project: ProjectDetails}` |
| `PATCH /projects/:id` `{name?, description?, language?, visibility?, repo_url?, default_branch?, archived?}` | owner | `200 {project: ProjectDetails}` |
| `DELETE /projects/:id` | owner | `200 {ok: true}` |
| `GET /projects/:id/revisions?limit=50&before=<number>` | reader | `200 {head_revision_id, revisions: Revision[]}` |
| `GET /projects/:id/revisions/:rev/manifest` (`:rev` = id or `head`) | reader | `200 {revision: Revision, files: [{path, sha256, size}]}` |
| `POST /projects/:id/blobs/missing` `{sha256: string[]}` | owner | `200 {missing: string[]}` |
| `PUT /projects/:id/blobs/:sha` (raw gzip body) | owner, tm | `201` (new) or `200` (already stored) `{sha256, size, stored: "db"\|"fs", existed}` |
| `GET /projects/:id/blobs/:sha` | reader | `200`, gzip body, `Content-Type: application/gzip` |
| `POST /projects/:id/revisions` | owner, tm | `201 {revision}`; `200 {revision: head, unchanged: true}` when the files equal the head |
| `GET /projects/:id/files/<path>?rev=<id>\|head` | reader | `200` raw content (`text/plain; charset=utf-8` or `application/octet-stream`), headers `X-Revision-Id` and `X-Sha256` |
| `PUT /projects/:id/presence` `{device_id, app_version?, state}` | owner/member | `200 {presence: Presence[]}` |
| `GET /projects/:id/live` | reader | SSE |
| `GET /monitor/live` | MONITOR or VIEW_ALL | SSE |
| `POST /projects/:id/git` `{branch?, head_commit?, ahead?, behind?, changes?, remote_url?, pushed?: {commit, message?}}` | owner/collaborator, github | `200 {git}` |
| `POST /projects/:id/members` `{user_id \| email, github_username?, role?: "collaborator"\|"viewer"}` | owner, github | `201` (new) or `200` (updated) `{member}` |
| `DELETE /projects/:id/members/:userId` | owner, or the member leaving | `200 {ok: true}` |
| `GET /projects/:id/open-link` | reader | `200 {deeplink: "tmcode://project?id=<id>&api=<origin>"}` |
| `GET /activities/linkable` | USE | `200 {activities: [{type, id, title, course_id, course_name, due_date, submission_type?}]}`; quiz rows add `start_date`, `attempt_open`, `practical_questions[]` (see "Grading v2") |
| `POST /projects/:id/links` `{activity_type, activity_id}` | owner | `201 {link}` |
| `POST /projects/:id/links/:linkId/submit` `{git_commit?}` | owner | `200 {link, submission: {id, status, is_late} \| null}` |
| `POST /projects/:id/return` `{message?, allow_resubmission?}` | MONITOR or VIEW_ALL, teacher of the linked assignment | `200 {status, project}`; see "Return for changes" |
| `DELETE /projects/:id/links/:linkId` | owner | `200 {ok: true}` |
| `GET /activities/:type/:id/projects` | MONITOR or VIEW_ALL, with access to the activity | `200 {activity, projects: [...]}` |

The "reader" roles are the owner, a member, an admin (VIEW_ALL) and a teacher (MONITOR plus a link to one of their activities). A teacher reads only the frozen (submitted) revisions, or every revision when the owner set `visibility: "course"`.

## Shapes

```ts
User (auth) = { id, mis_user_id, name, email, role, avatar_url, permissions: string[] }
UserBrief   = { id, name, avatar_url }

Revision = { id, project_id, number, parent_id, author_id, author_name?, message,
             file_count, size_bytes, source: "save"|"auto"|"submit", git_commit, created_at }

Git = { branch, head_commit, ahead, behind, changes, remote_url,
        last_push: {commit, message, at} | null, reported_at }

ProjectCore = { id, name, slug, description, language, kind: "tm"|"github",
                visibility: "private"|"course", repo_url, repo_full_name, default_branch,
                head_revision_id, size_bytes, file_count, git: Git|null, archived_at,
                last_activity_at, created_at, updated_at, owner: UserBrief,
                my_role: "owner"|"collaborator"|"viewer"|"admin"|"teacher" }

PresenceSummary = { online, devices_online, last_seen_at, file, dirty: number }

ProjectRow (GET /projects) = ProjectCore & {
  head: Revision | null,
  presence: PresenceSummary,
  links: { total, submitted, items: [{id, activity_type, activity_id, status}] } }
stats = { total, online, active_this_week, revisions, submissions }

ProjectDetails (GET/POST/PATCH) = ProjectCore & {
  head: Revision | null,               // null for a teacher without "course" visibility
  members: Member[],                   // [] for tm projects
  links: Link[],
  events: Event[],                     // last 20, newest first
  presence: Presence[],                // every device row, each with `online`
  presence_summary: PresenceSummary,
  can: { edit, save, report_git, read_all_revisions } }

Member   = { user_id, name, avatar_url, role: "owner"|"collaborator"|"viewer",
             github_username, status: "invited"|"active"|"removed", invited_by, created_at }
Link     = { id, project_id, activity_type: "quiz"|"assignment"|"manual_assessment", activity_id,
             activity: {title, course_id, open, due_date} | null, status: "linked"|"submitted",
             revision_id, revision_number, git_commit, submitted_at, linked_by, created_at }
Event    = { id, project_id, user_id, user_name?, type, data, created_at }
Presence = { project_id, user_id, user_name?, device_id, app_version, state, last_seen_at, online }
```

`online` means `state.open !== false` and a heartbeat within `PROJECTS_PRESENCE_STALE_S` (60 s). `state` is whatever TMCode sends, `{open, file, dirty, branch, ahead, behind, changes, last_commit, last_run, sync}`, up to 8 KB, with `open` defaulting to `true`.

Event `type`s: `created`, `updated`, `archived`, `unarchived`, `saved` `{revision_id, number, source, file_count}`, `opened` `{device_id, file}` (when a device goes from offline to open), `pushed` `{commit, message, branch}`, `linked`, `unlinked`, `submitted` `{link_id, activity_type, activity_id, title, revision_id, revision_number, git_commit}`, `member_added` and `member_removed`.

The teacher view `GET /activities/:type/:id/projects` returns:
`{activity: {type, id, title, course_id, open, due_date}, projects: [{link: Link, project: {id, name, kind, language, visibility, repo_url, git}, owner: UserBrief, frozen_revision: Revision|null, presence: PresenceSummary}]}`.

## Sync protocol (tm projects)

1. Hash the files (sha256 of the raw bytes). Call `POST blobs/missing` with every hash.
2. For each missing hash, `PUT blobs/<sha>` with the gzip'd bytes: `Content-Type: application/gzip` and **no** `Content-Encoding`. Send `X-Blob-Size: <raw bytes>` (or `?size=`) optionally. The server gunzips the body and checks it:
   - `400 BAD_GZIP` when the body isn't gzip;
   - `413 FILE_TOO_LARGE` over the per-file limit;
   - `422 HASH_MISMATCH {sha256}` when the content doesn't hash to `<sha>`;
   - `422 SIZE_MISMATCH {size}` when it doesn't match the declared size.

   Blobs under 256 KB are stored in MySQL and larger ones on the file-server (`nga-task-mentor/projects/<sha>`). Outside production, an unreachable file-server falls back to MySQL; in production it answers `503 STORAGE_UNAVAILABLE`.
3. `POST revisions {base_revision_id, message, files: [{path, sha256, size}], source}`. `base_revision_id` is `null` for the first save. The checks, in order:
   - `400 VALIDATION_ERROR`;
   - `413 QUOTA_EXCEEDED {limit: "files"|"file_size"|"project_size", max}`;
   - `422 INVALID_PATH {path}`: `..`, `.`, empty segments, absolute paths, `C:`, backslashes, NUL or control characters, or more than 260 characters;
   - `422 DUPLICATE_PATH {path}`;
   - `422 BLOBS_MISSING {missing}`;
   - `422 SIZE_MISMATCH {path, size}`;
   - `409 REVISION_CONFLICT {head: Revision|null}` when the base is not the head. This check runs in a transaction under `SELECT … FOR UPDATE` on the project;
   - `409 PROJECT_KIND` for a github project;
   - `409 PROJECT_ARCHIVED`.
4. **Pull:** `GET revisions/head/manifest`, then `GET blobs/<sha>` for each blob you don't have. A blob is served only when it appears in a revision of that project that you may read.

## Live streams (SSE)

- **Transport.** `Content-Type: text/event-stream`, `X-Accel-Buffering: no`, a `retry: 5000` line, and a `: ping` comment every 25 s (`PROJECTS_SSE_HEARTBEAT_MS`). The subscription is removed when the client disconnects.
- **`/projects/:id/live` events:**
  - `hello {project_id, head: Revision|null, git, presence: Presence[]}`;
  - `presence Presence`;
  - `revision Revision` (not sent to a teacher who is limited to frozen revisions);
  - `event Event`;
  - `git {project_id, git}`;
  - `project ProjectCore` (after a PATCH);
  - `deleted {project_id}`, after which the stream closes.
- **`/monitor/live` events:**
  - `hello {scope: "all"|"courses", course_ids: number[]|null, online: MonitorEntry[]}`;
  - `presence MonitorEntry`, where `MonitorEntry = {project: {id, name, kind, language, owner: UserBrief}, course_ids: number[], presence: Presence}`.
- **Going offline.** When a device stops sending heartbeats, a sweep that runs every 10 s publishes one `presence` with `online: false` after 60 s. A `{open:false}` heartbeat publishes it at once.

## Deviations from the plan

1. **Git state is stored on the project.** `projects.git_state` (JSON) and `projects.last_activity_at` were added. The plan kept git state only in presence, which goes stale.
2. **`submissions.project_ref` (JSON).** The `submissions` table has no `submission_type` column, so the plan's "`submission_type` `project`" is implemented as follows:
   - `assignments.submission_type` gains `'project'` (model, controller validation and enum);
   - the submit writes the student's `submissions` row with raw SQL: the status, `is_late`, a readable `text_submission` such as `TMCode project "X", revision #3`, and `project_ref = {project_id, link_id, kind, revision_id, revision_number, git_commit, repo_url, submitted_at}`;
   - the `Submission` model doesn't map `project_ref`, so code deployed before the migration runs keeps working;
   - a `graded` submission refuses a resubmit with `409 ALREADY_GRADED`;
   - `is_late` is "handed in after the due date", except that handing in again the same frozen revision (or git commit) that was on time keeps it on time, so withdrawing after the due date doesn't make unchanged on-time work late. `POST /projects/:id/withdraw` answers `will_be_late: true` when the due date has passed (a changed version will be late);
   - a quiz practical link is handed in only into the student's open (`in_progress`) quiz attempt; without one the submit answers `409 {error_code: "QUIZ_NOT_OPEN", code: "QUIZ_NOT_OPEN", message: "Open the quiz in Task Mentor, then submit again."}` and nothing is marked submitted.
3. **Monitor scoping is by links.** "Students in their scoped courses" means projects linked to an activity whose course is in the teacher's `getScopedSubjects`. Projects have no course of their own, and no roster calls are made.
4. **Submitted projects can't be deleted.** `DELETE` answers `409 PROJECT_SUBMITTED` while any link is submitted (archive the project instead), and `DELETE …/links/:linkId` answers `409 LINK_SUBMITTED`.
5. **Linking rules:**
   - one link per activity per owner, across all their projects (`409 ALREADY_LINKED`);
   - the activity must be open (`409 ACTIVITY_CLOSED`): an assignment or quiz is open when it is `published`, and a quiz also needs its `end_date` not to have passed; recorded assessments are always open;
   - resubmitting moves the freeze to the current head or commit.
6. **No-op saves.** A commit whose files equal the head returns `200 {revision: head, unchanged: true}` and creates no revision.
7. **The project-count quota** is `409 QUOTA_EXCEEDED {limit: "projects"}`. The size and file quotas are `413`.
8. **Members** start as `status: "active"`. TM access is immediate, and TMCode does the GitHub invite. The owner always has a `project_members` row with `role: "owner"`, but `members` is returned only for github projects.
9. **Slug.** The slug is fixed at creation and never changes on rename, because TMCode keys local folders by it.
10. **Blob clean-up.** It runs after `DELETE /projects/:id` responds. It scans the remaining manifests and rescans revisions committed during the scan. Blobs that were uploaded but never committed are not collected.
11. **`/auth/exchange`** is rate-limited to 20 requests a minute per IP. It provisions the user from MIS `/users/me`. If `/users/me` fails, an already-known user still signs in; an unknown one gets `503 MIS_UNAVAILABLE`.
12. **The user token's TTL** comes from `TMCODE_USER_TOKEN_TTL_DAYS` (default 30).

## Environment and nginx

- **Environment** (`.env.example`):
  - `PROJECTS_MAX_PROJECT_MB=100`
  - `PROJECTS_MAX_FILES=5000`
  - `PROJECTS_MAX_FILE_MB=10`
  - `PROJECTS_MAX_PER_USER=50`
  - `PROJECTS_BLOB_DB_MAX_KB=256`
  - `PROJECTS_PRESENCE_STALE_S=60`
  - `PROJECTS_SSE_HEARTBEAT_MS=25000`
  - `TMCODE_USER_TOKEN_TTL_DAYS=30`
- **nginx.** `deploy/nginx-taskmentor.conf` adds `location ~ ^/api/tmcode/.*/live$` with `proxy_buffering off; proxy_read_timeout 1h;`. Copy it into the live config on the box when deploying.

## Practicals and case studies (ASSIGNMENTS_PLAN.md)

Code: `controllers/tmcodeAssignments.controller.ts`, `tmcode/assignments/*`, migration
`20261007090000-tmcode-assignments.js`, tests `tests/tmcodeAssignments.integration.spec.ts`.
The `assignments.tmcode_*` columns are read through the `AssignmentTmcode` model, not `Assignment`.

| Method and path | Who | Success response |
|---|---|---|
| `GET /assignments?scope=student\|teaching` | any token (teaching: staff, else `403 FORBIDDEN`) | `200 {assignments: AssignmentSummary[]}` |
| `GET /assignments/:id` | teacher of it, or an enrolled student (`403 NOT_ENROLLED`; drafts/removed/non-TMCode are `404 ASSIGNMENT_NOT_FOUND` for students) | `200 {assignment: AssignmentDetail}` |
| `POST /assignments/:id/start` | USE | `201 {project, created: true}` first time, `200 {project, created: false}` after; `409 ASSIGNMENT_COMPLETED` (completed, not started), `403 NOT_ENROLLED` |
| `PUT /assignments/:id/tmcode` `{kind, language?, starter_project_id?, starter_revision_id?, instructions?}` | ASSIGNMENTS_EDIT + creator or MANAGE_ANY | `200 {assignment: AssignmentDetail}` (teacher view); `422 STARTER_NOT_FOUND\|STARTER_KIND\|STARTER_INVALID\|STARTER_REVISION_NOT_FOUND` |
| `GET /assignments/:id/workspaces` | teacher of it | `200 {assignment, counts, workspaces: WorkspaceRow[]}` |
| `GET /assignments/:id/open-link` | as `GET /assignments/:id` | `200 {deeplink: "tmcode://assignment?id=<id>&api=<origin>"}` |

```ts
AssignmentSummary = { id, title, kind: "practical"|"case_study"|null, course_id, course_name,
  status, due_date, points, language, read_only,
  late,   // the due date has passed (for a countdown); NOT the hand-in's lateness
  // The one cutoff (same for every caller, `my`-independent). TMCode hand-ins are taken
  // while the assignment is published, marked late after due_date, until the teacher closes it:
  accepts_submissions: boolean,       // status === "published"
  late_policy: "until_closed",        // late work accepted until the teacher closes the assignment
  accepts_late_until: string|null,    // a fixed last moment for late work; null = no fixed date (until closed)
  my: { project_id, link_id, state: "not_started"|"in_progress"|"submitted"|"graded",
        submitted_at, revision_number, grade: number|null, max_points, feedback,
        is_late: boolean|null,          // submissions.is_late; null until handed in
        returned_at: string|null,       // the teacher's latest "Return for changes" not yet
        returned_message: string|null,  //   answered by a new hand-in (null once resubmitted)
        rubric_scores: [{index: number, score: number, comment: string|null}] | null
                                        // per criterion (index into `rubric`), only once graded
                                        // (same visibility as grade/feedback); null otherwise or
                                        // when the grade didn't use the rubric. Comments come from
                                        // the feedback's "Criteria notes" block, which `feedback`
                                        // still contains (split on /\n*Criteria notes:\n/ to show it alone)
      } | null,
  teaching?: { students, started, submitted, graded } }   // submitted counts graded work too
AssignmentDetail = AssignmentSummary & { description_html /* untrusted, sanitise */, instructions,
  attachments: [{name, url /* absolute */}],
  rubric: [{criteria: string, description: string|null, max_score: number}],   // [] = no rubric
  starter: {project_id, revision_id, file_count, size_bytes} | null }
WorkspaceRow = { user: {id /* local, null if never signed in */, mis_user_id, name, email, avatar_url},
  project_id, link_id, submission_id, state, last_activity_at,
  presence: (PresenceSummary & {shared: boolean}) | null,   // shared:false -> zeros, "Live status not shared"
  revision_id, revision_number, submitted_at, grade, max_points }
counts = { students, started, submitted, graded, live }
```

- **Start** makes a `tm` project (`visibility: "course"`, the assignment's title and language, `assignment_id` set, `share_presence: true`), copies the starter's manifest as revision 1 (`message: "Starter files"`) when there is a starter with a saved revision, and links it. An unsubmitted link from another of the student's projects moves to the workspace. Unique `(owner_id, assignment_id)` makes concurrent Starts safe.
- **Read-only**: a workspace whose assignment is `completed` answers `POST /projects/:id/revisions` with `409 ASSIGNMENT_READ_ONLY`; `POST …/links/:linkId/submit` for a completed assignment answers `409 ASSIGNMENT_COMPLETED` (any project).
- **Projects additions**: every project shape has `share_presence`; `GET /projects` rows and `GET /projects/:id` have `assignment: {id, title, status, kind} | null` and `read_only`; `can.share_presence` says whether the owner may turn sharing off; `PATCH /projects/:id {share_presence}` answers `409 PRESENCE_LOCKED` when turning it off on a workspace of a published assignment.
- **share_presence false**: heartbeats are stored and reach the project stream for the owner, but never `/monitor/live` (hello or events); admins/teachers get `presence: []` / zeroed summaries on `/projects/:id`, `/projects/:id/live`, `/activities/:type/:id/projects` (rows also carry `project.share_presence`). Turning it off sends one `presence` on the monitor stream with `online: false` and `withdrawn: true`.
- `GET /api/assignments/:id` (web) carries `tmcode: {kind, language, starter_project_id, starter_revision_id, instructions} | null`.
- **Grading rubric scores** (`GET /grading/:type/:id`, `PUT /grading/:type/:id/students/:studentId`): `grade.rubric_scores` is `[{index, score, comment}]`. For assignments `submissions.rubric_scores` stays the index→score map the web marking shares, and the comments live in the feedback's "Criteria notes" block (the text the student reads); the roster parses them back out, so re-saving what it returned keeps them. A PUT whose scores carry no `comment` key at all keeps the notes found in the sent feedback.

## Grading v2 (TMCode 0.12: UX gap review G1–G14, S8, S10, E4, E10, E12)

Code: `controllers/tmcodePracticals.controller.ts`, `controllers/tmcodeSessions.controller.ts`,
`tmcode/practical/gradeMeta.ts`, `tmcode/projects/status.ts` (`reopenGradedProject`, `recordWebGrade`).
Tests: `tests/tmcodePracticals.integration.spec.ts`, `tests/tmcode.integration.spec.ts` ("session views"),
`tmcode/practical/__tests__/gradeMeta.test.ts`. **No migration.**

### Endpoints

| Method and path | Who | Success response |
|---|---|---|
| `GET /grading` | MONITOR or VIEW_ALL | `200 {activities: [...]}` (unchanged) |
| `GET /grading/:type(assignment\|quiz)/:id?question_id=` | MONITOR or VIEW_ALL + teacher of the activity | `200 {activity, counts, rows: GradingRow[]}` |
| `PUT /grading/:type/:id/students/:studentId` `GradePut` | grader of the activity (subject teacher, creator, MANAGE_ANY) | `200 GradePutResult`; `409 GRADE_CHANGED`, `409 DRAFT_NEEDS_SUBMISSION`, `409 NOT_ANSWERED`, `422 SCORE_TOO_HIGH\|UNKNOWN_CRITERION\|SCORE_REQUIRED` |
| `POST /grading/:type/:id/release` `{question_id?}` | grader | `200 {released: number, student_ids: number[], skipped: [{student_id, code}], locked_students: number}` |
| `GET /grading/:type/:id/open-link?question_id=&student_id=` | MONITOR or VIEW_ALL + teacher | `200 {deeplink: "tmcode://grading?type=<assignment\|quiz>&id=<id>&question=<qq id>&student=<local user id>&api=<origin>"}` (question/student only when known) |
| `GET /quizzes/:quizId/sessions` | MONITOR or VIEW_ALL + teacher of the quiz | `200 QuizSessions` |
| `GET /quizzes/:quizId/my-session` | any token (the caller's own attempt) | `200 {session: MySession \| null}` |

```ts
GradingRow = {
  student: UserBrief, state: "submitted"|"in_progress"|"graded"|"not_started",   // graded = a RELEASED grade
  project: {...} | null, link: {...} | null, submitted_at, late,
  grade: Grade | null,
  starter_revision: number | null,          // number of the project revision holding the starter files ("Starter files", #1)
  revisions: { revision: number, at: string, id: number }[],   // every revision the caller may read, oldest first
}
Grade = {
  score: number | null, rubric_scores: [{index, score, comment}] | null, feedback: string | null, ref_id: number | null,
  annotations: { path: string, line: number, text: string }[],
  released: boolean,                        // false: nothing released, or what is shown is an unreleased draft
  status: "ungraded" | "draft" | "released",
  graded_by: { id: number, name: string } | null,
  graded_at: string | null,                 // a real grading time (never updated_at); null for grades older than 0.12
  released_score: number | null,            // what the student sees now (a released grade under a draft)
  version: string,                          // opaque; changes on every save (and on any web re-grade)
}
// graded_by/graded_at describe the grade SHOWN: a draft's author and save time, else the release.
counts = { total, to_grade, graded, drafts }
activity.can_return: boolean               // Return for changes / Allow resubmission exist for assignments only

GradePut = { question_id?, rubric_scores?: [{index, score, comment?}], score?, feedback?,
  annotations?: {path, line, text}[],      // MISSING = keep the saved ones (old clients never wipe them); [] clears
  release?: boolean,                       // MISSING = true (the pre-0.12 behaviour)
  if_version?: string }                    // the Grade.version you edited
GradePutResult = { ok: true, score, max_points, released: boolean,
  locks_student: boolean,                  // S10: this release graded work the student was still editing; it is now read-only
  grade: Grade, version: string }
409 GRADE_CHANGED = { code: "GRADE_CHANGED", error_code: "GRADE_CHANGED", message, grade: Grade | null }  // the current grade
409 DRAFT_NEEDS_SUBMISSION                 // assignment with no submission row: no draft (a row would show the student
                                           // "Submitted"); save with release:true to grade unsubmitted work
```

**Loading a version for grading** (G2): every `revisions[].id` (and `starter_revision`'s) loads with
`GET /projects/:id/revisions/<id>/manifest` then `GET /projects/:id/blobs/<sha>` (or one file with
`GET /projects/:id/files/<path>?rev=<id>`). A teacher reads every revision of a `visibility: "course"` project
(practicals always are), otherwise only the frozen one, which is all `revisions` lists then.

**Drafts never reach students.** Storage, without a migration:
- Assignments: `submissions.project_ref.grading = {draft, annotations, graded_by, graded_at, fp, saved_at, previous}`.
  `project_ref` isn't mapped by the `Submission` model, so no web or student endpoint returns it. A draft writes only
  there: `grade`, `feedback`, `rubric_scores` and `status` (what every student view, the gradebook and the web read)
  are written on release only. The submit keeps `grading` when it rewrites `project_ref`. `fp` (hash of grade+feedback)
  tells whether a later re-grade on the web replaced ours: then `graded_by/graded_at/annotations` come from the web
  marking stamp (`recordWebGrade`, written by `PATCH /api/submissions/:id/grade`) or are null.
- Quiz practicals: `quiz_attempts.grading_details.draft`; students get `grading_details` only through
  `studentGradingDetails` (a whitelist), the attempt stays `pending`, and the quiz total isn't recomputed until release.
  The released grade is `grading_details.manual` as before, now with `annotations`.
- A draft doesn't lock the project or make it graded; only a release does (`locks_student` warns).
- Released annotations reach students as `my.annotations` (`GET /assignments[/:id]`) and
  `grading_details.manual.annotations` in quiz results.

**Release all** releases each draft as saved, guarded by the version it read (a draft changed meanwhile is skipped
with `GRADE_CHANGED`).

### Return for changes (G5)

`POST /projects/:id/return {message?, allow_resubmission?}` (the web's ReturnForChangesDialog uses it):
- submitted assignment work: back to draft (as before);
- graded assignment work: `409 {code: "PROJECT_GRADED", allow_resubmission: true}` unless `allow_resubmission: true`,
  which takes the grade back (kept in `project_ref.grading.previous`; `grade/feedback/rubric_scores` cleared,
  submission `draft`), unlinks the freeze and reopens the project. The next hand-in is a `resubmitted` row;
- quiz practicals: `409 {code: "RETURN_NOT_SUPPORTED", error_code: "RETURN_NOT_SUPPORTED"}` (the attempt is over).

### Quiz rows of `GET /activities/linkable` (S8)

Quiz rows add `start_date: string | null`, `attempt_open: boolean` (the caller has an `in_progress` attempt; a practical
can be handed in only then) and, per `practical_questions[]`, the caller's
`state: "not_started"|"in_progress"|"submitted"|"graded"` and `grade: number` only once released (teacher released AND
the quiz's result rules show the score; never a draft).

### TMCode exam sessions (E4, E10)

```ts
QuizSessions = { quiz: {id, title}, generated_at, stale_after_s: 90,
  counts: { total, active, offline, submitted, flagged },
  sessions: [{ student: UserBrief, submission_id, session_id, status: "active"|"offline"|"submitted", mode,
    started_at, last_heartbeat, last_sync /* newest snapshot server_ts */, submitted_at,
    current_task: {question_id, title} | null, focus, app_version, os,
    flags: [{ rule, severity, at, question_id, explanation /* one line for teachers */ }] }],
  explanations: Record<rule, string> }
MySession = { submission_id, status, active: boolean, last_saved_at, last_heartbeat, app_version }
```
One row per student (newest session). active = heartbeat within 90 s; submitted = the session ended or the attempt
isn't `in_progress`; else offline. `focus_out` is derived from the last heartbeat, not a stored flag. The web shows
the sessions on the quiz submissions page and the proctoring monitor; the quiz page asks `my-session` when the submit
dialog opens and warns while a session exists ("Coding questions are open in TMCode: last saved 10:41 ...").

### Exam protocol additions (nga-tmcode/docs/PROTOCOL.md)

- **Policy** (`GET /sessions/:sid/package` `policy`): `debugger: boolean` (false unless the teacher ticks
  "Debugger" in the quiz's TMCode settings; stored in `proctoring_settings.tmcode_policy.debugger`).
- **`min_app_version: string | null`** in the package: `tmcode_policy.min_app_version` ("x.y.z", the
  "Minimum TMCode version" field of the quiz's TMCode settings), else the `TMCODE_MIN_APP_VERSION` env var, else null.
- **Server-run 429**: `{error_code: "RATE_LIMITED", message, retry_after_s: number}` plus a `Retry-After` header
  (seconds until the 1-minute window resets).
- **Results** (`GET /sessions/:sid/results`): each test may carry
  `verdict: "passed"|"wrong_answer"|"time_limit"|"runtime_error"|"compile_error"` (memory/output limits count as
  runtime_error; omitted when the grader didn't record one).
- **`GET /profiles`** sends `Access-Control-Expose-Headers: Date` for TMCode's clock check.
- **Not done: starting the attempt clock after TMCode's pre-exam check.** The attempt's clock starts in
  `POST /launch` (`startOrResumeAttempt`, shared with the web), and the deadline (`attemptDeadline`: `end_time` /
  `started_at` + time limit) is enforced by the web submit, the snapshot/offline-grace rules and the auto-submit sweep.
  Moving the start means a "not started" attempt state those paths would all have to honour (and a cap so a student
  can't hold the clock indefinitely), so it isn't a small change.

### Web

- Grading page `/grading/practical/:type/:id?question=<quiz_questions.id>&student=<local user id>` (TMCode links back
  with these). Buttons: Save draft (`release:false`) / Release / Release & next, "Release N drafts", draft and
  "Graded by X · time" lines, line comments (read-only, kept on save), `if_version` on every save (409: the newer
  grade loads and the teacher's scores stay as a local draft), Allow resubmission on graded assignment work, no Return
  for quiz practicals. "Open in TMCode" uses `GET /grading/:type/:id/open-link`.
