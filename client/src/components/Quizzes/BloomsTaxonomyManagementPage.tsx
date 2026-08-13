import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { QuizApiService } from "../../services/quizApi";
import type { BloomsTaxonomyLevel } from "../../types/quiz.types";

// ─── Helpers ────────────────────────────────────────────────────────────────

const ORDER_LABELS: Record<number, string> = {
  1: "L1",
  2: "L2",
  3: "L3",
  4: "L4",
  5: "L5",
  6: "L6",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  2: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  3: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  4: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  5: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  6: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

// ─── Empty form state ────────────────────────────────────────────────────────

interface LevelForm {
  name: string;
  description: string;
  level_order: number;
}

const emptyForm = (): LevelForm => ({
  name: "",
  description: "",
  level_order: 1,
});

// ─── Main Component ──────────────────────────────────────────────────────────

const BloomsTaxonomyManagementPage: React.FC = () => {
  const [levels, setLevels] = useState<BloomsTaxonomyLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LevelForm>(emptyForm());

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchLevels = async () => {
    try {
      const res = await QuizApiService.getBloomsTaxonomyLevels();
      setLevels(res.data);
    } catch {
      toast.error("Failed to load Bloom's Taxonomy levels.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLevels();
  }, []);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (level: BloomsTaxonomyLevel) => {
    setEditingId(level.id);
    setForm({
      name: level.name,
      description: level.description ?? "",
      level_order: level.level_order,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await QuizApiService.updateBloomsTaxonomyLevel(editingId, form);
        toast.success("Level updated successfully!");
      } else {
        await QuizApiService.createBloomsTaxonomyLevel(form);
        toast.success("Level created successfully!");
      }
      closeModal();
      fetchLevels();
    } catch {
      toast.error(
        editingId ? "Failed to update level." : "Failed to create level.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setSubmitting(true);
    try {
      await QuizApiService.deleteBloomsTaxonomyLevel(id);
      toast.success("Level deleted.");
      setDeleteConfirmId(null);
      fetchLevels();
    } catch {
      toast.error("Failed to delete level.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
              Bloom's Taxonomy Levels
            </h1>
            <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
              Manage the cognitive taxonomy levels used to classify quiz
              questions.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm transition-colors shadow"
          >
            <span className="text-lg leading-none">+</span> Add Level
          </button>
        </div>

        {/* Quick reference */}
        <div className="mt-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">
            Standard Bloom's Levels:
          </span>
          &nbsp; Remembering → Understanding → Applying → Analyzing → Evaluating
          → Creating
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : levels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-600">
          <svg
            className="w-16 h-16 mb-4 opacity-40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <p className="font-medium">No levels found</p>
          <p className="text-sm mt-1">Click "Add Level" to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {levels.map((level) => (
            <div
              key={level.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-5">
                {/* Badge + title */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold shrink-0 ${LEVEL_COLORS[level.level_order] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {ORDER_LABELS[level.level_order] ??
                        `L${level.level_order}`}
                    </span>
                    <div>
                      <h3 className="font-semibold text-text-primary-light dark:text-text-primary-dark text-base">
                        {level.name}
                      </h3>
                      <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                        Order {level.level_order}
                      </span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(level)}
                      title="Edit"
                      className="p-2 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(level.id)}
                      title="Delete"
                      className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Description */}
                {level.description && (
                  <p className="mt-3 text-sm text-text-secondary-light dark:text-text-secondary-dark/70 leading-relaxed">
                    {level.description}
                  </p>
                )}
              </div>

              {/* Delete confirmation inline */}
              {deleteConfirmId === level.id && (
                <div className="px-5 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-300 mb-2 font-medium">
                    Delete "{level.name}"?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(level.id)}
                      disabled={submitting}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg disabled:opacity-50"
                    >
                      {submitting ? "Deleting…" : "Yes, Delete"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1.5 bg-white dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark text-xs rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                {editingId ? "Edit Level" : "New Bloom's Taxonomy Level"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
                  Level Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Remembering"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-text-primary-light dark:text-text-primary-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Order */}
              <div>
                <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
                  Level Order
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.level_order}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      level_order: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-text-primary-light dark:text-text-primary-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 mt-1">
                  Lower numbers appear first in dropdowns.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={3}
                  placeholder="Brief description of this cognitive level…"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-text-primary-light dark:text-text-primary-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 text-text-secondary-light dark:text-text-secondary-dark rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !form.name.trim()}
                  className="px-5 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {submitting
                    ? editingId
                      ? "Saving…"
                      : "Creating…"
                    : editingId
                      ? "Save Changes"
                      : "Create Level"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BloomsTaxonomyManagementPage;
