import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  Users,
  BookOpen,
  GraduationCap,
  Search,
  ChevronDown,
  Mail,
  LayoutGrid,
  List as ListIcon,
  UserRound,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface SubjectRef {
  subject_id: number;
  subject_name: string;
  subject_code: string | null;
}

interface ClassGroupRef {
  class_group_id: number;
  class_group_name: string;
  grade_name: string;
  program_name: string;
}

interface MyStudent {
  user_id: number;
  username: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  class_group_id: number;
  class_group_name: string;
  grade_name: string;
  program_name: string;
  subjects: SubjectRef[];
}

interface MyStudentsResponse {
  success: boolean;
  count: number;
  data: {
    students: MyStudent[];
    filters: { subjects: SubjectRef[]; class_groups: ClassGroupRef[] };
    academic_year_id: number | null;
    total: number;
  };
}

/* Admin flat-list shape (unchanged MIS contract) */
interface FlatUser {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  gender: string;
  class_group_name: string;
  grade_name: string;
  program_name: string;
  enrolled_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Small shared pieces                                                        */
/* -------------------------------------------------------------------------- */

const SUBJECT_HUES = [211, 262, 340, 24, 152, 190, 45, 288];
const hueFor = (id: number) => SUBJECT_HUES[Math.abs(id) % SUBJECT_HUES.length];

const initials = (first?: string | null, last?: string | null) =>
  `${(first || "").trim()[0] || ""}${(last || "").trim()[0] || ""}`.toUpperCase() ||
  "?";

const StatCard: React.FC<{
  icon: React.ReactNode;
  value: number | string;
  label: string;
}> = ({ icon, value, label }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-white/60 dark:border-border-dark/30 bg-card-light dark:bg-card-dark/30 px-4 py-3 shadow-sm">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-lg font-bold leading-tight text-text-primary-light dark:text-text-primary-dark">
        {value}
      </div>
      <div className="truncate text-xs text-text-secondary-light dark:text-text-secondary-dark">
        {label}
      </div>
    </div>
  </div>
);

const GenderChip: React.FC<{ gender?: string | null }> = ({ gender }) => {
  if (!gender) return null;
  const g = gender.toUpperCase();
  const label = g.startsWith("M") ? "M" : g.startsWith("F") ? "F" : g[0];
  return (
    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-surface-light px-1.5 text-[10px] font-semibold text-text-secondary-light dark:bg-surface-dark/60 dark:text-text-secondary-dark">
      {label}
    </span>
  );
};

const StudentRow: React.FC<{ student: MyStudent }> = ({ student }) => (
  <Link
    to={`/students/${student.user_id}`}
    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark/60"
  >
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
      {initials(student.first_name, student.last_name)}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-medium text-text-primary-light group-hover:text-blue-600 dark:text-text-primary-dark dark:group-hover:text-blue-400">
          {student.first_name} {student.last_name}
        </span>
        <GenderChip gender={student.gender} />
      </div>
      <div className="flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
        <Mail className="h-3 w-3" />
        <span className="truncate">{student.email || student.username || "—"}</span>
      </div>
    </div>
    <span className="hidden shrink-0 text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 sm:block">
      ID {student.user_id}
    </span>
  </Link>
);

/* -------------------------------------------------------------------------- */
/*  Instructor view — students grouped by subject → class group                */
/* -------------------------------------------------------------------------- */

const MyStudentsView: React.FC = () => {
  const { user } = useAuth();
  const termId = user?.currentAcademicTerm?.academic_term_id;

  const [students, setStudents] = useState<MyStudent[]>([]);
  const [subjects, setSubjects] = useState<SubjectRef[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroupRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<number | "all">("all");
  const [classGroupFilter, setClassGroupFilter] = useState<number | "all">("all");
  const [grouping, setGrouping] = useState<"subject" | "class_group">("subject");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (termId) params.termId = termId;
      const res = await axios.get<MyStudentsResponse>("/users/my-students", {
        params,
      });
      const data = res.data?.data;
      setStudents(Array.isArray(data?.students) ? data.students : []);
      setSubjects(data?.filters?.subjects ?? []);
      setClassGroups(data?.filters?.class_groups ?? []);
    } catch (err: unknown) {
      console.error("Error fetching my students:", err);
      setError("Could not load your students. Please try again.");
      setStudents([]);
      setSubjects([]);
      setClassGroups([]);
    } finally {
      setLoading(false);
    }
  }, [termId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  /* --- filtering --- */
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (
        subjectFilter !== "all" &&
        !s.subjects.some((sub) => sub.subject_id === subjectFilter)
      )
        return false;
      if (classGroupFilter !== "all" && s.class_group_id !== classGroupFilter)
        return false;
      if (!q) return true;
      return `${s.first_name ?? ""} ${s.last_name ?? ""} ${s.email ?? ""} ${
        s.username ?? ""
      }`
        .toLowerCase()
        .includes(q);
    });
  }, [students, search, subjectFilter, classGroupFilter]);

  const distinctCount = useMemo(
    () => new Set(filteredStudents.map((s) => s.user_id)).size,
    [filteredStudents],
  );

  /* --- grouped structure --- */
  type Section = {
    key: string;
    title: string;
    subtitle?: string;
    hue: number;
    badge?: string | null;
    subGroups: { key: string; title: string; subtitle?: string; students: MyStudent[] }[];
    total: number;
  };

  const sections: Section[] = useMemo(() => {
    if (grouping === "subject") {
      const bySubject = new Map<number, Section>();
      const seen = new Set<string>();
      for (const s of filteredStudents) {
        for (const sub of s.subjects) {
          if (subjectFilter !== "all" && sub.subject_id !== subjectFilter)
            continue;
          let sec = bySubject.get(sub.subject_id);
          if (!sec) {
            sec = {
              key: `sub-${sub.subject_id}`,
              title: sub.subject_name,
              subtitle: sub.subject_code || undefined,
              hue: hueFor(sub.subject_id),
              subGroups: [],
              total: 0,
            };
            bySubject.set(sub.subject_id, sec);
          }
          const cgKey = `${sub.subject_id}-${s.class_group_id}`;
          let cg = sec.subGroups.find((g) => g.key === cgKey);
          if (!cg) {
            cg = {
              key: cgKey,
              title: s.class_group_name,
              subtitle: [s.grade_name, s.program_name].filter(Boolean).join(" · "),
              students: [],
            };
            sec.subGroups.push(cg);
          }
          const dedup = `${cgKey}-${s.user_id}`;
          if (!seen.has(dedup)) {
            seen.add(dedup);
            cg.students.push(s);
            sec.total += 1;
          }
        }
      }
      return Array.from(bySubject.values())
        .map((sec) => ({
          ...sec,
          subGroups: sec.subGroups
            .map((g) => ({
              ...g,
              students: [...g.students].sort((a, b) =>
                `${a.first_name} ${a.last_name}`.localeCompare(
                  `${b.first_name} ${b.last_name}`,
                ),
              ),
            }))
            .sort((a, b) => a.title.localeCompare(b.title)),
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
    }

    // grouping === "class_group"
    const byGroup = new Map<number, Section>();
    for (const s of filteredStudents) {
      let sec = byGroup.get(s.class_group_id);
      if (!sec) {
        sec = {
          key: `cg-${s.class_group_id}`,
          title: s.class_group_name,
          subtitle: [s.grade_name, s.program_name].filter(Boolean).join(" · "),
          hue: hueFor(s.class_group_id + 7),
          subGroups: [{ key: `cg-${s.class_group_id}-all`, title: "", students: [] }],
          total: 0,
        };
        byGroup.set(s.class_group_id, sec);
      }
      sec.subGroups[0].students.push(s);
      sec.total += 1;
    }
    return Array.from(byGroup.values())
      .map((sec) => ({
        ...sec,
        subGroups: sec.subGroups.map((g) => ({
          ...g,
          students: [...g.students].sort((a, b) =>
            `${a.first_name} ${a.last_name}`.localeCompare(
              `${b.first_name} ${b.last_name}`,
            ),
          ),
        })),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredStudents, grouping, subjectFilter]);

  const toggle = (key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  /* --- render --- */
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-white/60 bg-card-light px-5 py-4 shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
        <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
          My Students
        </h1>
        <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Everyone enrolled in the subjects you teach this term, grouped by
          subject and class group.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          value={distinctCount}
          label="Students"
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          value={subjects.length}
          label="Subjects taught"
        />
        <StatCard
          icon={<GraduationCap className="h-5 w-5" />}
          value={classGroups.length}
          label="Class groups"
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary-light dark:text-text-secondary-dark/60" />
          <input
            type="text"
            placeholder="Search students by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-transparent bg-surface-light py-2.5 pl-9 pr-4 text-sm text-text-primary-light transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark"
          />
        </div>

        <select
          value={subjectFilter}
          onChange={(e) =>
            setSubjectFilter(
              e.target.value === "all" ? "all" : Number(e.target.value),
            )
          }
          className="w-full rounded-xl border border-transparent bg-surface-light px-3 py-2.5 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark lg:w-52"
        >
          <option value="all">All subjects</option>
          {subjects.map((s) => (
            <option key={s.subject_id} value={s.subject_id}>
              {s.subject_code ? `${s.subject_code} — ` : ""}
              {s.subject_name}
            </option>
          ))}
        </select>

        <select
          value={classGroupFilter}
          onChange={(e) =>
            setClassGroupFilter(
              e.target.value === "all" ? "all" : Number(e.target.value),
            )
          }
          className="w-full rounded-xl border border-transparent bg-surface-light px-3 py-2.5 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark lg:w-48"
        >
          <option value="all">All class groups</option>
          {classGroups.map((c) => (
            <option key={c.class_group_id} value={c.class_group_id}>
              {c.class_group_name}
            </option>
          ))}
        </select>

        <div className="flex shrink-0 rounded-xl bg-surface-light p-1 dark:bg-surface-dark/50">
          <button
            type="button"
            onClick={() => setGrouping("subject")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              grouping === "subject"
                ? "bg-white text-blue-600 shadow-sm dark:bg-surface-dark dark:text-blue-400"
                : "text-text-secondary-light dark:text-text-secondary-dark"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            By subject
          </button>
          <button
            type="button"
            onClick={() => setGrouping("class_group")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              grouping === "class_group"
                ? "bg-white text-blue-600 shadow-sm dark:bg-surface-dark dark:text-blue-400"
                : "text-text-secondary-light dark:text-text-secondary-dark"
            }`}
          >
            <ListIcon className="h-3.5 w-3.5" />
            By class group
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && sections.length === 0 && (
        <div className="rounded-2xl border border-white/60 bg-card-light py-16 text-center shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
          <UserRound className="mx-auto h-12 w-12 text-text-secondary-light/50 dark:text-text-secondary-dark/40" />
          <h3 className="mt-3 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {search || subjectFilter !== "all" || classGroupFilter !== "all"
              ? "No students match your filters"
              : "No students found for your subjects this term"}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
            {search || subjectFilter !== "all" || classGroupFilter !== "all"
              ? "Try clearing the search or filters."
              : "Students appear here once they're enrolled in a subject you're assigned to teach for the selected academic term."}
          </p>
        </div>
      )}

      {/* Grouped sections */}
      <div className="space-y-4">
        {sections.map((sec) => {
          const isCollapsed = collapsed[sec.key];
          return (
            <div
              key={sec.key}
              className="overflow-hidden rounded-2xl border border-white/60 bg-card-light shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30"
            >
              <button
                type="button"
                onClick={() => toggle(sec.key)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                  style={{
                    backgroundColor: `hsl(${sec.hue} 85% 92%)`,
                    color: `hsl(${sec.hue} 70% 35%)`,
                  }}
                >
                  {grouping === "subject" ? (
                    <BookOpen className="h-5 w-5" />
                  ) : (
                    <GraduationCap className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-text-primary-light dark:text-text-primary-dark">
                      {sec.title}
                    </span>
                    {sec.subtitle && (
                      <span className="shrink-0 rounded-md bg-surface-light px-1.5 py-0.5 text-[10px] font-medium text-text-secondary-light dark:bg-surface-dark/60 dark:text-text-secondary-dark">
                        {sec.subtitle}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                    {sec.total} {sec.total === 1 ? "student" : "students"}
                    {grouping === "subject" &&
                      ` · ${sec.subGroups.length} ${
                        sec.subGroups.length === 1 ? "class group" : "class groups"
                      }`}
                  </span>
                </div>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-text-secondary-light transition-transform dark:text-text-secondary-dark ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                />
              </button>

              {!isCollapsed && (
                <div className="border-t border-border-light px-2 pb-3 pt-1 dark:border-border-dark/30">
                  {sec.subGroups.map((g) => (
                    <div key={g.key} className="mt-2">
                      {g.title && (
                        <div className="flex items-center gap-2 px-3 py-1.5">
                          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark/80">
                            {g.title}
                          </span>
                          {g.subtitle && (
                            <span className="text-[11px] text-text-secondary-light/70 dark:text-text-secondary-dark/50">
                              {g.subtitle}
                            </span>
                          )}
                          <span className="ml-auto text-[11px] text-text-secondary-light/70 dark:text-text-secondary-dark/50">
                            {g.students.length}
                          </span>
                        </div>
                      )}
                      <div className="grid gap-1 sm:grid-cols-2">
                        {g.students.map((s) => (
                          <StudentRow key={`${g.key}-${s.user_id}`} student={s} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Admin view — flat directory of all students (MIS /users)                    */
/* -------------------------------------------------------------------------- */

const AllStudentsView: React.FC = () => {
  const [students, setStudents] = useState<FlatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 12;

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const params: Record<string, unknown> = { role: "student" };
        if (searchTerm) params.search = searchTerm;
        const res = await axios.get<{ data: FlatUser[] }>("/users", { params });
        setStudents(res.data.data || []);
      } catch (err) {
        console.error("Error fetching students:", err);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(run, searchTerm ? 300 : 0);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const sorted = useMemo(
    () =>
      [...students].sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`,
        ),
      ),
    [students],
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const shown = sorted.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/60 bg-card-light px-5 py-4 shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
        <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Students
        </h1>
        <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          {sorted.length} student{sorted.length === 1 ? "" : "s"} in the system
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary-light dark:text-text-secondary-dark/60" />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-xl border border-transparent bg-surface-light py-2.5 pl-9 pr-4 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark"
        />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-white/60 bg-card-light py-16 text-center shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
          <UserRound className="mx-auto h-12 w-12 text-text-secondary-light/50 dark:text-text-secondary-dark/40" />
          <h3 className="mt-3 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {searchTerm ? "No students found" : "No students registered"}
          </h3>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((s) => (
              <Link
                key={s.user_id}
                to={`/students/${s.user_id}`}
                className="group flex items-center gap-3 rounded-2xl border border-white/60 bg-card-light p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-border-dark/30 dark:bg-card-dark/30"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
                  {initials(s.first_name, s.last_name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-text-primary-light group-hover:text-blue-600 dark:text-text-primary-dark dark:group-hover:text-blue-400">
                    {s.first_name} {s.last_name}
                  </div>
                  <div className="truncate text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                    {s.username}
                  </div>
                  {(s.class_group_name || s.grade_name) && (
                    <div className="mt-0.5 truncate text-[11px] text-text-secondary-light/70 dark:text-text-secondary-dark/50">
                      {[s.grade_name, s.class_group_name]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-sm">
              <span className="text-text-secondary-light dark:text-text-secondary-dark">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-full border border-border-light px-3 py-1.5 disabled:opacity-40 dark:border-border-dark/50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-full border border-border-light px-3 py-1.5 disabled:opacity-40 dark:border-border-dark/50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Entry — pick the view that matches the requester                           */
/* -------------------------------------------------------------------------- */

const Students: React.FC = () => {
  const { can } = usePermissions();
  // Instructor-like: can see students but is not a user administrator. Admins
  // (USERS_CREATE) get the flat, cross-subject directory instead.
  const isInstructorLike = can("USERS_VIEW_ALL") && !can("USERS_CREATE");
  return isInstructorLike ? <MyStudentsView /> : <AllStudentsView />;
};

export default Students;
