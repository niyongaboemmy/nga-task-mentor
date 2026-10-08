import React, { useEffect, useMemo, useState } from "react";
import { Target } from "lucide-react";
import Modal from "../ui/Modal";
import { Button } from "../ui/Button";
import { competencyApi, type CriterionTag, type Outcome, type TaskType } from "../../services/competencyApi";

const errorText = (e: any, fallback: string) => e?.response?.data?.message || fallback;

/**
 * The learning outcomes (curriculum performance criteria) a quiz or assignment
 * assesses. Graded results of tagged work feed the MIS competency map. Shown to
 * whoever may grade the task; hidden for everyone else.
 */
export const LearningOutcomesPanel: React.FC<{ taskType: TaskType; taskId: number; className?: string }> = ({ taskType, taskId, className = "" }) => {
  const [tags, setTags] = useState<CriterionTag[] | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let live = true;
    competencyApi
      .task(taskType, taskId)
      .then((d) => {
        if (!live) return;
        setTags(d.criteria);
        setSubjectId(d.subject_id);
      })
      .catch(() => live && setHidden(true));
    return () => {
      live = false;
    };
  }, [taskType, taskId]);

  const grouped = useMemo(() => {
    const m = new Map<number, { title: string; n: number; numbers: string[] }>();
    for (const t of tags ?? []) {
      if (!m.has(t.competency_id)) m.set(t.competency_id, { title: t.outcome_title, n: t.element_number, numbers: [] });
      m.get(t.competency_id)!.numbers.push(t.criteria_number);
    }
    return [...m.values()];
  }, [tags]);

  if (hidden || tags === null || !subjectId) return null;
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800/50 dark:bg-gray-900 ${className}`} data-testid="learning-outcomes" aria-labelledby={`lo-${taskType}-${taskId}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={`lo-${taskType}-${taskId}`} className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden /> Learning outcomes
        </h3>
        <Button size="xs" variant="secondary" onClick={() => setEditing(true)}>{tags.length ? "Change" : "Add"}</Button>
      </div>
      {tags.length ? (
        <ul className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-200">
          {grouped.map((g) => (
            <li key={g.n + g.title}>
              <span className="font-semibold">LO{g.n}</span> {g.title}: <span className="tabular-nums">{g.numbers.join(", ")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          Not linked to the curriculum yet. Add the learning outcomes this {taskType} assesses and its marks will show on the MIS competency map.
        </p>
      )}
      {editing && (
        <OutcomesPicker
          taskType={taskType}
          subjectId={subjectId}
          selected={tags.map((t) => t.criteria_id)}
          onClose={() => setEditing(false)}
          onSave={async (ids) => {
            const d = await competencyApi.save(taskType, taskId, ids);
            setTags(d.criteria);
            setEditing(false);
          }}
        />
      )}
    </section>
  );
};

const OutcomesPicker: React.FC<{
  taskType: TaskType;
  subjectId: number;
  selected: number[];
  onClose: () => void;
  onSave: (ids: number[]) => Promise<void>;
}> = ({ taskType, subjectId, selected, onClose, onSave }) => {
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set(selected));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    competencyApi
      .curriculum(subjectId)
      .then(setOutcomes)
      .catch((e) => setError(errorText(e, "Couldn't load the learning outcomes.")));
  }, [subjectId]);

  const toggle = (ids: number[], on: boolean) =>
    setChosen((prev) => {
      const next = new Set(prev);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave([...chosen]);
    } catch (e) {
      setError(errorText(e, "Couldn't save the learning outcomes."));
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Learning outcomes"
      subtitle={`Tick what this ${taskType} assesses. A mark of 70% or more counts as demonstrated.`}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2 px-6 py-3">
          <span className="text-xs text-gray-600 dark:text-gray-300">{chosen.size} selected</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => void save()} disabled={saving || !outcomes}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      }
    >
      <div data-testid="outcomes-picker" className="space-y-4">
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
        {!outcomes && !error && <p className="text-sm text-gray-600 dark:text-gray-300">Loading the learning outcomes…</p>}
        {outcomes && !outcomes.length && (
          <p className="text-sm text-gray-700 dark:text-gray-200">This subject has no learning outcomes in MIS yet. Ask for its curriculum to be added or imported in MIS.</p>
        )}
        {outcomes?.map((o) => {
          const ids = o.criteria.map((c) => c.criteria_id);
          const all = ids.length > 0 && ids.every((id) => chosen.has(id));
          const some = ids.some((id) => chosen.has(id));
          return (
            <fieldset key={o.competency_id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <legend className="px-1">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <input
                    type="checkbox"
                    checked={all}
                    ref={(el) => {
                      if (el) el.indeterminate = some && !all;
                    }}
                    onChange={(e) => toggle(ids, e.target.checked)}
                    aria-label={`All of LO${o.element_number} ${o.title}`}
                  />
                  LO{o.element_number} {o.title}
                </label>
              </legend>
              <ul className="mt-1 space-y-1">
                {o.criteria.map((c) => (
                  <li key={c.criteria_id}>
                    <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <input type="checkbox" className="mt-1" checked={chosen.has(c.criteria_id)} onChange={(e) => toggle([c.criteria_id], e.target.checked)} />
                      <span><span className="font-semibold tabular-nums">{c.criteria_number}</span> {c.description}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </div>
    </Modal>
  );
};

export default LearningOutcomesPanel;
