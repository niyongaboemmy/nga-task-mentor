import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertOctagon, AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";
import {
  getAlertsVersion,
  isImportant,
  isSeen,
  latestAlerts,
  markSeen,
  publishAlerts,
  subscribeAlerts,
  unreadImportant,
  visibleAlerts,
  type StoreAlert,
} from "../../services/alertStore";
import { LiveCountdown } from "../Common/LiveCountdown";

/**
 * Top-bar bell: the dashboard's notifications on every page, for teachers
 * (alerts) and students (reminders) alike; `loadAlerts` decides which. The
 * badge counts important alerts not yet seen; opening the bell marks what it
 * shows as seen. Polls while the tab is visible and also picks up the
 * dashboard's own refreshes through the shared alert store.
 */

const POLL_MS = 5 * 60 * 1000;

const ICON: Record<StoreAlert["severity"], React.ReactNode> = {
  critical: <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" aria-label="Urgent" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-label="Attention" />,
  info: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-label="FYI" />,
  success: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-label="Good news" />,
};

/** Which countdown wording a reminder uses, from its id prefix. */
const countdownKind = (id: string) =>
  id.startsWith("running-") ? "time_left" : id.startsWith("opens-") ? "opens" : "due";

const NotificationBell: React.FC<{
  loadAlerts: () => Promise<StoreAlert[]>;
  /** Poll interval; students get a shorter one because deadlines tick. */
  pollMs?: number;
}> = ({ loadAlerts, pollMs = POLL_MS }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useSyncExternalStore(subscribeAlerts, getAlertsVersion);

  const poll = useCallback(async () => {
    try {
      publishAlerts(await loadAlerts());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [loadAlerts]);

  useEffect(() => {
    if (!latestAlerts()) poll();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [poll, pollMs]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const all = latestAlerts() ?? [];
  // "All clear" is a dashboard message, not a notification.
  const alerts = visibleAlerts(all).filter((a) => a.id !== "all-clear");
  const unread = unreadImportant(all);
  const urgent = unread.some((a) => a.severity === "critical");

  // Tab title shows unread important count, e.g. "(3) TaskMentor".
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread.length > 0 ? `(${unread.length}) ${base}` : base;
  }, [unread.length]);

  const toggle = () => {
    setOpen((wasOpen) => {
      // Mark on close, so the "New" chips stay visible while the panel is open.
      if (wasOpen) markSeen(alerts);
      return !wasOpen;
    });
  };

  const go = (a: StoreAlert) => {
    if (!a.action) return;
    markSeen(alerts);
    setOpen(false);
    navigate(a.action.url.startsWith("#") ? `/dashboard${a.action.url}` : a.action.url);
  };

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={toggle}
        aria-label={unread.length > 0 ? `Notifications, ${unread.length} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative p-2 rounded-xl text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread.length > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-[18px] text-center text-white ring-2 ring-white dark:ring-gray-900 ${
              urgent ? "bg-red-600 animate-pulse" : "bg-amber-500"
            }`}
          >
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </motion.button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-border-light dark:border-gray-700/40 z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-light dark:border-gray-700/40">
            <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Notifications</p>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => markSeen(alerts)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
            {alerts.length === 0 ? (
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark px-3 py-6 text-center">
                {failed ? "Couldn't load notifications." : "You're all caught up."}
              </p>
            ) : (
              alerts.map((a) => {
                const fresh = isImportant(a) && !isSeen(a);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => go(a)}
                    disabled={!a.action}
                    className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      fresh ? "bg-blue-50/70 dark:bg-blue-900/15" : ""
                    } ${a.action ? "hover:bg-surface-light dark:hover:bg-surface-dark" : "cursor-default"}`}
                  >
                    <span className="mt-0.5 shrink-0">{ICON[a.severity]}</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{a.title}</span>
                        {fresh && (
                          <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-600 text-white">New</span>
                        )}
                      </span>
                      <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark line-clamp-2">{a.message}</span>
                      {a.countdown_to && (
                        <span className="block mt-1">
                          <LiveCountdown to={a.countdown_to} kind={countdownKind(a.id)} compact />
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <Link
            to="/dashboard"
            onClick={() => {
              markSeen(alerts);
              setOpen(false);
            }}
            className="block text-center text-sm font-medium text-blue-600 dark:text-blue-400 px-4 py-2.5 border-t border-border-light dark:border-gray-700/40 hover:bg-surface-light dark:hover:bg-surface-dark"
          >
            Open dashboard
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
