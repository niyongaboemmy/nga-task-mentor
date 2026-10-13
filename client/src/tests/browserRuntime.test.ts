import { describe, expect, it, vi } from "vitest";
import { format, runNode } from "../components/code/browser/nodeShim";
import { formatBox } from "../components/code/browser/sqlFormat";
import { browserEntry, browserRuntime } from "../components/code/browser/browserRun";

const f = (path: string, content = "") => ({ path, content });

describe("in-browser JavaScript (Node.js shim)", () => {
  it("reads all of stdin with fs.readFileSync(0)", async () => {
    const r = await runNode({ "main.js": 'const [a, b] = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(`Sum: ${a + b}`);' }, "main.js", "4 8\n");
    expect(r).toEqual({ stdout: "Sum: 12\n", stderr: "", exit_code: 0 });
  });

  it("delivers lines to readline, then close (the js-io-readline starter)", async () => {
    const code = `const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
const numbers = [];
rl.on("line", (line) => { for (const w of line.split(/\\s+/)) if (w !== "") numbers.push(Number(w)); });
rl.on("close", () => {
  if (numbers.length === 0) { console.log("No numbers"); return; }
  console.log(\`Biggest: \${Math.max(...numbers)}\`);
  console.log(\`Smallest: \${Math.min(...numbers)}\`);
});`;
    expect((await runNode({ "main.js": code }, "main.js", "3\n-7\n10\n")).stdout).toBe("Biggest: 10\nSmallest: -7\n");
    expect((await runNode({ "main.js": code }, "main.js", "")).stdout).toBe("No numbers\n");
  });

  it("answers rl.question and async iteration", async () => {
    const q = `const rl = require("readline").createInterface({ input: process.stdin });
rl.question("Name? ", (n) => { console.log("Hi " + n); rl.close(); });`;
    expect((await runNode({ "main.js": q }, "main.js", "Ada\n")).stdout).toBe("Name? Hi Ada\n");
    const it = `(async () => { const rl = require("readline").createInterface({ input: process.stdin }); let t = 0; for await (const l of rl) t += Number(l); console.log(t); })();`;
    expect((await runNode({ "main.js": it }, "main.js", "1\n2\n3\n")).stdout).toBe("6\n");
  });

  it("loads local modules with require", async () => {
    const r = await runNode({ "main.js": 'const { add } = require("./lib/math");\nconsole.log(add(2, 3));', "lib/math.js": "exports.add = (a, b) => a + b;" }, "main.js", "");
    expect(r.stdout).toBe("5\n");
  });

  it("reports crashes, process.exit and async errors like Node", async () => {
    const crash = await runNode({ "main.js": 'console.log("before");\nnull.x;' }, "main.js", "");
    expect(crash.exit_code).toBe(1);
    expect(crash.stdout).toBe("before\n");
    expect(crash.stderr).toMatch(/TypeError/);
    expect((await runNode({ "main.js": "console.log(1); process.exit(3); console.log(2);" }, "main.js", "")).exit_code).toBe(3);
    const later = await runNode({ "main.js": 'setTimeout(() => { throw new Error("late") }, 5);' }, "main.js", "");
    expect(later.exit_code).toBe(1);
    expect(later.stderr).toMatch(/late/);
  });

  it("waits for timers before finishing", async () => {
    const r = await runNode({ "main.js": 'setTimeout(() => console.log("b"), 20);\nconsole.log("a");' }, "main.js", "");
    expect(r.stdout).toBe("a\nb\n");
  });

  it("refuses npm packages, so the server runs them", async () => {
    await expect(runNode({ "main.js": 'require("express");' }, "main.js", "")).rejects.toThrow(/express/);
  });

  it("prints values the way console.log does", () => {
    expect(format([[1, 2, 3]])).toBe("[ 1, 2, 3 ]");
    expect(format([{ a: 1, b: "x" }])).toBe("{ a: 1, b: 'x' }");
    expect(format(["%s is %d", "age", 42])).toBe("age is 42");
    expect(format(["a", 1, null])).toBe("a 1 null");
  });
});

describe("in-browser SQL output", () => {
  it("matches sqlite3 -header -box", () => {
    expect(formatBox({ columns: ["name", "class"], values: [["Grace", "S4B"], ["Jean", "S4B"]] })).toBe(
      "┌───────┬───────┐\n│ name  │ class │\n├───────┼───────┤\n│ Grace │ S4B   │\n│ Jean  │ S4B   │\n└───────┴───────┘\n",
    );
  });
});

describe("choosing the in-browser runtime", () => {
  it("runs simple programs in the browser and projects on the server", () => {
    vi.stubGlobal("Worker", class {});
    expect(browserRuntime([f("main.py")], "python", "main.py")).toBe("python");
    expect(browserRuntime([f("app.py"), f("requirements.txt")], "python", null)).toBeNull();
    expect(browserRuntime([f("main.js", "console.log(1)")], "javascript", null)).toBe("javascript");
    expect(browserRuntime([f("main.js"), f("package.json")], "javascript", null)).toBeNull();
    expect(browserRuntime([f("main.js", 'import fs from "fs";')], "javascript", null)).toBeNull();
    expect(browserRuntime([f("main.sql"), f("schema.sql")], "sql", null)).toBe("sql");
    expect(browserRuntime([f("Main.java")], "java", null)).toBeNull();
    vi.unstubAllGlobals();
    expect(browserRuntime([f("main.py")], "python", "main.py")).toBeNull();
  });

  it("finds the file to run", () => {
    expect(browserEntry("sql", [f("schema.sql"), f("seed.sql"), f("queries.sql")], null)).toBe("queries.sql");
    expect(browserEntry("python", [f("test_x.py"), f("solution.py")], null)).toBe("solution.py");
    expect(browserEntry("javascript", [f("main.js")], "main.js")).toBe("main.js");
  });
});
