import React, { useState } from "react";
import { Eye } from "lucide-react";
import type { CodingData } from "../../../types/quiz.types";
import { CodePreviewModal } from "../CodePreviewModal";

interface CodingSetupTabProps {
  codingData: CodingData;
  onChange: (data: CodingData) => void;
  onLanguageChange: (language: string) => void;
}

export const CodingSetupTab: React.FC<CodingSetupTabProps> = ({
  codingData,
  onChange,
  onLanguageChange,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const uiLanguages = ["html", "css", "react", "vue", "angular", "nextjs"];
  const canPreview = uiLanguages.includes(codingData.language.toLowerCase());

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">🌐</span>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
            Programming Language
          </label>
        </div>
        <select
          value={codingData.language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        >
          <optgroup label="🌐 Web Development">
            <option value="html">🎨 HTML - Structure and semantics</option>
            <option value="css">💅 CSS - Styling and layouts</option>
            <option value="javascript">
              🚀 JavaScript - Interactive web development
            </option>
            <option value="react">⚛️ React - Component-based UI library</option>
            <option value="vue">💚 Vue.js - Progressive framework</option>
            <option value="angular">🅰️ Angular - Enterprise framework</option>
            <option value="nextjs">
              ▲ Next.js - Full-stack React framework
            </option>
            <option value="nodejs">🟢 Node.js - Server-side JavaScript</option>
            <option value="typescript">🔷 TypeScript - Typed JavaScript</option>
          </optgroup>
          <optgroup label="💻 General Purpose">
            <option value="python">
              🐍 Python - Beginner friendly and versatile
            </option>
            <option value="java">
              ☕ Java - Enterprise and Android development
            </option>
            <option value="cpp">⚡ C++ - High performance applications</option>
            <option value="csharp">🔷 C# - .NET and game development</option>
            <option value="php">🐘 PHP - Web development</option>
            <option value="ruby">💎 Ruby - Elegant and productive</option>
            <option value="go">🐹 Go - Simple and efficient</option>
          </optgroup>
          <optgroup label="📱 Mobile & Others">
            <option value="swift">🍎 Swift - iOS development</option>
            <option value="kotlin">🤖 Kotlin - Android development</option>
            <option value="dart">🎯 Dart - Flutter development</option>
            <option value="rust">🦀 Rust - Systems programming</option>
            <option value="sql">🗄️ SQL - Database queries</option>
          </optgroup>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">✨</span>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Starter Code (Optional)
            </label>
          </div>
          {canPreview && (
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
              title="Preview code in browser"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
          )}
        </div>
        <textarea
          value={codingData.starter_code || ""}
          onChange={(e) =>
            onChange({
              ...codingData,
              starter_code: e.target.value,
            })
          }
          placeholder={`Provide starter code for students in ${codingData.language}. Use this space to give them function signatures, imports, or setup code they might need...`}
          rows={12}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm transition-all"
        />
        <div className="flex justify-between items-center mt-3 text-xs">
          <span className="text-gray-500">
            💡 Tip: Provide function signatures or setup code to help students
            get started
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                (codingData.starter_code?.length || 0) > 1000
                  ? "bg-red-100 text-red-700"
                  : (codingData.starter_code?.length || 0) > 500
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {codingData.starter_code?.length || 0} characters
            </span>
          </div>
        </div>
      </div>

      {/* Code Preview Modal */}
      <CodePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        code={codingData.starter_code || ""}
        language={codingData.language}
      />
    </div>
  );
};
