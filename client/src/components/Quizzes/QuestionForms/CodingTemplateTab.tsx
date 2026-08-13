import React, { useState } from "react";
import { Eye } from "lucide-react";
import type { CodingData } from "../../../types/quiz.types";
import { CodePreviewModal } from "../CodePreviewModal";
import { WebTemplateGallery, WEB_TEMPLATES } from "./WebTemplateGallery";
import type { AlgorithmicTemplate } from "./TemplateLibrary";

interface CodingTemplateTabProps {
  codingData: CodingData;
  languageTemplates: Record<string, AlgorithmicTemplate[]>;
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

  const uiLanguages = [
    "html",
    "css",
    "react",
    "vue",
    "angular",
    "nextjs",
    "javascript",
    "typescript",
    "nodejs",
  ];
  const isWebLang = uiLanguages.includes(codingData.language.toLowerCase());
  const canPreview = [
    "html",
    "css",
    "react",
    "vue",
    "angular",
    "nextjs",
  ].includes(codingData.language.toLowerCase());

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📋</span>
          <h3 className="text-lg font-semibold text-text-secondary-light dark:text-text-secondary-dark">
            Choose a Template
          </h3>
        </div>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
          Start with a common coding problem template for {codingData.language}.
        </p>

        {isWebLang ? (
          <WebTemplateGallery
            language={codingData.language.toLowerCase()}
            selectedId={selectedTemplate}
            onSelect={(t) => {
              onSelectTemplate(t.id);
              // Fire an event to load the template files into the project
              document.dispatchEvent(
                new CustomEvent("codespace:loadfiles", {
                  detail: Object.entries(t.starterCode).map(
                    ([ext, content]) => ({
                      name: `index.${ext}`,
                      content,
                      language: ext,
                      is_entry_point:
                        ext === "html" ||
                        ext === "javascript" ||
                        ext === "typescript",
                    }),
                  ),
                }),
              );
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  selectedTemplate === template.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800"
                }`}
                onClick={() => onSelectTemplate(template.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-gray-100 dark:bg-gray-700 text-text-secondary-light dark:text-text-secondary-dark px-2 py-0.5 rounded">
                      {template.tag}
                    </span>
                    {selectedTemplate === template.id && (
                      <span className="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canPreview && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewTemplate(template.id);
                        }}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Preview code"
                      >
                        <Eye className="w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/70" />
                      </button>
                    )}
                  </div>
                </div>

                <h4 className="font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
                  {template.name}
                </h4>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 flex-1">
                  {template.description}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                      template.difficulty === "beginner"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : template.difficulty === "intermediate"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    }`}
                  >
                    {template.difficulty}
                  </span>
                  {selectedTemplate === template.id && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedTemplate && !isWebLang && (
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
