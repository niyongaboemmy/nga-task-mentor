/**
 * What kind of project a submission is, and how to check it (grading,
 * CODE_RUNNER_PLAN.md §7.6). Each technology needs a different way of
 * looking: a web page is checked in the Preview, a program by running it with
 * inputs, a project with tests by running them, a window or a phone app only
 * in TMCode. Pure: give it the files, get the advice.
 */

export type ProfileId =
  | "web-page"
  | "web-app-build"
  | "web-server"
  | "mobile-app"
  | "desktop-gui"
  | "data-analysis"
  | "sql"
  | "unit-tested"
  | "program"
  | "code-only";

export type CheckAction = "preview" | "run" | "unit-tests" | "changes" | "tmcode" | "code";

export interface ProjectProfile {
  id: ProfileId;
  /** Short name of the technology ("Web page", "React app", "Python program"…). */
  label: string;
  /** The tab to open first. */
  primary: "preview" | "run" | "code";
  /** One-line advice, in order. */
  steps: string[];
  /** Buttons to offer, in order. */
  actions: CheckAction[];
  /** Something the grader should know (e.g. why the preview may be blank). */
  note?: string;
}

interface FileLike {
  path: string;
  content?: string;
}

const base = (p: string) => p.split("/").pop() ?? p;
const ext = (p: string) => (base(p).includes(".") ? base(p).split(".").pop()!.toLowerCase() : "");
const IGNORED = /(^|\/)(node_modules|dist|build|target|\.git|\.tmcode|\.nga|__pycache__|\.venv|venv)\//;

const LANGUAGE: Record<string, string> = {
  py: "Python", js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", ts: "TypeScript", java: "Java", c: "C", cpp: "C++", cc: "C++",
  cs: "C#", go: "Go", rs: "Rust", php: "PHP", rb: "Ruby", kt: "Kotlin", swift: "Swift", dart: "Dart", pl: "Perl", tcl: "Tcl", lua: "Lua",
  r: "R", sh: "Bash", scala: "Scala", hs: "Haskell", ex: "Elixir", exs: "Elixir", jl: "Julia", m: "Objective-C",
};

const UNIT_TEST_FILE =
  /(^|\/)(test_[^/]+\.py|[^/]+_test\.(py|go|rb|exs)|[^/]+\.(test|spec)\.(js|ts|mjs|cjs|jsx|tsx)|[^/]+(Test|Tests)\.(java|kt|cs|scala|swift)|[^/]+_spec\.rb)$|(^|\/)(tests?|spec|__tests__)\/[^/]+\.\w+$|(^|\/)src\/test\//;

const has = (files: FileLike[], re: RegExp) => files.some((f) => re.test(f.path));
const anyContent = (files: FileLike[], pathRe: RegExp, contentRe: RegExp) => files.some((f) => pathRe.test(f.path) && !!f.content && contentRe.test(f.content));

/** PHP that prints a page, and an HTML page that links or posts to a .php file. */
const PHP_HTML = /<(!doctype\s+html|html|head|body|form|div|h[1-6]|p|table|ul|ol|section|main|nav|header|footer)\b[^>]*>/i;
const LINKS_PHP = /\b(action|href)\s*=\s*["']?[^"'\s>]*\.php\b/i;

/**
 * A PHP website (the server's phpSiteEntry): index.php, or .php files that
 * print HTML, or pages whose forms post to .php files; not Composer or Laravel.
 */
function phpSite(files: FileLike[]): boolean {
  if (has(files, /(^|\/)(composer\.json|artisan)$/) || !has(files, /\.php$/i)) return false;
  return has(files, /(^|\/)index\.php$/i) || anyContent(files, /\.php$/i, PHP_HTML) || anyContent(files, /\.html?$/i, LINKS_PHP);
}

/** The main language by number of source files. */
function mainLanguage(files: FileLike[]): string | null {
  const count = new Map<string, number>();
  for (const f of files) {
    const lang = LANGUAGE[ext(f.path)];
    if (lang) count.set(lang, (count.get(lang) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function profileProject(all: FileLike[]): ProjectProfile {
  const files = all.filter((f) => !IGNORED.test(f.path));
  const pkg = files.find((f) => base(f.path) === "package.json" && !f.path.includes("/node_modules/"))?.content ?? "";
  const deps = (name: RegExp) => name.test(pkg);
  const lang = mainLanguage(files);
  const unitTests = has(files, UNIT_TEST_FILE);

  // Phone apps: only TMCode (or a device) can run them.
  if (has(files, /(^|\/)pubspec\.yaml$/) && anyContent(files, /pubspec\.yaml$/, /flutter/) || has(files, /(^|\/)AndroidManifest\.xml$/)) {
    return {
      id: "mobile-app",
      label: has(files, /pubspec\.yaml$/) ? "Flutter app" : "Android app",
      primary: "code",
      steps: ["Read the screens and logic in Code", "Open it in TMCode to run it on an emulator"],
      actions: ["code", "changes", "tmcode"],
      note: "Phone apps can't run in the browser.",
    };
  }

  // Web servers: they need a running server (previews come with the container tier).
  const server =
    deps(/"(express|fastify|koa|@nestjs\/core|hapi)"\s*:/) ||
    anyContent(files, /(^|\/)requirements\.txt$/, /^(flask|fastapi|django|uvicorn)\b/im) ||
    anyContent(files, /\.py$/, /\bfrom\s+(flask|fastapi)\s+import\b|\bimport\s+(flask|fastapi)\b/) ||
    has(files, /(^|\/)manage\.py$/) ||
    anyContent(files, /pom\.xml$|build\.gradle(\.kts)?$/, /spring-boot-starter-web/) ||
    anyContent(files, /\.csproj$/, /Microsoft\.NET\.Sdk\.Web/) ||
    anyContent(files, /\.(js|cjs|mjs)$/, /\bcreateServer\([\s\S]*\.listen\(|\bapp\.listen\(/);
  if (server && !deps(/"(react|vue|svelte|@angular\/core|next|nuxt|vite)"\s*:/)) {
    return {
      id: "web-server",
      label: `${lang ?? "Web"} web server`,
      primary: unitTests ? "run" : "code",
      steps: ["Read the routes and handlers in Code", ...(unitTests ? ["Run the unit tests"] : []), "Open it in TMCode to start the server and try it"],
      actions: [unitTests ? "unit-tests" : "code", "changes", "tmcode"],
      note: "A web server has to keep running; open it in TMCode to try it in a browser.",
    };
  }

  // Front-end apps with a build step (React, Vue, Svelte, Angular, Next…).
  const framework = deps(/"react"\s*:/) ? "React" : deps(/"vue"\s*:/) ? "Vue" : deps(/"svelte"\s*:/) ? "Svelte" : deps(/"@angular\/core"\s*:/) ? "Angular" : deps(/"next"\s*:/) ? "Next.js" : deps(/"vite"\s*:/) ? "Vite" : null;
  if (framework) {
    return {
      id: "web-app-build",
      label: `${framework} app`,
      primary: "code",
      steps: ["Read the components in Code (Changes since starter shows the student's own work)", "Open it in TMCode to build and run it"],
      actions: ["code", "changes", "preview", "tmcode"],
      note: `A ${framework} app needs a build before it shows: the Preview may be blank.`,
    };
  }

  // PHP websites: each page runs on the code runner in the Preview, links and forms working.
  if (phpSite(files)) {
    return {
      id: "web-page",
      label: "PHP website",
      primary: "preview",
      steps: [
        "Open the Preview: each page runs on the code runner, and its links and forms work",
        "Fill in the forms to check what the PHP code does with them",
        "Read the PHP, HTML and CSS in Code",
      ],
      actions: ["preview", "code", "changes"],
    };
  }

  // Plain web pages.
  if (has(files, /\.html?$/)) {
    return {
      id: "web-page",
      label: "Web page",
      primary: "preview",
      steps: ["Open the Preview at Desktop, then Phone size", "Use Full screen to check the details", "Read the HTML and CSS in Code"],
      actions: ["preview", "code", "changes"],
    };
  }

  // Windows on the desktop (Swing, JavaFX, Tkinter, pygame…).
  if (anyContent(files, /\.(java|kt)$/, /\bimport\s+(javax\.swing|java\.awt|javafx)\./) || anyContent(files, /\.py$/, /^\s*(import|from)\s+(tkinter|pygame|turtle|PyQt\d|PySide\d)\b/m)) {
    return {
      id: "desktop-gui",
      label: `${lang ?? "Desktop"} window app`,
      primary: "code",
      steps: ["Read the window and event code in Code", ...(unitTests ? ["Run the unit tests"] : []), "Open it in TMCode to see the window"],
      actions: ["code", ...(unitTests ? (["unit-tests"] as CheckAction[]) : []), "changes", "tmcode"],
      note: "A window can't be shown here: running it only shows what it prints.",
    };
  }

  if (has(files, /\.sql$/) && (lang === null || has(files, /(^|\/)(schema|seed|main|queries?)\.sql$/))) {
    return {
      id: "sql",
      label: "SQL queries",
      primary: "run",
      steps: ["Run it: each query's result shows as a table", "Compare the tables with what the task asks"],
      actions: ["run", "code", "changes"],
    };
  }

  if (lang === "Python" && (anyContent(files, /\.py$/, /^\s*(import|from)\s+(pandas|numpy|matplotlib|seaborn|sklearn)\b/m) || has(files, /\.(csv|xlsx|ipynb)$/))) {
    return {
      id: "data-analysis",
      label: "Python data analysis",
      primary: "run",
      steps: ["Run it and read the printed results", ...(unitTests ? ["Run the unit tests"] : []), "Check the analysis steps in Code"],
      actions: ["run", ...(unitTests ? (["unit-tests"] as CheckAction[]) : []), "code", "changes"],
      note: "Charts aren't shown here, only printed output.",
    };
  }

  if (unitTests && lang) {
    return {
      id: "unit-tested",
      label: `${lang} project with unit tests`,
      primary: "run",
      steps: ["Run the unit tests: failures come first, with their message", "Run the program with your inputs", "Read the code in Code"],
      actions: ["unit-tests", "run", "code", "changes"],
    };
  }

  if (lang) {
    return {
      id: "program",
      label: `${lang} program`,
      primary: "run",
      steps: ["Run it: answer its questions in the Console, or run the saved tests (the project's own tests are filled in)", "Read the code in Code"],
      actions: ["run", "code", "changes"],
    };
  }

  return { id: "code-only", label: "Project", primary: "code", steps: ["Read the files in Code"], actions: ["code", "changes"] };
}
