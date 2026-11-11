import { __setMisPermissionsFetcher, hasExternalConnect } from "../aiHandoff";
import { primaryTenantCtx, runWithTenant } from "../../vendor/nga-tenancy";

// MIS user ids repeat across schools: school 1's MIS user 7 holding
// AI_EXTERNAL_CONNECT must not grant it to school 2's MIS user 7.
describe("aiHandoff MIS permission cache is tenant-keyed", () => {
  afterEach(() => __setMisPermissionsFetcher(null));
  const T2 = { ...primaryTenantCtx(), tid: 2, slug: "two", name: "Two", isPrimary: false };
  const req = (token: string) =>
    ({ cookies: { misToken: token }, headers: {}, user: { id: 1, mis_user_id: 7, role: "teacher" } }) as any;

  it("does not reuse another school's cached permissions for the same MIS user id", async () => {
    const fetcher = jest.fn(async (token: string) => (token === "school-1" ? ["AI_EXTERNAL_CONNECT"] : []));
    __setMisPermissionsFetcher(fetcher);
    expect(await runWithTenant(primaryTenantCtx(), () => hasExternalConnect(req("school-1")))).toBe(true);
    expect(await runWithTenant(T2, () => hasExternalConnect(req("school-2")))).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
    // Same school, same user: served from the cache.
    expect(await runWithTenant(primaryTenantCtx(), () => hasExternalConnect(req("school-1")))).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
