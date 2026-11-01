import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, KeyRound, Search, Sparkles, Trash2, UserPlus } from "lucide-react";
import api from "../../utils/axiosConfig";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { Badge } from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PageHeader from "../../components/ui/PageHeader";

/**
 * Admin → AI: premium & own keys (AI_SETTINGS_MANAGE; GRADING_PREMIUM_CONTRACTS.md).
 * The free AI stays everyone's default. Here the school decides who may also use premium (paid)
 * models from the school's keys, how many premium requests a day, and whether people may bring
 * their own API keys (BYOK). Premium models come from the server's environment (read-only here).
 *   GET/PUT /api/admin/ai/settings, GET /api/admin/ai/entitlements,
 *   PUT/DELETE /api/admin/ai/entitlements/:userId, GET /api/admin/ai/users?q=
 */

interface PremiumModel {
  id: string;
  label: string;
  provider: string;
  providerLabel: string;
}

interface Settings {
  allow_byok: boolean;
  premium_default_limit: number;
  premium_models: PremiumModel[];
  premium_unavailable: { entry: string; reason: string }[];
  byok_providers: { id: string; label: string; suggested_models: string[] }[];
}

interface EntitledUser {
  user_id: number;
  name: string;
  email: string | null;
  role: string | null;
  /** The account is no longer active in NGA MIS (kept for history). */
  inactive?: boolean;
  premium: boolean;
  entitled: boolean;
  via: "role" | "grant" | null;
  daily_limit: number | null;
  effective_limit: number;
  used_today: number;
  note: string | null;
  granted_by: { id: number; name: string } | null;
  updated_at: string | null;
}

interface FoundUser {
  id: number;
  name: string;
  email: string;
  role: string | null;
  entitled: boolean;
}

const LIMITS = [10, 20, 50, 100, 200, 500];

const errorOf = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const card = "rounded-2xl border border-gray-200/70 bg-white p-5 dark:border-white/10 dark:bg-card-dark/40";
const h2 = "text-base font-semibold text-text-primary-light dark:text-text-primary-dark";
const muted = "text-sm text-text-secondary-light dark:text-text-secondary-dark";
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-text-primary-light placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-gray-900 dark:text-text-primary-dark dark:placeholder:text-gray-500";

/** The daily-limit picker: "Default (N)" or a number. */
const LimitSelect: React.FC<{ value: number | null; defaultLimit: number; onChange: (v: number | null) => void; label: string; disabled?: boolean }> = ({
  value,
  defaultLimit,
  onChange,
  label,
  disabled,
}) => {
  const options = [...new Set([...LIMITS, ...(value ? [value] : [])])].sort((a, b) => a - b);
  return (
    <Select aria-label={label} size="sm" value={value == null ? "" : String(value)} onValueChange={(v) => onChange(v ? Number(v) : null)} disabled={disabled}>
      <option value="">Default ({defaultLimit} a day)</option>
      {options.map((n) => (
        <option key={n} value={String(n)}>
          {n} a day
        </option>
      ))}
    </Select>
  );
};

const AiSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [users, setUsers] = useState<EntitledUser[] | null>(null);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [found, setFound] = useState<FoundUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<FoundUser | null>(null);
  const [newLimit, setNewLimit] = useState<number | null>(null);
  const [newNote, setNewNote] = useState("");
  const [revoking, setRevoking] = useState<EntitledUser | null>(null);
  const searchSeq = useRef(0);

  const load = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([api.get("/admin/ai/settings"), api.get("/admin/ai/entitlements")]);
      setSettings(s.data.data);
      setUsers(e.data.data.users);
      setRoles(e.data.data.roles_with_premium ?? []);
      setError(null);
    } catch (err) {
      setError(errorOf(err, "Couldn't load the AI settings."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // People search (Task Mentor accounts), debounced.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || picked) {
      setFound([]);
      return;
    }
    const seq = ++searchSeq.current;
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get("/admin/ai/users", { params: { q } });
        if (seq === searchSeq.current) setFound(res.data.data.users);
      } catch {
        if (seq === searchSeq.current) setFound([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [query, picked]);

  const toggleByok = async () => {
    if (!settings) return;
    setBusy("byok");
    try {
      const res = await api.put("/admin/ai/settings", { allow_byok: !settings.allow_byok });
      setSettings(res.data.data);
      setNotice(res.data.data.allow_byok ? "People can use their own API keys again." : "Own API keys are switched off.");
    } catch (err) {
      setError(errorOf(err, "Couldn't save the setting."));
    } finally {
      setBusy(null);
    }
  };

  const save = async (userId: number, body: { premium?: boolean; daily_limit?: number | null; note?: string | null }, done?: string) => {
    setBusy(`user-${userId}`);
    try {
      const res = await api.put(`/admin/ai/entitlements/${userId}`, body);
      const row: EntitledUser = res.data.data.user;
      setUsers((list) => [row, ...(list ?? []).filter((u) => u.user_id !== userId)]);
      if (done) setNotice(done);
      setError(null);
      return true;
    } catch (err) {
      setError(errorOf(err, "Couldn't save."));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const grant = async () => {
    if (!picked) return;
    const ok = await save(picked.id, { premium: true, daily_limit: newLimit, note: newNote.trim() || null }, `${picked.name} can now use premium AI.`);
    if (ok) {
      setPicked(null);
      setQuery("");
      setNewLimit(null);
      setNewNote("");
    }
  };

  const revoke = async (u: EntitledUser) => {
    setRevoking(null);
    setBusy(`user-${u.user_id}`);
    try {
      await api.delete(`/admin/ai/entitlements/${u.user_id}`);
      setUsers((list) => (list ?? []).filter((x) => x.user_id !== u.user_id));
      setNotice(u.via === "role" ? `${u.name}'s own grant was removed; their role still gives premium AI.` : `${u.name} no longer has premium AI.`);
    } catch (err) {
      setError(errorOf(err, "Couldn't revoke."));
    } finally {
      setBusy(null);
    }
  };

  const defaultLimit = settings?.premium_default_limit ?? 50;

  return (
    <div className="space-y-6" data-testid="ai-settings-page">
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "AI: premium & own keys" }]}
        title="AI: premium & own keys"
        icon={<Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />}
        description="Free AI stays everyone's default. Choose who may also use premium (paid) models on the school's keys, and whether people may use their own API keys."
      />

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" role="status">
          {notice}
        </p>
      )}

      {!settings && !error ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : settings ? (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className={card} aria-labelledby="ai-how">
              <h2 id="ai-how" className={h2}>
                How AI is chosen
              </h2>
              <ul className={`mt-3 space-y-2 ${muted}`}>
                <li>
                  <strong className="text-text-primary-light dark:text-text-primary-dark">Free</strong> is the default for everyone: free models only, within the school's daily free requests.
                </li>
                <li>
                  <strong className="text-text-primary-light dark:text-text-primary-dark">Premium</strong> uses the school's paid keys, only for the people below (or a role given "Use premium AI"), up to their daily limit.
                </li>
                <li>
                  <strong className="text-text-primary-light dark:text-text-primary-dark">Own keys</strong>: a person pastes their own API key in TMCode. It stays on their computer and is sent with each request only; Task Mentor never stores it.
                </li>
                <li>The school's AI policy (MIS → Settings → AI) and each activity's AI mode still apply to every tier.</li>
              </ul>
            </div>

            <div className={card} aria-labelledby="ai-byok">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="ai-byok" className={`${h2} flex items-center gap-2`}>
                    <KeyRound className="h-4 w-4" aria-hidden="true" /> Allow own API keys (BYOK)
                  </h2>
                  <p className={`mt-1 ${muted}`}>People allowed AI may use their own OpenAI, Anthropic, Gemini, OpenRouter, Groq or DeepSeek key in TMCode.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.allow_byok}
                  aria-label="Allow own API keys"
                  data-testid="byok-switch"
                  disabled={busy === "byok"}
                  onClick={() => void toggleByok()}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 ${
                    settings.allow_byok ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${settings.allow_byok ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">Premium models (set on the server)</h3>
                {settings.premium_models.length ? (
                  <ul className="mt-2 flex flex-wrap gap-2" data-testid="premium-models">
                    {settings.premium_models.map((m) => (
                      <li key={m.id}>
                        <Badge tone="info">
                          {m.providerLabel} · {m.label}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={`mt-1 ${muted}`}>None yet. Set TMCODE_AI_PREMIUM_MODELS and the provider keys on the server to offer premium AI.</p>
                )}
                {settings.premium_unavailable.length > 0 && (
                  <ul className={`mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300`}>
                    {settings.premium_unavailable.map((m) => (
                      <li key={m.entry}>
                        {m.entry}: {m.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className={card} aria-labelledby="ai-grant">
            <h2 id="ai-grant" className={`${h2} flex items-center gap-2`}>
              <UserPlus className="h-4 w-4" aria-hidden="true" /> Give premium AI to someone
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto] md:items-start">
              <div className="relative">
                <label className="sr-only" htmlFor="ai-user-search">
                  Search people
                </label>
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  id="ai-user-search"
                  className={`${input} pl-9`}
                  placeholder="Search by name or email"
                  value={picked ? `${picked.name} (${picked.email})` : query}
                  onChange={(e) => {
                    setPicked(null);
                    setQuery(e.target.value);
                  }}
                  autoComplete="off"
                />
                {!picked && (found.length > 0 || searching) && (
                  <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-gray-900" role="listbox">
                    {searching && !found.length && <li className={`px-3 py-2 ${muted}`}>Searching…</li>}
                    {found.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/5"
                          onClick={() => {
                            setPicked(u);
                            setFound([]);
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-text-primary-light dark:text-text-primary-dark">{u.name}</span>
                            <span className="block truncate text-xs text-text-secondary-light dark:text-text-secondary-dark">
                              {u.email}
                              {u.role ? ` · ${u.role}` : ""}
                            </span>
                          </span>
                          {u.entitled && <Badge tone="success">Premium</Badge>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <LimitSelect label="Daily premium limit" value={newLimit} defaultLimit={defaultLimit} onChange={setNewLimit} />
              <input className={input} placeholder="Note (optional), e.g. grading pilot" value={newNote} maxLength={500} onChange={(e) => setNewNote(e.target.value)} aria-label="Note" />
              <Button onClick={() => void grant()} disabled={!picked || !!busy} icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}>
                Give premium
              </Button>
            </div>
            <p className={`mt-2 ${muted}`}>Only people who have signed in to Task Mentor at least once can be found.</p>
          </section>

          <section className={card} aria-labelledby="ai-entitled">
            <h2 id="ai-entitled" className={h2}>
              People with their own premium setting
            </h2>
            {roles.length > 0 && (
              <p className={`mt-1 ${muted}`}>
                Roles with premium AI: {roles.map((r) => r.name).join(", ")} (Roles &amp; permissions → "Use premium AI").
              </p>
            )}
            {!users ? (
              <Skeleton className="mt-3 h-24 rounded-xl" />
            ) : users.length === 0 ? (
              <p className={`mt-3 ${muted}`}>Nobody yet. Everyone uses the free AI.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm" data-testid="entitled-users">
                  <thead className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Person</th>
                      <th className="py-2 pr-3 font-medium">Premium</th>
                      <th className="py-2 pr-3 font-medium">Daily limit</th>
                      <th className="py-2 pr-3 font-medium">Used today</th>
                      <th className="py-2 pr-3 font-medium">Note</th>
                      <th className="py-2 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {users.map((u) => (
                      <tr key={u.user_id} data-testid={`entitled-${u.user_id}`}>
                        <td className="py-2.5 pr-3">
                          <span className="block text-text-primary-light dark:text-text-primary-dark">
                            {u.name}
                            {u.inactive ? (
                              <span className="ml-2 align-middle">
                                <Badge tone="neutral">Inactive</Badge>
                              </span>
                            ) : null}
                          </span>
                          <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark">
                            {u.email}
                            {u.role ? ` · ${u.role}` : ""}
                            {u.granted_by ? ` · by ${u.granted_by.name}` : ""}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          {u.entitled ? <Badge tone="success">{u.via === "role" ? "Yes (role)" : "Yes"}</Badge> : <Badge tone="neutral">Off</Badge>}
                        </td>
                        <td className="py-2.5 pr-3">
                          <LimitSelect
                            label={`Daily premium limit for ${u.name}`}
                            value={u.daily_limit}
                            defaultLimit={defaultLimit}
                            disabled={busy === `user-${u.user_id}`}
                            onChange={(v) => void save(u.user_id, { premium: u.premium, daily_limit: v }, `Saved ${u.name}'s daily limit.`)}
                          />
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
                          {u.used_today} / {u.effective_limit}
                        </td>
                        <td className="max-w-[16rem] truncate py-2.5 pr-3 text-text-secondary-light dark:text-text-secondary-dark" title={u.note ?? undefined}>
                          {u.note || "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          <Button variant="ghost" size="sm" disabled={busy === `user-${u.user_id}`} onClick={() => setRevoking(u)} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <RequestCheckMetrics />

      <ConfirmDialog
        open={!!revoking}
        title="Revoke premium AI?"
        description={revoking ? `${revoking.name} goes back to the free AI${revoking.via === "role" ? " unless their role gives premium AI" : ""}. Open TMCode apps update right away.` : ""}
        confirmLabel="Revoke"
        danger
        onConfirm={() => revoking && void revoke(revoking)}
        onCancel={() => setRevoking(null)}
      />
    </div>
  );
};

type ArmMetrics = {
  users: number;
  questions: number;
  cards: number;
  coach: number;
  accept_rate: number | null;
  edit_rate: number | null;
  as_is_rate: number | null;
  ms_p50: number | null;
  ms_p95: number | null;
  completeness_mean: number | null;
  runs: number;
  run_pass_rate: number | null;
};

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const secs = (v: number | null) => (v === null ? "—" : `${(v / 1000).toFixed(1)} s`);

/**
 * TMCode's request check, measured (nga-tmcode reports/TMCode prompt interpreter layer.md, Q14):
 * the card arm against the holdout that never sees it, from the activity TMCode uploads. The
 * pre-registered primary metric is passing runs; acceptance alone means little without it.
 */
export const RequestCheckMetrics: React.FC = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{ arms: Record<string, ArmMetrics>; languages: Record<string, number>; stages: Record<string, number>; holdout_pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setError(null);
    api
      .get("/tmcode/ai/interpret/metrics", { params: { days } })
      .then((r) => live && setData(r.data))
      .catch((e) => live && setError(errorOf(e, "The request-check numbers couldn't load.")));
    return () => {
      live = false;
    };
  }, [days]);
  const arms = data ? (["card", "holdout"] as const).filter((a) => data.arms[a]) : [];
  return (
    <section className={card} aria-labelledby="ai-request-check" data-testid="request-check-metrics">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ai-request-check" className={`${h2} flex items-center gap-2`}>
          <Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" /> TMCode request check (A/B)
        </h2>
        <span className="flex-1" />
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-white/10" role="group" aria-label="Period">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d} className={`rounded-md px-2.5 py-1 text-xs font-medium ${days === d ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"}`} data-testid={`request-check-days-${d}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      <p className={`${muted} mt-1`}>
        Students in the card arm confirm what TMCode understood before the AI acts; {data ? `${data.holdout_pct}%` : "a share"} of students (the holdout) never see it. Compare passing runs and request completeness; acceptance alone means little.
      </p>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!data && !error && <Skeleton className="mt-3 h-24 w-full" />}
      {data && !arms.length && <p className={`${muted} mt-3`}>No request checks in this period yet.</p>}
      {data && !!arms.length && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" data-testid="request-check-table">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Arm</th>
                <th className="py-2 pr-3 text-right">Students</th>
                <th className="py-2 pr-3 text-right">Questions</th>
                <th className="py-2 pr-3 text-right">Cards</th>
                <th className="py-2 pr-3 text-right">Confirmed · edited · as typed</th>
                <th className="py-2 pr-3 text-right">Completeness</th>
                <th className="py-2 pr-3 text-right">Latency p50 / p95</th>
                <th className="py-2 text-right">Runs passing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {arms.map((a) => {
                const m = data.arms[a];
                return (
                  <tr key={a} data-testid={`request-check-arm-${a}`}>
                    <td className="py-2 pr-3">
                      <Badge tone={a === "card" ? "info" : "neutral"}>{a === "card" ? "Card" : "Holdout"}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.users}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.questions}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.cards + m.coach}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {pct(m.accept_rate)} · {pct(m.edit_rate)} · {pct(m.as_is_rate)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{pct(m.completeness_mean)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {secs(m.ms_p50)} / {secs(m.ms_p95)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{m.runs ? `${pct(m.run_pass_rate)} of ${m.runs}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!!Object.keys(data.languages).length && (
            <p className={`${muted} mt-2`}>
              Languages: {Object.entries(data.languages).map(([l, n]) => `${l} ${n}`).join(" · ")}
              {Object.keys(data.stages).length ? ` — stages: ${Object.entries(data.stages).map(([s, n]) => `${s} ${n}`).join(" · ")}` : ""}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default AiSettingsPage;
