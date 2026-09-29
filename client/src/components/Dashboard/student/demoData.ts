/**
 * Student dashboard demo data -- LOCAL DEVELOPMENT ONLY.
 *
 * A busy, realistic student (a quiz in progress, work due today, marks,
 * reminders, a class rank) so the layout can be judged full instead of empty.
 *
 * On only when ALL hold:
 *   - the Vite dev server is running (`import.meta.env.DEV`; a production build
 *     replaces it with `false` and drops this data),
 *   - it is not a test run,
 *   - `VITE_STUDENT_DASHBOARD_DEMO=true` is set in the untracked `client/.env`.
 * Remove that line (or set it to false) and restart Vite to see real data.
 */
import type { StudentOverview, StudentTask } from "../../../services/studentOverviewApi";

export const STUDENT_DASHBOARD_DEMO =
  import.meta.env.DEV && import.meta.env.MODE !== "test" && import.meta.env.VITE_STUDENT_DASHBOARD_DEMO === "true";

const H = 3600000;
const at = (hours: number) => new Date(Date.now() + hours * H).toISOString();

const task = (over: Partial<StudentTask>): StudentTask => ({
  id: 1,
  kind: "assignment",
  title: "Task",
  subject_id: 1,
  subject_code: "WEB",
  subject_name: "Web UI",
  state: "upcoming",
  quiz_type: null,
  opens_at: null,
  due_at: at(96),
  countdown_to: at(96),
  countdown_label: "due",
  max_score: 20,
  question_count: null,
  duration_minutes: null,
  attempts_used: 0,
  max_attempts: null,
  can_retake: false,
  has_draft: false,
  submitted_at: null,
  is_late: false,
  score_pct: null,
  score_display: null,
  passed: null,
  has_feedback: false,
  graded_at: null,
  is_new: false,
  action: { label: "Submit", url: "/assignments" },
  ...over,
});

const subject = (id: number, code: string, name: string, todo: number, avg: number | null) => ({
  subject_id: id,
  subject_name: name,
  subject_code: code,
  total: 6,
  todo,
  due_soon: todo,
  missed: 0,
  awaiting: 0,
  graded: avg == null ? 0 : 3,
  completion: avg == null ? null : 80,
  recent_average: avg,
  next_task: null,
});

export const demoOverview = (): StudentOverview => ({
  generated_at: new Date().toISOString(),
  academic_term_id: null,
  summary: {
    subjects: 8,
    todo: 3,
    in_progress: 1,
    due_today: 1,
    due_this_week: 3,
    not_open: 1,
    awaiting_grade: 1,
    graded: 4,
    missed: 1,
    drafts: 1,
    completion_rate: 86,
    on_time_rate: 71,
    recent_average: 68,
    new_results: 1,
    next_deadline: at(0.4),
  },
  tasks: [
    task({ id: 9001, kind: "quiz", title: "JavaScript basics", state: "in_progress", subject_id: 2, subject_code: "JS", subject_name: "JavaScript", countdown_to: at(0.4), countdown_label: "time_left", due_at: at(20), question_count: 10, duration_minutes: 25, max_attempts: 2, action: { label: "Resume", url: "/my-quizzes" } }),
    task({ id: 9002, title: "Landing page", state: "due_today", due_at: at(5), countdown_to: at(5), has_draft: true, action: { label: "Finish & submit", url: "/assignments" } }),
    task({ id: 9003, title: "Contact form", state: "due_soon", due_at: at(50), countdown_to: at(50), is_new: true }),
    task({ id: 9004, kind: "quiz", title: "Loops and functions", state: "not_open", subject_id: 2, subject_code: "JS", subject_name: "JavaScript", opens_at: at(30), countdown_to: at(30), countdown_label: "opens", due_at: at(60), quiz_type: "Exam", question_count: 20, duration_minutes: 40 }),
    task({ id: 9005, title: "Wireframes", state: "submitted", countdown_to: null, countdown_label: null, submitted_at: at(-24), action: { label: "View submission", url: "/submissions" } }),
    task({ id: 9006, title: "HTML structure", state: "graded", countdown_to: null, countdown_label: null, score_pct: 80, score_display: "16/20", passed: true, has_feedback: true, graded_at: at(-30), action: { label: "View feedback", url: "/submissions" } }),
    task({ id: 9007, kind: "quiz", title: "Algebra check", state: "graded", subject_id: 3, subject_code: "MAT", subject_name: "Mathematics", countdown_to: null, countdown_label: null, score_pct: 74, passed: true, graded_at: at(-80) }),
    task({ id: 9008, title: "CSS basics", state: "graded", countdown_to: null, countdown_label: null, score_pct: 45, passed: false, graded_at: at(-150) }),
    task({ id: 9009, kind: "quiz", title: "Forces and motion", state: "graded", subject_id: 4, subject_code: "PHY", subject_name: "Physics", countdown_to: null, countdown_label: null, score_pct: 62, passed: true, graded_at: at(-220) }),
    task({ id: 9010, title: "CSS lab", state: "missed", due_at: at(-48), countdown_to: null, countdown_label: null, action: { label: "View", url: "/assignments" } }),
  ],
  subjects: [
    subject(1, "WEB", "Web UI", 2, 64),
    subject(2, "JS", "JavaScript", 2, null),
    subject(3, "MAT", "Mathematics", 0, 74),
    subject(4, "PHY", "Physics", 0, 62),
    subject(5, "ENG", "English", 0, 81),
    subject(6, "CHE", "Chemistry", 0, null),
    subject(7, "ENT", "Entrepreneurship", 0, 70),
    subject(8, "DB", "Databases", 0, 58),
  ],
  reminders: [
    { id: "demo-due-today", severity: "critical", title: "Assignment due in 5h: Landing page", message: "Late submissions are not accepted.", countdown_to: at(5), subject_id: 1, action: { label: "Finish & submit", url: "/assignments" } },
    { id: "demo-result", severity: "success", title: "New result: 16/20 on HTML structure", message: "WEB · 80% · your teacher left feedback.", countdown_to: null, subject_id: 1, action: { label: "View feedback", url: "/submissions" } },
    { id: "demo-opens", severity: "info", title: "Exam opens in 1 day: Loops and functions", message: "20 questions · 40 minutes.", countdown_to: at(30), subject_id: 2 },
  ],
});

export const demoStanding = () => ({
  view: "student",
  overall: { rank: 4, ranked_count: 36, score: 71.2, band: "Top quarter", class_average: 64, status: "on_track" },
  subjects: [
    { course_id: "1", score: 78, class_average: 66, status: "on_track" },
    { course_id: "3", score: 74, class_average: 70, status: "on_track" },
    { course_id: "4", score: 62, class_average: 65, status: "watch" },
    { course_id: "5", score: 81, class_average: 72, status: "on_track" },
    { course_id: "8", score: 58, class_average: 61, status: "watch" },
  ],
  suggestions: [
    { id: "demo-s1", priority: "high", title: "Redo the CSS basics task", detail: "Your lowest mark this term: 45%.", action: { label: "Open", href: "/assignments" } },
    { id: "demo-s2", priority: "normal", title: "Revise loops before Friday's exam", detail: "The exam opens tomorrow." },
  ],
});
