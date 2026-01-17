import React from "react";
import { toast } from "react-toastify";

export const CssKeywordsHelper: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-3xl p-6">
      <div className="flex items-start gap-4">
        <div className="text-3xl">🎨</div>
        <div className="flex-1">
          <h4 className="text-xl font-bold text-purple-900 dark:text-purple-100 mb-3">
            CSS Validation Keywords Guide
          </h4>
          <p className="text-sm text-purple-800 dark:text-purple-200 mb-4">
            Use these keywords in your test case input to validate CSS
            selectors, properties, and advanced features. Click on any keyword
            to copy it to your clipboard!
          </p>

          {/* Keyword Categories */}
          <div className="space-y-4">
            {/* Basic Selectors & Properties */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-purple-900 dark:text-purple-100 cursor-pointer flex items-center gap-2">
                🎯 Basic Selectors & Properties
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "selector:.class-name",
                    desc: "Must include specific class selector",
                  },
                  {
                    keyword: "selector:#id-name",
                    desc: "Must include specific ID selector",
                  },
                  {
                    keyword: "selector:element",
                    desc: "Must include element selector",
                  },
                  {
                    keyword: "property:display",
                    desc: "Must include display property",
                  },
                  {
                    keyword: "property:color",
                    desc: "Must include color property",
                  },
                  {
                    keyword: "property:background",
                    desc: "Must include background property",
                  },
                  {
                    keyword: "value:display=flex",
                    desc: "Must have display:flex",
                  },
                  {
                    keyword: "value:color=#333",
                    desc: "Must have specific color value",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-purple-800 dark:text-purple-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Advanced Selectors */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-purple-900 dark:text-purple-100 cursor-pointer flex items-center gap-2">
                🔍 Advanced Selectors
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "pseudo-class:hover",
                    desc: "Must include :hover pseudo-class",
                  },
                  {
                    keyword: "pseudo-class:focus",
                    desc: "Must include :focus pseudo-class",
                  },
                  {
                    keyword: "pseudo-element:before",
                    desc: "Must include ::before pseudo-element",
                  },
                  {
                    keyword: "pseudo-element:after",
                    desc: "Must include ::after pseudo-element",
                  },
                  {
                    keyword: "combinator:descendant",
                    desc: "Must use descendant combinator (space)",
                  },
                  {
                    keyword: "combinator:child",
                    desc: "Must use child combinator (>)",
                  },
                  {
                    keyword: "combinator:adjacent",
                    desc: "Must use adjacent sibling (+)",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-purple-800 dark:text-purple-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Layout & Positioning */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-purple-900 dark:text-purple-100 cursor-pointer flex items-center gap-2">
                📐 Layout & Positioning
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "layout:flexbox",
                    desc: "Must include flexbox layout",
                  },
                  {
                    keyword: "layout:grid",
                    desc: "Must include CSS grid layout",
                  },
                  {
                    keyword: "layout:positioning",
                    desc: "Must include advanced positioning",
                  },
                  {
                    keyword: "has-property:.container:flex-direction",
                    desc: "Container must have flex-direction",
                  },
                  {
                    keyword: "property-value:.header:position:fixed",
                    desc: "Header must be position:fixed",
                  },
                  {
                    keyword: "count-selectors:class:3",
                    desc: "Must have at least 3 class selectors",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-purple-800 dark:text-purple-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Responsive Design */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-purple-900 dark:text-purple-100 cursor-pointer flex items-center gap-2">
                📱 Responsive Design
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "responsive-design",
                    desc: "Must include responsive design patterns",
                  },
                  {
                    keyword: "media-query:(max-width: 768px)",
                    desc: "Must include mobile media query",
                  },
                  {
                    keyword: "media-query:(min-width: 1024px)",
                    desc: "Must include desktop media query",
                  },
                  {
                    keyword: "property:width",
                    desc: "Must include width property",
                  },
                  {
                    keyword: "value:width=100%",
                    desc: "Must have width: 100%",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-purple-800 dark:text-purple-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Animations & Effects */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-purple-900 dark:text-purple-100 cursor-pointer flex items-center gap-2">
                ✨ Animations & Effects
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "animation:keyframes",
                    desc: "Must include @keyframes animation",
                  },
                  {
                    keyword: "animation:transition",
                    desc: "Must include CSS transition",
                  },
                  {
                    keyword: "animation:transform",
                    desc: "Must include CSS transform",
                  },
                  {
                    keyword: "property:animation",
                    desc: "Must include animation property",
                  },
                  {
                    keyword: "property:transition",
                    desc: "Must include transition property",
                  },
                  {
                    keyword: "property:transform",
                    desc: "Must include transform property",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-purple-800 dark:text-purple-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Colors & Typography */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-purple-900 dark:text-purple-100 cursor-pointer flex items-center gap-2">
                🎨 Colors & Typography
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "color:hex",
                    desc: "Must include hex color values",
                  },
                  {
                    keyword: "color:rgb",
                    desc: "Must include RGB color values",
                  },
                  {
                    keyword: "color:hsl",
                    desc: "Must include HSL color values",
                  },
                  {
                    keyword: "font:family",
                    desc: "Must include font-family",
                  },
                  {
                    keyword: "font:size",
                    desc: "Must include font-size",
                  },
                  {
                    keyword: "font:weight",
                    desc: "Must include font-weight",
                  },
                  {
                    keyword: "property:line-height",
                    desc: "Must include line-height",
                  },
                  {
                    keyword: "property:text-align",
                    desc: "Must include text-align",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-purple-800 dark:text-purple-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Validation & Structure */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-purple-900 dark:text-purple-100 cursor-pointer flex items-center gap-2">
                ✅ Validation & Structure
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "valid-css",
                    desc: "Basic CSS structure validation",
                  },
                  {
                    keyword: "not-contains:important",
                    desc: "Should not use !important",
                  },
                  {
                    keyword: "not-contains:inline-styles",
                    desc: "Should avoid inline styles",
                  },
                  {
                    keyword: "property:margin",
                    desc: "Must include margin property",
                  },
                  {
                    keyword: "property:padding",
                    desc: "Must include padding property",
                  },
                  {
                    keyword: "property:border",
                    desc: "Must include border property",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-purple-800 dark:text-purple-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Usage Instructions */}
          <div className="mt-6 p-4 bg-purple-100/50 dark:bg-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-700">
            <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
              <span className="text-sm">📖</span>
              How to Use Keywords
            </h5>
            <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
              <li>
                • <strong>Single keyword:</strong> Use one keyword like
                <code>selector:.container</code>
              </li>
              <li>
                • <strong>Multiple keywords:</strong> Separate with semicolons
                like
                <code>
                  selector:.container;property:display;value:display=flex
                </code>
              </li>
              <li>
                • <strong>Expected output:</strong> For CSS validation, use
                <code>CSS validation passed</code>
              </li>
              <li>
                • <strong>Combine with other languages:</strong> Keywords only
                work for CSS language selection
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
