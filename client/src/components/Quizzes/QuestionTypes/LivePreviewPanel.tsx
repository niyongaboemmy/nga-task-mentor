import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { RefreshCw, ExternalLink, AlertTriangle, Globe } from "lucide-react";
import type { ProjectFile } from "./FileExplorer";

interface LivePreviewPanelProps {
  files: ProjectFile[];
  activeFile: string;
  language: string;
}

// Languages that support live preview
const PREVIEW_LANGUAGES = new Set([
  "html",
  "css",
  "react",
  "vue",
  "angular",
  "nextjs",
  "javascript",
  "js",
  "typescript",
  "ts",
]);

function buildPreviewHTML(files: ProjectFile[], language: string): string {
  const htmlFile = files.find((f) => f.name.endsWith(".html"));
  const cssFiles = files.filter((f) => f.name.endsWith(".css"));
  const jsTsFiles = files.filter((f) => /\.(js|jsx|ts|tsx)$/.test(f.name));
  const vueFiles = files.filter((f) => f.name.endsWith(".vue"));

  const isReact =
    language === "react" ||
    jsTsFiles.some(
      (f) => f.content.includes("React") || f.content.includes("from 'react'"),
    );
  const isVue = language === "vue" || vueFiles.length > 0;
  const isTs =
    language === "typescript" ||
    language === "ts" ||
    jsTsFiles.some((f) => f.name.endsWith(".ts") || f.name.endsWith(".tsx"));

  // Intelligent framework detection
  const allContent = files.map((f) => f.content).join("\n");
  const hasTailwindClasses =
    /\b(bg-|text-|p-|m-|flex-|grid-|rounded-|shadow-)\w*\b/.test(allContent);
  const needsTailwind = allContent.includes("tailwind") || hasTailwindClasses;
  const needsBootstrap =
    allContent.includes("bootstrap") ||
    /\b(container|row|col-|btn-|card)\b/.test(allContent);

  let baseHtml =
    htmlFile?.content ||
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Preview</title>
</head>
<body>
  <div id="root"></div>
  <div id="app"></div>
</body>
</html>`;

  // 1. Inject CDNs and CSS into <head>
  let headInjections = "";

  if (cssFiles.length > 0) {
    headInjections += `<style>\n${cssFiles.map((f) => f.content).join("\n")}\n</style>\n`;
  }

  if (needsTailwind && !baseHtml.includes("tailwindcss.com")) {
    headInjections += `<script src="https://cdn.tailwindcss.com"></script>\n`;
  }

  if (needsBootstrap && !baseHtml.includes("bootstrap.min.css")) {
    headInjections += `<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">\n`;
  }

  if (isReact || isTs) {
    headInjections += `
<!-- React & ReactDOM -->
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<!-- Babel Standalone (Compiles JSX/TS in browser) -->
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
`;
  }

  if (isVue && !baseHtml.includes("vue.global.js")) {
    headInjections += `<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>\n`;
  }

  baseHtml = baseHtml.replace("</head>", `${headInjections}</head>`);

  // 2. Inject JS/TS into <body>
  let bodyInjections = "";

  if (isReact || isTs) {
    jsTsFiles.forEach((f) => {
      const isTypeScript =
        f.name.endsWith(".ts") || f.name.endsWith(".tsx") || isTs;
      const preserves = ["env"];
      if (isReact || f.name.endsWith(".jsx") || f.name.endsWith(".tsx"))
        preserves.push("react");
      if (isTypeScript) preserves.push("typescript");

      const presets = preserves.join(",");
      bodyInjections += `<script type="text/babel" data-presets="${presets}" data-type="module">\n${f.content}\n</script>\n`;
    });
  } else if (jsTsFiles.length > 0) {
    bodyInjections += `<script type="module">\n${jsTsFiles.map((f) => f.content).join("\n")}\n</script>\n`;
  }

  // 3. Fallback pure code console formatting (for JS/TS algorithms without HTML structural need)
  const isPureCodeLang = ["javascript", "js", "typescript", "ts"].includes(
    language,
  );
  if (isPureCodeLang && !htmlFile && !isReact && !isVue) {
    return `<!DOCTYPE html>
<html>
<head>
${headInjections}
<style>
body { background: #0f172a; color: #e2e8f0; font-family: monospace; padding: 20px; }
#console-output { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; min-height: 100px; white-space: pre-wrap; font-size: 13px; }
.log-line { color: #94a3b8; } .error-line { color: #f87171; }
</style>
</head>
<body>
  <p style="color:#64748b;font-size:12px;margin-bottom:8px;">▶ Console Output:</p>
  <div id="console-output"></div>
<script>
const output = document.getElementById('console-output');
const origLog = console.log;
const origError = console.error;
console.log = (...args) => {
  origLog(...args);
  const line = document.createElement('div');
  line.className = 'log-line';
  line.textContent = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
  output.appendChild(line);
};
console.error = (...args) => {
  origError(...args);
  const line = document.createElement('div');
  line.className = 'error-line';
  line.textContent = '✗ ' + args.map(a => String(a)).join(' ');
  output.appendChild(line);
};
window.addEventListener('error', (e) => console.error(e.message));
</script>
${bodyInjections}
</body>
</html>`;
  }

  // Pure CSS project fallback
  if (language === "css" && !htmlFile) {
    return `<!DOCTYPE html>
<html>
<head>
${headInjections}
<style>
body { font-family: system-ui, sans-serif; padding: 20px; background: #1e293b; color: #e2e8f0; }
.preview-message { color: #64748b; font-size: 12px; margin-top: 8px; }
</style>
</head>
<body>
  <div class="container">
    <h1>CSS Preview</h1>
    <p class="preview-message">Your CSS is applied to this page. Add HTML elements to see them styled.</p>
    <div class="box">Sample Box</div>
    <button class="btn btn-primary">Sample Button</button>
  </div>
</body>
</html>`;
  }

  // Append body injections and error catcher
  if (bodyInjections) {
    const errorCatcher = `<script>
window.addEventListener('error', function(event) {
  const d = document.createElement('div');
  d.style.cssText = 'background:#fee2e2;color:#991b1b;padding:12px;margin:8px;border-radius:6px;font-family:monospace;font-size:12px;border:1px solid #fca5a5;';
  d.textContent = 'Runtime Error: ' + event.message;
  document.body.prepend(d);
});
</script>`;
    baseHtml = baseHtml.replace(
      "</body>",
      `${errorCatcher}\n${bodyInjections}\n</body>`,
    );
  }

  return baseHtml;
}

export const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({
  files,
  activeFile,
  language,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const previewHtml = useMemo(() => {
    try {
      return buildPreviewHTML(files, language);
    } catch (e: any) {
      setError(e.message);
      return "";
    }
  }, [files, language]);

  // Auto-refresh with debounce
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setError(null);
      setLastRefresh(Date.now());
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [previewHtml]);

  const forceRefresh = () => {
    setLastRefresh(Date.now());
  };

  const isPreviewable = PREVIEW_LANGUAGES.has(language.toLowerCase());

  if (!isPreviewable) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-slate-600 gap-4">
        <Globe size={40} className="opacity-20" />
        <div className="text-center">
          <p className="text-sm text-slate-500">Live preview not available</p>
          <p className="text-xs mt-1">Use the Console for {language} output</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="flex-1 bg-slate-800 rounded px-3 py-0.5 text-[10px] text-slate-500 font-mono flex items-center gap-2">
          <Globe size={10} />
          <span>preview — {activeFile}</span>
        </div>
        <button
          onClick={forceRefresh}
          className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded"
          title="Refresh preview"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950/40 border-b border-red-900/40 text-red-400 text-xs flex-shrink-0">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      {/* Preview iframe */}
      <iframe
        key={lastRefresh}
        ref={iframeRef}
        className="flex-1 w-full border-0 bg-white"
        srcDoc={previewHtml}
        sandbox="allow-scripts allow-same-origin allow-modals"
        title="Live Preview"
      />
    </div>
  );
};
