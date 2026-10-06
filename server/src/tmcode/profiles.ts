/**
 * TMCode language profiles (plan §7.2), copied as data from
 * nga-tmcode/packages/profiles (this repo can't import that one). The exam
 * package carries these, so they are the authoritative copies for an exam;
 * keep them in step with packages/profiles when a profile changes.
 */

export interface ProfileLimits {
  cpu_s: number;
  wall_s: number;
  memory_mb: number;
  output_kb: number;
}

export interface ProfileStep {
  tool: "python" | "node" | "cc" | "cxx" | "javac" | "java" | "exe";
  args: string[];
}

export interface TmcodeProfile {
  id: string;
  version: number;
  label: string;
  monaco_language: string;
  extensions: string[];
  entry_point: string;
  template: Array<{ path: string; content: string }>;
  local: { build: ProfileStep[]; run: ProfileStep; fallback?: "pyodide" | "js-worker" | "server" } | null;
  judge: { engine: string; language: string; version: string } | null;
  preview: "static" | "bundle-react" | null;
  test_kinds: Array<"io" | "unit-pytest" | "unit-node" | "unit-junit" | "web">;
  limits: ProfileLimits;
}

const LIMITS: ProfileLimits = { cpu_s: 5, wall_s: 10, memory_mb: 256, output_kb: 256 };
const COMPILED: ProfileLimits = { cpu_s: 5, wall_s: 15, memory_mb: 256, output_kb: 256 };

export const PROFILES: TmcodeProfile[] = [
  {
    id: "python-3",
    version: 1,
    label: "Python 3",
    monaco_language: "python",
    extensions: ["py"],
    entry_point: "main.py",
    template: [{ path: "main.py", content: 'name = input("What is your name? ")\nprint(f"Hello, {name}!")\n' }],
    local: { build: [], run: { tool: "python", args: ["-u", "{entry}"] }, fallback: "pyodide" },
    judge: { engine: "piston", language: "python", version: "3.12.*" },
    preview: null,
    test_kinds: ["io", "unit-pytest"],
    limits: LIMITS,
  },
  {
    id: "node-22",
    version: 1,
    label: "JavaScript (Node.js)",
    monaco_language: "javascript",
    extensions: ["js", "mjs", "cjs"],
    entry_point: "main.js",
    template: [{ path: "main.js", content: 'console.log("Hello, NGA!");\n' }],
    local: { build: [], run: { tool: "node", args: ["{entry}"] }, fallback: "js-worker" },
    judge: { engine: "piston", language: "javascript", version: "22.*" },
    preview: null,
    test_kinds: ["io", "unit-node"],
    limits: LIMITS,
  },
  {
    id: "typescript",
    version: 1,
    label: "TypeScript (Node.js)",
    monaco_language: "typescript",
    extensions: ["ts", "mts"],
    entry_point: "main.ts",
    template: [{ path: "main.ts", content: 'const greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("NGA"));\n' }],
    // Node 22.6+ runs TypeScript by stripping types; no compiler needed.
    local: { build: [], run: { tool: "node", args: ["--experimental-strip-types", "--no-warnings", "{entry}"] } },
    judge: { engine: "piston", language: "typescript", version: "5.*" },
    preview: null,
    test_kinds: ["io", "unit-node"],
    limits: LIMITS,
  },
  {
    id: "web",
    version: 1,
    label: "HTML/CSS/JavaScript",
    monaco_language: "html",
    extensions: ["html", "htm", "css"],
    entry_point: "index.html",
    template: [
      {
        path: "index.html",
        content:
          '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>My page</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <h1>Hello, NGA!</h1>\n    <script src="script.js"></script>\n  </body>\n</html>\n',
      },
      { path: "style.css", content: "body {\n  font-family: system-ui, sans-serif;\n  margin: 2rem;\n}\n" },
      { path: "script.js", content: 'console.log("Page loaded");\n' },
    ],
    local: null,
    judge: { engine: "webgrader", language: "web", version: "1" },
    preview: "static",
    test_kinds: ["web"],
    limits: LIMITS,
  },
  {
    id: "react",
    version: 1,
    label: "React",
    monaco_language: "javascript",
    extensions: ["jsx", "tsx"],
    entry_point: "src/main.jsx",
    template: [
      {
        path: "index.html",
        content: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>React app</title>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n',
      },
      {
        path: "src/main.jsx",
        content:
          'import { createRoot } from "react-dom/client";\nimport App from "./App.jsx";\n\ncreateRoot(document.getElementById("root")).render(<App />);\n',
      },
      {
        path: "src/App.jsx",
        content:
          'import { useState } from "react";\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;\n}\n',
      },
    ],
    local: null,
    judge: { engine: "webgrader", language: "react", version: "19" },
    preview: "bundle-react",
    test_kinds: ["web"],
    limits: LIMITS,
  },
  {
    id: "c17",
    version: 1,
    label: "C (C17)",
    monaco_language: "c",
    extensions: ["c", "h"],
    entry_point: "main.c",
    template: [{ path: "main.c", content: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, NGA!\\n");\n    return 0;\n}\n' }],
    local: {
      build: [{ tool: "cc", args: ["-std=c17", "-Wall", "-O0", "-g", "{sources:c}", "-o", "{out}/main", "-lm"] }],
      run: { tool: "exe", args: ["{out}/main"] },
      fallback: "server",
    },
    judge: { engine: "piston", language: "c", version: "*" },
    preview: null,
    test_kinds: ["io"],
    limits: COMPILED,
  },
  {
    id: "cpp17",
    version: 1,
    label: "C++ (C++17)",
    monaco_language: "cpp",
    extensions: ["cpp", "cc", "cxx", "hpp", "hh"],
    entry_point: "main.cpp",
    template: [{ path: "main.cpp", content: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, NGA!" << std::endl;\n    return 0;\n}\n' }],
    local: {
      build: [{ tool: "cxx", args: ["-std=c++17", "-Wall", "-O0", "-g", "{sources:cpp}", "-o", "{out}/main"] }],
      run: { tool: "exe", args: ["{out}/main"] },
      fallback: "server",
    },
    judge: { engine: "piston", language: "c++", version: "*" },
    preview: null,
    test_kinds: ["io"],
    limits: COMPILED,
  },
  {
    id: "java-21",
    version: 1,
    label: "Java 21",
    monaco_language: "java",
    extensions: ["java"],
    entry_point: "Main.java",
    template: [
      {
        path: "Main.java",
        content: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, NGA!");\n    }\n}\n',
      },
    ],
    local: {
      build: [{ tool: "javac", args: ["-d", "{out}", "-encoding", "UTF-8", "{sources:java}"] }],
      run: { tool: "java", args: ["-cp", "{out}", "{entry_stem}"] },
      fallback: "server",
    },
    judge: { engine: "piston", language: "java", version: "21.*" },
    preview: null,
    test_kinds: ["io", "unit-junit"],
    limits: COMPILED,
  },
];


export const profileById = (id: string): TmcodeProfile | undefined =>
  PROFILES.find((p) => p.id === id);

/**
 * Task Mentor language → profile id (PROTOCOL.md §2). Languages without a
 * profile (go, rust, …) can't be delivered in TMCode or run on tm-judge.
 */
const LANGUAGE_PROFILE: Record<string, string> = {
  python: "python-3",
  py: "python-3",
  python3: "python-3",
  javascript: "node-22",
  js: "node-22",
  node: "node-22",
  typescript: "typescript",
  ts: "typescript",
  c: "c17",
  cpp: "cpp17",
  "c++": "cpp17",
  java: "java-21",
  html: "web",
  css: "web",
  web: "web",
  react: "react",
};

export function profileIdForLanguage(language: unknown): string | null {
  if (typeof language !== "string") return null;
  return LANGUAGE_PROFILE[language.trim().toLowerCase()] ?? null;
}

/** Profiles graded by the browser grader, not by running I/O tests. */
export const isWebProfile = (id: string) => id === "web" || id === "react";
