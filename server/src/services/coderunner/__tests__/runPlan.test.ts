import { javaFilePath, planRun } from "../runPlan";
import { javaPackage, programFiles } from "../../../tmcode/practical/run";
import * as judgeInfo from "../judgeInfo";
import * as projectKind from "../projectKind";

/**
 * What a run sends to the code runner (planRun): the request the MIS Code
 * Playground, the project editor and the grading workspace all build, per
 * language. The live matrix (liveRunMatrix.test.ts) runs the same cases on a
 * real tm-judge.
 */

const CATALOG = new Set(["java", "c", "cpp", "python", "javascript", "typescript", "go", "rust", "kotlin", "lua", "dart", "sql", "bash", "php", "ruby", "swift"]);
const runner: any = { name: "tmjudge", supportsLanguage: () => true, languages: () => [...CATALOG], engineFor: () => "tmjudge" };

const files = (o: Record<string, string>) => Object.entries(o).map(([path, content]) => ({ path, content }));
const paths = (plan: any) => plan.files.map((f: { path: string }) => f.path).sort();

const JAVA_TASKS = {
  "Task1/Task1.java": 'public class Task1 { public static void main(String[] a) { System.out.println("1"); } }\n',
  "Task3/Task3.java": "class Pet { Pet(String n, int a) {} }\npublic class Task3 { public static void main(String[] a) { new Pet(\"Rex\", 3); } }\n",
  "Task7/Task7.java": 'class Pet { Pet(String n, String k) {} void displayRecords() {} }\npublic class Task7 { public static void main(String[] a) { new Pet("Rex", "dog").displayRecords(); } }\n',
  "README.md": "# Assignment 1\n",
};

beforeEach(() => {
  jest.spyOn(judgeInfo, "judgeHas").mockReturnValue(true);
  jest.spyOn(judgeInfo, "judgeRunsLanguage").mockImplementation((l) => CATALOG.has(l));
  jest.spyOn(projectKind, "detectProject").mockResolvedValue(null);
});
afterEach(() => jest.restoreAllMocks());

describe("planRun: the request every Run sends", () => {
  it("names a Java entry after its public class, like the playground (and keeps the student's name to show)", async () => {
    const plan: any = await planRun({ files: files({ "Main.java": "public class Calculator { public static void main(String[] a) {} }" }), language: "java" }, runner);
    expect(plan).toMatchObject({ ok: true, mode: "language", language: "java", kind: null, entry: "Calculator.java", original_entry: "Main.java" });
    expect(paths(plan)).toEqual(["Calculator.java"]);
    // Already right, or a file of that name exists: unchanged.
    const same: any = await planRun({ files: files({ "src/Calculator.java": "/* public class Main */ public final class Calculator {}\nclass X { public static void main(String[] a) {} }" }), language: "java" }, runner);
    expect(same).toMatchObject({ entry: "src/Calculator.java", original_entry: null });
    expect(javaFilePath("a/B.java", "class B {}")).toBe("a/B.java");
    expect(javaFilePath("a/Main.java", "public record Point(int x) {}")).toBe("a/Point.java");
  });

  it("runs one Task folder of independent Java programs: Task1 and Task3 each without the other Pets", async () => {
    const t1: any = await planRun({ files: files(JAVA_TASKS), language: "java", entry: "Task1/Task1.java" }, runner);
    expect(t1).toMatchObject({ ok: true, entry: "Task1/Task1.java" });
    expect(paths(t1)).toEqual(["README.md", "Task1/Task1.java"]);
    const t3: any = await planRun({ files: files(JAVA_TASKS), language: "java", entry: "Task3/Task3.java" }, runner);
    expect(paths(t3)).toEqual(["README.md", "Task3/Task3.java"]);
    // Asked as the catalog's java/single kind (an older Run tab): the same scope.
    const kind: any = await planRun({ files: files(JAVA_TASKS), language: "java", kind: "java/single", entry: "Task7/Task7.java" }, runner);
    expect(kind).toMatchObject({ mode: "project", kind: "java/single" });
    expect(paths(kind)).toEqual(["README.md", "Task7/Task7.java"]);
  });

  it("keeps a Java program's package tree and same-folder classes, leaving other exercises out", async () => {
    const plan: any = await planRun(
      {
        files: files({
          "src/rw/ac/nga/Main.java": "package rw.ac.nga;\nimport rw.ac.nga.model.Student;\npublic class Main { public static void main(String[] a) {} }",
          "src/rw/ac/nga/model/Student.java": "package rw.ac.nga.model;\npublic class Student {}",
          "src/rw/ac/nga/Helper.java": "package rw.ac.nga;\nclass Helper {}",
          "old/Main.java": "public class Main { public static void main(String[] a) {} }\nclass Student {}",
        }),
        language: "java",
        entry: "src/rw/ac/nga/Main.java",
      },
      runner,
    );
    expect(paths(plan)).toEqual(["src/rw/ac/nga/Helper.java", "src/rw/ac/nga/Main.java", "src/rw/ac/nga/model/Student.java"]);
    // Root programs keep the classes beside them (and their own packages), not Task folders.
    const root = programFiles(
      files({ "Main.java": "public class Main { public static void main(String[] a) {} }", "Shape.java": "class Shape {}", "geo/Point.java": "package geo; public class Point {}", "Task1/Task1.java": "public class Task1 {}" }),
      "java",
      "Main.java",
      new Map(Object.entries({ "Main.java": "", "Shape.java": "", "geo/Point.java": "package geo; public class Point {}", "Task1/Task1.java": "public class Task1 {}" })),
    ).map((f) => f.path);
    expect(root).toEqual(["Main.java", "Shape.java", "geo/Point.java"]);
    expect(javaPackage("// package nope;\n/* package no; */\npackage a . b ;")).toBe("a.b");
  });

  it("runs one exercise folder in C, C++, Go and Kotlin, keeping helpers and headers", async () => {
    const c: any = await planRun({ files: files({ "ex1/main.c": "int main(void){return 0;}", "ex2/main.c": '#include "u.h"\nint main(void){return sq(2);}', "ex2/u.c": "int sq(int n){return n*n;}", "ex2/u.h": "int sq(int);" }), language: "c", entry: "ex2/main.c" }, runner);
    expect(paths(c)).toEqual(["ex2/main.c", "ex2/u.c", "ex2/u.h"]);
    // A program at the root keeps its helpers anywhere, but not the exercise folders' programs.
    const rootC: any = await planRun({ files: files({ "main.c": "int main(void){return 0;}", "lib/util.c": "int u(void){return 1;}", "lab1/main.c": "int main(void){return 1;}", "lab1/x.c": "int x;" }), language: "c", entry: "main.c" }, runner);
    expect(paths(rootC)).toEqual(["lib/util.c", "main.c"]);
    const cpp: any = await planRun({ files: files({ "a/main.cpp": "int main(){}", "b/main.cpp": "int main(){}" }), language: "cpp", entry: "b/main.cpp" }, runner);
    expect(paths(cpp)).toEqual(["b/main.cpp"]);
    const go: any = await planRun({ files: files({ "ex1/main.go": "package main\nfunc main(){}", "ex2/main.go": "package main\nfunc main(){}" }), language: "go", entry: "ex2/main.go" }, runner);
    expect(paths(go)).toEqual(["ex2/main.go"]);
    const kt: any = await planRun({ files: files({ "ex1/Main.kt": "fun main() {}", "ex2/Main.kt": "fun main() {}", "ex2/Util.kt": "fun twice(n: Int) = n * 2" }), language: "kotlin", entry: "ex2/Main.kt" }, runner);
    expect(paths(kt)).toEqual(["ex2/Main.kt", "ex2/Util.kt"]);
  });

  it("sends every source of an interpreted language (it loads only what it imports)", async () => {
    const plan: any = await planRun({ files: files({ "week1/main.py": "print(1)", "week2/main.py": "print(2)", "week2/helpers.py": "x = 1" }), language: "python", entry: "week2/main.py" }, runner);
    expect(plan).toMatchObject({ mode: "language", language: "python", entry: "week2/main.py" });
    expect(paths(plan)).toEqual(["week1/main.py", "week2/helpers.py", "week2/main.py"]);
  });

  it("runs TypeScript as its language (the playground's path), not the esbuild single-file kind", async () => {
    const plan: any = await planRun({ files: files({ "main.ts": "const n: number = 1;" }), language: "typescript" }, runner);
    expect(plan).toMatchObject({ mode: "language", language: "typescript", kind: null, entry: "main.ts" });
  });

  it("sends a project with a build file whole, for the runner to build", async () => {
    const plan: any = await planRun({ files: files({ "pom.xml": "<project/>", "src/main/java/App.java": "public class App {}", "node_modules/x/i.js": "" }), language: "java" }, runner);
    expect(plan).toMatchObject({ ok: true, mode: "project", language: "java", kind: null, entry: null });
    expect(paths(plan)).toEqual(["pom.xml", "src/main/java/App.java"]);
  });

  it("runs a language known only to the catalog (Lua, Dart, SQL…) as a project, by the project's language", async () => {
    const plan: any = await planRun({ files: files({ "main.lua": "print(1)" }), projectLanguage: "lua" }, runner);
    expect(plan).toMatchObject({ ok: true, mode: "project", language: "lua" });
    const asked: any = await planRun({ files: files({ "main.sql": "SELECT 1;" }), language: "sql", entry: "main.sql" }, runner);
    expect(asked).toMatchObject({ ok: true, mode: "project", language: "sql", entry: "main.sql" });
  });

  it("says plainly when there's nothing to run: web pages, browser apps, a kind the runner lacks", async () => {
    expect(await planRun({ files: files({ "index.html": "<h1/>" }), language: "html" }, runner)).toMatchObject({ ok: false, code: "USE_PREVIEW" });
    expect(await planRun({ files: files({ "README.md": "hi" }) }, runner)).toMatchObject({ ok: false, code: "NOTHING_TO_RUN" });
    const app = { kind: "js/vite", label: "React app (Vite)", language: "javascript", entry: null, actions: ["build", "test"], available: true, webApp: true };
    expect(await planRun({ files: files({ "package.json": "{}", "src/App.jsx": "" }), language: "javascript", detected: app }, runner)).toMatchObject({ ok: false, code: "NOT_A_PROGRAM" });
    const cmake = { kind: "cpp/cmake", label: "C++ – CMake project", language: "cpp", entry: null, actions: ["build", "run", "test"], available: false, webApp: false };
    expect(await planRun({ files: files({ "CMakeLists.txt": "", "main.cpp": "int main(){}" }), language: "cpp", detected: cmake }, runner)).toMatchObject({ ok: false, code: "RUNTIME_UNAVAILABLE" });
  });
});
