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
| `GET /activities/linkable` | USE | `200 {activities: [{type, id, title, course_id, course_name, due_date, submission_type?}]}` |
| `POST /projects/:id/links` `{activity_type, activity_id}` | owner | `201 {link}` |
| `POST /projects/:id/links/:linkId/submit` `{git_commit?}` | owner | `200 {link, submission: {id, status, is_late} \| null}` |
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
   - a `graded` submission refuses a resubmit with `409 ALREADY_GRADED`.
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
