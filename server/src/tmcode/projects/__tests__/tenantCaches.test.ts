import { primaryTenantCtx, runWithTenant } from "../../../vendor/nga-tenancy";
import { clearManifestCache, gzipManifest, readManifest } from "../storage";

// Revision ids repeat across school databases: school 2's revision 5 must
// never be answered from school 1's cached manifest for revision 5.
describe("manifest cache is tenant-keyed", () => {
  afterEach(() => clearManifestCache());
  const T2 = { ...primaryTenantCtx(), tid: 2, slug: "two", name: "Two", isPrimary: false };

  it("keeps the same revision id apart per school", () => {
    const one = [{ path: "a.txt", sha256: "1".repeat(64), size: 1 }];
    const two = [{ path: "secret.txt", sha256: "2".repeat(64), size: 2 }];
    expect(readManifest({ id: 5, manifest_gz: gzipManifest(one) } as any)).toEqual(one);
    expect(runWithTenant(T2, () => readManifest({ id: 5, manifest_gz: gzipManifest(two) } as any))).toEqual(two);
    // Both cached: each school still reads its own.
    expect(readManifest({ id: 5, manifest_gz: gzipManifest(two) } as any)).toEqual(one);
    expect(runWithTenant(T2, () => readManifest({ id: 5, manifest_gz: gzipManifest(one) } as any))).toEqual(two);
  });
});
