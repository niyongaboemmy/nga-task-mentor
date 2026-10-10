import type { MyTmcodeSession } from "../services/practicalsApi";

/**
 * The web quiz page's warning before a web submit while the attempt is open
 * in TMCode (UX gap review E10). null: nothing to warn about.
 */
export function tmcodeSubmitWarning(session: MyTmcodeSession | null | undefined, locale?: string): string | null {
  if (!session || session.status === "submitted") return null;
  const saved = session.last_saved_at
    ? `last saved ${new Date(session.last_saved_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`
    : "nothing saved from TMCode yet";
  const where = session.active ? "Coding questions are open in TMCode" : "Coding questions were opened in TMCode (not connected now)";
  return `${where}: ${saved}. Submitting here ends the attempt for TMCode too: work it hasn't saved yet is lost. Save in TMCode first, or submit from TMCode.`;
}
