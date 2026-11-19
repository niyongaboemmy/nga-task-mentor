import { allTenants } from "../tenancy/jobs";
import { publishDueCards } from "../controllers/reportCardWorkflow.controller";

/**
 * Scheduled report card releases: every minute, publish the approved cards
 * whose publish_at has passed, in every tenant database.
 */
const EVERY_MS = 60 * 1000;
let timer: NodeJS.Timeout | null = null;

export function startReportCardPublishSweep(): void {
  if (process.env.REPORT_CARD_PUBLISH_SWEEP === "off" || timer) return;
  const run = () =>
    void allTenants("report-card-publish", async () => {
      const n = await publishDueCards();
      if (n > 0) console.log(`[report-cards] published ${n} scheduled card(s)`);
    });
  timer = setInterval(run, EVERY_MS);
  timer.unref?.();
}

export function stopReportCardPublishSweep(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
