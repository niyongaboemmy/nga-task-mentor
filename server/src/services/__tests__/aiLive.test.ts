import { aiLiveListenerCount, aiLiveWatching, lookAtPolicyForTests, publishAiChange, subscribeAiChanges, type AiChange } from "../aiLive";
import { resetAiPolicyCache, setAiPolicyForTests } from "../aiPolicy";
import { AI_POLICY_DEFAULT } from "../../vendor/nga-access";
import { primaryTenantCtx, runWithTenant } from "../../vendor/nga-tenancy";

/**
 * "AI settings changed" for TMCode's live line (services/aiLive.ts): item and access changes go
 * out at once; a policy change is noticed by watching MIS while anyone listens.
 */

const on = (v: number, extra: Record<string, unknown> = {}) => ({ ...AI_POLICY_DEFAULT, v, enabled: true, ...extra });

// Pinned before anyone subscribes: the watcher must never reach for the real MIS here.
beforeEach(() => setAiPolicyForTests(on(0)));
afterEach(() => resetAiPolicyCache());

describe("aiLive", () => {
  it("passes item and access changes to every listener until it unsubscribes", () => {
    const a: AiChange[] = [];
    const b: AiChange[] = [];
    const offA = subscribeAiChanges((c) => a.push(c));
    const offB = subscribeAiChanges((c) => b.push(c));
    publishAiChange({ cause: "item", kind: "quiz", id: 12 });
    offA();
    publishAiChange({ cause: "access" });
    offB();
    expect(a.map((c) => c.cause)).toEqual(["item"]);
    expect(a[0]).toMatchObject({ kind: "quiz", id: 12 });
    expect(typeof a[0].at).toBe("string");
    expect(b.map((c) => c.cause)).toEqual(["item", "access"]);
    expect(aiLiveListenerCount()).toBe(0);
  });

  it("announces a policy change seen at MIS, not an unchanged look", async () => {
    setAiPolicyForTests(on(1));
    const seen: AiChange[] = [];
    const off = subscribeAiChanges((c) => seen.push(c));
    await lookAtPolicyForTests(); // the first look only remembers
    await lookAtPolicyForTests();
    expect(seen).toEqual([]);
    setAiPolicyForTests(on(2, { assessments: "always_off" }));
    await lookAtPolicyForTests();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ cause: "policy", v: 2 });
    off();
  });

  it("announces MIS falling silent (no policy: AI off) as a change", async () => {
    setAiPolicyForTests(on(3));
    const seen: AiChange[] = [];
    const off = subscribeAiChanges((c) => seen.push(c));
    await lookAtPolicyForTests();
    setAiPolicyForTests(null);
    await lookAtPolicyForTests();
    expect(seen).toEqual([expect.objectContaining({ cause: "policy", v: null })]);
    off();
  });

  describe("per school (ids and listeners never cross tenants)", () => {
    const T2 = { ...primaryTenantCtx(), tid: 2, slug: "two", name: "Two", isPrimary: false };

    it("a change in school 2 reaches only school 2's listeners, stamped with its tid", () => {
      const one: AiChange[] = [];
      const two: AiChange[] = [];
      const offOne = subscribeAiChanges((c) => one.push(c));
      const offTwo = runWithTenant(T2, () => subscribeAiChanges((c) => two.push(c)));
      runWithTenant(T2, () => publishAiChange({ cause: "item", kind: "quiz", id: 12 }));
      expect(one).toEqual([]);
      expect(two).toEqual([expect.objectContaining({ cause: "item", id: 12, tid: 2 })]);
      publishAiChange({ cause: "access" });
      expect(one).toEqual([expect.objectContaining({ cause: "access", tid: 1 })]);
      expect(two).toHaveLength(1);
      // An explicit tid (code outside the request's context) goes to that school only.
      publishAiChange({ cause: "access" }, 2);
      expect(one).toHaveLength(1);
      expect(two).toHaveLength(2);
      expect(aiLiveListenerCount()).toBe(1);
      expect(aiLiveListenerCount(true)).toBe(2);
      offOne();
      expect(aiLiveWatching(1)).toBe(false);
      expect(aiLiveWatching(2)).toBe(true);
      offTwo();
      expect(aiLiveWatching(2)).toBe(false);
    });

    it("each school's watcher reads its own school's policy", async () => {
      setAiPolicyForTests(on(1));
      const seen: Array<number | undefined> = [];
      const offOne = subscribeAiChanges(() => seen.push(1));
      const offTwo = runWithTenant(T2, () => subscribeAiChanges(() => seen.push(2)));
      await lookAtPolicyForTests();
      await runWithTenant(T2, () => lookAtPolicyForTests());
      setAiPolicyForTests(on(2));
      await runWithTenant(T2, () => lookAtPolicyForTests());
      expect(seen).toEqual([2]);
      offOne();
      offTwo();
    });
  });
});
