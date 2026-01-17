import React from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface CssValidationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CssValidationGuideModal: React.FC<
  CssValidationGuideModalProps
> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🎨 CSS Validation Keywords Guide"
      subtitle="Complete reference for creating comprehensive CSS test cases"
      size="full"
    >
      <div className="space-y-6">
        {/* Comprehensive Test Case Design Guide */}
        <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl border border-purple-200 dark:border-purple-700 p-6">
          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
            <span className="text-sm">🎯</span>
            Comprehensive CSS Test Case Design Principles
          </h5>

          <div className="space-y-4">
            {/* The 5 Pillars of Test Case Design */}
            <div>
              <h6 className="font-medium text-purple-900 dark:text-purple-100 mb-3">
                🏗️ The 5 Pillars of Effective CSS Test Cases
              </h6>
              <div className="grid gap-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    1. Selector Accuracy
                  </strong>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Verify CSS selectors target the correct elements. Test
                    class, ID, element, and advanced selectors for proper
                    element matching.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    2. Property Application
                  </strong>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Ensure CSS properties are applied correctly with proper
                    values. Test layout, typography, colors, and spacing
                    properties.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    3. Layout & Positioning
                  </strong>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Validate layout systems (Flexbox, Grid), positioning, and
                    responsive design patterns for proper element arrangement.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    4. Responsive Design
                  </strong>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Test media queries, fluid layouts, and mobile-first
                    approaches to ensure designs work across different screen
                    sizes.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    5. CSS Best Practices
                  </strong>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Enforce semantic HTML usage, avoid !important, use efficient
                    selectors, and follow modern CSS conventions.
                  </p>
                </div>
              </div>
            </div>

            {/* Real-World Examples */}
            <div>
              <h6 className="font-medium text-purple-900 dark:text-purple-100 mb-3">
                🌍 Real-World CSS Test Case Examples
              </h6>
              <div className="space-y-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200 text-base mb-2 block">
                    Centered Flexbox Layout
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> Container centers content
                      both horizontally and vertically
                    </div>
                    <div>
                      <strong>⚠️ Selectors:</strong> Uses proper class
                      selectors, no over-specificity
                    </div>
                    <div>
                      <strong>📐 Layout:</strong> Flexbox properties applied
                      correctly
                    </div>
                    <div>
                      <strong>📱 Responsive:</strong> Layout adapts to different
                      screen sizes
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200 text-base mb-2 block">
                    Responsive Navigation Menu
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> Menu transforms from
                      horizontal to hamburger on mobile
                    </div>
                    <div>
                      <strong>⚠️ Media Queries:</strong> Proper breakpoints for
                      different devices
                    </div>
                    <div>
                      <strong>📐 Layout:</strong> Uses modern layout techniques
                      (Flexbox/Grid)
                    </div>
                    <div>
                      <strong>🎨 Styling:</strong> Consistent typography and
                      spacing
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Common CSS Testing Mistakes */}
            <div>
              <h6 className="font-medium text-purple-900 dark:text-purple-100 mb-3">
                🚨 Common CSS Test Case Mistakes to Avoid
              </h6>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <ul className="space-y-2 text-sm text-red-800 dark:text-red-200">
                  <li>
                    <strong>❌ Over-specific selectors:</strong> Using IDs when
                    classes would work, creating maintenance issues
                  </li>
                  <li>
                    <strong>❌ !important abuse:</strong> Overriding specificity
                    with !important instead of proper selector organization
                  </li>
                  <li>
                    <strong>❌ Fixed dimensions only:</strong> Using only px
                    units without considering responsive design
                  </li>
                  <li>
                    <strong>❌ Ignoring accessibility:</strong> Poor color
                    contrast, missing focus states, improper semantic structure
                  </li>
                  <li>
                    <strong>❌ No fallbacks:</strong> Not providing fallbacks
                    for older browsers or unsupported features
                  </li>
                  <li>
                    <strong>❌ Magic numbers:</strong> Hardcoded values without
                    explanation or CSS custom properties
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-step Guide */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
            <span className="text-lg">📋</span>
            Step-by-Step Guide to Creating CSS Test Cases
          </h5>

          <div className="space-y-4">
            {/* Step 1: Understand the Design Requirements */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
              <h6 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Understand Design Requirements & Test Case Strategy
              </h6>
              <div className="space-y-3 text-sm">
                {/* Basic Layout Example */}
                <div className="bg-white/50 dark:bg-gray-700/50 p-3 rounded">
                  <strong className="text-green-800 dark:text-green-200 text-base mb-2 block">
                    📐 Example: Create a Centered Card Layout
                  </strong>
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <strong>Requirements:</strong> Center a card both
                      horizontally and vertically on the page
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                        ✅ CORRECT Test Cases:
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            selector:.card;property:display;value:display=flex
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>CSS validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            layout:flexbox;property:justify-content;value:justify-content=center
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>CSS validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            property:align-items;value:align-items=center
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>CSS validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            responsive-design;media-query:(max-width: 768px)
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>CSS validation passed</code> ✓
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                        ❌ INCORRECT Test Cases (Common Mistakes):
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>selector:#card</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>CSS validation passed</code> ✗ (ID selector
                          instead of class)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>property:margin;value:margin=auto</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>CSS validation passed</code> ✗ (Wrong centering
                          method)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>not-contains:flex</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>CSS validation passed</code> ✗ (Should require
                          flexbox)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>valid-css</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>CSS validation passed</code> ✗ (Too generic,
                          doesn't test requirements)
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <strong className="text-blue-800 dark:text-blue-200">
                        🎯 CSS Test Case Strategy:
                      </strong>
                      <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-300">
                        <li>
                          • <strong>Selector validation:</strong> Test that
                          correct selectors are used
                        </li>
                        <li>
                          • <strong>Property requirements:</strong> Ensure
                          required CSS properties are present
                        </li>
                        <li>
                          • <strong>Value validation:</strong> Check for
                          specific property values
                        </li>
                        <li>
                          • <strong>Layout techniques:</strong> Validate modern
                          layout methods (Flexbox/Grid)
                        </li>
                        <li>
                          • <strong>Responsive design:</strong> Test media
                          queries and fluid layouts
                        </li>
                        <li>
                          • <strong>Best practices:</strong> Avoid !important,
                          use efficient selectors
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Test Case Categories */}
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <strong className="text-blue-800 dark:text-blue-200 flex items-center gap-1">
                      🎯 Selector Tests
                    </strong>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Validate correct selector usage and specificity
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                    <strong className="text-orange-800 dark:text-orange-200 flex items-center gap-1">
                      📐 Layout Tests
                    </strong>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      Test positioning, Flexbox, Grid, and spacing
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <strong className="text-red-800 dark:text-red-200 flex items-center gap-1">
                      📱 Responsive Tests
                    </strong>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      Check media queries and mobile-first design
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Keywords Reference */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🔑</span>
            Complete CSS Validation Keywords Reference
          </h5>

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
                    example: "selector:.container",
                  },
                  {
                    keyword: "selector:#id-name",
                    desc: "Must include specific ID selector",
                    example: "selector:#main",
                  },
                  {
                    keyword: "selector:element",
                    desc: "Must include element selector",
                    example: "selector:div",
                  },
                  {
                    keyword: "property:display",
                    desc: "Must include display property",
                    example: "property:display",
                  },
                  {
                    keyword: "property:color",
                    desc: "Must include color property",
                    example: "property:color",
                  },
                  {
                    keyword: "value:display=flex",
                    desc: "Must have display:flex",
                    example: "value:display=flex",
                  },
                  {
                    keyword: "value:color=#333",
                    desc: "Must have specific color value",
                    example: "value:color=#333",
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
                    example: "pseudo-class:hover",
                  },
                  {
                    keyword: "pseudo-class:focus",
                    desc: "Must include :focus pseudo-class",
                    example: "pseudo-class:focus",
                  },
                  {
                    keyword: "pseudo-element:before",
                    desc: "Must include ::before pseudo-element",
                    example: "pseudo-element:before",
                  },
                  {
                    keyword: "combinator:descendant",
                    desc: "Must use descendant combinator (space)",
                    example: "combinator:descendant",
                  },
                  {
                    keyword: "combinator:child",
                    desc: "Must use child combinator (>)",
                    example: "combinator:child",
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
                    example: "layout:flexbox",
                  },
                  {
                    keyword: "layout:grid",
                    desc: "Must include CSS grid layout",
                    example: "layout:grid",
                  },
                  {
                    keyword: "has-property:.container:flex-direction",
                    desc: "Container must have flex-direction",
                    example: "has-property:.container:flex-direction",
                  },
                  {
                    keyword: "property-value:.header:position:fixed",
                    desc: "Header must be position:fixed",
                    example: "property-value:.header:position:fixed",
                  },
                  {
                    keyword: "count-selectors:class:3",
                    desc: "Must have at least 3 class selectors",
                    example: "count-selectors:class:3",
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
                    example: "responsive-design",
                  },
                  {
                    keyword: "media-query:(max-width: 768px)",
                    desc: "Must include mobile media query",
                    example: "media-query:(max-width: 768px)",
                  },
                  {
                    keyword: "property:width",
                    desc: "Must include width property",
                    example: "property:width",
                  },
                  {
                    keyword: "value:width=100%",
                    desc: "Must have width: 100%",
                    example: "value:width=100%",
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
                    example: "animation:keyframes",
                  },
                  {
                    keyword: "animation:transition",
                    desc: "Must include CSS transition",
                    example: "animation:transition",
                  },
                  {
                    keyword: "property:animation",
                    desc: "Must include animation property",
                    example: "property:animation",
                  },
                  {
                    keyword: "property:transition",
                    desc: "Must include transition property",
                    example: "property:transition",
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
                    example: "color:hex",
                  },
                  {
                    keyword: "color:rgb",
                    desc: "Must include RGB color values",
                    example: "color:rgb",
                  },
                  {
                    keyword: "font:family",
                    desc: "Must include font-family",
                    example: "font:family",
                  },
                  {
                    keyword: "font:size",
                    desc: "Must include font-size",
                    example: "font:size",
                  },
                  {
                    keyword: "property:line-height",
                    desc: "Must include line-height",
                    example: "property:line-height",
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
                    example: "valid-css",
                  },
                  {
                    keyword: "not-contains:important",
                    desc: "Should not use !important",
                    example: "not-contains:important",
                  },
                  {
                    keyword: "not-contains:inline-styles",
                    desc: "Should avoid inline styles",
                    example: "not-contains:inline-styles",
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
        </div>

        {/* Usage Instructions */}
        <div className="bg-purple-100/50 dark:bg-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-700 p-4">
          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
            <span className="text-sm">📖</span>
            Complete Guide to CSS Test Case Validation
          </h5>

          <div className="space-y-4">
            {/* Basic Usage */}
            <div>
              <h6 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
                🔧 Basic Usage
              </h6>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4">
                <li>
                  • <strong>Single validation:</strong>{" "}
                  <code>selector:.container</code>
                </li>
                <li>
                  • <strong>Multiple validations:</strong>{" "}
                  <code>
                    selector:.container;property:display;value:display=flex
                  </code>
                </li>
                <li>
                  • <strong>Expected output:</strong>{" "}
                  <code>CSS validation passed</code>
                </li>
              </ul>
            </div>

            {/* Validation Categories */}
            <div>
              <h6 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
                📋 Validation Categories
              </h6>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4">
                <li>
                  • <strong>Selectors:</strong> Validate correct selector usage
                  and specificity
                </li>
                <li>
                  • <strong>Properties:</strong> Check for required CSS
                  properties and values
                </li>
                <li>
                  • <strong>Layout:</strong> Test Flexbox, Grid, and positioning
                  techniques
                </li>
                <li>
                  • <strong>Responsive:</strong> Validate media queries and
                  fluid layouts
                </li>
                <li>
                  • <strong>Animations:</strong> Check transitions and keyframe
                  animations
                </li>
                <li>
                  • <strong>Typography:</strong> Validate fonts, colors, and
                  text properties
                </li>
                <li>
                  • <strong>Best Practices:</strong> Enforce CSS conventions and
                  avoid anti-patterns
                </li>
              </ul>
            </div>

            {/* Tips for Instructors */}
            <div>
              <h6 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
                💡 Tips for Creating Effective CSS Test Cases
              </h6>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4">
                <li>
                  • <strong>Start with selectors:</strong> Begin with basic
                  selector validation
                </li>
                <li>
                  • <strong>Test layout first:</strong> Validate positioning and
                  layout techniques
                </li>
                <li>
                  • <strong>Add responsiveness:</strong> Include media query
                  requirements
                </li>
                <li>
                  • <strong>Check best practices:</strong> Avoid !important and
                  over-specificity
                </li>
                <li>
                  • <strong>Combine validations:</strong> Use multiple keywords
                  for comprehensive testing
                </li>
                <li>
                  • <strong>Modern techniques:</strong> Prioritize Flexbox/Grid
                  over floats
                </li>
                <li>
                  • <strong>Accessibility:</strong> Include focus states and
                  proper contrast
                </li>
              </ul>
            </div>

            <div className="text-xs text-purple-700 dark:text-purple-300 mt-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
              <strong>Note:</strong> CSS validation keywords only work when CSS
              language is selected. For execution-based testing, use the
              standard input/output format without validation keywords.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
