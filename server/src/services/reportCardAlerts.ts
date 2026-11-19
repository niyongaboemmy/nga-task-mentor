import { Request } from "express";
import { Op } from "sequelize";
import { ReportCard } from "../models/ReportCard.model";
import { ReportCycle, ReportCycleSubjectSignoff } from "../models/ReportCardWorkflow.model";
import { resolveCurrentAcademicPeriodNames } from "../utils/misUtils";
import type { DashboardAlert } from "./instructorOverview.service";
import type { StudentReminder } from "./studentOverview.service";

/**
 * Report card notices for the top-bar bell (it shows the dashboard's alerts
 * for staff and reminders for students):
 *  - students: "your report card is out" for 21 days after it is published;
 *  - approvers: cards waiting for approval; publishers: approved, not released;
 *  - subject teachers: their submitted marks returned with a reason.
 * Best effort: a failure here never costs the dashboard.
 */

const FRESH_DAYS = 21;
export const REPORT_CARD_PAGE = "/report-cards";

export async function studentReportCardReminders(userId: number, misUserId: number | null): Promise<StudentReminder[]> {
  try {
    const ids = [userId, ...(misUserId != null ? [misUserId] : [])];
    const since = new Date(Date.now() - FRESH_DAYS * 86_400_000);
    const cards = await ReportCard.findAll({
      where: { student_id: { [Op.in]: ids }, status: "published", published_at: { [Op.gte]: since } },
      order: [["published_at", "DESC"]],
      limit: 3,
    });
    return cards.map((c) => ({
      id: `report-card-${c.id}-v${c.version}`,
      severity: "info" as const,
      title: "Your report card is out",
      message: `Your ${c.term} ${c.academic_year} report card has been published.`,
      countdown_to: null,
      subject_id: null,
      action: { label: "View report card", url: "/dashboard#report-card" },
    }));
  } catch (e: any) {
    console.warn("studentReportCardReminders:", e?.message ?? e);
    return [];
  }
}

export async function staffReportCardAlerts(req: Request): Promise<DashboardAlert[]> {
  try {
    const perms: Set<string> = (req as any).user?.permissions ?? new Set();
    const userId = (req as any).user?.id ?? null;
    const period = await resolveCurrentAcademicPeriodNames(req).catch(() => ({ term: null, academicYear: null }) as any);
    const out: DashboardAlert[] = [];
    const where = period.term && period.academicYear ? { term: period.term, academic_year: period.academicYear } : {};
    if (perms.has("REPORT_CARDS_APPROVE")) {
      const n = await ReportCard.count({ where: { ...where, status: "reviewed" } });
      if (n > 0) {
        out.push({
          id: `report-cards-to-approve-${n}`,
          severity: "warning",
          title: `${n} report card${n === 1 ? "" : "s"} waiting for approval`,
          message: "Reviewed by the class teacher and ready for your approval.",
          subject_id: null,
          action: { label: "Open workbench", url: `${REPORT_CARD_PAGE}?status=reviewed` },
        });
      }
    }
    if (perms.has("REPORT_CARDS_PUBLISH")) {
      const n = await ReportCard.count({ where: { ...where, status: "approved", publish_at: { [Op.is]: null } as any } });
      if (n > 0) {
        out.push({
          id: `report-cards-to-publish-${n}`,
          severity: "info",
          title: `${n} approved report card${n === 1 ? "" : "s"} not yet published`,
          message: "Students can't see them until they are published.",
          subject_id: null,
          action: { label: "Open workbench", url: `${REPORT_CARD_PAGE}?status=approved` },
        });
      }
    }
    if (userId) {
      const returned = await ReportCycleSubjectSignoff.findAll({
        where: { submitted_by: userId, status: "open", returned_reason: { [Op.ne]: null } },
        limit: 5,
      });
      const cycles = returned.length
        ? await ReportCycle.findAll({ where: { id: { [Op.in]: returned.map((r) => r.cycle_id) } } })
        : [];
      for (const r of returned) {
        const cycle = cycles.find((c) => c.id === r.cycle_id);
        if (!cycle || (period.term && cycle.term !== period.term)) continue;
        out.push({
          id: `report-marks-returned-${r.id}-${new Date(r.updatedAt as any).getTime()}`,
          severity: "warning",
          title: `Marks returned for ${cycle.class_name ?? `class ${cycle.class_group_id}`}`,
          message: r.returned_reason ?? "Please check and submit again.",
          subject_id: r.subject_id,
          action: {
            label: "Open workbench",
            url: `${REPORT_CARD_PAGE}/${cycle.class_group_id}?term=${encodeURIComponent(cycle.term)}&year=${encodeURIComponent(cycle.academic_year)}`,
          },
        });
      }
    }
    return out;
  } catch (e: any) {
    console.warn("staffReportCardAlerts:", e?.message ?? e);
    return [];
  }
}
