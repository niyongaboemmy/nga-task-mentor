import React from "react";
import { FileCode2, Plus, Trash2 } from "lucide-react";
import type { CodingData } from "../../../types/quiz.types";

/**
 * The teacher's unit tests for a coding question (check_with "unit"): test
 * files that run with each student's answer when it is graded. Students
 * never see them; they see each test's name and whether it passed.
 */

const EXAMPLE: Record<string, { path: string; content: string }> = {
  python: { path: "tests/test_main.py", content: "from main import add\n\n\ndef test_adds_two_numbers():\n    assert add(2, 3) == 5\n" },
  javascript: { path: "test/main.test.js", content: 'const test = require("node:test");\nconst assert = require("node:assert");\nconst { add } = require("../main");\n\ntest("adds two numbers", () => {\n  assert.strictEqual(add(2, 3), 5);\n});\n' },
  java: { path: "src/test/java/MainTest.java", content: "import org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.assertEquals;\n\nclass MainTest {\n    @Test\n    void addsTwoNumbers() {\n        assertEquals(5, Main.add(2, 3));\n    }\n}\n" },
  go: { path: "main_test.go", content: 'package main\n\nimport "testing"\n\nfunc TestAdd(t *testing.T) {\n\tif add(2, 3) != 5 {\n\t\tt.Fatal("add(2, 3) should be 5")\n\t}\n}\n' },
};

const UnitTestFiles: React.FC<{ codingData: CodingData; onChange: (d: CodingData) => void }> = ({ codingData, onChange }) => {
  const files = codingData.unit_test_files ?? [];
  const set = (next: { path: string; content: string }[]) => onChange({ ...codingData, unit_test_files: next });
  const add = () => {
    const ex = EXAMPLE[codingData.language] ?? { path: "tests/test_main", content: "" };
    set([...files, files.length ? { path: "", content: "" } : ex]);
  };

  return (
    <div className="space-y-3" data-testid="unit-test-files">
      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
        These files run with each student's answer when it is graded (pytest, JUnit, node:test, go test…). The score is the share of tests that pass. Students see each test's name and result, never the test code.
      </p>
      {files.map((f, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
            <FileCode2 className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            <label className="min-w-0 flex-1">
              <span className="sr-only">Test file path</span>
              <input
                value={f.path}
                onChange={(e) => set(files.map((x, j) => (j === i ? { ...x, path: e.target.value } : x)))}
                placeholder="tests/test_main.py"
                className="w-full bg-transparent font-mono text-xs outline-none"
                data-testid="unit-test-path"
              />
            </label>
            <button type="button" onClick={() => set(files.filter((_, j) => j !== i))} className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-rose-600 dark:hover:bg-gray-700" aria-label={`Remove ${f.path || "this file"}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <label className="block">
            <span className="sr-only">Test code</span>
            <textarea
              value={f.content}
              onChange={(e) => set(files.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))}
              rows={Math.min(18, Math.max(6, f.content.split("\n").length + 1))}
              spellCheck={false}
              className="block w-full resize-y bg-slate-950 p-3 font-mono text-xs text-slate-100 outline-none"
              data-testid="unit-test-content"
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-text-secondary-light hover:border-primary hover:text-primary dark:border-gray-600"
        data-testid="add-unit-test-file"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {files.length ? "Add another test file" : "Add a test file"}
      </button>
    </div>
  );
};

export default UnitTestFiles;
