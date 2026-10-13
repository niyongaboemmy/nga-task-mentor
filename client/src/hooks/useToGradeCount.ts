import { useEffect, useState } from "react";
import { fetchGradingInbox } from "../services/gradingInboxApi";

const REFRESH_MS = 120_000;

/** How many submissions wait to be graded (the "To grade" menu badge); null while unknown. */
export function useToGradeCount(enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () =>
      fetchGradingInbox()
        .then((d) => !cancelled && setCount(d.total_to_grade))
        .catch(() => undefined);
    void load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [enabled]);
  return count;
}
