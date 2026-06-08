import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  BookOpen,
  ClipboardList,
  GripVertical,
  Save,
  CheckCircle2,
  X,
  ChevronDown,
  Loader2,
  Plus,
  Zap,
} from "lucide-react";
import { toast } from "react-toastify";
import { AnimatePresence, motion } from "framer-motion";
import {
  ReportCardApiService,
  type AssessmentCategory,
  type AssessmentType,
} from "../../services/reportCardApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssessmentDragItem {
  dndId: string;
  assessment_id: number;
  assessment_type: AssessmentType;
  title: string;
  subject_id: number;
}

export interface SubjectOption {
  id: number;
  name: string;
  quizzes:     { id: number; title: string }[];
  assignments: { id: number; title: string }[];
}

export interface ReportCardBuilderProps {
  studentId: number;
  term: string;
  academicYear: string;
  subjects: SubjectOption[];
  initialDropped?: Partial<Record<AssessmentCategory, AssessmentDragItem[]>>;
  onSaved?: (reportCardId: number) => void;
  readOnly?: boolean;
}

// ─── Category config ──────────────────────────────────────────────────────────

interface CategoryMeta {
  label: string;
  shortLabel: string;
  weight: number;
  bg: string;
  border: string;
  badge: string;
  dot: string;
  dropBg: string;
  ring: string;
}

const CATEGORIES: Record<AssessmentCategory, CategoryMeta> = {
  CW: {
    label: "Class Work",
    shortLabel: "CW",
    weight: 15,
    bg: "bg-blue-950/50",
    border: "border-blue-800/50",
    badge: "bg-blue-600 text-white",
    dot: "bg-blue-400",
    dropBg: "bg-blue-900/30",
    ring: "ring-blue-500/40",
  },
  HW: {
    label: "Homework",
    shortLabel: "HW",
    weight: 10,
    bg: "bg-cyan-950/50",
    border: "border-cyan-800/50",
    badge: "bg-cyan-600 text-white",
    dot: "bg-cyan-400",
    dropBg: "bg-cyan-900/30",
    ring: "ring-cyan-500/40",
  },
  MD: {
    label: "Mid-Term",
    shortLabel: "MD",
    weight: 25,
    bg: "bg-amber-950/50",
    border: "border-amber-800/50",
    badge: "bg-amber-600 text-white",
    dot: "bg-amber-400",
    dropBg: "bg-amber-900/30",
    ring: "ring-amber-500/40",
  },
  EOT: {
    label: "End of Term",
    shortLabel: "EOT",
    weight: 50,
    bg: "bg-emerald-950/50",
    border: "border-emerald-800/50",
    badge: "bg-emerald-600 text-white",
    dot: "bg-emerald-400",
    dropBg: "bg-emerald-900/30",
    ring: "ring-emerald-500/40",
  },
};

const CATEGORY_ORDER: AssessmentCategory[] = ["CW", "HW", "MD", "EOT"];

// ─── Quick-assign popover ─────────────────────────────────────────────────────

function QuickAssignPopover({
  item,
  onAssign,
  onClose,
}: {
  item: AssessmentDragItem;
  onAssign: (cat: AssessmentCategory) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -4 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 top-full mt-1.5 z-50 w-52
        bg-[#0D1525] backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
    >
      <div className="px-3 py-2.5 border-b border-white/[0.06]">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Assign to category</p>
        <p className="text-xs text-slate-300 truncate mt-0.5">{item.title}</p>
      </div>
      <div className="p-1.5 space-y-0.5">
        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORIES[cat];
          return (
            <button
              key={cat}
              onClick={() => { onAssign(cat); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm
                hover:bg-white/[0.06] transition-colors text-left group"
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
              <span className="flex-1 text-slate-300 group-hover:text-white font-medium">{meta.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${meta.badge}`}>
                {meta.weight}%
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Draggable item card ──────────────────────────────────────────────────────

function DraggableCard({
  item,
  isOverlay = false,
  readOnly = false,
  onQuickAssign,
}: {
  item: AssessmentDragItem;
  isOverlay?: boolean;
  readOnly?: boolean;
  onQuickAssign?: (item: AssessmentDragItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.dndId,
    data: item,
  });

  const style = { transform: CSS.Translate.toString(transform) };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium
        select-none transition-all duration-150 group
        ${isOverlay
          ? "bg-white text-slate-900 border-blue-400 shadow-2xl shadow-blue-500/40 scale-105 rotate-1"
          : isDragging
          ? "opacity-20 bg-white/[0.04] border-white/[0.06]"
          : readOnly
          ? "bg-white/[0.04] border-white/[0.07] cursor-default"
          : "bg-white/[0.06] border-white/[0.1] hover:bg-white/[0.1] hover:border-white/[0.18] hover:shadow-md hover:shadow-black/30 cursor-grab active:cursor-grabbing"
        }
      `}
      {...attributes}
      {...listeners}
    >
      {!readOnly && (
        <GripVertical className={`w-3.5 h-3.5 flex-shrink-0 ${isOverlay ? "text-slate-400" : "text-slate-600"}`} />
      )}
      {item.assessment_type === "quiz" ? (
        <BookOpen className={`w-3.5 h-3.5 flex-shrink-0 ${isOverlay ? "text-blue-600" : "text-blue-400"}`} />
      ) : (
        <ClipboardList className={`w-3.5 h-3.5 flex-shrink-0 ${isOverlay ? "text-cyan-600" : "text-cyan-400"}`} />
      )}
      <span className={`truncate flex-1 text-xs font-medium ${isOverlay ? "text-slate-800" : "text-slate-200"}`}>{item.title}</span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
          item.assessment_type === "quiz"
            ? isOverlay ? "bg-blue-100 text-blue-700" : "bg-blue-900/60 text-blue-300"
            : isOverlay ? "bg-cyan-100 text-cyan-700" : "bg-cyan-900/60 text-cyan-300"
        }`}
      >
        {item.assessment_type === "quiz" ? "Quiz" : "Assign"}
      </span>

      {/* Quick-assign button */}
      {!readOnly && !isOverlay && onQuickAssign && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onQuickAssign(item); }}
          className="flex-shrink-0 w-5 h-5 rounded-md bg-white/[0.08] hover:bg-blue-600/50
            flex items-center justify-center opacity-0 group-hover:opacity-100
            transition-all duration-150 touch-action-auto"
          aria-label={`Quick assign ${item.title}`}
          title="Quick assign to category"
        >
          <Plus className="w-3 h-3 text-slate-300" />
        </button>
      )}
    </div>
  );
}

// ─── Dropped item in a category ───────────────────────────────────────────────

function DroppedItem({
  item,
  onRemove,
}: {
  item: AssessmentDragItem;
  onRemove: (dndId: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/20 border border-white/[0.08] text-sm group"
    >
      {item.assessment_type === "quiz" ? (
        <BookOpen className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
      ) : (
        <ClipboardList className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
      )}
      <span className="text-slate-200 truncate flex-1 text-xs font-medium">{item.title}</span>
      <button
        onClick={() => onRemove(item.dndId)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full
          hover:bg-red-500/20 text-slate-600 hover:text-red-400"
        aria-label={`Remove ${item.title}`}
      >
        <X className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

// ─── Droppable category zone ──────────────────────────────────────────────────

function CategoryDropZone({
  category,
  items,
  onRemove,
}: {
  category: AssessmentCategory;
  items: AssessmentDragItem[];
  onRemove: (dndId: string) => void;
}) {
  const meta = CATEGORIES[category];
  const { setNodeRef, isOver } = useDroppable({ id: category });

  return (
    <div
      ref={setNodeRef}
      data-testid={`drop-zone-${category}`}
      className={`
        flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden
        ${meta.bg} ${meta.border}
        ${isOver ? `ring-2 ${meta.ring} scale-[1.01] shadow-lg shadow-black/40` : ""}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
          <span className="font-semibold text-white text-sm">{meta.label}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${meta.badge}`}>
            {meta.weight}%
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={items.length}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-xs text-slate-500 tabular-nums"
          >
            {items.length} item{items.length !== 1 ? "s" : ""}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Drop area */}
      <div
        className={`flex-1 p-3 min-h-[120px] flex flex-col gap-2 transition-colors duration-150 ${
          isOver ? "bg-white/[0.03]" : ""
        }`}
      >
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2.5 py-6">
            <div className={`w-9 h-9 rounded-xl border-2 border-dashed ${meta.border} flex items-center justify-center`}>
              <Plus className="w-4 h-4 text-slate-700" />
            </div>
            <p className="text-slate-700 text-xs text-center select-none">
              {isOver ? "Release to drop" : "Drag or assign here"}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {items.map((item) => (
              <DroppedItem key={item.dndId} item={item} onRemove={onRemove} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ─── Weight summary bar ───────────────────────────────────────────────────────

function WeightSummary({ dropped }: { dropped: Record<AssessmentCategory, AssessmentDragItem[]> }) {
  const totalWeight = CATEGORY_ORDER.reduce(
    (sum, cat) => sum + (dropped[cat].length > 0 ? CATEGORIES[cat].weight : 0),
    0,
  );

  return (
    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
      <span className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-slate-600" />
        <span className="text-slate-500">Weight:</span>
      </span>
      {CATEGORY_ORDER.map((cat) => (
        <span
          key={cat}
          className={`flex items-center gap-1 transition-opacity ${dropped[cat].length > 0 ? "opacity-100" : "opacity-25"}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${CATEGORIES[cat].dot}`} />
          <span className={dropped[cat].length > 0 ? "text-slate-300" : "text-slate-600"}>
            {CATEGORIES[cat].shortLabel} {CATEGORIES[cat].weight}%
          </span>
        </span>
      ))}
      <span className={`ml-auto font-semibold ${totalWeight >= 100 ? "text-emerald-400" : "text-slate-500"}`}>
        {totalWeight}% covered
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportCardBuilder({
  studentId,
  term,
  academicYear,
  subjects,
  initialDropped,
  onSaved,
  readOnly = false,
}: ReportCardBuilderProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(subjects[0]?.id ?? null);
  const [dropped, setDropped] = useState<Record<AssessmentCategory, AssessmentDragItem[]>>({
    CW: initialDropped?.CW ?? [],
    HW: initialDropped?.HW ?? [],
    MD: initialDropped?.MD ?? [],
    EOT: initialDropped?.EOT ?? [],
  });
  const [activeDragItem, setActiveDragItem] = useState<AssessmentDragItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [quickAssignItem, setQuickAssignItem] = useState<AssessmentDragItem | null>(null);

  const [syncKey, setSyncKey] = useState(0);
  useEffect(() => {
    setDropped({
      CW: initialDropped?.CW ?? [],
      HW: initialDropped?.HW ?? [],
      MD: initialDropped?.MD ?? [],
      EOT: initialDropped?.EOT ?? [],
    });
    setSyncKey((k) => k + 1);
  }, [initialDropped]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) ?? null,
    [subjects, selectedSubjectId],
  );

  const allSubjectItems = useMemo<AssessmentDragItem[]>(() => {
    if (!selectedSubject) return [];
    const quizItems: AssessmentDragItem[] = selectedSubject.quizzes.map((q) => ({
      dndId: `quiz-${q.id}`,
      assessment_id: q.id,
      assessment_type: "quiz",
      title: q.title,
      subject_id: selectedSubject.id,
    }));
    const assignItems: AssessmentDragItem[] = selectedSubject.assignments.map((a) => ({
      dndId: `assignment-${a.id}`,
      assessment_id: a.id,
      assessment_type: "assignment",
      title: a.title,
      subject_id: selectedSubject.id,
    }));
    return [...quizItems, ...assignItems];
  }, [selectedSubject]);

  const droppedDndIds = useMemo(
    () => new Set(Object.values(dropped).flatMap((arr) => arr.map((i) => i.dndId))),
    [dropped],
  );

  const availableItems = useMemo(
    () => allSubjectItems.filter((item) => !droppedDndIds.has(item.dndId)),
    [allSubjectItems, droppedDndIds],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (readOnly) return;
    setActiveDragItem(event.active.data.current as AssessmentDragItem);
  }, [readOnly]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragItem(null);
      if (readOnly) return;
      const { over, active } = event;
      if (!over) return;

      const targetCategory = over.id as AssessmentCategory;
      if (!CATEGORY_ORDER.includes(targetCategory)) return;

      const draggedItem = active.data.current as AssessmentDragItem;

      setDropped((prev) => {
        const next = { ...prev };
        CATEGORY_ORDER.forEach((cat) => {
          next[cat] = next[cat].filter((i) => i.dndId !== draggedItem.dndId);
        });
        next[targetCategory] = [...next[targetCategory], draggedItem];
        return next;
      });
    },
    [readOnly],
  );

  const handleRemoveFromCategory = useCallback((dndId: string) => {
    setDropped((prev) => {
      const next = { ...prev };
      CATEGORY_ORDER.forEach((cat) => {
        next[cat] = next[cat].filter((i) => i.dndId !== dndId);
      });
      return next;
    });
  }, []);

  const handleQuickAssign = useCallback((item: AssessmentDragItem, category: AssessmentCategory) => {
    setDropped((prev) => {
      const next = { ...prev };
      CATEGORY_ORDER.forEach((cat) => {
        next[cat] = next[cat].filter((i) => i.dndId !== item.dndId);
      });
      next[category] = [...next[category], item];
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!selectedSubjectId) {
      toast.error("Please select a subject first.");
      return;
    }

    const allMappings = CATEGORY_ORDER.flatMap((cat) =>
      dropped[cat].map((item) => ({
        subject_id:      item.subject_id,
        assessment_type: item.assessment_type,
        assessment_id:   item.assessment_id,
        category: cat,
      })),
    );

    if (allMappings.length === 0) {
      toast.error("Drop at least one assessment into a category before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await ReportCardApiService.saveBuilder({
        student_id:    studentId,
        term,
        academic_year: academicYear,
        assessments:   allMappings,
      });

      if (result.success) {
        toast.success(`Saved ${result.data.subject_mappings_saved} assessment mapping(s).`);
        onSaved?.(result.data.report_card_id);
      }
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const totalMapped = Object.values(dropped).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <DndContext
      key={syncKey}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-5 sm:p-6">
        {/* ── Header ── */}
        <div className="mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Report Card Builder</h1>
              <p className="text-xs text-slate-500 mt-0.5">{term} · {academicYear} · Student #{studentId}</p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {totalMapped > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 rounded-full px-3 py-1.5"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {totalMapped} mapped
                </motion.span>
              )}
              {readOnly ? (
                <span className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                  bg-emerald-950/50 border border-emerald-800/50 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  Approved — view only
                </span>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={isSaving || totalMapped === 0}
                  data-testid="save-button"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                    bg-blue-600 hover:bg-blue-500 text-white
                    disabled:opacity-40 disabled:cursor-not-allowed
                    shadow-lg shadow-blue-900/50
                    transition-all duration-200 active:scale-95"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? "Saving…" : "Save Mappings"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Weight summary ── */}
        {totalMapped > 0 && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <WeightSummary dropped={dropped} />
          </div>
        )}

        {/* ── Subject selector ── */}
        <div className="mb-5 relative">
          <button
            onClick={() => setSubjectOpen((o) => !o)}
            data-testid="subject-selector"
            className="w-full sm:w-80 flex items-center justify-between gap-2 px-4 py-2.5
              bg-white/[0.05] border border-white/[0.1] rounded-xl text-white text-sm font-medium
              hover:bg-white/[0.08] hover:border-white/[0.16] transition-all"
          >
            <span className="truncate text-slate-200">
              {selectedSubject ? selectedSubject.name : "Select a subject"}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200 ${subjectOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {subjectOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-1.5 left-0 z-50 w-full sm:w-80
                  bg-[#0D1525] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
              >
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSubjectId(s.id); setSubjectOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                      ${selectedSubjectId === s.id
                        ? "bg-blue-600/30 text-white font-semibold"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                      }`}
                  >
                    {s.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Touch hint ── */}
        {!readOnly && (
          <p className="mb-4 text-[11px] text-slate-700 flex items-center gap-1.5 sm:hidden">
            <GripVertical className="w-3 h-3" />
            Press &amp; hold to drag, or tap <Plus className="w-3 h-3 inline mx-0.5" /> to quick-assign
          </p>
        )}

        {/* ── Main two-panel layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
          {/* Left panel – available assessments */}
          <div className="bg-[#0A1020] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold text-white">Available Assessments</h2>
              <span className="text-xs text-slate-600 tabular-nums">{availableItems.length} item{availableItems.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Legend */}
            <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-4 text-[11px] text-slate-600 flex-shrink-0">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3 h-3 text-blue-500" /> Quiz
              </span>
              <span className="flex items-center gap-1.5">
                <ClipboardList className="w-3 h-3 text-cyan-500" /> Assignment
              </span>
              {!readOnly && (
                <span className="ml-auto flex items-center gap-1 text-slate-700">
                  <GripVertical className="w-3 h-3" /> Drag
                </span>
              )}
            </div>

            <div
              className="p-3 flex flex-col gap-2 max-h-[48vh] lg:max-h-[calc(100vh-300px)] overflow-y-auto
                scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/[0.08]"
              data-testid="available-items"
            >
              {availableItems.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-slate-600 text-xs">
                    {allSubjectItems.length === 0
                      ? "No assessments found for this subject"
                      : "All assessments have been categorised"}
                  </p>
                </div>
              ) : (
                <>
                  {availableItems.map((item) => (
                    <div key={item.dndId} className="relative">
                      <DraggableCard
                        item={item}
                        readOnly={readOnly}
                        onQuickAssign={!readOnly ? (i) => setQuickAssignItem(i) : undefined}
                      />
                      <AnimatePresence>
                        {quickAssignItem?.dndId === item.dndId && (
                          <QuickAssignPopover
                            item={item}
                            onAssign={(cat) => handleQuickAssign(item, cat)}
                            onClose={() => setQuickAssignItem(null)}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Right panel – category drop zones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CATEGORY_ORDER.map((cat) => (
              <CategoryDropZone
                key={cat}
                category={cat}
                items={dropped[cat]}
                onRemove={handleRemoveFromCategory}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDragItem ? <DraggableCard item={activeDragItem} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
