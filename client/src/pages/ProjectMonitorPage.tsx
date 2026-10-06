import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, FileCode2, GitBranch, Play, Radio, Search, TriangleAlert, Users } from "lucide-react";
import { useEventSource } from "../hooks/useEventSource";
import { useCourseNames } from "../hooks/useCourseNames";
import {
  courseLabel,
  isPresenceLive,
  monitorLiveUrl,
  normalizeMonitorEntry,
  type MonitorEntry,
} from "../services/projectsApi";
import { Skeleton } from "../components/ui/Skeleton";
import { Avatar, LanguageBadge, LiveDot, LiveIndicator, Pill, SyncBadge } from "../components/Projects/ProjectBadges";
import { dirtyCount, languageMeta, timeAgo } from "../components/Projects/projectFormat";
import Select from "../components/ui/Select";

/**
 * /projects/monitor (PROJECTS_MONITOR) — who is working on a project in TMCode
 * right now, for the students in the teacher's courses, grouped by course.
 * Fed entirely by GET /api/tmcode/monitor/live (SSE): a `snapshot` event with
 * the current rows, then a `presence` event per heartbeat or close.
 */

type StateFilter = "open" | "unsaved" | "attention" | "all";
const NO_COURSE = "__none__";
/** Rows that closed more than this long ago drop off the page. */
const KEEP_CLOSED_MS = 30 * 60 * 1000;

const entryKey = (e: Pick<MonitorEntry, "project_id" | "user_id" | "device_id">) => `${e.project_id}:${e.user_id}:${e.device_id}`;

const ProjectMonitorPage: React.FC = () => {
  const [entries, setEntries] = useState<Map<string, MonitorEntry>>(new Map());
  const [received, setReceived] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [course, setCourse] = useState("");
  const [language, setLanguage] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const courseNames = useCourseNames();

  const live = useEventSource(monitorLiveUrl(), {
    // `hello {scope, course_ids, online: MonitorEntry[]}` opens every stream.
    hello: (data) => {
      const rows: unknown[] = Array.isArray(data?.online) ? data.online : Array.isArray(data) ? data : [];
      setEntries(new Map(rows.map(normalizeMonitorEntry).map((e) => [entryKey(e), e])));
      setReceived(true);
      setNow(Date.now());
    },
    snapshot: (data) => {
      const rows: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.presence) ? data.presence : [];
      setEntries(new Map(rows.map(normalizeMonitorEntry).map((e) => [entryKey(e), e])));
      setReceived(true);
      setNow(Date.now());
    },
    presence: (data) => {
      const e = normalizeMonitorEntry(data);
      // The student turned Share live status off: drop the row at once.
      if (e.withdrawn) {
        setEntries((prev) => {
          const next = new Map(prev);
          next.delete(entryKey(e));
          return next;
        });
        return;
      }
      setEntries((prev) => {
        const next = new Map(prev);
        const old = next.get(entryKey(e));
        // Heartbeats may omit the project/course details sent in the snapshot.
        next.set(entryKey(e), {
          ...e,
          user: e.user ?? old?.user ?? null,
          project: e.project.name !== "Untitled project" || !old ? e.project : old.project,
          // A stale device arrives once with online:false; keep what it was doing.
          state: e.online === false && old ? { ...old.state, open: false } : e.state,
          courses: e.courses.length ? e.courses : (old?.courses ?? []),
        });
        return next;
      });
      setReceived(true);
      setNow(Date.now());
    },
  });

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  // Without a snapshot (an older server), stop showing skeletons after a while.
  useEffect(() => {
    if (live.status !== "live" || received) return;
    const t = window.setTimeout(() => setReceived(true), 3000);
    return () => window.clearTimeout(t);
  }, [live.status, received]);

  const all = useMemo(
    () => [...entries.values()].filter((e) => isPresenceLive(e, now) || now - new Date(e.last_seen_at).getTime() < KEEP_CLOSED_MS),
    [entries, now],
  );

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    all.forEach((e) => e.courses.forEach((c) => map.set(String(c.id), courseLabel(c, courseNames))));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all, courseNames]);
  const languages = useMemo(() => [...new Set(all.map((e) => e.project.language).filter((l): l is string => !!l))].sort(), [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((e) => {
      const isLive = isPresenceLive(e, now);
      if (stateFilter === "open" && !isLive) return false;
      if (stateFilter === "unsaved" && !(isLive && dirtyCount(e.state.dirty) > 0)) return false;
      if (stateFilter === "attention" && !(e.state.sync === "conflict" || e.state.last_run?.status === "error")) return false;
      if (course && !(course === NO_COURSE ? e.courses.length === 0 : e.courses.some((c) => String(c.id) === course))) return false;
      if (language && e.project.language !== language) return false;
      if (!q) return true;
      return [e.user?.name, e.project.name, e.state.file].filter(Boolean).some((s) => s!.toLowerCase().includes(q));
    });
  }, [all, now, query, course, language, stateFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; rows: MonitorEntry[] }>();
    filtered.forEach((e) => {
      const list = e.courses.length ? e.courses : [null];
      list.forEach((c) => {
        if (course && course !== NO_COURSE && c && String(c.id) !== course) return;
        const key = c ? String(c.id) : NO_COURSE;
        const label = c ? courseLabel(c, courseNames) : "No course";
        const g = map.get(key) ?? { label, rows: [] };
        g.rows.push(e);
        map.set(key, g);
      });
    });
    return [...map.entries()]
      .map(([key, g]) => ({
        key,
        ...g,
        rows: g.rows.sort((a, b) => Number(isPresenceLive(b, now)) - Number(isPresenceLive(a, now)) || (a.user?.name ?? "").localeCompare(b.user?.name ?? "")),
      }))
      .sort((a, b) => (a.key === NO_COURSE ? 1 : b.key === NO_COURSE ? -1 : a.label.localeCompare(b.label)));
  }, [filtered, course, now, courseNames]);

  const openNow = all.filter((e) => isPresenceLive(e, now));
  const students = new Set(openNow.map((e) => e.user_id)).size;
  const unsaved = openNow.filter((e) => dirtyCount(e.state.dirty) > 0).length;
  const attention = all.filter((e) => e.state.sync === "conflict" || e.state.last_run?.status === "error").length;

  return (
    <div className="mx-auto max-w-8xl space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200/60 bg-white/80 p-4 backdrop-blur-xl dark:border-gray-800/30 dark:bg-gray-900/50 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Radio className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark md:text-2xl">Project monitor</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Students working in TMCode right now, in the courses you teach.</p>
          </div>
        </div>
        <LiveIndicator status={live.status} onRetry={live.reconnect} />
      </div>

      <section aria-label="Monitor summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Students online", value: students, icon: Users, accent: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300" },
          { label: "Projects open", value: openNow.length, icon: FileCode2, accent: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300" },
          { label: "With unsaved work", value: unsaved, icon: TriangleAlert, accent: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300" },
          { label: "Need attention", value: attention, icon: Play, accent: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-2xl border border-white bg-card-light p-4 dark:border-border-dark/30 dark:bg-card-dark/30">
            <div className="mb-2 flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/70">{label}</span>
            </div>
            {received ? (
              <p className="text-2xl font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark">{value}</p>
            ) : (
              <Skeleton className="h-7 w-10" />
            )}
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-2 rounded-2xl border border-gray-200/60 bg-white/80 p-3 backdrop-blur-xl dark:border-gray-800/30 dark:bg-gray-900/50 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search students, projects or files</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students, projects or files"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:text-text-primary-dark"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <span className="sr-only">Course</span>
            <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Select variant="outline"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            >
              <option value="">All courses</option>
              {courses.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
              <option value={NO_COURSE}>No course</option>
            </Select>
          </label>
          <Select variant="outline"
            aria-label="Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="">All languages</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {languageMeta(l)?.label ?? l}
              </option>
            ))}
          </Select>
          <div role="radiogroup" aria-label="Show" className="flex rounded-xl bg-gray-100 p-1 dark:bg-white/[0.04]">
            {(
              [
                ["open", "Open now"],
                ["unsaved", "Unsaved"],
                ["attention", "Attention"],
                ["all", "Last 30 min"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={stateFilter === value}
                onClick={() => setStateFilter(value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  stateFilter === value ? "bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!received ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700" data-testid="monitor-empty">
          <Radio className="h-7 w-7 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            {all.length ? "Nobody matches these filters" : "No student has a project open right now"}
          </p>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">Rows appear here as soon as a student opens a project in TMCode.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-label={g.label} className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
              <BookOpen className="h-4 w-4 text-slate-400" aria-hidden="true" />
              {g.label}
              <span className="text-xs font-medium text-slate-500">· {g.rows.length}</span>
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence initial={false}>
                {g.rows.map((e) => (
                  <MonitorCard key={entryKey(e)} entry={e} now={now} />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ))
      )}
    </div>
  );
};

const MonitorCard: React.FC<{ entry: MonitorEntry; now: number }> = ({ entry: e, now }) => {
  const isLive = isPresenceLive(e, now);
  const dirty = dirtyCount(e.state.dirty);
  const run = e.state.last_run;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: isLive ? 1 : 0.6, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl border border-gray-200/70 bg-card-light p-4 dark:border-border-dark/30 dark:bg-card-dark/30"
      data-testid="monitor-card"
    >
      <div className="flex items-start gap-3">
        <Avatar name={e.user?.name ?? "Student"} src={e.user?.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            {e.user?.name ?? `Student #${e.user_id}`}
            <LiveDot live={isLive} />
          </p>
          <Link to={`/projects/${e.project.id}`} className="block truncate text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
            {e.project.name}
          </Link>
        </div>
        <span className="whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">{isLive ? `seen ${timeAgo(e.last_seen_at, now)}` : `closed ${timeAgo(e.last_seen_at, now)}`}</span>
      </div>
      {e.state.file && (
        <p className="mt-2 flex items-center gap-1.5 truncate font-mono text-xs text-slate-600 dark:text-slate-300">
          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          {e.state.file}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <LanguageBadge language={e.project.language} />
        {dirty > 0 && <Pill tone="amber">{dirty} unsaved</Pill>}
        {e.state.branch && (
          <Pill tone="slate" icon={<GitBranch className="h-3 w-3" aria-hidden="true" />}>
            {e.state.branch}
            {e.state.ahead ? ` ↑${e.state.ahead}` : ""}
          </Pill>
        )}
        <SyncBadge sync={e.state.sync} />
        {run?.at && (
          <Pill tone={run.status === "error" ? "rose" : run.status === "running" ? "violet" : "emerald"} icon={<Play className="h-3 w-3" aria-hidden="true" />}>
            {run.status === "error" ? "Run failed" : run.status === "running" ? "Running" : "Ran"} {timeAgo(run.at, now)}
          </Pill>
        )}
        {e.device_name && <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">{e.device_name}</span>}
      </div>
    </motion.li>
  );
};

export default ProjectMonitorPage;
