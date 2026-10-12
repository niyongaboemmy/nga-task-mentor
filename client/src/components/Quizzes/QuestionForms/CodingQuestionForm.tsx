import React, { useState } from "react";
import { FlaskConical, LayoutTemplate, SlidersHorizontal, Terminal } from "lucide-react";
import type { CodingData } from "../../../types/quiz.types";
import { CodingProgressIndicator } from "./CodingProgressIndicator";
import { CodingSetupTab } from "./CodingSetupTab";
import { CodingTestsTab } from "./CodingTestsTab";
import { CodingConstraintsTab } from "./CodingConstraintsTab";
import ReferenceSolution from "./ReferenceSolution";
import Drawer from "../../ui/Drawer";
import StarterPicker from "../../code/StarterPicker";
import { monacoLanguage } from "../../code/languages";
import { readIoTests } from "../../code/tests";
import type { Starter } from "../../../services/catalogApi";

/**
 * Code setup of a coding question (CODE_RUNNER_PLAN.md §7.3): one page, no
 * overlay — Code setup (language, starter, files), Tests (reference solution
 * and test cases) and Limits, with jump links. A starter from the catalog
 * fills the code and its input/output tests in one step.
 */

const SECTIONS = [
  { id: "code-setup", label: "Code setup", icon: Terminal },
  { id: "code-tests", label: "Tests", icon: FlaskConical },
  { id: "code-limits", label: "Limits & guidelines", icon: SlidersHorizontal },
] as const;

interface CodingQuestionFormProps {
  data: CodingData;
  onChange: (data: CodingData) => void;
}

const SectionTitle: React.FC<{ id: string; title: string; hint: string; icon: React.ElementType; action?: React.ReactNode }> = ({ id, title, hint, icon: Icon, action }) => (
  <div id={id} className="flex scroll-mt-24 flex-wrap items-end justify-between gap-2">
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">{title}</h3>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{hint}</p>
      </div>
    </div>
    {action}
  </div>
);

export const CodingQuestionForm: React.FC<CodingQuestionFormProps> = ({ data, onChange }) => {
  const codingData: CodingData = { ...data, test_cases: data.test_cases ?? [] };
  const [pickerOpen, setPickerOpen] = useState(false);

  const applyStarter = (s: Starter) => {
    const visible = s.files.filter((f) => !f.path.startsWith(".nga/") && !f.path.startsWith(".tmcode/") && !/^readme\.md$/i.test(f.path) && f.path !== ".gitignore");
    const io = readIoTests(s.files);
    const replaceTests =
      io.tests.length > 0 &&
      (codingData.test_cases.length === 0 || window.confirm(`Replace the ${codingData.test_cases.length} current test(s) with the starter's ${io.tests.length}?`));
    const entry = io.entry ?? s.entry ?? visible[0]?.path;
    const single = visible.length === 1;
    onChange({
      ...codingData,
      language: s.language,
      starter_id: s.id,
      project_mode: !single,
      starter_code: single ? visible[0]!.content : visible.find((f) => f.path === entry)?.content ?? "",
      project_files: single
        ? codingData.project_files
        : visible.map((f) => ({ name: f.path, content: f.content, language: monacoLanguage(f.path), is_entry_point: f.path === entry })),
      test_cases: replaceTests
        ? io.tests.map((t, i) => ({ id: t.id || `t${i + 1}`, input: t.input, expected_output: t.expected_output, is_hidden: false, points: t.points ?? 1 }))
        : codingData.test_cases,
    });
    setPickerOpen(false);
  };

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="space-y-6" data-testid="coding-question-form">
      <nav className="sticky top-16 z-sticky -mx-1 flex flex-wrap gap-1 rounded-xl bg-white/90 p-1 backdrop-blur dark:bg-gray-900/90" aria-label="Coding question sections">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => jump(id)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-text-secondary-light hover:bg-gray-100 hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:bg-white/10"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      <section className="space-y-4" aria-labelledby="code-setup-title">
        <SectionTitle
          id="code-setup"
          title="Code setup"
          hint="The language, and the code students start from."
          icon={Terminal}
          action={
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
              data-testid="choose-starter"
            >
              <LayoutTemplate className="h-3.5 w-3.5" aria-hidden="true" /> {codingData.starter_id ? "Change starter" : "Start from a starter"}
            </button>
          }
        />
        <CodingSetupTab
          codingData={codingData}
          onChange={onChange}
          onLanguageChange={(language) => onChange({ ...codingData, language, starter_code: "", starter_id: undefined })}
        />
      </section>

      <section className="space-y-4">
        <SectionTitle id="code-tests" title="Tests" hint="What the answer must print for each input. Hidden tests run only when students submit." icon={FlaskConical} />
        <ReferenceSolution codingData={codingData} onChange={onChange} />
        <CodingTestsTab codingData={codingData} onChange={onChange} />
      </section>

      <section className="space-y-4">
        <SectionTitle id="code-limits" title="Limits & guidelines" hint="Optional: rules shown to students, and time and memory limits." icon={SlidersHorizontal} />
        <CodingConstraintsTab codingData={codingData} rawData={data} onChange={onChange} />
      </section>

      <CodingProgressIndicator codingData={codingData} />

      <Drawer open={pickerOpen} onClose={() => setPickerOpen(false)} title="Start from a starter" width="max-w-4xl" elevated>
        <StarterPicker onUse={applyStarter} useLabel="Use this starter" initialLanguage={codingData.language || undefined} selectedId={codingData.starter_id} runnableOnly />
      </Drawer>
    </div>
  );
};

export default CodingQuestionForm;
