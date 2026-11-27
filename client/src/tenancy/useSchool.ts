import { useEffect, useState } from "react";
import api from "../utils/axiosConfig";
import { currentIdentity } from "./storageKey";

/**
 * The signed-in person's school (name + logo for the header) and their other
 * schools (account menu "Switch school"), from GET /api/auth/school, which
 * asks MIS /tenant/branding and /auth/my-schools (plan Appendix A.4/A.5).
 * One request per school session, shared by every component that asks.
 */

export interface MySchool {
  tid: number;
  slug: string | null;
  name: string;
  logoUrl: string | null;
  current: boolean;
}

export interface SchoolInfo {
  tid: number;
  name: string | null;
  logoUrl: string | null;
  /** The school's document letterhead (see tenancy/letterhead.ts); absent on an older server. */
  letterhead?: { headerUrl: string | null; fallbackLogoUrl: string | null; footerUrl: string | null; footerText: string | null } | null;
  schools: MySchool[];
  canSwitch: boolean;
}

let cached: { key: string; promise: Promise<SchoolInfo | null> } | null = null;

export function loadSchoolInfo(): Promise<SchoolInfo | null> {
  const id = currentIdentity();
  const key = id ? `${id.tid}:${id.uid}` : "anon";
  if (!cached || cached.key !== key) {
    cached = {
      key,
      promise: api
        .get("/auth/school")
        .then((res) => (res.data?.data as SchoolInfo) ?? null)
        .catch(() => {
          cached = null; // try again on the next mount
          return null;
        }),
    };
  }
  return cached.promise;
}

export function useSchoolInfo(enabled = true): { school: SchoolInfo | null; loading: boolean } {
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(enabled);
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    void loadSchoolInfo().then((info) => {
      if (!live) return;
      setSchool(info);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [enabled]);
  return { school, loading };
}

/** Tests only. */
export function resetSchoolInfoForTests(): void {
  cached = null;
}
