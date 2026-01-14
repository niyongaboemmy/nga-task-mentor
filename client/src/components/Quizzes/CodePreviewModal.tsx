import React, { useState } from "react";
import {
  X,
  RefreshCw,
  Monitor,
  Tablet,
  Smartphone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface CodePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  language: string;
}

export const CodePreviewModal: React.FC<CodePreviewModalProps> = ({
  isOpen,
  onClose,
  code,
  language,
}) => {
  const [device, setDevice] = useState<"desktop" | "tablet" | "phone">(
    "desktop"
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const renderPreview = () => {
    if (!code.trim()) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-4">📝</div>
            <p>Enter some code to see the preview</p>
          </div>
        </div>
      );
    }

    switch (language.toLowerCase()) {
      case "html":
        return (
          <iframe
            key={isRefreshing ? Date.now() : "html"}
            srcDoc={code}
            className="w-full h-full border-0"
            title="HTML Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        );

      case "css":
        // For CSS, we need to wrap it with some HTML
        const cssPreview = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>${code}</style>
            </head>
            <body>
              <div class="preview-container">
                <h1>CSS Preview</h1>
                <div class="sample-content">
                  <div class="box">Sample Box 1</div>
                  <div class="box">Sample Box 2</div>
                  <div class="box">Sample Box 3</div>
                </div>
                <p>This is sample content to demonstrate your CSS styles.</p>
                <button class="sample-button">Sample Button</button>
              </div>
            </body>
          </html>
        `;
        return (
          <iframe
            key={isRefreshing ? Date.now() : "css"}
            srcDoc={cssPreview}
            className="w-full h-full border-0"
            title="CSS Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        );

      case "react":
      case "vue":
      case "angular":
      case "nextjs":
        // For framework previews, show a code display with explanation
        return (
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
            <div className="text-center max-w-md p-8">
              <div className="text-6xl mb-6">⚛️</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {language.charAt(0).toUpperCase() + language.slice(1)} Preview
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Framework components require a build environment to render
                properly. This preview shows your code structure.
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border text-left">
                <pre className="text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
                  <code>{code}</code>
                </pre>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-4">💻</div>
              <p>Preview not available for {language}</p>
              <p className="text-sm mt-2">
                Only UI languages (HTML, CSS, React, etc.) can be previewed
              </p>
            </div>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 w-full h-full overflow-hidden">
        {/* Browser Window Header */}
        <div className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Window Controls */}
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            {/* Address Bar */}
            <div className="flex-1 max-w-md mx-4">
              <div className="bg-white dark:bg-gray-600 rounded-md px-3 py-1 flex items-center gap-2 text-sm">
                <div className="w-4 h-4 text-gray-400">🔒</div>
                <span className="text-gray-600 dark:text-gray-300 truncate">
                  https://preview.{language}.local
                </span>
              </div>
            </div>
            {/* Device Preview Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDevice("desktop")}
                className={`p-1 rounded transition-colors ${
                  device === "desktop"
                    ? "bg-blue-500 text-white"
                    : "hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                title="Desktop View"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDevice("tablet")}
                className={`p-1 rounded transition-colors ${
                  device === "tablet"
                    ? "bg-blue-500 text-white"
                    : "hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                title="Tablet View"
              >
                <Tablet className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDevice("phone")}
                className={`p-1 rounded transition-colors ${
                  device === "phone"
                    ? "bg-blue-500 text-white"
                    : "hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                title="Phone View"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Back"
              disabled
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Forward"
              disabled
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleRefresh}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div
          className={`h-full bg-white dark:bg-gray-900 ${
            device !== "desktop" ? "flex justify-center items-start pt-4" : ""
          }`}
        >
          <div
            className={`${
              device === "desktop"
                ? "w-full h-full"
                : device === "tablet"
                ? "w-full max-w-4xl h-full"
                : "w-full max-w-sm h-full"
            }`}
          >
            {renderPreview()}
          </div>
        </div>
      </div>
    </div>
  );
};
