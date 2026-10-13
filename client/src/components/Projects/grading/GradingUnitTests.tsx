import React, { useEffect, useState } from "react";
import UnitTestsPanel from "../../code/UnitTestsPanel";
import { guessLanguage } from "../../code/languages";
import { hasUnitTests, isHiddenFile } from "../../code/tests";
import { codeApi, loadProjectFiles, type CodeFile } from "../../../services/codeApi";

/**
 * Grading: the student's unit tests, run on this revision (CODE_RUNNER_PLAN.md
 * §7.6). Shows nothing when the project has no unit tests or the runner
 * can't run them.
 */
const GradingUnitTests: React.FC<{ projectId: number; revisionId: number | null; studentName?: string }> = ({ projectId, revisionId, studentName }) => {
  const [files, setFiles] = useState<CodeFile[] | null>(null);
  const [language, setLanguage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setFiles(null);
    (async () => {
      const caps = await codeApi.capabilities();
      if (!caps.unit_tests) return;
      const { files: all } = await loadProjectFiles(projectId, revisionId ?? "head");
      const visible = all.filter((f) => !isHiddenFile(f.path));
      const lang = guessLanguage(visible.map((f) => f.path));
      if (!live || !lang || !caps.unit_test_languages.includes(lang) || !hasUnitTests(visible)) return;
      setLanguage(lang);
      setFiles(visible);
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, [projectId, revisionId]);

  if (!files) return null;
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <UnitTestsPanel getFiles={() => files} language={language} hint={studentName ? `${studentName}'s tests, on this version` : "On this version"} />
    </div>
  );
};

export default GradingUnitTests;
