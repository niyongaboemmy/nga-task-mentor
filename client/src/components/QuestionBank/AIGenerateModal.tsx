import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileUp,
  Library,
  Loader2,
  Plus,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";
import ConfirmDialog from "../ui/ConfirmDialog";
import { QuestionBankApiService } from "../../services/quizApi";
import {
  AIQuestionGenerationApi,
  aiErrorMessage,
  type AIPreparedContext,
  type AIProviderInfo,
  type AIProviderName,
  type AISourceItem,
  type AISourcesResponse,
} from "../../services/aiQuestionGenerationApi";
import type { QuestionType } from "../../types/quiz.types";
import SourcePicker from "./ai/SourcePicker";
import DocumentDropzone from "./ai/DocumentDropzone";
import PlanBuilder from "./ai/PlanBuilder";
import PromptComposer from "./ai/PromptComposer";
import ProviderPicker from "./ai/ProviderPicker";
import GenerationProgress from "./ai/GenerationProgress";
import AIReviewList, { LinkToggle, type ReviewQuestion } from "./ai/AIReviewList";
import { runGeneration, type BatchState } from "./ai/runGeneration";
import StepIndicator from "./ai/StepIndicator";
import {
  MAX_TOTAL,
  DIFFICULTIES,
  buildPlan,
  estimateSeconds,
  formatDuration,
  linkedSchemeEntry,
  planByDifficulty,
  planTotal,
  sourceKey,
  splitIntoBatches,
  suggestPrompts,
  type Mix,
} from "./ai/aiGeneratorModel";

type Stage = "setup" | "working" | "review" | "saved";
type SourceTab = "resources" | "document";

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  onSuccess: () => void;
}

// Per-viewer convenience only: the last settings used, so a teacher running the
// generator several times doesn't redo them. Safe to lose.
const PREFS_KEY = "tm.aiGenerator.prefs.v1";
interface Prefs {
  tab: SourceTab;
  types: QuestionType[];
  mode: "uniform" | "custom";
  uniform: Mix;
  provider: AIProviderName | null;
}
const DEFAULT_PREFS: Prefs = {
  tab: "resources",
  types: ["single_choice", "multiple_choice"],
  mode: "uniform",
  uniform: { EASY: 1, MEDIUM: 1, DIFFICULT: 0 },
  provider: null,
};
function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}
function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — fine */
  }
}

let uidSeq = 0;
const nextUid = () => `ai-${Date.now().toString(36)}-${uidSeq++}`;

const AIGenerateModal: React.FC<AIGenerateModalProps> = ({ isOpen, onClose, courseId, onSuccess }) => {
  const initial = useMemo(loadPrefs, []);
  const [stage, setStage] = useState<Stage>("setup");
  const [tab, setTab] = useState<SourceTab>(initial.tab);

  // Sources
  const [sources, setSources] = useState<AISourcesResponse | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [classGroupId, setClassGroupId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Map<string, AISourceItem>>(new Map());
  const [file, setFile] = useState<File | null>(null);

  // Plan
  const [types, setTypes] = useState<QuestionType[]>(initial.types);
  const [mode, setMode] = useState<"uniform" | "custom">(initial.mode);
  const [uniform, setUniform] = useState<Mix>(initial.uniform);
  const [perType, setPerType] = useState<Partial<Record<QuestionType, Mix>>>({});
  const [instructions, setInstructions] = useState("");
  const [providers, setProviders] = useState<AIProviderInfo[] | null>(null);
  const [provider, setProvider] = useState<AIProviderName | null>(initial.provider);

  // Run
  const [prepared, setPrepared] = useState<{ signature: string; ctx: AIPreparedContext } | null>(null);
  const [phase, setPhase] = useState<"preparing" | "generating">("preparing");
  const [batches, setBatches] = useState<BatchState[]>([]);
  const [latest, setLatest] = useState<{ text: string; difficulty: string; type: string }[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Review / save
  const [review, setReview] = useState<ReviewQuestion[]>([]);
  const [linkEntry, setLinkEntry] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showSource, setShowSource] = useState(false);

  const plan = useMemo(() => buildPlan(types, mode, uniform, perType), [types, mode, uniform, perType]);
  const total = planTotal(plan);
  const batchPlan = useMemo(() => splitIntoBatches(plan), [plan]);
  const selectedItems = useMemo(() => [...selected.values()], [selected]);
  const weekEntries = useMemo(() => sources?.groups.find((g) => g.key === "weeks")?.items ?? [], [sources]);
  const link = tab === "resources" ? linkedSchemeEntry(selectedItems, weekEntries) : null;

  const signature =
    tab === "document"
      ? file
        ? `doc:${file.name}:${file.size}:${file.lastModified}`
        : ""
      : selected.size
        ? `res:${classGroupId}:${[...selected.keys()].sort().join(",")}`
        : "";

  const suggestions = useMemo(
    () =>
      suggestPrompts({
        origin: tab === "document" ? "document" : "resources",
        sourceTitles: tab === "document" ? (file ? [file.name.replace(/\.(pdf|docx)$/i, "")] : []) : selectedItems.map((s) => s.title),
        weeks: tab === "document" ? [] : selectedItems.map((s) => s.week || "").filter(Boolean),
        types,
        hasDifficult: plan.some((p) => p.DIFFICULT > 0),
      }),
    [tab, file, selectedItems, types, plan],
  );

  const blockers: string[] = [];
  if (tab === "resources" && !selected.size) blockers.push("Pick at least one resource");
  if (tab === "document" && !file) blockers.push("Upload a PDF or DOCX");
  if (!types.length) blockers.push("Choose a question type");
  else if (!total) blockers.push("Set how many questions");
  if (total > MAX_TOTAL) blockers.push(`At most ${MAX_TOTAL} questions per run`);
  if (providers && !providers.some((p) => p.configured)) blockers.push("No AI engine configured");
  const canGenerate = blockers.length === 0;

  // ---------------------------------------------------------------- loading

  const loadSources = useCallback(
    async (cg?: number | null) => {
      setSourcesLoading(true);
      setSourcesError(null);
      try {
        const data = await AIQuestionGenerationApi.sources(courseId, cg ? { class_group_id: cg } : {});
        setSources(data);
        setClassGroupId(data.scope.class_group_id);
      } catch (err) {
        setSourcesError(aiErrorMessage(err, "Couldn't load this subject's resources from the MIS."));
      } finally {
        setSourcesLoading(false);
      }
    },
    [courseId],
  );

  useEffect(() => {
    if (!isOpen) return;
    AIQuestionGenerationApi.providers(courseId)
      .then((d) => setProviders(d.providers))
      .catch(() => setProviders(null));
  }, [isOpen, courseId]);

  useEffect(() => {
    if (isOpen && tab === "resources" && !sources && !sourcesLoading && !sourcesError) loadSources();
  }, [isOpen, tab, sources, sourcesLoading, sourcesError, loadSources]);

  useEffect(() => {
    savePrefs({ tab, types, mode, uniform, provider });
  }, [tab, types, mode, uniform, provider]);

  // ---------------------------------------------------------------- source selection

  const toggleSource = (item: AISourceItem) =>
    setSelected((prev) => {
      const next = new Map(prev);
      const k = sourceKey(item);
      if (next.has(k)) next.delete(k);
      else if (next.size >= 25) toast.warn("You can pick up to 25 resources at a time.");
      else next.set(k, item);
      return next;
    });
  const setMany = (items: AISourceItem[], on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const it of items) {
        if (on && next.size >= 25) {
          toast.warn("You can pick up to 25 resources at a time.");
          break;
        }
        if (on) next.set(sourceKey(it), it);
        else next.delete(sourceKey(it));
      }
      return next;
    });

  // ---------------------------------------------------------------- generation

  const prepare = async (signal: AbortSignal): Promise<AIPreparedContext> => {
    const ctx =
      tab === "document"
        ? await AIQuestionGenerationApi.prepareDocument(courseId, file!, signal)
        : await AIQuestionGenerationApi.prepareResources(
            courseId,
            { sources: selectedItems.map((s) => ({ kind: s.kind, id: s.id })), class_group_id: classGroupId ?? undefined },
            signal,
          );
    setPrepared({ signature, ctx });
    if (ctx.missing?.length) {
      toast.warn(`${ctx.missing.length} resource${ctx.missing.length === 1 ? "" : "s"} couldn't be read and ${ctx.missing.length === 1 ? "was" : "were"} left out: ${ctx.missing.map((m) => m.reason).join("; ")}`);
    }
    if (ctx.truncated) toast.info("The source is long — the AI reads a shortened version of each part.");
    return ctx;
  };

  const handleGenerate = async () => {
    if (!canGenerate || stage === "working") return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunError(null);
    setCancelling(false);
    setBatches([]);
    setLatest([]);
    setStartedAt(Date.now());
    setStage("working");

    let contextId: string;
    try {
      if (prepared && prepared.signature === signature) {
        contextId = prepared.ctx.context_id;
      } else {
        setPhase("preparing");
        contextId = (await prepare(controller.signal)).context_id;
      }
    } catch (err) {
      const msg = aiErrorMessage(err, "Couldn't read the source material.");
      if (msg !== "Cancelled") {
        setRunError(msg);
        toast.error(msg);
      }
      setStage(review.length ? "review" : "setup");
      return;
    }

    setPhase("generating");
    setStartedAt(Date.now());
    const added: ReviewQuestion[] = [];
    const result = await runGeneration(
      {
        batches: batchPlan,
        contextId,
        signal: controller.signal,
        generate: (body, signal) =>
          AIQuestionGenerationApi.generate(
            courseId,
            { ...body, additional_context: instructions.trim() || undefined, provider },
            signal,
          ),
        reprepare: async () => (await prepare(controller.signal)).context_id,
      },
      {
        onBatch: (b) => setBatches((prev) => {
          const next = prev.slice();
          next[b.index] = b;
          return next;
        }),
        onQuestions: (qs, b) => {
          const mapped = qs.map((q) => ({ ...q, uid: nextUid(), selected: true, provider: b.provider }));
          added.push(...mapped);
          setReview((prev) => [...prev, ...mapped]);
          setLatest((prev) => [...qs.map((q) => ({ text: q.question_text, difficulty: q.difficulty_level, type: q.question_type })), ...prev].slice(0, 6));
        },
      },
    );
    abortRef.current = null;

    const fellBack = result.states.find((s) => s.fellBack);
    if (fellBack) toast.info(`Your chosen engine was busy, so ${fellBack.provider} answered instead.`);
    if (added.length) {
      const short = planTotal(batchPlan.flat()) - added.length;
      if (result.failed) toast.warn(`${added.length} questions ready — ${result.failed} batch${result.failed === 1 ? "" : "es"} failed. You can generate more from the review screen.`);
      else if (short > 0 && !result.cancelled) toast.info(`${added.length} of ${added.length + short} questions ready — some didn't pass quality checks.`);
      else toast.success(`${added.length} question${added.length === 1 ? "" : "s"} ready for review`);
      setStage("review");
    } else {
      const firstError = result.states.find((s) => s.error)?.error;
      const msg = controller.signal.aborted ? null : firstError || "The AI didn't return any usable questions. Try other settings or a different source.";
      if (msg) {
        setRunError(msg);
        toast.error(msg);
      }
      setStage(review.length ? "review" : "setup");
    }
  };

  const handleCancel = () => {
    setCancelling(true);
    abortRef.current?.abort();
  };

  // Ctrl/Cmd + Enter generates from the setup screen.
  useEffect(() => {
    if (!isOpen || stage !== "setup") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------------------------------------------------------------- save / close

  const chosen = review.filter((q) => q.selected);

  const handleSave = async () => {
    if (!chosen.length) return;
    setSaving(true);
    try {
      await QuestionBankApiService.bulkCreateCourseQuestions(
        courseId,
        chosen.map((q) => ({
          question_type: q.question_type,
          question_text: q.question_text,
          question_data: q.question_data,
          correct_answer: q.correct_answer ?? null,
          explanation: q.explanation ?? null,
          difficulty_level: q.difficulty_level,
          tags: q.tags ?? [],
          time_limit_seconds: q.time_limit_seconds ?? 60,
          ...(link && linkEntry ? { scheme_of_work_entry_id: link.id, scheme_of_work_entry_title: link.title } : {}),
        })),
      );
      setSavedCount(chosen.length);
      setReview((prev) => prev.filter((q) => !q.selected));
      setStage("saved");
      onSuccess();
      toast.success(`${chosen.length} question${chosen.length === 1 ? "" : "s"} added to the question bank`);
    } catch (err) {
      toast.error(aiErrorMessage(err, "Couldn't save the questions. Nothing was saved — please try again."));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setStage("setup");
    setSelected(new Map());
    setFile(null);
    setInstructions("");
    setPerType({});
    setPrepared(null);
    setBatches([]);
    setLatest([]);
    setReview([]);
    setRunError(null);
    setSavedCount(0);
  };

  const requestClose = () => {
    if (stage === "working" || (stage === "review" && review.length)) setConfirmClose(true);
    else {
      reset();
      onClose();
    }
  };

  // ---------------------------------------------------------------- render

  const steps = ["Choose source", "Configure", "Review & save"];
  const hasSource = tab === "document" ? !!file : selected.size > 0;
  const stepIndex = stage === "setup" ? (hasSource ? 1 : 0) : stage === "working" ? 1 : 2;
  const eta = estimateSeconds(total, batchPlan.length);
  const byLevel = planByDifficulty(plan);
  const sourceSummary =
    tab === "document" ? file?.name ?? "No file yet" : selected.size ? `${selected.size} resource${selected.size === 1 ? "" : "s"}` : "No resources yet";

  const footerShell =
    "border-t border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-[0_-10px_30px_-18px_rgba(15,23,42,0.35)] px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col sm:flex-row sm:items-center gap-3";

  const setupFooter = (
    <div className={footerShell}>
      <div className="flex-1 min-w-0 text-xs text-text-secondary-light dark:text-text-secondary-dark">
        {canGenerate ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-sm text-text-primary-light dark:text-text-primary-dark">{total} questions</span>
            <span className="inline-flex items-center gap-2">
              {DIFFICULTIES.map((d) =>
                byLevel[d.value] ? (
                  <span key={d.value} className="inline-flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${d.dot}`} /> {byLevel[d.value]} {d.label.toLowerCase()}
                  </span>
                ) : null,
              )}
            </span>
            <span className="hidden md:inline text-gray-400">•</span>
            <span className="truncate">
              from <b className="font-medium text-text-primary-light dark:text-text-primary-dark">{sourceSummary}</b>
              {batchPlan.length > 1 ? ` · ${batchPlan.length} batches` : ""} · ~{formatDuration(eta)}
            </span>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {blockers[0]}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {review.length > 0 && (
          <button type="button" onClick={() => setStage("review")} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-blue-400 hover:text-blue-600">
            Review {review.length}
          </button>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          title={canGenerate ? "Ctrl/⌘ + Enter" : blockers.join(" · ")}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all"
        >
          <Sparkles className="w-4 h-4" /> Generate {total > 0 ? total : ""} question{total === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );

  const reviewFooter = (
    <div className={footerShell}>
      <div className="flex-1 min-w-0">
        {link ? (
          <LinkToggle title={link.title} on={linkEntry} onChange={setLinkEntry} />
        ) : (
          <p className="text-xs text-gray-500">
            <b className="text-text-primary-light dark:text-text-primary-dark">{chosen.length}</b> of {review.length} selected
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setStage("setup")} className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-blue-400 hover:text-blue-600">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Generate</span> more
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!chosen.length || saving}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save {chosen.length} to question bank
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/30">
            <Sparkles className="w-4 h-4 text-white" />
          </span>
          AI Question Generator
        </span>
      }
      subtitle={<StepIndicator steps={steps} current={stage === "saved" ? steps.length : stepIndex} />}
      size="full"
      className="h-full"
      bodyClassName={stage === "setup" ? "overflow-y-auto lg:overflow-hidden p-3 sm:p-4" : "overflow-y-auto p-3 sm:p-4"}
      footer={stage === "setup" ? setupFooter : stage === "review" ? reviewFooter : undefined}
      closeOnBackdropClick={false}
      closeOnEscape={stage !== "working"}
    >
      <AnimatePresence mode="wait">
        {stage === "setup" && (
          <motion.div key="setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-3 lg:h-full">
            {runError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/15 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="flex-1">{runError}</span>
                <button type="button" onClick={() => setRunError(null)} className="text-xs underline">
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3 sm:gap-4 lg:flex-1 lg:min-h-0">
              {/* Source: fixed header, list scrolls on its own on large screens */}
              <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 flex flex-col lg:min-h-0 overflow-hidden">
                <div className="p-3 sm:p-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800/70" role="tablist" aria-label="Source">
                    {([
                      { id: "resources", label: "From course resources", short: "Course resources", icon: Library },
                      { id: "document", label: "Upload a document", short: "Upload", icon: FileUp },
                    ] as const).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          tab === t.id
                            ? "bg-white text-blue-700 shadow-sm dark:bg-blue-600 dark:text-white"
                            : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      >
                        <t.icon className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline whitespace-nowrap">{t.label}</span>
                        <span className="sm:hidden whitespace-nowrap">{t.short}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    {tab === "resources"
                      ? "Pick curriculum outcomes, scheme-of-work weeks, lesson plans, your notes, shared materials or e-learning pages — the AI writes questions from exactly these."
                      : "Upload course notes, a chapter or a handout. The AI writes questions only from what's in the file."}
                  </p>
                </div>
                <div className="p-3 sm:p-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto overscroll-contain">
                  {tab === "resources" ? (
                    <SourcePicker
                      data={sources}
                      loading={sourcesLoading}
                      error={sourcesError}
                      onRetry={() => loadSources(classGroupId)}
                      selected={selected}
                      onToggle={toggleSource}
                      onSetMany={setMany}
                      onClear={() => setSelected(new Map())}
                      classGroupId={classGroupId}
                      onClassGroupChange={(id) => {
                        setSelected(new Map());
                        loadSources(id);
                      }}
                    />
                  ) : (
                    <DocumentDropzone file={file} onFile={setFile} onReject={(r) => toast.error(r)} />
                  )}
                </div>
              </section>

              {/* Configure */}
              <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-3 sm:p-4 space-y-6 lg:min-h-0 lg:overflow-y-auto overscroll-contain">
                <PlanBuilder
                  types={types}
                  onTypesChange={setTypes}
                  mode={mode}
                  onModeChange={setMode}
                  uniform={uniform}
                  onUniformChange={setUniform}
                  perType={perType}
                  onPerTypeChange={(t, m) => setPerType((p) => ({ ...p, [t]: m }))}
                  plan={plan}
                />
                <PromptComposer value={instructions} onChange={setInstructions} suggestions={suggestions} />
                <ProviderPicker providers={providers} value={provider} onChange={setProvider} />
              </section>
            </div>
          </motion.div>
        )}

        {stage === "working" && (
          <motion.div key="working" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GenerationProgress
              phase={phase}
              sourceLabel={prepared?.signature === signature ? prepared.ctx.label : sourceSummary}
              batches={batches}
              latest={latest}
              startedAt={startedAt}
              estimateSec={eta}
              onCancel={handleCancel}
              cancelling={cancelling}
            />
          </motion.div>
        )}

        {stage === "review" && (
          <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-5xl mx-auto w-full">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <button type="button" onClick={() => setStage("setup")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                <ArrowLeft className="w-4 h-4" /> Settings
              </button>
              <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                Review {review.length} question{review.length === 1 ? "" : "s"}
              </h3>
              <span className="text-xs text-gray-500">Untick or delete what you don't want, adjust difficulty, then save.</span>
            </div>

            {prepared && (
              <div className="mb-3 rounded-xl border border-gray-200 dark:border-gray-800 text-xs">
                <button type="button" onClick={() => setShowSource((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-600 dark:text-gray-300" aria-expanded={showSource}>
                  <Library className="w-3.5 h-3.5 text-blue-500" />
                  <span className="flex-1 truncate">
                    Source: <b>{prepared.ctx.label}</b> · {Math.round(prepared.ctx.char_count / 1000)}k characters{prepared.ctx.truncated ? " (shortened)" : ""}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSource ? "rotate-180" : ""}`} />
                </button>
                {showSource && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {prepared.ctx.parts.map((p) => (
                        <span key={`${p.kind}:${p.id}`} className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {p.title} · {Math.max(1, Math.round(p.chars / 1000))}k
                        </span>
                      ))}
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed max-h-40 overflow-y-auto rounded-lg bg-gray-50 dark:bg-gray-800/50 p-2 text-gray-600 dark:text-gray-400">
                      {prepared.ctx.preview}
                      {prepared.ctx.char_count > prepared.ctx.preview.length ? "…" : ""}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <AIReviewList questions={review} onChange={setReview} />
          </motion.div>
        )}

        {stage === "saved" && (
          <motion.div key="saved" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
                {savedCount} question{savedCount === 1 ? "" : "s"} added to the bank
              </h3>
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
                {review.length ? `${review.length} unselected question${review.length === 1 ? " is" : "s are"} still waiting for review.` : "They're ready to use in quizzes."}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {review.length > 0 && (
                <button type="button" onClick={() => setStage("review")} className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700">
                  Back to review
                </button>
              )}
              <button type="button" onClick={() => setStage("setup")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-blue-300 text-blue-700 dark:text-blue-200">
                <Sparkles className="w-4 h-4" /> Generate more
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="px-6 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmClose}
        danger
        title={stage === "working" ? "Stop generating and close?" : `Discard ${review.length} unsaved question${review.length === 1 ? "" : "s"}?`}
        description={stage === "working" ? "The AI run will be cancelled and nothing will be saved." : "They haven't been saved to the question bank yet."}
        confirmLabel="Discard and close"
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          reset();
          onClose();
        }}
      />
    </Modal>
  );
};

export default AIGenerateModal;
