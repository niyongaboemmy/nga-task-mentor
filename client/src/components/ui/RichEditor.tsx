import React, { useState } from "react";
import Modal from "./Modal";
import { Edit3, Eye, Save, X } from "lucide-react";
import TiptapEditor from "../Common/RichTextEditor";
import RichTextDisplay from "../Common/RichTextDisplay";

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

/**
 * A full-featured rich text editor wrapper using the existing Tiptap-based RichTextEditor.
 * Features: bold, italic, underline, tables, lists, text alignment, images,
 * math formulas (LaTeX/KaTeX via Σ button), code blocks, and more.
 *
 * Uses a "modal-based" focus mode: shows a preview that, when clicked,
 * opens a full-width Google Docs-style editor in a modal.
 */
const RichEditor: React.FC<RichEditorProps> = ({
  value,
  onChange,
  placeholder = "Click to add content...",
  className = "",
  label,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const latestContentRef = React.useRef(value);

  const handleOpen = () => {
    latestContentRef.current = value;
    setTempValue(value);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    onChange(latestContentRef.current);
    setIsModalOpen(false);
  };

  const handleDiscard = () => {
    setTempValue(value);
    setIsModalOpen(false);
  };

  return (
    <div className={`rich-editor-wrapper ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2 block">
          {label}
        </label>
      )}

      {/* Clickable Preview Area */}
      <div
        onClick={handleOpen}
        className="rich-editor-preview group relative cursor-pointer min-h-[100px] p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 transition-all hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-600 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Preview
          </span>
          <span className="text-xs font-medium text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <Edit3 className="w-3 h-3" /> Click to edit
          </span>
        </div>

        {value ? (
          <RichTextDisplay
            content={value}
            className="line-clamp-4 text-text-secondary-light dark:text-text-secondary-dark"
          />
        ) : (
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 italic">
            {placeholder}
          </p>
        )}
      </div>

      {/* Editor Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleDiscard}
        size="full"
        showCloseButton={false}
        closeOnBackdropClick={false}
        title={
          <div className="flex items-center gap-2">
            <span className="text-text-primary-light dark:text-text-primary-dark">
              {label || "Rich Text Editor"}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
              Focus Mode
            </span>
          </div>
        }
      >
        <div
          className="flex flex-col"
          style={{ height: "calc(100vh - 120px)" }}
        >
          {/* Tiptap Editor — fills the modal */}
          <div className="flex-1 overflow-hidden">
            <TiptapEditor
              content={tempValue}
              onChange={(html) => {
                latestContentRef.current = html;
                setTempValue(html);
              }}
              placeholder={placeholder}
              minHeight="100%"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 flex-shrink-0">
            <button
              onClick={handleDiscard}
              className="px-4 py-2 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark hover:text-gray-900 dark:hover:text-white flex items-center gap-2 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-4 h-4" /> Discard
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RichEditor;
