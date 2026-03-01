import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  X,
  Check,
  Loader2,
  Download,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Modal from "../ui/Modal";

import { QuestionBankApiService } from "../../services/quizApi";
import { toast } from "react-toastify";
import DocxPreviewList from "./DocxPreviewList";

interface DocxUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  onSuccess: () => void;
}

const DocxUploadModal: React.FC<DocxUploadModalProps> = ({
  isOpen,
  onClose,
  courseId,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (
        selectedFile.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        selectedFile.name.endsWith(".docx")
      ) {
        setFile(selectedFile);
      } else {
        toast.error("Please select a valid .docx file");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const response = await QuestionBankApiService.parseDocxQuestions(
        courseId,
        file,
      );
      setParsedQuestions(response.data);
      toast.success("File parsed successfully. Please review questions.");
    } catch (err) {
      console.error("Upload error", err);
      toast.error("Failed to parse Word document. Check the format.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await QuestionBankApiService.downloadDocxTemplate(courseId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "question_bank_template.docx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error("Failed to download template");
    }
  };

  const handleConfirmBulk = async (questions: any[]) => {
    setLoading(true);
    try {
      await QuestionBankApiService.bulkCreateCourseQuestions(
        courseId,
        questions,
      );
      toast.success(`${questions.length} questions imported successfully`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Failed to import questions");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveQuestion = (index: number) => {
    if (!parsedQuestions) return;
    const newQuestions = [...parsedQuestions];
    newQuestions.splice(index, 1);
    setParsedQuestions(newQuestions.length > 0 ? newQuestions : null);
    if (newQuestions.length === 0) {
      toast.info("All questions removed. Please upload another file.");
    }
  };

  const reset = () => {
    setFile(null);
    setParsedQuestions(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import Questions from Word"
      subtitle="Upload a .docx file following our template format"
      size={"full"}
      className="h-full"
    >
      <AnimatePresence mode="wait">
        {!parsedQuestions ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col gap-6 py-4 h-full"
          >
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-semibold mb-1">Before you upload:</p>
                <p>
                  Make sure your document follows our specific structure for
                  accurate parsing. You can download our sample template below.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="mt-3 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  <Download className="w-4 h-4" /> Download Sample Template
                </button>
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all duration-300 ${
                file
                  ? "border-green-400 bg-green-50/30 dark:bg-green-900/10"
                  : "border-gray-200 dark:border-gray-800 hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".docx"
                className="hidden"
              />
              {file ? (
                <>
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center mb-4">
                    <Check className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {file.name}
                  </p>
                  <p className="text-sm text-gray-500">File ready for upload</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    Choose a Word File
                  </p>
                  <p className="text-sm text-gray-500">
                    Drag & drop or click to browse
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!file || loading}
                onClick={handleUpload}
                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Parsing...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" /> Parse Document
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="h-full"
          >
            <DocxPreviewList
              questions={parsedQuestions}
              onConfirm={handleConfirmBulk}
              onCancel={() => setParsedQuestions(null)}
              onRemove={handleRemoveQuestion}
              loading={loading}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};

export default DocxUploadModal;
