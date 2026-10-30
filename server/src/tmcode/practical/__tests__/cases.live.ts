/**
 * Student submissions per language for the live run matrix (liveRun.test.ts):
 * what a program reads, and what it should print for that input.
 */

export interface LiveCase {
  name: string;
  /** The playground's language key (what the MIS Code Playground would send). */
  language: string;
  files: Record<string, string>;
  /** The playground's main file (relay: the entry when there are several files). */
  entry?: string;
  input: string;
  expected: string;
  /**
   * Reads its whole input in one call (Node's readFileSync(0)): fine in a batch run; live, the
   * runner's stdin pipe is non-blocking and Node fails with EAGAIN (the playground's live runs too).
   */
  readsAllAtOnce?: boolean;
  /** Needs a tool this machine may lack (cmake…): reported, not failed. */
  optional?: boolean;
}

const javaScanner = (cls: string, pkg = "") =>
  `${pkg ? `package ${pkg};\n\n` : ""}import java.util.Scanner;\n\npublic class ${cls} {\n  public static void main(String[] args) {\n    Scanner in = new Scanner(System.in);\n    System.out.print("Name: ");\n    String name = in.nextLine();\n    System.out.print("Age: ");\n    int age = in.nextInt();\n    System.out.println("Hello " + name + ", next year you are " + (age + 1));\n  }\n}\n`;

/** Levi's assignment: seven programs in Task folders, Task3 and Task7 each with their own `class Pet`. */
const JAVA_TASKS: Record<string, string> = {
  "Task1/Task1.java": 'import java.util.Scanner;\npublic class Task1 {\n  public static void main(String[] args) {\n    System.out.println("Task1: " + new Scanner(System.in).nextLine());\n  }\n}\n',
  "Task2/Task2.java": 'public class Task2 {\n  public static void main(String[] args) { System.out.println("Task2"); }\n}\n',
  "Task3/Task3.java":
    'import java.util.Scanner;\nclass Pet {\n  String name; int age;\n  Pet(String name, int age) { this.name = name; this.age = age; }\n}\npublic class Task3 {\n  public static void main(String[] args) {\n    Pet p = new Pet(new Scanner(System.in).nextLine(), 3);\n    System.out.println(p.name + " is " + p.age);\n  }\n}\n',
  "Task7/Task7.java":
    'import java.util.Scanner;\nclass Pet {\n  String name, kind;\n  Pet(String name, String kind) { this.name = name; this.kind = kind; }\n  void displayRecords() { System.out.println(name + " (" + kind + ")"); }\n}\npublic class Task7 {\n  public static void main(String[] args) {\n    new Pet(new Scanner(System.in).nextLine(), "dog").displayRecords();\n  }\n}\n',
};
function javaTasks(entry: string, input: string, expected: string): LiveCase[] {
  return [{ name: `java: Task folders, run ${entry}`, language: "java", entry, files: JAVA_TASKS, input, expected }];
}

export const LIVE_CASES: LiveCase[] = [
  // ── Java ──
  { name: "java: Main.java with Scanner", language: "java", files: { "Main.java": javaScanner("Main") }, input: "Ama\n20\n", expected: "Name: Age: Hello Ama, next year you are 21\n" },
  { name: "java: public class not named Main", language: "java", files: { "Calculator.java": javaScanner("Calculator") }, input: "Ama\n20\n", expected: "Name: Age: Hello Ama, next year you are 21\n" },
  {
    name: "java: public class in a file named otherwise",
    language: "java",
    files: { "Main.java": javaScanner("Greeter") },
    input: "Ama\n20\n",
    expected: "Name: Age: Hello Ama, next year you are 21\n",
  },
  { name: "java: package under src/", language: "java", files: { "src/com/school/App.java": javaScanner("App", "com.school") }, input: "Ama\n20\n", expected: "Name: Age: Hello Ama, next year you are 21\n" },
  {
    name: "java: several classes",
    language: "java",
    entry: "Main.java",
    files: {
      "Main.java": 'import java.util.Scanner;\npublic class Main {\n  public static void main(String[] a) {\n    Scanner s = new Scanner(System.in);\n    int n = s.nextInt();\n    System.out.println(new Shape(n).area());\n  }\n}\n',
      "Shape.java": "public class Shape {\n  private final int side;\n  public Shape(int side) { this.side = side; }\n  public int area() { return side * side; }\n}\n",
    },
    input: "7\n",
    expected: "49\n",
  },
  {
    name: "java: Maven project",
    language: "java",
    files: {
      "pom.xml":
        '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>rw.nga</groupId><artifactId>app</artifactId><version>1.0</version><properties><maven.compiler.source>17</maven.compiler.source><maven.compiler.target>17</maven.compiler.target><exec.mainClass>rw.nga.App</exec.mainClass></properties></project>\n',
      "src/main/java/rw/nga/App.java": javaScanner("App", "rw.nga"),
    },
    input: "Ama\n20\n",
    expected: "Name: Age: Hello Ama, next year you are 21\n",
    optional: true,
  },
  {
    name: "java: Gradle project",
    language: "java",
    files: {
      "settings.gradle": "rootProject.name = 'app'\n",
      "build.gradle": "plugins { id 'application' }\napplication { mainClass = 'rw.nga.App' }\n",
      "src/main/java/rw/nga/App.java": javaScanner("App", "rw.nga"),
    },
    input: "Ama\n20\n",
    expected: "Name: Age: Hello Ama, next year you are 21\n",
    optional: true,
  },

  // ── Single files reading stdin ──
  { name: "python", language: "python", files: { "main.py": 'name = input("Name: ")\nprint(f"Hello {name}")\n' }, input: "Ama\n", expected: "Name: Hello Ama\n" },
  { name: "javascript (node)", language: "javascript", readsAllAtOnce: true, files: { "main.js": 'const lines = require("fs").readFileSync(0, "utf8").trim().split("\\n");\nconsole.log(Number(lines[0]) * 2);\n' }, input: "21\n", expected: "42\n" },
  {
    name: "typescript",
    language: "typescript",
    readsAllAtOnce: true,
    files: { "main.ts": 'const text: string = require("fs").readFileSync(0, "utf8");\nconst n: number = Number(text.trim());\nconsole.log(`double: ${n * 2}`);\n' },
    input: "21\n",
    expected: "double: 42\n",
  },
  {
    name: "javascript: readline prompt",
    language: "javascript",
    files: { "main.js": 'const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });\nrl.question("Name: ", (n) => { console.log(`Hi ${n}`); rl.close(); });\n' },
    input: "Ama\n",
    expected: "Name: Hi Ama\n",
  },
  {
    name: "typescript: readline prompt",
    language: "typescript",
    files: { "main.ts": 'import * as readline from "readline";\nconst rl = readline.createInterface({ input: process.stdin, output: process.stdout });\nrl.question("n: ", (a: string) => { console.log(Number(a) * 2); rl.close(); });\n' },
    input: "21\n",
    expected: "n: 42\n",
  },
  { name: "c", language: "c", files: { "main.c": '#include <stdio.h>\nint main(void){int a,b;printf("Two numbers: ");scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}\n' }, input: "2 3\n", expected: "Two numbers: 5\n" },
  { name: "cpp", language: "cpp", files: { "main.cpp": '#include <iostream>\nusing namespace std;\nint main(){string n;cout<<"Name: ";getline(cin,n);cout<<"Hi "<<n<<endl;}\n' }, input: "Ama\n", expected: "Name: Hi Ama\n" },
  { name: "go", language: "go", files: { "main.go": 'package main\nimport "fmt"\nfunc main(){var n int\nfmt.Print("n: ")\nfmt.Scan(&n)\nfmt.Println(n*n)}\n' }, input: "9\n", expected: "n: 81\n" },
  { name: "rust", language: "rust", files: { "main.rs": 'use std::io::*;\nfn main(){let mut s=String::new();stdin().read_line(&mut s).unwrap();let n:i32=s.trim().parse().unwrap();println!("{}",n+1);}\n' }, input: "41\n", expected: "42\n" },
  { name: "php (CLI)", language: "php", files: { "main.php": '<?php\n$n = (int) trim(fgets(STDIN));\necho $n * 3, "\\n";\n' }, input: "14\n", expected: "42\n" },
  { name: "ruby", language: "ruby", files: { "main.rb": 'print "Name: "\nname = gets.chomp\nputs "Hi #{name}"\n' }, input: "Ama\n", expected: "Name: Hi Ama\n" },
  { name: "kotlin", language: "kotlin", files: { "Main.kt": 'fun main() {\n  print("n: ")\n  val n = readLine()!!.trim().toInt()\n  println(n * 2)\n}\n' }, input: "21\n", expected: "n: 42\n" },
  { name: "swift", language: "swift", files: { "main.swift": 'print("Name: ", terminator: "")\nlet n = readLine() ?? ""\nprint("Hi \\(n)")\n' }, input: "Ama\n", expected: "Name: Hi Ama\n" },
  { name: "lua", language: "lua", files: { "main.lua": 'io.write("n: ")\nlocal n = io.read("n")\nprint(n * 2)\n' }, input: "21\n", expected: "n: 42\n" },
  { name: "dart", language: "dart", files: { "main.dart": "import 'dart:io';\nvoid main() {\n  stdout.write('Name: ');\n  final n = stdin.readLineSync();\n  print('Hi $n');\n}\n" }, input: "Ama\n", expected: "Name: Hi Ama\n" },
  { name: "sql (sqlite)", language: "sql", files: { "main.sql": "CREATE TABLE t(n INT);\nINSERT INTO t VALUES (1),(2),(3);\nSELECT SUM(n) FROM t;\n" }, input: "", expected: "┌────────┐\n│ SUM(n) │\n├────────┤\n│ 6      │\n└────────┘\n" },
  { name: "bash", language: "bash", files: { "main.sh": 'read -p "Name: " name\necho "Hi $name"\n' }, input: "Ama\n", expected: "Hi Ama\n" },

  // ── Several files, imports and includes ──
  {
    name: "python: imports a module",
    language: "python",
    entry: "main.py",
    files: { "main.py": "from helpers import double\nprint(double(int(input())))\n", "helpers.py": "def double(n):\n    return n * 2\n" },
    input: "21\n",
    expected: "42\n",
  },
  {
    name: "c: main.c + util.c + util.h",
    language: "c",
    entry: "main.c",
    files: {
      "main.c": '#include <stdio.h>\n#include "util.h"\nint main(void){int n;scanf("%d",&n);printf("%d\\n",square(n));return 0;}\n',
      "util.c": '#include "util.h"\nint square(int n){return n*n;}\n',
      "util.h": "int square(int n);\n",
    },
    input: "7\n",
    expected: "49\n",
  },
  {
    name: "cpp: main.cpp + shape.cpp + shape.h",
    language: "cpp",
    entry: "main.cpp",
    files: {
      "main.cpp": '#include <iostream>\n#include "shape.h"\nint main(){int n;std::cin>>n;std::cout<<area(n)<<std::endl;}\n',
      "shape.cpp": '#include "shape.h"\nint area(int n){return n*n;}\n',
      "shape.h": "int area(int n);\n",
    },
    input: "6\n",
    expected: "36\n",
  },
  {
    name: "javascript: require a module",
    language: "javascript",
    readsAllAtOnce: true,
    entry: "index.js",
    files: { "index.js": 'const { add } = require("./lib/math");\nconst [a, b] = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(add(a, b));\n', "lib/math.js": "exports.add = (a, b) => a + b;\n" },
    input: "40 2\n",
    expected: "42\n",
  },

  // ── Projects with build files ──
  {
    name: "c: Makefile",
    language: "c",
    files: {
      Makefile: "app: main.c util.c\n\tcc -o app main.c util.c\n\nrun: app\n\t./app\n",
      "main.c": '#include <stdio.h>\nint square(int);\nint main(void){int n;scanf("%d",&n);printf("%d\\n",square(n));return 0;}\n',
      "util.c": "int square(int n){return n*n;}\n",
    },
    input: "5\n",
    expected: "25\n",
  },
  {
    name: "cpp: CMakeLists.txt",
    language: "cpp",
    files: { "CMakeLists.txt": "cmake_minimum_required(VERSION 3.10)\nproject(app CXX)\nadd_executable(app main.cpp)\n", "main.cpp": "#include <iostream>\nint main(){int n;std::cin>>n;std::cout<<n*2<<std::endl;}\n" },
    input: "21\n",
    expected: "42\n",
    optional: true,
  },
  {
    name: "node: package.json",
    language: "javascript",
    files: {
      "package.json": '{ "name": "app", "version": "1.0.0", "main": "src/index.js", "scripts": { "start": "node src/index.js" } }\n',
      "src/index.js": 'const rl = require("readline").createInterface({ input: process.stdin });\nrl.question("n: ", (a) => { console.log(Number(a) * 2); rl.close(); });\n',
    },
    input: "21\n",
    expected: "42\n",
  },
  {
    name: "python: requirements.txt",
    language: "python",
    files: { "requirements.txt": "", "app.py": "def main():\n    n = int(input())\n    print(n * 2)\n\nif __name__ == '__main__':\n    main()\n" },
    input: "21\n",
    expected: "42\n",
  },
  {
    name: "go: module",
    language: "go",
    files: { "go.mod": "module example.com/app\n\ngo 1.21\n", "main.go": 'package main\nimport ("fmt"; "example.com/app/calc")\nfunc main(){var n int\nfmt.Scan(&n)\nfmt.Println(calc.Double(n))}\n', "calc/calc.go": "package calc\nfunc Double(n int) int { return n * 2 }\n" },
    input: "21\n",
    expected: "42\n",
  },
  {
    name: "rust: Cargo",
    language: "rust",
    files: { "Cargo.toml": '[package]\nname = "app"\nversion = "0.1.0"\nedition = "2021"\n', "src/main.rs": 'use std::io::*;\nfn main(){let mut s=String::new();stdin().read_line(&mut s).unwrap();println!("{}", s.trim().parse::<i32>().unwrap()*2);}\n' },
    input: "21\n",
    expected: "42\n",
  },
  // ── TMCode projects as students keep them ──
  {
    name: "java: TMCode starter (.nga/tests.json, README)",
    language: "java",
    entry: "Main.java",
    files: {
      ".nga/tests.json": '{ "entry": "Main.java", "tests": [] }\n',
      "README.md": "# Java\n",
      "Main.java": 'import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner in = new Scanner(System.in);\n    System.out.print("What is your name? ");\n    System.out.println("Hello, " + in.nextLine() + "!");\n  }\n}\n',
    },
    input: "Ada\n",
    expected: "What is your name? Hello, Ada!\n",
  },
  {
    name: "java: class + JUnit test beside it",
    language: "java",
    // The runner's JUnit jar (/opt/junit) is on the classpath only on a real runner.
    optional: true,
    entry: "Main.java",
    files: {
      "Grades.java": 'public class Grades { public static String letter(int m) { return m >= 50 ? "pass" : "fail"; } }\n',
      "GradesTest.java": 'import static org.junit.jupiter.api.Assertions.assertEquals;\nimport org.junit.jupiter.api.Test;\nclass GradesTest { @Test void pass() { assertEquals("pass", Grades.letter(60)); } }\n',
      "Main.java": 'import java.util.Scanner;\npublic class Main { public static void main(String[] a) { System.out.println(Grades.letter(new Scanner(System.in).nextInt())); } }\n',
    },
    input: "70\n",
    expected: "pass\n",
  },
  {
    name: "java: exercises in folders, each a Main",
    language: "java",
    entry: "ex2/Main.java",
    files: {
      "ex1/Main.java": 'public class Main { public static void main(String[] a) { System.out.println("ex1"); } }\n',
      "ex2/Main.java": 'import java.util.Scanner;\npublic class Main { public static void main(String[] a) { System.out.println(new Scanner(System.in).nextInt() * 2); } }\n',
    },
    input: "21\n",
    expected: "42\n",
  },
  {
    name: "c: exercises in folders, each with main()",
    language: "c",
    entry: "ex2/main.c",
    files: {
      "ex1/main.c": '#include <stdio.h>\nint main(void){puts("ex1");return 0;}\n',
      "ex2/main.c": '#include <stdio.h>\nint main(void){int n;scanf("%d",&n);printf("%d\\n",n*2);return 0;}\n',
    },
    input: "21\n",
    expected: "42\n",
  },
  {
    name: "python: exercises in folders",
    language: "python",
    entry: "week2/main.py",
    files: { "week1/main.py": "print('week1')\n", "week2/main.py": "print(int(input()) * 2)\n" },
    input: "21\n",
    expected: "42\n",
  },
  {
    name: "typescript: several files",
    language: "typescript",
    readsAllAtOnce: true,
    entry: "main.ts",
    files: { "main.ts": 'import { double } from "./math";\nconst n: number = Number(require("fs").readFileSync(0, "utf8").trim());\nconsole.log(double(n));\n', "math.ts": "export const double = (n: number): number => n * 2;\n" },
    input: "21\n",
    expected: "42\n",
  },
  // ── "Assignment 1 of Java Programming": independent programs in folders ──
  ...javaTasks("Task1/Task1.java", "Ama\n", "Task1: Ama\n"),
  ...javaTasks("Task3/Task3.java", "Rex\n", "Rex is 3\n"),
  ...javaTasks("Task7/Task7.java", "Rex\n", "Rex (dog)\n"),
  {
    name: "kotlin: exercises in folders, each with main",
    language: "kotlin",
    entry: "ex2/Main.kt",
    files: { "ex1/Main.kt": 'fun main() { println("ex1") }\n', "ex2/Main.kt": "fun main() { println(readLine()!!.trim().toInt() * 2) }\n" },
    input: "21\n",
    expected: "42\n",
  },
  {
    name: "cpp: exercises in folders, each with main()",
    language: "cpp",
    entry: "lab2/main.cpp",
    files: { "lab1/main.cpp": "#include <iostream>\nint main(){std::cout<<1;}\n", "lab2/main.cpp": "#include <iostream>\n#include \"calc.h\"\nint main(){int n;std::cin>>n;std::cout<<twice(n)<<std::endl;}\n", "lab2/calc.h": "inline int twice(int n){return n*2;}\n" },
    input: "21\n",
    expected: "42\n",
  },
  {
    name: "go: exercises in folders",
    language: "go",
    entry: "ex2/main.go",
    files: { "ex1/main.go": 'package main\nimport "fmt"\nfunc main(){fmt.Println("ex1")}\n', "ex2/main.go": 'package main\nimport "fmt"\nfunc main(){var n int\nfmt.Scan(&n)\nfmt.Println(n*2)}\n' },
    input: "21\n",
    expected: "42\n",
  },
  {
    name: "java: package tree beside other exercises",
    language: "java",
    entry: "src/rw/ac/nga/Main.java",
    files: {
      "src/rw/ac/nga/Main.java": "package rw.ac.nga;\nimport rw.ac.nga.model.Student;\npublic class Main { public static void main(String[] a) { System.out.println(new Student(new java.util.Scanner(System.in).next()).hello()); } }\n",
      "src/rw/ac/nga/model/Student.java": 'package rw.ac.nga.model;\npublic class Student { private final String n; public Student(String n) { this.n = n; } public String hello() { return "Hi " + n; } }\n',
      "old/Main.java": 'public class Main { public static void main(String[] a) { System.out.println("old"); } }\nclass Student {}\n',
    },
    input: "Ama\n",
    expected: "Hi Ama\n",
  },
];
