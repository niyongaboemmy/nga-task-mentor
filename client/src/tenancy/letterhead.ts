import { useEffect } from "react";
import { preloadLetterhead, resetLetterhead, setLetterheadSource, type LetterheadSource } from "../utils/documentLetterhead";
import { loadSchoolInfo, type SchoolInfo } from "./useSchool";

/**
 * Ties the document letterhead (utils/documentLetterhead.ts, the same file as in MIS) to this
 * app: the signed-in school's header and footer come with GET /api/auth/school, which reads
 * them from MIS. Every printed page gets them through <PrintLetterhead />.
 */

/** What the letterhead reads from the school answer (the school's logo stands in for a missing Documents logo). */
export function letterheadSourceOf(school: SchoolInfo | null): LetterheadSource | null {
  if (!school) return null;
  const lh = school.letterhead ?? null;
  return {
    schoolName: school.name,
    headerUrl: lh?.headerUrl ?? null,
    fallbackLogoUrl: lh?.fallbackLogoUrl ?? school.logoUrl,
    footerUrl: lh?.footerUrl ?? null,
    footerText: lh?.footerText ?? null,
  };
}

/** Once, at app start. */
export function wireLetterhead(): void {
  setLetterheadSource(async () => letterheadSourceOf(await loadSchoolInfo()));
}

/**
 * Loads the letterhead once someone is signed in, and forgets it when the person (or their
 * school) changes or signs out. `who` is null when nobody is signed in.
 */
export function useLetterheadPreload(who: string | number | null | undefined): void {
  useEffect(() => {
    resetLetterhead();
    if (who != null) preloadLetterhead();
  }, [who]);
}
