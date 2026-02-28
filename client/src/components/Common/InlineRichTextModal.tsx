import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import RichTextEditor from "./RichTextEditor";
import { Check, X } from "lucide-react";

interface InlineRichTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
  initialContent: string;
  title?: string;
  subtitle?: string;
}

export const InlineRichTextModal: React.FC<InlineRichTextModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialContent,
  title = "Edit Answer",
  subtitle = "Use the rich editor to add formulas or special characters",
}) => {
  const [content, setContent] = useState(initialContent);

  // Reset content when modal opens with new initialContent
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
    }
  }, [isOpen, initialContent]);

  const handleSave = () => {
    onSave(content);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="full"
      className="w-full"
    >
      <div className="flex flex-col space-y-4">
        <div
          className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden min-h-[300px]"
          style={{ height: "calc(100vh - 180px)" }}
        >
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Type your answer here..."
            minHeight="300px"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
          >
            <Check className="w-4 h-4" /> Save Answer
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default InlineRichTextModal;
