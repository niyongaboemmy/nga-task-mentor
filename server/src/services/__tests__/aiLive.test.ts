import { aiLiveListenerCount, lookAtPolicyForTests, publishAiChange, subscribeAiChanges, type AiChange } from "../aiLive";
import { resetAiPolicyCache, setAiPolicyForTests } from "../aiPolicy";
import { AI_POLICY_DEFAULT } from "../../vendor/nga-access";

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
});
