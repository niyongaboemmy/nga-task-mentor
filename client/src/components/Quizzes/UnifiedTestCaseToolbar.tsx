import React, { useState } from "react";
import { Wrench, BookOpen } from "lucide-react";
import { JavaScriptTestCaseBuilderModal } from "./JavaScriptTestCaseBuilderModal";
import { JavaScriptValidationGuideModal } from "./JavaScriptValidationGuideModal";
import { ReactTestCaseBuilderModal } from "./ReactTestCaseBuilderModal";
import { ReactValidationGuideModal } from "./ReactValidationGuideModal";
import { TypeScriptTestCaseBuilderModal } from "./TypeScriptTestCaseBuilderModal";
import { TypeScriptValidationGuideModal } from "./TypeScriptValidationGuideModal";
import { NodeJSTestCaseBuilderModal } from "./NodeJSTestCaseBuilderModal";
import { NodeJSValidationGuideModal } from "./NodeJSValidationGuideModal";
import { CssTestCaseBuilderModal } from "./CssTestCaseBuilderModal";
import { CssValidationGuideModal } from "./CssValidationGuideModal";
import { HtmlTestCaseBuilderModal } from "./HtmlTestCaseBuilderModal";
import { HtmlValidationGuideModal } from "./HtmlValidationGuideModal";
import { VueTestCaseBuilderModal } from "./VueTestCaseBuilderModal";
import { VueValidationGuideModal } from "./VueValidationGuideModal";
import { PythonTestCaseBuilderModal } from "./PythonTestCaseBuilderModal";
import { PythonValidationGuideModal } from "./PythonValidationGuideModal";
import { JavaTestCaseBuilderModal } from "./JavaTestCaseBuilderModal";
import { JavaValidationGuideModal } from "./JavaValidationGuideModal";
import { CTestCaseBuilderModal } from "./CTestCaseBuilderModal";
import { CValidationGuideModal } from "./CValidationGuideModal";
import { CppTestCaseBuilderModal } from "./CppTestCaseBuilderModal";
import { CppValidationGuideModal } from "./CppValidationGuideModal";
import { PhpTestCaseBuilderModal } from "./PhpTestCaseBuilderModal";
import { PhpValidationGuideModal } from "./PhpValidationGuideModal";
import { AngularTestCaseBuilderModal } from "./AngularTestCaseBuilderModal";
import { AngularValidationGuideModal } from "./AngularValidationGuideModal";
import { toast } from "react-toastify";
import { getLanguageIcon } from "./languageIcons";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModal = React.ComponentType<any>;

interface LangConfig {
  label: string;
  accentColor: string;
  BuilderModal: AnyModal | null;
  GuideModal: AnyModal | null;
}

const LANG_CONFIG: Record<string, LangConfig> = {
  javascript: {
    label: "JavaScript",
    accentColor: "#f59e0b",
    BuilderModal: JavaScriptTestCaseBuilderModal,
    GuideModal: JavaScriptValidationGuideModal,
  },
  typescript: {
    label: "TypeScript",
    accentColor: "#3b82f6",
    BuilderModal: TypeScriptTestCaseBuilderModal,
    GuideModal: TypeScriptValidationGuideModal,
  },
  react: {
    label: "React",
    accentColor: "#06b6d4",
    BuilderModal: ReactTestCaseBuilderModal,
    GuideModal: ReactValidationGuideModal,
  },
  nodejs: {
    label: "Node.js",
    accentColor: "#22c55e",
    BuilderModal: NodeJSTestCaseBuilderModal,
    GuideModal: NodeJSValidationGuideModal,
  },
  css: {
    label: "CSS",
    accentColor: "#8b5cf6",
    BuilderModal: CssTestCaseBuilderModal,
    GuideModal: CssValidationGuideModal,
  },
  html: {
    label: "HTML",
    accentColor: "#10b981",
    BuilderModal: HtmlTestCaseBuilderModal,
    GuideModal: HtmlValidationGuideModal,
  },
  vue: {
    label: "Vue.js",
    accentColor: "#22c55e",
    BuilderModal: VueTestCaseBuilderModal,
    GuideModal: VueValidationGuideModal,
  },
  python: {
    label: "Python",
    accentColor: "#3b82f6",
    BuilderModal: PythonTestCaseBuilderModal,
    GuideModal: PythonValidationGuideModal,
  },
  java: {
    label: "Java",
    accentColor: "#b07219",
    BuilderModal: JavaTestCaseBuilderModal,
    GuideModal: JavaValidationGuideModal,
  },
  c: {
    label: "C",
    accentColor: "#6366f1",
    BuilderModal: CTestCaseBuilderModal,
    GuideModal: CValidationGuideModal,
  },
  cpp: {
    label: "C++",
    accentColor: "#6366f1",
    BuilderModal: CppTestCaseBuilderModal,
    GuideModal: CppValidationGuideModal,
  },
  php: {
    label: "PHP",
    accentColor: "#8892cf",
    BuilderModal: PhpTestCaseBuilderModal,
    GuideModal: PhpValidationGuideModal,
  },
  angular: {
    label: "Angular",
    accentColor: "#ef4444",
    BuilderModal: AngularTestCaseBuilderModal,
    GuideModal: AngularValidationGuideModal,
  },
};

interface UnifiedTestCaseToolbarProps {
  language: string;
  onTestCaseGenerated: (testCase: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const UnifiedTestCaseToolbar: React.FC<UnifiedTestCaseToolbarProps> = ({
  language,
  onTestCaseGenerated,
}) => {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const config = LANG_CONFIG[language];
  if (!config) return null;

  const { label, accentColor, BuilderModal, GuideModal } = config;
  const LangIcon = getLanguageIcon(language);

  const handleTestCaseGenerated = (testCase: any) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    onTestCaseGenerated(testCase);
    toast.success(`${label} test case added!`, { autoClose: 2000 });
    setBuilderOpen(false);
  };

  const borderStyle = { borderColor: accentColor + "66" };
  const accentBg = { backgroundColor: accentColor + "18" };

  return (
    <div
      className="rounded-2xl border-2 p-5"
      style={{ ...borderStyle, ...accentBg }}
    >
      <div className="flex items-center gap-3 mb-4">
        <LangIcon className="w-6 h-6" style={{ color: accentColor }} />
        <div>
          <h4 className="font-bold text-text-primary-light dark:text-text-primary-dark text-sm">
            {label} Test Case Tools
          </h4>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-0.5">
            Interactive tools to create structured test cases with validation
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {BuilderModal && (
          <button
            type="button"
            onClick={() => setBuilderOpen(true)}
            className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-left transition-all group"
          >
            <span
              className="flex-shrink-0 p-2 rounded-lg"
              style={{ backgroundColor: accentColor + "22" }}
            >
              <Wrench size={16} style={{ color: accentColor }} />
            </span>
            <div>
              <p className="font-semibold text-sm text-text-primary-light dark:text-text-primary-dark">
                Test Case Builder
              </p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-0.5">
                Visual builder with input/output examples
              </p>
            </div>
          </button>
        )}

        {GuideModal && (
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-left transition-all group"
          >
            <span
              className="flex-shrink-0 p-2 rounded-lg"
              style={{ backgroundColor: accentColor + "22" }}
            >
              <BookOpen size={16} style={{ color: accentColor }} />
            </span>
            <div>
              <p className="font-semibold text-sm text-text-primary-light dark:text-text-primary-dark">
                Validation Guide
              </p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-0.5">
                All validation keywords with examples
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Modals — rendered once, hidden until open */}
      {BuilderModal && builderOpen && (
        <BuilderModal
          isOpen={builderOpen}
          onClose={() => setBuilderOpen(false)}
          onTestCaseGenerated={handleTestCaseGenerated}
        />
      )}
      {GuideModal && guideOpen && (
        <GuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      )}
    </div>
  );
};
