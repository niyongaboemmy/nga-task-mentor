import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch, shallowEqual } from "react-redux";
import { motion } from "framer-motion";
import { ArrowRight, ClipboardList, Gauge, LayoutGrid, List, PenLine, Search } from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import SubjectIcon from "./subjectIcons";
import type { RootState, AppDispatch } from "../../store";
import type { Course } from "../../types/course.types";
import { fetchCourses } from "../../store/slices/courseSlice";
import { getStudentOverview, type StudentSubjectSummary } from "../../services/studentOverviewApi";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 18,
    },
  },
};

// Grid by default, like the MIS's My Subjects; the choice is remembered.
const VIEW_KEY = "tm.courses.view";
type View = "grid" | "list";
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
};

const ink = {
  primary: "text-text-primary-light dark:text-text-primary-dark",
  secondary: "text-text-secondary-light dark:text-text-secondary-dark",
  muted: "text-text-secondary-light/70 dark:text-text-secondary-dark/60",
};

const Courses: React.FC = () => {
  const { can } = usePermissions();
  const isCourseManager = can("COURSES_VIEW_STUDENTS");
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [filter, _setFilter] = useState<"all" | "enrolled" | "teaching">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<View>(readView);
  // A student's own numbers per subject (work set, to do, average). Optional:
  // the grid still renders without them.
  const isStudent = !isCourseManager && can("SUBMISSIONS_CREATE");
  const [summaries, setSummaries] = useState<Map<number, StudentSubjectSummary>>(new Map());

  // Get courses from Redux store with defensive checks
  const { courses, loading, error } = useSelector(
    (state: RootState) => ({
      courses: state.course?.courses || [],
      loading: !!state.course?.loading?.courses,
      error: state.course?.error?.courses || null,
    }),
    shallowEqual,
  );

  useEffect(() => {
    // Prevent infinite retry loop when the initial fetch fails:
    // only attempt to load courses if we have no data yet, we're not
    // currently loading, and there is no recorded error.
    if (courses.length === 0 && !loading && !error) {
      dispatch(fetchCourses());
    }
  }, [courses.length, loading, error, dispatch]);

  useEffect(() => {
    if (!isStudent) return;
    let cancelled = false;
    getStudentOverview()
      .then((o) => {
        if (!cancelled) setSummaries(new Map(o.subjects.map((s) => [s.subject_id, s])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isStudent]);

  const chooseView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };

  // Filter courses based on search query
  const filteredCourses = useMemo(() => {
    if (!Array.isArray(courses)) return [];
    return courses.filter((course) => {
      if (!course) return false;
      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      const title = (course.title || "").toLowerCase();
      const code = (course.code || "").toLowerCase();
      const description = (course.description || "").toLowerCase();

      return (
        title.includes(query) ||
        code.includes(query) ||
        description.includes(query)
      );
    });
  }, [courses, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary-light dark:text-text-secondary-dark/70 font-medium">
            Loading courses...
          </p>
        </div>
      </div>
    );
  }

  const withWork = [...summaries.values()].filter((x) => x.total > 0).length;
  const open = (course: Course) => navigate(`/courses/${course.id}`, { state: { course } });

  return (
    <motion.div
      className="space-y-4 md:space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${ink.primary}`}>
            Courses
          </h1>
          <p className={`mt-1 text-sm ${ink.secondary}`}>
            <span className={`font-semibold ${ink.primary}`}>{courses.length}</span>{" "}
            {!isCourseManager
              ? `subject${courses.length === 1 ? "" : "s"} this term`
              : filter === "all"
                ? `course${courses.length === 1 ? "" : "s"} available`
                : filter === "enrolled"
                  ? `course${courses.length === 1 ? "" : "s"} you're enrolled in`
                  : `course${courses.length === 1 ? "" : "s"} you're teaching`}
            {isStudent && summaries.size > 0 && (
              <>
                {" · "}
                <span className={`font-semibold ${ink.primary}`}>{withWork}</span> with work set
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${ink.muted}`} aria-hidden />
            <input
              type="text"
              aria-label="Search subjects"
              placeholder="Search subjects by name or code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 text-sm rounded-full bg-card-light dark:bg-card-dark/30 border border-border-light dark:border-border-dark/40 placeholder-text-secondary-light dark:placeholder-text-secondary-dark/60 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div role="group" aria-label="Layout" className="inline-flex items-center gap-1">
            {[
              { key: "grid" as const, Icon: LayoutGrid, label: "Grid view" },
              { key: "list" as const, Icon: List, label: "List view" },
            ].map(({ key, Icon, label }) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={view === key}
                onClick={() => chooseView(key)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  view === key
                    ? "bg-card-light dark:bg-card-dark/40 shadow-sm text-blue-600 dark:text-blue-400"
                    : `${ink.secondary} hover:text-blue-600 dark:hover:text-blue-400`
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Courses */}
      <motion.div variants={itemVariants}>
        {filteredCourses.length === 0 ? (
          <div className="text-center py-12 bg-card-light dark:bg-card-dark/30 border border-dashed border-border-light dark:border-border-dark/50 rounded-2xl">
            <Search className="mx-auto h-12 w-12 text-text-secondary-light dark:text-text-secondary-dark/50" aria-hidden />
            <h3 className="mt-3 text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
              {courses.length === 0
                ? "No courses found"
                : "No courses match your search"}
            </h3>
            <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark/70 max-w-md mx-auto">
              {courses.length === 0
                ? !isCourseManager
                  ? "You're not enrolled in any courses yet."
                  : filter === "all"
                    ? "No courses are available yet."
                    : filter === "enrolled"
                      ? "You're not enrolled in any courses yet."
                      : "You're not teaching any courses yet."
                : "Try adjusting your search terms or filters."}
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filteredCourses.map((course) => (
              <SubjectCard key={course.id} course={course} summary={summaries.get(course.id)} onOpen={() => open(course)} />
            ))}
          </div>
        ) : (
          <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl border border-white dark:border-border-dark/30 shadow-sm divide-y divide-border-light dark:divide-border-dark/30 overflow-hidden">
            {filteredCourses.map((course) => (
              <SubjectRow key={course.id} course={course} summary={summaries.get(course.id)} onOpen={() => open(course)} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ─── Subject card / row ───────────────────────────────────────────────────────

const SubjectTile: React.FC<{ name: string }> = ({ name }) => (
  <span className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 dark:bg-blue-900/25 dark:text-blue-300">
    <SubjectIcon name={name} className="w-4 h-4" />
  </span>
);

const Chips: React.FC<{ course: Course }> = ({ course }) => (
  <div className="mt-1 flex flex-wrap items-center gap-1.5">
    {course.code && (
      <span className="rounded-md bg-surface-light dark:bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
        {course.code}
      </span>
    )}
    {course.credits != null && (
      <span className="rounded-full bg-blue-50 dark:bg-blue-900/25 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
        {course.credits} credit{course.credits === 1 ? "" : "s"}
      </span>
    )}
  </div>
);

/** One fact with its icon — reads as data, not decoration. */
const Metric: React.FC<{ icon: React.ReactNode; value: React.ReactNode; label: string; alert?: boolean }> = ({ icon, value, label, alert }) => (
  <span className={`inline-flex items-center gap-1 text-xs ${alert ? "text-amber-600 dark:text-amber-400" : ink.secondary}`}>
    <span className={alert ? "" : ink.muted}>{icon}</span>
    <span className={`font-semibold tabular-nums ${alert ? "" : ink.primary}`}>{value}</span>
    {label}
  </span>
);

const Metrics: React.FC<{ course: Course; summary?: StudentSubjectSummary }> = ({ course, summary }) =>
  summary ? (
    <>
      <Metric icon={<ClipboardList className="w-3.5 h-3.5" />} value={summary.total} label={summary.total === 1 ? "task" : "tasks"} />
      <Metric
        icon={<PenLine className="w-3.5 h-3.5" />}
        value={summary.missed || summary.todo}
        label={summary.missed ? "missed" : "to do"}
        alert={summary.missed > 0}
      />
      <Metric
        icon={<Gauge className="w-3.5 h-3.5" />}
        value={summary.recent_average != null ? `${Math.round(summary.recent_average)}%` : "—"}
        label="average"
      />
    </>
  ) : course.instructor ? (
    <span className={`text-xs truncate ${ink.secondary}`}>
      {course.instructor.first_name} {course.instructor.last_name}
    </span>
  ) : null;

const SubjectCard: React.FC<{ course: Course; summary?: StudentSubjectSummary; onOpen: () => void }> = ({ course, summary, onOpen }) => (
  <motion.button
    type="button"
    layout
    variants={itemVariants}
    onClick={onOpen}
    aria-label={`Open ${course.title}`}
    className="group flex h-full flex-col text-left p-4 rounded-2xl bg-card-light dark:bg-card-dark/30 border border-white dark:border-border-dark/30 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
  >
    <div className="mb-3 flex items-start gap-3">
      <SubjectTile name={course.title} />
      <div className="min-w-0 flex-1">
        <h3 className={`line-clamp-2 text-[15px] font-semibold leading-snug ${ink.primary}`}>{course.title}</h3>
        <Chips course={course} />
      </div>
      {!!summary?.todo && (
        <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          {summary.todo} due
        </span>
      )}
    </div>
    {course.description && <p className={`line-clamp-2 text-xs leading-relaxed ${ink.secondary}`}>{course.description}</p>}
    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border-light dark:border-border-dark/30 pt-3">
      <Metrics course={course} summary={summary} />
      <ArrowRight className="ml-auto w-4 h-4 text-text-secondary-light/50 transition-all group-hover:translate-x-0.5 group-hover:text-blue-600" />
    </div>
  </motion.button>
);

const SubjectRow: React.FC<{ course: Course; summary?: StudentSubjectSummary; onOpen: () => void }> = ({ course, summary, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    aria-label={`Open ${course.title}`}
    className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-light dark:hover:bg-surface-dark/40 focus:outline-none focus-visible:bg-surface-light"
  >
    <SubjectTile name={course.title} />
    <div className="min-w-0 flex-1">
      <p className={`truncate text-sm font-semibold ${ink.primary}`}>{course.title}</p>
      <Chips course={course} />
    </div>
    <div className="hidden md:flex items-center gap-4">
      <Metrics course={course} summary={summary} />
    </div>
    <ArrowRight className="w-4 h-4 text-text-secondary-light/50 transition-all group-hover:translate-x-0.5 group-hover:text-blue-600" />
  </button>
);

export default React.memo(Courses);
