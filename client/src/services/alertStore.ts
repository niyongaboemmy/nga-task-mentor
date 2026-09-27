/**
 * Shared client state for dashboard notifications (the teacher's alerts and
 * the student's reminders), used by both the dashboard panel and the top-bar
 * bell:
 *   - the latest *unfocused* alert list (so the bell updates the moment the
 *     dashboard refreshes, without a second request),
 *   - which alerts the teacher has already seen (drives the unread badge and
 *     the "New" chip),
 *   - which alerts were dismissed today.
 *
 * Seen/dismissed are keyed by a signature of id + title, so an alert that
 * changes ("3 to grade" -> "12 to grade") counts as new again rather than
 * staying hidden because an earlier version was dismissed.
 */

export interface StoreAlert {
  id: string;
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  subject_id?: number | null;
  action?: { label: string; url: string };
  /** Live countdown target shown next to the alert. */
  countdown_to?: string | null;
  /** Overrides the default "urgent or attention = badge-worthy" rule. */
  notify?: boolean;
}

const SEEN_KEY = "tm.alerts.seen";
const DISMISS_KEY = "tm.alerts.dismissed";
const SEEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const alertSignature = (a: Pick<StoreAlert, "id" | "title">) => `${a.id}|${a.title}`;
export const isImportant = (a: StoreAlert) => a.notify ?? (a.severity === "critical" || a.severity === "warning");

function read(key: string): Record<string, number | string> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}
function write(key: string, value: Record<string, number | string>) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: state lasts for this page view only */
  }
}

let memSeen: Record<string, number> | null = null;
let memDismissed: Record<string, string> | null = null;

function seenMap(): Record<string, number> {
  if (!memSeen) {
    const now = Date.now();
    memSeen = Object.fromEntries(
      Object.entries(read(SEEN_KEY)).filter(([, at]) => typeof at === "number" && now - at < SEEN_TTL_MS),
    ) as Record<string, number>;
  }
  return memSeen;
}
function dismissedMap(): Record<string, string> {
  if (!memDismissed) {
    const today = new Date().toDateString();
    // Dismissals last for the day, so a problem that persists comes back.
    memDismissed = Object.fromEntries(
      Object.entries(read(DISMISS_KEY)).filter(([, day]) => day === today),
    ) as Record<string, string>;
  }
  return memDismissed;
}

export const isSeen = (a: StoreAlert) => alertSignature(a) in seenMap();
export const isDismissed = (a: StoreAlert) => alertSignature(a) in dismissedMap();

export function markSeen(alerts: StoreAlert[]) {
  const seen = seenMap();
  let changed = false;
  for (const a of alerts) {
    const sig = alertSignature(a);
    if (!(sig in seen)) {
      seen[sig] = Date.now();
      changed = true;
    }
  }
  if (changed) {
    write(SEEN_KEY, seen);
    emit();
  }
}

export function dismissAlert(a: StoreAlert) {
  const d = dismissedMap();
  d[alertSignature(a)] = new Date().toDateString();
  write(DISMISS_KEY, d);
  markSeen([a]);
  emit();
}

/** Alerts still worth showing: not dismissed today. */
export const visibleAlerts = (alerts: StoreAlert[]) => alerts.filter((a) => !isDismissed(a));
/** Important alerts the teacher hasn't looked at yet. */
export const unreadImportant = (alerts: StoreAlert[]) =>
  visibleAlerts(alerts).filter((a) => isImportant(a) && !isSeen(a));

// ─── Latest overview pub/sub ──────────────────────────────────────────────────

let latest: StoreAlert[] | null = null;
let storeVersion = 0;
const listeners = new Set<() => void>();
function emit() {
  storeVersion++;
  for (const fn of listeners) fn();
}
/** Snapshot for useSyncExternalStore: changes whenever anything above does. */
export const getAlertsVersion = () => storeVersion;

export function publishAlerts(alerts: StoreAlert[]) {
  latest = alerts;
  emit();
}
/** null until a dashboard or the bell has loaded alerts at least once. */
export const latestAlerts = () => latest;
export function subscribeAlerts(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Test hook. */
export function resetAlertState() {
  latest = null;
  memSeen = null;
  memDismissed = null;
  listeners.clear();
}
