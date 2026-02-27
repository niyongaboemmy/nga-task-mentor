import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Edit3, X, Save } from "lucide-react";
import { Button } from "../ui/Button";
import RichTextEditor from "../Common/RichTextEditor";
import RichTextDisplay from "../Common/RichTextDisplay";

interface AssignmentDescriptionEditorProps {
  description: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const AssignmentDescriptionEditor: React.FC<
  AssignmentDescriptionEditorProps
> = ({
  description,
  onChange,
  placeholder = "Describe the assignment ...",
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempContent, setTempContent] = useState(description);

  const handleEdit = () => {
    setTempContent(description);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    onChange(tempContent);
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-3">
      <div
        onClick={handleEdit}
        className={`min-h-[120px] p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 group
          ${
            description
              ? "bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500/50"
              : "bg-gray-50/50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/30 hover:border-blue-300"
          } text-black dark:text-white`}
      >
        {description ? (
          <RichTextDisplay
            content={description}
            className="assignment-description line-clamp-6 opacity-80 group-hover:opacity-100 transition-opacity dark:text-white"
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-gray-400 dark:text-gray-500">
            <Edit3 className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm italic">{placeholder}</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 w-full max-w-[90rem] max-h-[90vh] rounded-3xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {description ? "Edit Description" : "Add Description"}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Use the toolbar to format your content, add images, or
                    tables.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Editor Content */}
              <div className="flex-1 overflow-y-auto p-0 bg-white dark:bg-gray-950 assignment-description">
                <RichTextEditor
                  content={tempContent}
                  onChange={setTempContent}
                  placeholder={placeholder}
                  minHeight="300px"
                />
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3 bg-white dark:bg-gray-900">
                <Button type="button" variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] shadow-lg shadow-blue-500/20"
                >
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    <span>Save and Continue</span>
                  </div>
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssignmentDescriptionEditor;
