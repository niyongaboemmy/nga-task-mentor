import { pendingCompetencyKeys, queueCompetencyPush, resetCompetencyQueuesForTests } from "../competencyEvidence";
import { setReminderTransport } from "../reminderSync";
import { primaryTenantCtx, runWithTenant } from "../../vendor/nga-tenancy";

// Task ids repeat across school databases: school 2's quiz 5 must be pushed
// from school 2's database by school 2's own (debounced) flush, never ride
// along in school 1's.
describe("competency push queue is per school", () => {
  const ENV = { ...process.env };
  const T2 = { ...primaryTenantCtx(), tid: 2, slug: "two", name: "Two", isPrimary: false };
  beforeEach(() => {
    process.env.NGA_MIS_BASE_URL = process.env.NGA_MIS_BASE_URL || "http://mis.test";
    process.env.SSO_CLIENT_ID = process.env.SSO_CLIENT_ID || "id";
    process.env.SSO_CLIENT_SECRET = process.env.SSO_CLIENT_SECRET || "secret";
    delete process.env.COMPETENCY_PUSH;
    setReminderTransport(async () => ({ status: 200, body: {} }) as any);
  });
  afterEach(() => {
    resetCompetencyQueuesForTests();
    setReminderTransport(null);
    process.env = { ...ENV };
  });

  it("keeps the same task id apart per school", () => {
    queueCompetencyPush({ type: "quiz", id: 5 });
    runWithTenant(T2, () => queueCompetencyPush({ type: "quiz", id: 5 }));
    runWithTenant(T2, () => queueCompetencyPush({ type: "assignment", id: 8 }));
    expect(pendingCompetencyKeys()).toEqual(["quiz:5"]);
    expect(runWithTenant(T2, () => pendingCompetencyKeys())).toEqual(["quiz:5", "assignment:8"]);
  });
});
