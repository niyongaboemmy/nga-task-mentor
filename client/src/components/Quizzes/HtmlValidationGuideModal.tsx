import React from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface HtmlValidationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HtmlValidationGuideModal: React.FC<
  HtmlValidationGuideModalProps
> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🏷️ HTML Validation Keywords Guide"
      subtitle="Complete reference for creating comprehensive HTML test cases"
      size="full"
    >
      <div className="space-y-6">
        {/* Comprehensive Test Case Design Guide */}
        <div className="bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-xl border border-emerald-200 dark:border-emerald-700 p-6">
          <h5 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-4 flex items-center gap-2">
            <span className="text-sm">🎯</span>
            Comprehensive HTML Test Case Design Principles
          </h5>

          <div className="space-y-4">
            {/* The 5 Pillars of Test Case Design */}
            <div>
              <h6 className="font-medium text-emerald-900 dark:text-emerald-100 mb-3">
                🏗️ The 5 Pillars of Effective HTML Test Cases
              </h6>
              <div className="grid gap-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-emerald-800 dark:text-emerald-200">
                    1. Document Structure
                  </strong>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    Verify proper HTML document structure with DOCTYPE, html,
                    head, and body elements. Ensure semantic markup and proper
                    nesting.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-emerald-800 dark:text-emerald-200">
                    2. Content Semantics
                  </strong>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    Test for appropriate use of semantic HTML elements (header,
                    nav, main, section, article, aside, footer) and proper
                    heading hierarchy.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-emerald-800 dark:text-emerald-200">
                    3. Accessibility Compliance
                  </strong>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    Validate alt attributes on images, proper form labels, ARIA
                    attributes, and keyboard navigation support for inclusive
                    web experiences.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-emerald-800 dark:text-emerald-200">
                    4. Form Functionality
                  </strong>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    Test form elements, input types, validation attributes, and
                    proper form structure with labels, fieldsets, and submit
                    buttons.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-emerald-800 dark:text-emerald-200">
                    5. HTML5 Features & Best Practices
                  </strong>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    Validate modern HTML5 elements, proper character encoding,
                    meta tags, and adherence to web standards and performance
                    best practices.
                  </p>
                </div>
              </div>
            </div>

            {/* Real-World Examples */}
            <div>
              <h6 className="font-medium text-emerald-900 dark:text-emerald-100 mb-3">
                🌍 Real-World HTML Test Case Examples
              </h6>
              <div className="space-y-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-emerald-800 dark:text-emerald-200 text-base mb-2 block">
                    Semantic Article Page
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Structure:</strong> Proper DOCTYPE, semantic
                      elements, heading hierarchy
                    </div>
                    <div>
                      <strong>♿ Accessibility:</strong> Alt text on images,
                      proper labels, ARIA attributes
                    </div>
                    <div>
                      <strong>📝 Content:</strong> Appropriate element usage for
                      different content types
                    </div>
                    <div>
                      <strong>🌐 SEO:</strong> Meta tags, proper document
                      structure
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-emerald-800 dark:text-emerald-200 text-base mb-2 block">
                    Contact Form with Validation
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Forms:</strong> Proper form structure with
                      labels and input types
                    </div>
                    <div>
                      <strong>♿ Accessibility:</strong> Associated labels,
                      fieldsets, keyboard navigation
                    </div>
                    <div>
                      <strong>🔒 Validation:</strong> HTML5 validation
                      attributes and patterns
                    </div>
                    <div>
                      <strong>📱 Responsive:</strong> Proper form layout for
                      different screen sizes
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Common HTML Testing Mistakes */}
            <div>
              <h6 className="font-medium text-emerald-900 dark:text-emerald-100 mb-3">
                🚨 Common HTML Test Case Mistakes to Avoid
              </h6>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <ul className="space-y-2 text-sm text-red-800 dark:text-red-200">
                  <li>
                    <strong>❌ Missing semantic elements:</strong> Using divs
                    instead of header, nav, main, etc.
                  </li>
                  <li>
                    <strong>❌ Poor accessibility:</strong> Images without alt
                    text, forms without labels
                  </li>
                  <li>
                    <strong>❌ Invalid structure:</strong> Improper nesting,
                    missing DOCTYPE, unclosed tags
                  </li>
                  <li>
                    <strong>❌ Ignoring HTML5 features:</strong> Not using
                    modern elements like article, section, aside
                  </li>
                  <li>
                    <strong>❌ Missing meta information:</strong> No charset,
                    viewport, or description meta tags
                  </li>
                  <li>
                    <strong>❌ Generic test cases:</strong> "contains:h1"
                    without checking content or context
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-step Guide */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-4 flex items-center gap-2">
            <span className="text-lg">📋</span>
            Step-by-Step Guide to Creating HTML Test Cases
          </h5>

          <div className="space-y-4">
            {/* Step 1: Understand the Content Requirements */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
              <h6 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Understand Content Requirements & Test Case Strategy
              </h6>
              <div className="space-y-3 text-sm">
                {/* Basic Page Structure Example */}
                <div className="bg-white/50 dark:bg-gray-700/50 p-3 rounded">
                  <strong className="text-green-800 dark:text-green-200 text-base mb-2 block">
                    🏗️ Example: Create a Basic Article Page
                  </strong>
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <strong>Requirements:</strong> Article page with proper
                      structure, accessibility, and semantic HTML
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                        ✅ CORRECT Test Cases:
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>doctype:html5;valid-structure</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>HTML validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>semantic-html;contains:h1</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>HTML validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>has-attribute:img:alt</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>HTML validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>heading-hierarchy;accessibility-basics</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>HTML validation passed</code> ✓
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                        ❌ INCORRECT Test Cases (Common Mistakes):
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>contains:div</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>HTML validation passed</code> ✗ (Too generic,
                          doesn't test semantics)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>has-id:main</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>HTML validation passed</code> ✗ (Should use
                          semantic elements over IDs)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>count:p:1</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>HTML validation passed</code> ✗ (Arbitrary count
                          without context)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>valid-structure</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>HTML validation passed</code> ✗ (Too broad,
                          combine with specific requirements)
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <strong className="text-blue-800 dark:text-blue-200">
                        🎯 HTML Test Case Strategy:
                      </strong>
                      <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-300">
                        <li>
                          • <strong>Structure first:</strong> Validate DOCTYPE
                          and basic document structure
                        </li>
                        <li>
                          • <strong>Semantic elements:</strong> Check for proper
                          use of HTML5 semantic elements
                        </li>
                        <li>
                          • <strong>Accessibility:</strong> Ensure alt
                          attributes, labels, and ARIA support
                        </li>
                        <li>
                          • <strong>Content validation:</strong> Test for
                          specific content and element relationships
                        </li>
                        <li>
                          • <strong>Modern features:</strong> Validate HTML5
                          elements and attributes
                        </li>
                        <li>
                          • <strong>Best practices:</strong> Avoid deprecated
                          elements and ensure clean markup
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Test Case Categories */}
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <strong className="text-blue-800 dark:text-blue-200 flex items-center gap-1">
                      🏗️ Structure Tests
                    </strong>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Validate document structure and semantic markup
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                    <strong className="text-orange-800 dark:text-orange-200 flex items-center gap-1">
                      ♿ Accessibility Tests
                    </strong>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      Check alt text, labels, ARIA, and inclusive design
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <strong className="text-red-800 dark:text-red-200 flex items-center gap-1">
                      📝 Content Tests
                    </strong>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      Validate content elements and their relationships
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Keywords Reference */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🔑</span>
            Complete HTML Validation Keywords Reference
          </h5>

          <div className="space-y-4">
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
                    example: "doctype:html5",
                  },
                  {
                    keyword: "valid-structure",
                    desc: "Complete HTML document structure",
                    example: "valid-structure",
                  },
                  {
                    keyword: "character-encoding",
                    desc: "UTF-8 character encoding",
                    example: "character-encoding",
                  },
                  {
                    keyword: "lang-attribute",
                    desc: "Language attribute on html",
                    example: "lang-attribute",
                  },
                  {
                    keyword: "proper-closing-tags",
                    desc: "All tags properly opened/closed",
                    example: "proper-closing-tags",
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
                    example: "contains:h1",
                  },
                  {
                    keyword: "count:p:2",
                    desc: "Must have exactly 2 paragraphs",
                    example: "count:p:2",
                  },
                  {
                    keyword: "has-attribute:img:alt",
                    desc: "Images must have alt attribute",
                    example: "has-attribute:img:alt",
                  },
                  {
                    keyword: "text-content:Hello World",
                    desc: "Must contain specific text",
                    example: "text-content:Hello World",
                  },
                  {
                    keyword: "has-class:container",
                    desc: "Element with specific class",
                    example: "has-class:container",
                  },
                  {
                    keyword: "has-id:main",
                    desc: "Element with specific ID",
                    example: "has-id:main",
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
                    example: "semantic-html",
                  },
                  {
                    keyword: "accessibility-basics",
                    desc: "Basic accessibility checks",
                    example: "accessibility-basics",
                  },
                  {
                    keyword: "aria:describedby",
                    desc: "ARIA describedby attribute",
                    example: "aria:describedby",
                  },
                  {
                    keyword: "role:main",
                    desc: "ARIA role attribute",
                    example: "role:main",
                  },
                  {
                    keyword: "heading-hierarchy",
                    desc: "Proper heading structure",
                    example: "heading-hierarchy",
                  },
                  {
                    keyword: "has-h1",
                    desc: "Must include h1 element",
                    example: "has-h1",
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
                    example: "form-validation:has-form",
                  },
                  {
                    keyword: "form-validation:has-submit",
                    desc: "Form must have submit button",
                    example: "form-validation:has-submit",
                  },
                  {
                    keyword: "form-validation:has-label",
                    desc: "Form inputs must have labels",
                    example: "form-validation:has-label",
                  },
                  {
                    keyword: "form-method:post",
                    desc: "Form must use POST method",
                    example: "form-method:post",
                  },
                  {
                    keyword: "input-type:email",
                    desc: "Must include email input",
                    example: "input-type:email",
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
                    example: "canvas-element",
                  },
                  {
                    keyword: "svg-inline",
                    desc: "Must include inline SVG",
                    example: "svg-inline",
                  },
                  {
                    keyword: "video-element",
                    desc: "Must include video element",
                    example: "video-element",
                  },
                  {
                    keyword: "time-element",
                    desc: "Must include time element",
                    example: "time-element",
                  },
                  {
                    keyword: "details-summary",
                    desc: "Must include details/summary",
                    example: "details-summary",
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

            {/* SEO & Social Media */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-emerald-900 dark:text-emerald-100 cursor-pointer flex items-center gap-2">
                🌐 SEO & Social Media
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "open-graph",
                    desc: "Must include Open Graph tags",
                    example: "open-graph",
                  },
                  {
                    keyword: "twitter-cards",
                    desc: "Must include Twitter Card tags",
                    example: "twitter-cards",
                  },
                  {
                    keyword: "meta-description",
                    desc: "Must include meta description",
                    example: "meta-description",
                  },
                  {
                    keyword: "meta-author",
                    desc: "Must include meta author",
                    example: "meta-author",
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
        </div>

        {/* Usage Instructions */}
        <div className="bg-emerald-100/50 dark:bg-emerald-900/30 rounded-xl border border-emerald-200 dark:border-emerald-700 p-4">
          <h5 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-3 flex items-center gap-2">
            <span className="text-sm">📖</span>
            Complete Guide to HTML Test Case Validation
          </h5>

          <div className="space-y-4">
            {/* Basic Usage */}
            <div>
              <h6 className="font-medium text-emerald-900 dark:text-emerald-100 mb-2">
                🔧 Basic Usage
              </h6>
              <ul className="text-sm text-emerald-800 dark:text-emerald-200 space-y-1 ml-4">
                <li>
                  • <strong>Single validation:</strong>{" "}
                  <code>semantic-html</code>
                </li>
                <li>
                  • <strong>Multiple validations:</strong>{" "}
                  <code>
                    semantic-html;accessibility-basics;heading-hierarchy
                  </code>
                </li>
                <li>
                  • <strong>Expected output:</strong>{" "}
                  <code>HTML validation passed</code>
                </li>
              </ul>
            </div>

            {/* Validation Categories */}
            <div>
              <h6 className="font-medium text-emerald-900 dark:text-emerald-100 mb-2">
                📋 Validation Categories
              </h6>
              <ul className="text-sm text-emerald-800 dark:text-emerald-200 space-y-1 ml-4">
                <li>
                  • <strong>Document Structure:</strong> Validate DOCTYPE,
                  encoding, and basic structure
                </li>
                <li>
                  • <strong>Semantic Elements:</strong> Check for proper use of
                  HTML5 semantic elements
                </li>
                <li>
                  • <strong>Accessibility:</strong> Ensure alt text, labels,
                  ARIA attributes, and keyboard navigation
                </li>
                <li>
                  • <strong>Content Validation:</strong> Test for specific
                  elements, attributes, and content
                </li>
                <li>
                  • <strong>Forms:</strong> Validate form structure, inputs, and
                  validation attributes
                </li>
                <li>
                  • <strong>Modern HTML5:</strong> Check for canvas, SVG, video,
                  and other modern elements
                </li>
                <li>
                  • <strong>SEO & Social:</strong> Validate meta tags and social
                  media integration
                </li>
              </ul>
            </div>

            {/* Tips for Instructors */}
            <div>
              <h6 className="font-medium text-emerald-900 dark:text-emerald-100 mb-2">
                💡 Tips for Creating Effective HTML Test Cases
              </h6>
              <ul className="text-sm text-emerald-800 dark:text-emerald-200 space-y-1 ml-4">
                <li>
                  • <strong>Start with structure:</strong> Always validate basic
                  document structure first
                </li>
                <li>
                  • <strong>Emphasize semantics:</strong> Prioritize semantic
                  HTML over presentational markup
                </li>
                <li>
                  • <strong>Accessibility first:</strong> Include accessibility
                  checks in every test case
                </li>
                <li>
                  • <strong>Content over structure:</strong> Test for meaningful
                  content, not just element presence
                </li>
                <li>
                  • <strong>Modern features:</strong> Encourage use of HTML5
                  elements and attributes
                </li>
                <li>
                  • <strong>Progressive enhancement:</strong> Ensure graceful
                  degradation and broad compatibility
                </li>
                <li>
                  • <strong>Combine validations:</strong> Use multiple keywords
                  for comprehensive testing
                </li>
              </ul>
            </div>

            <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-3 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded">
              <strong>Note:</strong> HTML validation keywords only work when
              HTML language is selected. For execution-based testing, use the
              standard input/output format without validation keywords.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
