import type { CodeFile } from "../../services/codeApi";

/** Visible input/output tests shipped with a project (.nga/tests.json, or TMCode's .tmcode/tests.json). */
export interface IoTest {
  id: string;
  name?: string;
  input: string;
  expected_output: string;
  points?: number;
}

export const TEST_FILES = [".nga/tests.json", ".tmcode/tests.json"];

export function readIoTests(files: CodeFile[]): { entry: string | null; tests: IoTest[] } {
  for (const name of TEST_FILES) {
    const f = files.find((x) => x.path === name);
    if (!f) continue;
    try {
      const data = JSON.parse(f.content);
      const tests = Array.isArray(data?.tests)
        ? data.tests
            .filter((t: unknown) => t && typeof t === "object")
            .map((t: Record<string, unknown>, i: number) => ({
              id: String(t.id ?? `t${i + 1}`),
              name: t.name ? String(t.name) : undefined,
              input: String(t.input ?? ""),
              expected_output: String(t.expected_output ?? ""),
              points: t.points != null ? Number(t.points) : undefined,
            }))
        : [];
      return { entry: data?.entry ? String(data.entry) : null, tests };
    } catch {
      return { entry: null, tests: [] };
    }
  }
  return { entry: null, tests: [] };
}

/** Files students see in the tree (the test definitions stay hidden). */
export const isHiddenFile = (path: string) => TEST_FILES.includes(path) || path.startsWith(".nga/") || path.startsWith(".tmcode/");

/** Unit-test files by the usual naming rules (pytest, JUnit, node:test/Jest, go test, cargo, RSpec…). */
const UNIT_TEST_FILE =
  /(^|\/)(test_[^/]+\.py|[^/]+_test\.(py|go|rb|exs)|[^/]+\.(test|spec)\.(js|ts|mjs|cjs|jsx|tsx)|[^/]+(Test|Tests)\.(java|kt|cs|scala|swift)|[^/]+_spec\.rb)$|(^|\/)(tests?|spec|__tests__)\/[^/]+\.\w+$|(^|\/)src\/test\//;

/** Whether a project has unit tests to run (beyond its input/output tests). */
export const hasUnitTests = (files: CodeFile[]) =>
  files.some((f) => UNIT_TEST_FILE.test(f.path) || (f.path.endsWith(".rs") && /#\[(cfg\()?test\)?\]/.test(f.content)));
