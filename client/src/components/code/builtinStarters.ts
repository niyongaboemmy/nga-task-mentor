import type { CodeFile } from "../../services/codeApi";

/**
 * Small built-in starters for the Playground: "Hello" and an input/output
 * exercise per language the runner runs today. The full library (every
 * language and project type) comes from the Runtime Catalog's starters.
 */

export interface BuiltinStarter {
  id: string;
  language: string;
  title: string;
  files: CodeFile[];
}

const tests = (entry: string, cases: [string, string, string][]) => ({
  path: ".nga/tests.json",
  content: JSON.stringify(
    { entry, tests: cases.map(([name, input, expected_output], i) => ({ id: `t${i + 1}`, name, input, expected_output, points: 1 })) },
    null,
    2,
  ),
});

const SUM_CASES: [string, string, string][] = [
  ["two numbers", "4 8\n", "Sum: 12\n"],
  ["negatives", "-3 10\n", "Sum: 7\n"],
];

export const BUILTIN_STARTERS: BuiltinStarter[] = [
  { id: "python-hello", language: "python", title: "Hello", files: [{ path: "main.py", content: 'name = input("What is your name? ")\nprint(f"Hello, {name}!")\n' }] },
  {
    id: "python-io",
    language: "python",
    title: "Input/output exercise",
    files: [{ path: "main.py", content: "# Read two whole numbers on one line and print their sum.\na, b = map(int, input().split())\nprint(f\"Sum: {a + b}\")\n" }, tests("main.py", SUM_CASES)],
  },
  {
    id: "javascript-hello",
    language: "javascript",
    title: "Hello",
    files: [{ path: "main.js", content: 'const lines = require("fs").readFileSync(0, "utf8").split("\\n");\nconsole.log(`Hello, ${lines[0] || "world"}!`);\n' }],
  },
  {
    id: "javascript-io",
    language: "javascript",
    title: "Input/output exercise",
    files: [
      { path: "main.js", content: '// Read two whole numbers on one line and print their sum.\nconst [a, b] = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(`Sum: ${a + b}`);\n' },
      tests("main.js", SUM_CASES),
    ],
  },
  {
    id: "typescript-io",
    language: "typescript",
    title: "Input/output exercise",
    files: [
      {
        path: "main.ts",
        content:
          'import { readFileSync } from "fs";\n\n// Read two whole numbers on one line and print their sum.\nconst [a, b]: number[] = readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(`Sum: ${a + b}`);\n',
      },
      tests("main.ts", SUM_CASES),
    ],
  },
  { id: "c-hello", language: "c", title: "Hello", files: [{ path: "main.c", content: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, world!\\n");\n    return 0;\n}\n' }] },
  {
    id: "c-io",
    language: "c",
    title: "Input/output exercise",
    files: [{ path: "main.c", content: '#include <stdio.h>\n\n/* Read two whole numbers and print their sum. */\nint main(void) {\n    int a, b;\n    if (scanf("%d %d", &a, &b) != 2) return 1;\n    printf("Sum: %d\\n", a + b);\n    return 0;\n}\n' }, tests("main.c", SUM_CASES)],
  },
  {
    id: "cpp-io",
    language: "cpp",
    title: "Input/output exercise",
    files: [
      { path: "main.cpp", content: '#include <iostream>\n\n// Read two whole numbers and print their sum.\nint main() {\n    long long a, b;\n    std::cin >> a >> b;\n    std::cout << "Sum: " << a + b << "\\n";\n    return 0;\n}\n' },
      tests("main.cpp", SUM_CASES),
    ],
  },
  {
    id: "java-io",
    language: "java",
    title: "Input/output exercise",
    files: [
      {
        path: "Main.java",
        content:
          'import java.util.Scanner;\n\n/** Read two whole numbers and print their sum. */\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        long a = in.nextLong(), b = in.nextLong();\n        System.out.println("Sum: " + (a + b));\n    }\n}\n',
      },
      tests("Main.java", SUM_CASES),
    ],
  },
  {
    id: "go-io",
    language: "go",
    title: "Input/output exercise",
    files: [{ path: "main.go", content: 'package main\n\nimport "fmt"\n\n// Read two whole numbers and print their sum.\nfunc main() {\n\tvar a, b int\n\tfmt.Scan(&a, &b)\n\tfmt.Printf("Sum: %d\\n", a+b)\n}\n' }, tests("main.go", SUM_CASES)],
  },
  {
    id: "rust-io",
    language: "rust",
    title: "Input/output exercise",
    files: [
      {
        path: "main.rs",
        content:
          'use std::io::Read;\n\n// Read two whole numbers and print their sum.\nfn main() {\n    let mut s = String::new();\n    std::io::stdin().read_to_string(&mut s).unwrap();\n    let n: Vec<i64> = s.split_whitespace().map(|x| x.parse().unwrap()).collect();\n    println!("Sum: {}", n[0] + n[1]);\n}\n',
      },
      tests("main.rs", SUM_CASES),
    ],
  },
];

export const startersFor = (language: string) => BUILTIN_STARTERS.filter((s) => s.language === language);
