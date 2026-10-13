import React, { useMemo, useState } from "react";
import CodeWorkspace from "./CodeWorkspace";
import { entryFileFor } from "./languages";
import { answerToFiles } from "./answerFiles";

/**
 * A student's coding answer for the teacher (CODE_RUNNER_PLAN.md §7.6): the
 * files, read-only, in the code workspace — with Run and the question's tests
 * (hidden ones included: this is the teacher's view). Replaces the plain
 * text block on the submission page.
 */

interface TestCase {
  id?: string | number;
  input?: string;
  expected_output?: string;
  is_hidden?: boolean;
  points?: number;
}

const CodeAnswerView: React.FC<{ code: string; language: string | null | undefined; tests?: TestCase[]; height?: number }> = ({
  code,
  language,
  tests = [],
  height = 460,
}) => {
  const files = useMemo(() => {
    const own = answerToFiles(code, language);
    if (!tests.length) return own;
    const entry = own.find((f) => f.path === entryFileFor(language))?.path ?? own[0]?.path;
    const ioTests = tests.map((t, i) => ({
      id: String(t.id ?? i + 1),
      name: `${t.is_hidden ? "Hidden test" : "Test"} ${i + 1}`,
      input: t.input ?? "",
      expected_output: t.expected_output ?? "",
      points: t.points ?? 1,
    }));
    return [...own, { path: ".nga/tests.json", content: JSON.stringify({ entry, tests: ioTests }) }];
  }, [code, language, tests]);
  const [current, setCurrent] = useState(files);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10" style={{ height }} data-testid="code-answer">
      <CodeWorkspace files={current} onFilesChange={setCurrent} readOnly language={language ?? null} storageKey="answer" />
    </div>
  );
};

export default CodeAnswerView;
