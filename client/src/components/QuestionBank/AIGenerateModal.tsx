import React, { useState, useRef } from "react";
import {
  Sparkles,
  Upload,
  FileText,
  Loader2,
  Check,
  AlertTriangle,
  Info,
  X,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Modal from "../ui/Modal";
import { QuestionBankApiService } from "../../services/quizApi";
import { toast } from "react-toastify";
import DocxPreviewList from "./DocxPreviewList";
import type { QuestionType, DifficultyLevel } from "../../types/quiz.types";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const WARN_FILE_BYTES = 5 * 1024 * 1024;

type Stage = "setup" | "generating" | "preview" | "success";

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  onSuccess: () => void;
}

const QUESTION_TYPES: {
  value: QuestionType;
  label: string;
  icon: string;
  complex?: boolean;
}[] = [
  { value: "single_choice", label: "Single Choice", icon: "🔘" },
  { value: "multiple_choice", label: "Multiple Choice", icon: "☑️" },
  { value: "true_false", label: "True / False", icon: "✅" },
  { value: "fill_blank", label: "Fill in the Blank", icon: "📝" },
  { value: "matching", label: "Matching", icon: "🔗" },
  { value: "numerical", label: "Numerical", icon: "🔢" },
  { value: "short_answer", label: "Short Answer", icon: "💬" },
  { value: "ordering", label: "Ordering", icon: "🔡" },
  { value: "dropdown", label: "Dropdown", icon: "📋" },
  { value: "coding", label: "Coding", icon: "💻", complex: true },
  { value: "algorithmic", label: "Algorithmic", icon: "⚙️", complex: true },
  { value: "drag_drop", label: "Drag & Drop", icon: "🖐️", complex: true },
  {
    value: "logical_expression",
    label: "Logical Expression",
    icon: "🧩",
    complex: true,
  },
];

const DIFFICULTY_LEVELS: {
  value: DifficultyLevel;
  label: string;
  activeClass: string;
}[] = [
  {
    value: "EASY",
    label: "Easy",
    activeClass:
      "bg-green-100 text-green-700 border-green-400 dark:bg-green-900/30 dark:text-green-400",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    activeClass:
      "bg-amber-100 text-amber-700 border-amber-400 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    value: "DIFFICULT",
    label: "Difficult",
    activeClass:
      "bg-red-100 text-red-700 border-red-400 dark:bg-red-900/30 dark:text-red-400",
  },
];

const COUNT_OPTIONS = [1, 2, 3, 5, 10];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AIGenerateModal: React.FC<AIGenerateModalProps> = ({
  isOpen,
  onClose,
  courseId,
  onSuccess,
}) => {
  const [stage, setStage] = useState<Stage>("setup");
  const [file, setFile] = useState<File | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([
    "single_choice",
    "multiple_choice",
  ]);
  const [countPerType, setCountPerType] = useState(2);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("MEDIUM");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [documentInfo, setDocumentInfo] = useState<{
    char_count: number;
    truncated: boolean;
  } | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > MAX_FILE_BYTES) {
        toast.error(
          "File exceeds 20MB limit. Please upload a smaller document.",
        );
        return;
      }
      const isPdf =
        selected.type === PDF_MIME ||
        selected.name.toLowerCase().endsWith(".pdf");
      const isDocx =
        selected.type === DOCX_MIME ||
        selected.name.toLowerCase().endsWith(".docx");
      if (!isPdf && !isDocx) {
        toast.error("Only PDF and DOCX files are supported.");
        return;
      }
      setFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const fakeEvent = { target: { files: e.dataTransfer.files } } as any;
      handleFileChange(fakeEvent);
    }
  };

  const handleGenerate = async () => {
    if (!file || !selectedTypes.length) return;
    setLoading(true);
    setStage("generating");
    try {
      const result = await QuestionBankApiService.generateQuestionsFromDocument(
        courseId,
        file,
        {
          questionTypes: selectedTypes,
          countPerType,
          difficulty,
          additionalContext: additionalContext.trim() || undefined,
        },
      );
      setGeneratedQuestions(result.data);
      setDocumentInfo(result.document_info);
      setSkippedCount(result.skipped || 0);
      setStage("preview");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "AI generation failed. Please try again.",
      );
      setStage("setup");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBulk = async (questions: any[]) => {
    setLoading(true);
    try {
      await QuestionBankApiService.bulkCreateCourseQuestions(
        courseId,
        questions,
      );
      setStage("success");
      onSuccess();
      toast.success(
        `${questions.length} AI-generated question${questions.length !== 1 ? "s" : ""} saved to question bank`,
      );
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch {
      toast.error("Failed to save questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (index: number) => {
    const updated = [...generatedQuestions];
    updated.splice(index, 1);
    setGeneratedQuestions(updated);
    if (updated.length === 0) setStage("setup");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const reset = () => {
    setStage("setup");
    setFile(null);
    setSelectedTypes(["single_choice", "multiple_choice"]);
    setCountPerType(2);
    setDifficulty("MEDIUM");
    setAdditionalContext("");
    setGeneratedQuestions([]);
    setDocumentInfo(null);
    setSkippedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const totalExpected = selectedTypes.length * countPerType;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="AI Question Generator"
      subtitle="Upload a document and let AI create questions from your content"
      size="full"
      closeOnBackdropClick={stage === "setup"}
    >
      <AnimatePresence mode="wait">
        {/* ── Stage 1: Setup ── */}
        {stage === "setup" && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* File Upload Zone */}
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                Upload Document <span className="text-red-500">*</span>
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                  file
                    ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/10"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                      <Check className="w-6 h-6 text-violet-600" />
                    </div>
                    <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatBytes(file.size)} — click to change
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Drag & drop or click to upload
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Supports PDF and DOCX (max 20 MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Large file warning */}
              {file && file.size > WARN_FILE_BYTES && (
                <div className="mt-2 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Large document ({formatBytes(file.size)}). Processing may take
                  longer and content may be trimmed to fit AI context limits.
                </div>
              )}
            </div>

            {/* Question Types */}
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                Question Types{" "}
                <span className="text-gray-400 font-normal">
                  ({selectedTypes.length} selected)
                </span>
              </label>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                {QUESTION_TYPES.map((qt) => {
                  const active = selectedTypes.includes(qt.value);
                  return (
                    <button
                      key={qt.value}
                      type="button"
                      onClick={() => toggleType(qt.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-medium border transition-all duration-150 ${
                        active
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-violet-400"
                      }`}
                    >
                      <span>{qt.icon}</span> {qt.label}
                      {active && <Check className="w-3 h-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
              {selectedTypes.some(
                (t) => QUESTION_TYPES.find((q) => q.value === t)?.complex,
              ) && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Complex types (Coding, Algorithmic, Drag & Drop, Logical
                  Expression) may produce less accurate AI output.
                </p>
              )}
            </div>

            {/* Count & Difficulty Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  Questions per type
                </label>
                <select
                  value={countPerType}
                  onChange={(e) => setCountPerType(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {COUNT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} question{n !== 1 ? "s" : ""} per type
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  Difficulty
                </label>
                <div className="flex gap-2">
                  {DIFFICULTY_LEVELS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDifficulty(d.value)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        difficulty === d.value
                          ? d.activeClass
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Additional Context */}
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                Additional instructions{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="e.g. Focus on Chapter 3, target secondary school level, emphasise application questions..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-gray-400"
              />
            </div>

            {/* Generate Button */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedTypes.length > 0
                  ? `Will generate ~${totalExpected} question${totalExpected !== 1 ? "s" : ""}`
                  : "Select at least one question type"}
              </p>
              <button
                onClick={handleGenerate}
                disabled={!file || selectedTypes.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Generate Questions
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Stage 2: Generating ── */}
        {stage === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center py-20 gap-6 text-center"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-violet-500 animate-pulse" />
              </div>
              <Loader2 className="absolute -bottom-1 -right-1 w-7 h-7 text-violet-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                AI is reading your document...
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Crafting {totalExpected} question
                {totalExpected !== 1 ? "s" : ""} from your content. This usually
                takes 15–60 seconds.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2">
              <FileText className="w-3.5 h-3.5" />
              {file?.name}
            </div>
          </motion.div>
        )}

        {/* ── Stage 3: Preview ── */}
        {stage === "preview" && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {/* Banners */}
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2.5 text-sm font-medium">
              <Check className="w-4 h-4 flex-shrink-0" />
              AI generated {generatedQuestions.length} question
              {generatedQuestions.length !== 1 ? "s" : ""} from your document
              {skippedCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  ({skippedCount} skipped due to validation)
                </span>
              )}
            </div>

            {documentInfo?.truncated && (
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Your document was large and was trimmed to 80,000 characters.
                Questions may not cover content from later sections.
              </div>
            )}

            {/* Back button */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStage("setup")}
                className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back to settings
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Review and remove any questions before saving
              </p>
            </div>

            <DocxPreviewList
              questions={generatedQuestions}
              onConfirm={handleConfirmBulk}
              onCancel={() => setStage("setup")}
              onRemove={handleRemove}
              loading={loading}
            />
          </motion.div>
        )}

        {/* ── Stage 4: Success ── */}
        {stage === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Questions saved!
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Your question bank has been updated.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};

export default AIGenerateModal;
