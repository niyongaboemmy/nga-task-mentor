import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  X,
  Check,
  Loader2,
  Download,
  AlertCircle,
  Table,
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

type FileFormat = "docx" | "xlsx";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const DocxUploadModal: React.FC<DocxUploadModalProps> = ({
  isOpen,
  onClose,
  courseId,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileFormat, setFileFormat] = useState<FileFormat | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (
        selected.type === DOCX_MIME ||
        selected.name.toLowerCase().endsWith(".docx")
      ) {
        setFile(selected);
        setFileFormat("docx");
      } else if (
        selected.type === XLSX_MIME ||
        selected.name.toLowerCase().endsWith(".xlsx")
      ) {
        setFile(selected);
        setFileFormat("xlsx");
      } else {
        toast.error("Please select a valid .docx or .xlsx file");
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !fileFormat) return;
    setLoading(true);
    try {
      let response: { success: boolean; data: any[] };
      if (fileFormat === "xlsx") {
        response = await QuestionBankApiService.parseXlsxQuestions(
          courseId,
          file,
        );
      } else {
        response = await QuestionBankApiService.parseDocxQuestions(
          courseId,
          file,
        );
      }
      setParsedQuestions(response.data);
      toast.success("File parsed successfully. Please review questions.");
    } catch (err) {
      console.error("Upload error", err);
      toast.error(
        fileFormat === "xlsx"
          ? "Failed to parse Excel file. Check the format."
          : "Failed to parse Word document. Check the format.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDocxTemplate = async () => {
    try {
      const blob = await QuestionBankApiService.downloadDocxTemplate(courseId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "question_bank_template.docx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Failed to download Word template");
    }
  };

  const handleDownloadXlsxTemplate = async () => {
    try {
      const blob = await QuestionBankApiService.downloadXlsxTemplate(courseId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "question_bank_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Failed to download Excel template");
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
    } catch {
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
    setFileFormat(null);
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
      title="Import Questions from Word or Excel"
      subtitle="Upload a .docx or .xlsx file following our template format"
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
                  Make sure your file follows our template structure for
                  accurate parsing. Download a sample template below.
                </p>
                <div className="mt-3 flex flex-wrap gap-4">
                  <button
                    onClick={handleDownloadDocxTemplate}
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    <FileText className="w-4 h-4" /> Download Word Template
                    (.docx)
                  </button>
                  <button
                    onClick={handleDownloadXlsxTemplate}
                    className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold hover:underline"
                  >
                    <Table className="w-4 h-4" /> Download Excel Template
                    (.xlsx)
                  </button>
                </div>
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
                accept=".docx,.xlsx"
                className="hidden"
              />
              {file ? (
                <>
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                      fileFormat === "xlsx"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                    }`}
                  >
                    <Check className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {file.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {fileFormat === "xlsx" ? "Excel" : "Word"} file ready for
                    upload
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    Choose a Word or Excel File
                  </p>
                  <p className="text-sm text-gray-500">
                    Drag & drop or click to browse (.docx or .xlsx)
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
                ) : fileFormat === "xlsx" ? (
                  <>
                    <Table className="w-4 h-4" /> Parse Excel File
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
