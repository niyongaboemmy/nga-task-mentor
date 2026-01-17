import React, { useState } from "react";
import { Eye } from "lucide-react";
import type { CodingData } from "../../../types/quiz.types";
import { CodePreviewModal } from "../CodePreviewModal";

interface CodingTemplateTabProps {
  codingData: CodingData;
  languageTemplates: {
    [language: string]: Array<{
      id: string;
      name: string;
      description: string;
      code: string;
    }>;
  };
  selectedTemplate: string;
  onSelectTemplate: (templateId: string) => void;
}

export const CodingTemplateTab: React.FC<CodingTemplateTabProps> = ({
  codingData,
  languageTemplates,
  selectedTemplate,
  onSelectTemplate,
}) => {
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);

  const templates =
    languageTemplates[codingData.language as keyof typeof languageTemplates] ||
    [];

  const uiLanguages = ["html", "css", "react", "vue", "angular", "nextjs"];
  const canPreview = uiLanguages.includes(codingData.language.toLowerCase());

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📋</span>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Choose a Template
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Start with a common coding problem template for {codingData.language}.
          Choose from 15+ languages including modern web technologies!
        </p>
        <div className="grid gap-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedTemplate === template.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
              }`}
              onClick={() => onSelectTemplate(template.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {template.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {template.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {canPreview && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewTemplate(template.id);
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Preview template"
                    >
                      <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  )}
                  <div className="text-2xl">
                    {selectedTemplate === template.id ? "✅" : "📄"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {selectedTemplate && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <span>✅</span>
              <span className="text-sm font-medium">
                Template applied successfully!
              </span>
            </div>
          </div>
        )}

        {/* Template Preview Modal */}
        {previewTemplate && (
          <CodePreviewModal
            isOpen={!!previewTemplate}
            onClose={() => setPreviewTemplate(null)}
            code={templates.find((t) => t.id === previewTemplate)?.code || ""}
            language={codingData.language}
          />
        )}
      </div>
    </div>
  );
};
