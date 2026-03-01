import React, { useState } from "react";
import { Maximize2, X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import type { CodingData } from "../../../types/quiz.types";
import { CodingProgressIndicator } from "./CodingProgressIndicator";
import { CodingSetupTab } from "./CodingSetupTab";
import { CodingTemplateTab } from "./CodingTemplateTab";
import { CodingTestsTab } from "./CodingTestsTab";
import { CodingConstraintsTab } from "./CodingConstraintsTab";
import { WEB_TEMPLATES } from "./WebTemplateGallery";
import { languageTemplates } from "./TemplateLibrary";

// ─── Tabs config ───────────────────────────────────────────────────────────────
const TABS = [
  { key: "setup", label: "Setup & Templates", icon: "⚙️" },
  { key: "tests", label: "Test Cases", icon: "🧪" },
  { key: "constraints", label: "Constraints", icon: "📋" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface CodingQuestionFormProps {
  data: CodingData;
  onChange: (data: CodingData) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export const CodingQuestionForm: React.FC<CodingQuestionFormProps> = ({
  data,
  onChange,
}) => {
  const codingData: CodingData = {
    ...data,
    test_cases: data.test_cases ?? [],
  };

  const [activeTab, setActiveTab] = useState<TabKey>("setup");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const applyTemplate = (templateId: string) => {
    const templates = languageTemplates[codingData.language] ?? [];
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      onChange({ ...codingData, starter_code: tpl.code });
      setSelectedTemplate(templateId);
      return;
    }
    // For web templates, starter_code and files are updated via the codespace:loadfiles event
    setSelectedTemplate(templateId);
  };

  const getSelectedTemplateName = () => {
    if (!selectedTemplate) return "Custom (Blank)";
    const templates = languageTemplates[codingData.language] ?? [];
    const tpl = templates.find((t) => t.id === selectedTemplate);
    if (tpl) return tpl.name;
    const webTpl = WEB_TEMPLATES.find((t) => t.id === selectedTemplate);
    if (webTpl) return webTpl.title;
    return "Custom";
  };

  const currentTabIndex = TABS.findIndex((t) => t.key === activeTab);

  const handleNext = () => {
    if (currentTabIndex < TABS.length - 1) {
      setActiveTab(TABS[currentTabIndex + 1].key);
    } else {
      setIsModalOpen(false);
    }
  };

  const handlePrev = () => {
    if (currentTabIndex > 0) {
      setActiveTab(TABS[currentTabIndex - 1].key);
    }
  };

  const formContent = (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Tab nav */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
        {TABS.map((tab, idx) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 flex items-center gap-2 ${
              activeTab === tab.key
                ? "bg-blue-600 text-white shadow-md scale-105"
                : idx < currentTabIndex
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent"
            }`}
          >
            {idx < currentTabIndex && activeTab !== tab.key ? (
              <Check size={14} />
            ) : (
              <span>{tab.icon}</span>
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-[420px] px-2">
        {activeTab === "setup" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <CodingSetupTab
              codingData={codingData}
              onChange={onChange}
              onLanguageChange={(language) => {
                onChange({ ...codingData, language, starter_code: "" });
                setSelectedTemplate("");
              }}
            />
            {codingData.language && (
              <div className="pt-8 mt-8 border-t border-gray-200 dark:border-gray-800">
                <CodingTemplateTab
                  codingData={codingData}
                  languageTemplates={languageTemplates}
                  selectedTemplate={selectedTemplate}
                  onSelectTemplate={applyTemplate}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "tests" && (
          <CodingTestsTab codingData={codingData} onChange={onChange} />
        )}

        {activeTab === "constraints" && (
          <CodingConstraintsTab
            codingData={codingData}
            rawData={data}
            onChange={onChange}
          />
        )}
      </div>

      <div className="mt-6">
        <CodingProgressIndicator codingData={codingData} />
      </div>
    </div>
  );

  return (
    <div>
      {/* Launch Button Area */}
      <div className="p-8 border-2 border-dashed border-blue-200 dark:border-blue-800/50 rounded-2xl text-center bg-blue-50/50 dark:bg-blue-900/10 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20">
        <div className="w-16 h-16 bg-white dark:bg-gray-800 shadow-sm border border-blue-100 dark:border-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">💻</span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Coding Question Configurator
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
          Set up the language, customize the starter template, define test
          cases, and set execution constraints.
        </p>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
        >
          <Maximize2 size={18} />
          {codingData.language
            ? `Edit ${codingData.language.toUpperCase()} Workspace`
            : "Open Workspace Editor"}
        </button>
        {codingData.language && (
          <div className="mt-4 flex items-center justify-center gap-4 text-xs font-medium text-gray-500">
            <span className="flex items-center gap-1">
              <Check size={14} className="text-green-500" />{" "}
              {codingData.language}
            </span>
            <span className="flex items-center gap-1">
              <Check size={14} className="text-green-500" />{" "}
              {codingData.test_cases.length} Tests
            </span>
          </div>
        )}
      </div>

      {/* Full Screen Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col overflow-hidden animate-in fade-in duration-200">
          <div className="w-full h-full flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/80 relative z-10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center border border-blue-200 dark:border-blue-800">
                  <span className="text-xl">💻</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    Workspace Editor
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {codingData.language
                      ? `Configuring ${codingData.language.toUpperCase()}`
                      : "Select a language to begin"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                title="Close Editor"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden p-6 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="container mx-auto h-full">{formContent}</div>
            </div>

            {/* Modal Footer / Navigation */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-between items-center z-10 shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl font-medium transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                >
                  Save & Close Editor
                </button>
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs text-gray-500 font-medium tracking-wide">
                    SELECTED TEMPLATE
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {getSelectedTemplateName()}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentTabIndex === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-medium transition-colors border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm"
                >
                  {currentTabIndex === TABS.length - 1 ? (
                    <>
                      Finish <Check size={16} />
                    </>
                  ) : (
                    <>
                      Next <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
