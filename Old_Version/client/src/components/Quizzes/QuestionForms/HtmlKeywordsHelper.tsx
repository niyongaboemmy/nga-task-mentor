import React from "react";
import { toast } from "react-toastify";

export const HtmlKeywordsHelper: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-700 rounded-3xl p-6">
      <div className="flex items-start gap-4">
        <div className="text-3xl">🏷️</div>
        <div className="flex-1">
          <h4 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mb-3">
            HTML Validation Keywords Guide
          </h4>
          <p className="text-sm text-emerald-800 dark:text-emerald-200 mb-4">
            Use these keywords in your test case input to validate HTML
            structure and content. Click on any keyword to copy it to your
            clipboard!
          </p>

          {/* Keyword Categories */}
          <div className="space-y-3">
            {/* Document Structure */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-emerald-900 dark:text-emerald-100 cursor-pointer flex items-center gap-2">
                🏗️ Document Structure
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "doctype:html5",
                    desc: "HTML5 DOCTYPE declaration",
                  },
                  {
                    keyword: "valid-structure",
                    desc: "Complete HTML document structure",
                  },
                  {
                    keyword: "character-encoding",
                    desc: "UTF-8 character encoding",
                  },
                  {
                    keyword: "lang-attribute",
                    desc: "Language attribute on html",
                  },
                  {
                    keyword: "proper-closing-tags",
                    desc: "All tags properly opened/closed",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-emerald-100 dark:bg-emerald-900 px-2 py-1 rounded text-emerald-800 dark:text-emerald-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Content & Elements */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-emerald-900 dark:text-emerald-100 cursor-pointer flex items-center gap-2">
                📝 Content & Elements
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "contains:h1",
                    desc: "Must include h1 element",
                  },
                  {
                    keyword: "count:p:2",
                    desc: "Must have exactly 2 paragraphs",
                  },
                  {
                    keyword: "has-attribute:img:alt",
                    desc: "Images must have alt attribute",
                  },
                  {
                    keyword: "attribute-value:meta:name:viewport",
                    desc: "Meta tag with specific name",
                  },
                  {
                    keyword: "text-content:Hello World",
                    desc: "Must contain specific text",
                  },
                  {
                    keyword: "has-class:container",
                    desc: "Element with specific class",
                  },
                  {
                    keyword: "has-id:main",
                    desc: "Element with specific ID",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-emerald-100 dark:bg-emerald-900 px-2 py-1 rounded text-emerald-800 dark:text-emerald-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Semantics & Accessibility */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-emerald-900 dark:text-emerald-100 cursor-pointer flex items-center gap-2">
                ♿ Semantics & Accessibility
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "semantic-html",
                    desc: "Use semantic HTML elements",
                  },
                  {
                    keyword: "accessibility-basics",
                    desc: "Basic accessibility checks",
                  },
                  {
                    keyword: "aria:describedby",
                    desc: "ARIA describedby attribute",
                  },
                  {
                    keyword: "role:main",
                    desc: "ARIA role attribute",
                  },
                  {
                    keyword: "heading-hierarchy",
                    desc: "Proper heading structure",
                  },
                  {
                    keyword: "has-h1",
                    desc: "Must include h1 element",
                  },
                  {
                    keyword: "heading-content",
                    desc: "Headings must have content",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-emerald-100 dark:bg-emerald-900 px-2 py-1 rounded text-emerald-800 dark:text-emerald-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Forms & Interaction */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-emerald-900 dark:text-emerald-100 cursor-pointer flex items-center gap-2">
                📋 Forms & Interaction
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "form-validation:has-form",
                    desc: "Must include form element",
                  },
                  {
                    keyword: "form-validation:has-submit",
                    desc: "Form must have submit button",
                  },
                  {
                    keyword: "form-validation:has-label",
                    desc: "Form inputs must have labels",
                  },
                  {
                    keyword: "form-method:post",
                    desc: "Form must use POST method",
                  },
                  {
                    keyword: "form-action",
                    desc: "Form must have action attribute",
                  },
                  {
                    keyword: "input-type:email",
                    desc: "Must include email input",
                  },
                  {
                    keyword: "data-list",
                    desc: "Must include datalist element",
                  },
                  {
                    keyword: "output-element",
                    desc: "Must include output element",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-emerald-100 dark:bg-emerald-900 px-2 py-1 rounded text-emerald-800 dark:text-emerald-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Advanced HTML5 */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-emerald-900 dark:text-emerald-100 cursor-pointer flex items-center gap-2">
                🚀 Advanced HTML5
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "canvas-element",
                    desc: "Must include canvas element",
                  },
                  {
                    keyword: "svg-inline",
                    desc: "Must include inline SVG",
                  },
                  {
                    keyword: "video-element",
                    desc: "Must include video element",
                  },
                  {
                    keyword: "audio-element",
                    desc: "Must include audio element",
                  },
                  {
                    keyword: "progress-element",
                    desc: "Must include progress element",
                  },
                  {
                    keyword: "meter-element",
                    desc: "Must include meter element",
                  },
                  {
                    keyword: "details-summary",
                    desc: "Must include details/summary",
                  },
                  {
                    keyword: "dialog-element",
                    desc: "Must include dialog element",
                  },
                  {
                    keyword: "template-element",
                    desc: "Must include template element",
                  },
                  {
                    keyword: "custom-elements",
                    desc: "Must include custom elements",
                  },
                  {
                    keyword: "time-element",
                    desc: "Must include time element",
                  },
                  {
                    keyword: "mark-element",
                    desc: "Must include mark element",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-emerald-100 dark:bg-emerald-900 px-2 py-1 rounded text-emerald-800 dark:text-emerald-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* SEO & Social */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-emerald-900 dark:text-emerald-100 cursor-pointer flex items-center gap-2">
                🌐 SEO & Social Media
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "open-graph",
                    desc: "Must include Open Graph tags",
                  },
                  {
                    keyword: "twitter-cards",
                    desc: "Must include Twitter Card tags",
                  },
                  {
                    keyword: "microdata-schema",
                    desc: "Must include schema.org microdata",
                  },
                  {
                    keyword: "meta-description",
                    desc: "Must include meta description",
                  },
                  {
                    keyword: "meta-author",
                    desc: "Must include meta author",
                  },
                  {
                    keyword: "meta-keywords",
                    desc: "Must include meta keywords",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-emerald-100 dark:bg-emerald-900 px-2 py-1 rounded text-emerald-800 dark:text-emerald-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Performance & Security */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-emerald-900 dark:text-emerald-100 cursor-pointer flex items-center gap-2">
                ⚡ Performance & Security
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "resource-hints",
                    desc: "Must include resource hints",
                  },
                  {
                    keyword: "lazy-loading",
                    desc: "Must use lazy loading",
                  },
                  {
                    keyword: "csp-meta",
                    desc: "Must include Content Security Policy",
                  },
                  {
                    keyword: "sri-integrity",
                    desc: "Must use Subresource Integrity",
                  },
                  {
                    keyword: "async-defer",
                    desc: "Must use async/defer on scripts",
                  },
                  {
                    keyword: "no-inline-js",
                    desc: "Must avoid inline JavaScript",
                  },
                  {
                    keyword: "no-inline-event-handlers",
                    desc: "Must avoid inline event handlers",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-emerald-100 dark:bg-emerald-900 px-2 py-1 rounded text-emerald-800 dark:text-emerald-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Usage Instructions */}
          <div className="mt-6 p-4 bg-emerald-100/50 dark:bg-emerald-900/30 rounded-xl border border-emerald-200 dark:border-emerald-700">
            <h5 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2 flex items-center gap-2">
              <span className="text-sm">📖</span>
              How to Use Keywords
            </h5>
            <ul className="text-sm text-emerald-800 dark:text-emerald-200 space-y-1">
              <li>
                • <strong>Single keyword:</strong> Use one keyword like
                <code>semantic-html</code>
              </li>
              <li>
                • <strong>Multiple keywords:</strong> Separate with semicolons
                like
                <code>
                  semantic-html;accessibility-basics;heading-hierarchy
                </code>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
