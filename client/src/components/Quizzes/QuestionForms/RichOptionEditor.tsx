import React, { useState } from "react";
import { Sigma, Save } from "lucide-react";
import Modal from "../../ui/Modal";
import TiptapEditor from "../../Common/RichTextEditor";

interface RichOptionEditorProps {
  value: string;
  onChange: (val: string) => void;
  label: string;
}

export const RichOptionEditor: React.FC<RichOptionEditorProps> = ({
  value,
  onChange,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value || "");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTempValue(value || "");
          setIsOpen(true);
        }}
        className="w-10 h-10 shrink-0 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-all duration-200 shadow-sm"
        title="Edit with Rich Text Editor (Formulas, Tables, etc.)"
      >
        <Sigma className="w-5 h-5" />
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        size="full"
        title={`Edit ${label}`}
        showCloseButton={false}
      >
        <div className="flex flex-col h-[calc(100vh-200px)]">
          <div className="flex-1 overflow-hidden border rounded-3xl border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
            <TiptapEditor
              content={tempValue}
              onChange={setTempValue}
              placeholder="Enter rich text content..."
              minHeight="100%"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsOpen(false)}
              className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-text-secondary-light dark:text-text-secondary-dark font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onChange(tempValue);
                setIsOpen(false);
              }}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" /> Save Content
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
