import { MONITOR_TOPIC, projectsBus, projectTopic } from "./bus";
import { presenceStaleMs } from "./limits";
import { PresenceJson, UserBrief } from "./serialize";

/**
 * Presence fan-out. Every heartbeat goes to the project's stream and to the
 * monitor stream (with the project's course ids, so each monitor subscriber
 * can filter by its own scope). Devices that stop sending heartbeats are
 * announced offline once they go stale (60 s): a sweep runs every 10 s while
 * anything is being tracked, so a crashed TMCode doesn't stay "live" forever.
 */

export interface MonitorProject {
  id: number;
  name: string;
  kind: string;
  language: string | null;
  owner: UserBrief | null;
}

export interface MonitorEntry {
  project: MonitorProject;
  course_ids: number[];
  presence: PresenceJson;
}

const tracked = new Map<string, MonitorEntry>();
let sweeper: NodeJS.Timeout | null = null;

const keyOf = (e: PresenceJson) => `${e.project_id}:${e.user_id}:${e.device_id}`;

export function publishPresence(project: MonitorProject, courseIds: number[], entry: PresenceJson) {
  projectsBus.publish(projectTopic(project.id), "presence", entry);
  const monitorEntry: MonitorEntry = { project, course_ids: courseIds, presence: entry };
  projectsBus.publish(MONITOR_TOPIC, "presence", monitorEntry);
  if (entry.online) tracked.set(keyOf(entry), monitorEntry);
  else tracked.delete(keyOf(entry));
  if (tracked.size > 0 && !sweeper) {
    sweeper = setInterval(() => sweepPresence(), 10_000);
    (sweeper as any).unref?.();
  }
}

/** Announce stale devices offline; returns how many. */
export function sweepPresence(now = Date.now()): number {
  let n = 0;
  for (const [key, e] of tracked) {
    const seen = e.presence.last_seen_at ? new Date(e.presence.last_seen_at).getTime() : 0;
    if (now - seen < presenceStaleMs()) continue;
    tracked.delete(key);
    const offline = { ...e.presence, online: false };
    projectsBus.publish(projectTopic(e.project.id), "presence", offline);
    projectsBus.publish(MONITOR_TOPIC, "presence", { ...e, presence: offline });
    n++;
  }
  if (tracked.size === 0 && sweeper) {
    clearInterval(sweeper);
    sweeper = null;
  }
  return n;
}

/** Tests only. */
export function resetPresenceTracking() {
  tracked.clear();
  if (sweeper) clearInterval(sweeper);
  sweeper = null;
}
