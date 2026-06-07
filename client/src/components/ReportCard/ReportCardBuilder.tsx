import { useState, useMemo, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
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
} from "lucide-react";
import { toast } from "react-toastify";
import {
  ReportCardApiService,
  type AssessmentCategory,
  type AssessmentType,
} from "../../services/reportCardApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssessmentDragItem {
  /** Unique id used by dnd-kit (e.g. "quiz-42") */
  dndId: string;
  assessment_id: number;
  assessment_type: AssessmentType;
  title: string;
  subject_id: number;
}

export interface SubjectOption {
  id: number;
  name: string;
  quizzes: { id: number; title: string }[];
  assignments: { id: number; title: string }[];
}

export interface ReportCardBuilderProps {
  studentId: number;
  term: string;
  academicYear: string;
  subjects: SubjectOption[];
  /** Pre-populate drop zones from an existing saved card */
  initialDropped?: Partial<Record<AssessmentCategory, AssessmentDragItem[]>>;
  onSaved?: (reportCardId: number) => void;
  /** When true, drag-drop and save are disabled (approved card, non-admin view) */
  readOnly?: boolean;
}

// ─── Category config ─────────────────────────────────────────────────────────

interface CategoryMeta {
  label: string;
  shortLabel: string;
  weight: number;
  bg: string;
  border: string;
  badge: string;
  dot: string;
  dropBg: string;
}

const CATEGORIES: Record<AssessmentCategory, CategoryMeta> = {
  CW: {
    label: "Class Work",
    shortLabel: "CW",
    weight: 15,
    bg: "from-blue-500/20 to-blue-600/10",
    border: "border-blue-400/40",
    badge: "bg-blue-500 text-white",
    dot: "bg-blue-400",
    dropBg: "bg-blue-500/10",
  },
  HW: {
    label: "Homework",
    shortLabel: "HW",
    weight: 10,
    bg: "from-cyan-500/20 to-cyan-600/10",
    border: "border-cyan-400/40",
    badge: "bg-cyan-500 text-white",
    dot: "bg-cyan-400",
    dropBg: "bg-cyan-500/10",
  },
  MD: {
    label: "Mid-Term",
    shortLabel: "MD",
    weight: 25,
    bg: "from-amber-500/20 to-amber-600/10",
    border: "border-amber-400/40",
    badge: "bg-amber-500 text-white",
    dot: "bg-amber-400",
    dropBg: "bg-amber-500/10",
  },
  EOT: {
    label: "End of Term",
    shortLabel: "EOT",
    weight: 50,
    bg: "from-emerald-500/20 to-emerald-600/10",
    border: "border-emerald-400/40",
    badge: "bg-emerald-500 text-white",
    dot: "bg-emerald-400",
    dropBg: "bg-emerald-500/10",
  },
};

const CATEGORY_ORDER: AssessmentCategory[] = ["CW", "HW", "MD", "EOT"];

// ─── Draggable item card ──────────────────────────────────────────────────────

function DraggableCard({
  item,
  isOverlay = false,
}: {
  item: AssessmentDragItem;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.dndId,
    data: item,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium cursor-grab active:cursor-grabbing
        select-none transition-all duration-150
        ${isOverlay
          ? "bg-white/95 border-indigo-400 shadow-2xl shadow-indigo-500/30 scale-105 rotate-1"
          : isDragging
          ? "opacity-40 bg-white/20 border-white/20"
          : "bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/40 hover:shadow-lg hover:shadow-black/20"
        }
      `}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
      {item.assessment_type === "quiz" ? (
        <BookOpen className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
      ) : (
        <ClipboardList className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
      )}
      <span className="text-white/90 truncate flex-1">{item.title}</span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
          item.assessment_type === "quiz"
            ? "bg-blue-500/30 text-blue-200"
            : "bg-cyan-500/30 text-cyan-200"
        }`}
      >
        {item.assessment_type === "quiz" ? "Quiz" : "Assign"}
      </span>
    </div>
  );
}

// ─── Dropped item inside a category zone ─────────────────────────────────────

function DroppedItem({
  item,
  onRemove,
}: {
  item: AssessmentDragItem;
  onRemove: (dndId: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/15 border border-white/20 text-sm group">
      {item.assessment_type === "quiz" ? (
        <BookOpen className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
      ) : (
        <ClipboardList className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
      )}
      <span className="text-white/90 truncate flex-1">{item.title}</span>
      <button
        onClick={() => onRemove(item.dndId)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-red-500/30 text-white/50 hover:text-red-300"
        aria-label={`Remove ${item.title}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
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
        flex flex-col rounded-2xl border backdrop-blur-sm transition-all duration-200 overflow-hidden
        bg-gradient-to-br ${meta.bg} ${meta.border}
        ${isOver ? `${meta.dropBg} border-opacity-80 scale-[1.01] shadow-lg` : ""}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
          <span className="font-semibold text-white text-sm">{meta.label}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${meta.badge}`}>
            {meta.weight}%
          </span>
        </div>
        <span className="text-xs text-white/50">{items.length} item{items.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Drop area */}
      <div
        className={`flex-1 p-3 min-h-[100px] flex flex-col gap-2 transition-colors duration-150 ${
          isOver ? "bg-white/5" : ""
        }`}
      >
        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/25 text-xs text-center select-none">
              Drop assessments here
            </p>
          </div>
        ) : (
          items.map((item) => (
            <DroppedItem key={item.dndId} item={item} onRemove={onRemove} />
          ))
        )}
      </div>
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
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    subjects[0]?.id ?? null,
  );
  const [dropped, setDropped] = useState<Record<AssessmentCategory, AssessmentDragItem[]>>({
    CW: initialDropped?.CW ?? [],
    HW: initialDropped?.HW ?? [],
    MD: initialDropped?.MD ?? [],
    EOT: initialDropped?.EOT ?? [],
  });
  const [activeDragItem, setActiveDragItem] = useState<AssessmentDragItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);

  // When a new pre-populated state arrives (e.g. navigating between students),
  // reset the drop zones so they reflect the loaded card.
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
  );

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) ?? null,
    [subjects, selectedSubjectId],
  );

  // All items for the selected subject
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

  // Items not yet placed in any category
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

      // Remove from any existing category first (handles re-categorising)
      setDropped((prev) => {
        const next = { ...prev };
        CATEGORY_ORDER.forEach((cat) => {
          next[cat] = next[cat].filter((i) => i.dndId !== draggedItem.dndId);
        });
        next[targetCategory] = [...next[targetCategory], draggedItem];
        return next;
      });
    },
    [],
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

  const handleSave = async () => {
    if (!selectedSubjectId) {
      toast.error("Please select a subject first.");
      return;
    }

    const allMappings = CATEGORY_ORDER.flatMap((cat) =>
      dropped[cat].map((item) => ({
        subject_id: item.subject_id,
        assessment_type: item.assessment_type,
        assessment_id: item.assessment_id,
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
        student_id: studentId,
        term,
        academic_year: academicYear,
        assessments: allMappings,
      });

      if (result.success) {
        toast.success(`Saved ${result.data.subject_mappings_saved} assessment mapping(s) for this subject.`);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 md:p-6">
        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Report Card Builder
              </h1>
              <p className="text-sm text-white/50 mt-0.5">
                {term} · {academicYear} · Student #{studentId}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {totalMapped > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {totalMapped} mapped
                </span>
              )}
              {readOnly ? (
                <span className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                  bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  Approved — view only
                </span>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={isSaving || totalMapped === 0}
                  data-testid="save-button"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                    bg-gradient-to-r from-indigo-500 to-blue-600 text-white
                    hover:from-indigo-400 hover:to-blue-500
                    disabled:opacity-40 disabled:cursor-not-allowed
                    shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
                    transition-all duration-200 active:scale-95"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? "Saving…" : "Save Mappings"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Subject selector ── */}
        <div className="mb-5 relative">
          <button
            onClick={() => setSubjectOpen((o) => !o)}
            data-testid="subject-selector"
            className="w-full sm:w-64 flex items-center justify-between gap-2 px-4 py-2.5
              bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white text-sm font-medium
              hover:bg-white/15 transition-colors"
          >
            <span className="truncate">
              {selectedSubject ? selectedSubject.name : "Select a subject"}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-white/50 flex-shrink-0 transition-transform duration-200 ${
                subjectOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {subjectOpen && (
            <div className="absolute top-full mt-1 left-0 z-50 w-full sm:w-64
              bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedSubjectId(s.id);
                    setSubjectOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                    ${selectedSubjectId === s.id
                      ? "bg-indigo-600/40 text-white font-medium"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Main two-panel layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
          {/* Left panel – available assessments */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Available Assessments</h2>
              <span className="text-xs text-white/40">{availableItems.length} item{availableItems.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 border-b border-white/5 flex items-center gap-3 text-[11px] text-white/40">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-blue-300" /> Quiz
              </span>
              <span className="flex items-center gap-1">
                <ClipboardList className="w-3 h-3 text-cyan-300" /> Assignment
              </span>
              <span className="ml-auto flex items-center gap-1">
                <GripVertical className="w-3 h-3" /> Drag to category
              </span>
            </div>

            <div
              className="p-3 flex flex-col gap-2 max-h-[60vh] lg:max-h-[calc(100vh-260px)] overflow-y-auto
                scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
              data-testid="available-items"
            >
              {availableItems.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
                  <p className="text-white/30 text-sm">
                    {allSubjectItems.length === 0
                      ? "No assessments found for this subject"
                      : "All assessments have been categorised"}
                  </p>
                </div>
              ) : (
                availableItems.map((item) => (
                  <DraggableCard key={item.dndId} item={item} />
                ))
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

      {/* Drag overlay (ghost card while dragging) */}
      <DragOverlay dropAnimation={null}>
        {activeDragItem ? (
          <DraggableCard item={activeDragItem} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
