import { busTid, monitorTopic, projectsBus, projectTopic } from "./bus";
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
  /** The school the project belongs to; monitor subscribers drop any other tid. */
  tid?: number;
  project: MonitorProject;
  course_ids: number[];
  presence: PresenceJson;
  /** The owner stopped sharing live status: monitors drop the row at once. */
  withdrawn?: boolean;
}

const tracked = new Map<string, MonitorEntry>();
let sweeper: NodeJS.Timeout | null = null;

// Project/user ids repeat across schools: the tracked key carries the tenant,
// and the stale sweep (a timer, outside any request) publishes to the entry's
// own tenant's topics.
const keyOf = (tid: number, e: PresenceJson) => `t${tid}:${e.project_id}:${e.user_id}:${e.device_id}`;

/**
 * `shared` false (the owner turned "Share live status" off): the heartbeat
 * still reaches the project's own stream (the owner's other devices; the
 * stream itself hides it from teachers) but never the monitor.
 */
export function publishPresence(project: MonitorProject, courseIds: number[], entry: PresenceJson, shared = true) {
  const tid = busTid();
  projectsBus.publish(projectTopic(project.id, tid), "presence", entry);
  if (!shared) {
    withdrawPresence(project.id, tid);
    return;
  }
  const monitorEntry: MonitorEntry = { tid, project, course_ids: courseIds, presence: entry };
  projectsBus.publish(monitorTopic(tid), "presence", monitorEntry);
  if (entry.online) tracked.set(keyOf(tid, entry), monitorEntry);
  else tracked.delete(keyOf(tid, entry));
  if (tracked.size > 0 && !sweeper) {
    sweeper = setInterval(() => sweepPresence(), 10_000);
    (sweeper as any).unref?.();
  }
}

/**
 * Take a project off the monitors (sharing turned off): every device still
 * tracked as online is announced offline on the monitor stream only.
 */
export function withdrawPresence(projectId: number, tid: number = busTid()): number {
  let n = 0;
  for (const [key, e] of tracked) {
    if (e.project.id !== projectId || e.tid !== tid) continue;
    tracked.delete(key);
    projectsBus.publish(monitorTopic(tid), "presence", { ...e, presence: { ...e.presence, online: false }, withdrawn: true });
    n++;
  }
  return n;
}

/** Announce stale devices offline; returns how many. */
export function sweepPresence(now = Date.now()): number {
  let n = 0;
  for (const [key, e] of tracked) {
    const seen = e.presence.last_seen_at ? new Date(e.presence.last_seen_at).getTime() : 0;
    if (now - seen < presenceStaleMs()) continue;
    tracked.delete(key);
    const offline = { ...e.presence, online: false };
    projectsBus.publish(projectTopic(e.project.id, e.tid), "presence", offline);
    projectsBus.publish(monitorTopic(e.tid), "presence", { ...e, presence: offline });
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
