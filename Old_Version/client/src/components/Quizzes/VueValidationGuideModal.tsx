import React from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface VueValidationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VueValidationGuideModal: React.FC<
  VueValidationGuideModalProps
> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🟢 Vue.js Validation Keywords Guide"
      subtitle="Complete reference for creating comprehensive Vue.js test cases"
      size="full"
    >
      <div className="space-y-6">
        {/* Comprehensive Test Case Design Guide */}
        <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl border border-green-200 dark:border-green-700 p-6">
          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
            <span className="text-sm">🎯</span>
            Comprehensive Vue.js Test Case Design Principles
          </h5>

          <div className="space-y-4">
            {/* The 5 Pillars of Test Case Design */}
            <div>
              <h6 className="font-medium text-green-900 dark:text-green-100 mb-3">
                🏗️ The 5 Pillars of Effective Vue.js Test Cases
              </h6>
              <div className="grid gap-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200">
                    1. Component Structure
                  </strong>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Verify proper Vue component structure with template, script,
                    and style sections. Ensure single file components follow Vue
                    conventions.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200">
                    2. Reactivity System
                  </strong>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Test Vue's reactivity system including data properties,
                    computed properties, and watchers. Validate proper reactive
                    updates.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200">
                    3. Component Communication
                  </strong>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Validate props passing, event emission, and provide/inject
                    patterns. Ensure proper parent-child component
                    communication.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200">
                    4. Lifecycle Management
                  </strong>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Test component lifecycle hooks and proper cleanup. Validate
                    mounted, updated, and destroyed hook implementations.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200">
                    5. Vue Ecosystem Integration
                  </strong>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Validate integration with Vue Router, Vuex/Pinia, and other
                    Vue ecosystem tools. Test proper usage of Vue directives and
                    plugins.
                  </p>
                </div>
              </div>
            </div>

            {/* Real-World Examples */}
            <div>
              <h6 className="font-medium text-green-900 dark:text-green-100 mb-3">
                🌍 Real-World Vue.js Test Case Examples
              </h6>
              <div className="space-y-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200 text-base mb-2 block">
                    Todo List Component
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> Add, remove, and toggle
                      todo items properly
                    </div>
                    <div>
                      <strong>⚠️ Reactivity:</strong> UI updates when data
                      changes without manual DOM manipulation
                    </div>
                    <div>
                      <strong>📊 State:</strong> Proper v-model usage and data
                      binding
                    </div>
                    <div>
                      <strong>🎯 Events:</strong> @click handlers for user
                      interactions
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200 text-base mb-2 block">
                    Data Fetching Component
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> Fetches data on mount and
                      displays it
                    </div>
                    <div>
                      <strong>⚠️ Lifecycle:</strong> Uses mounted() hook for API
                      calls
                    </div>
                    <div>
                      <strong>📊 State:</strong> Loading and error states
                      properly managed
                    </div>
                    <div>
                      <strong>🎯 Async:</strong> Proper async/await usage in
                      methods
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Common Vue.js Testing Mistakes */}
            <div>
              <h6 className="font-medium text-green-900 dark:text-green-100 mb-3">
                🚨 Common Vue.js Test Case Mistakes to Avoid
              </h6>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <ul className="space-y-2 text-sm text-red-800 dark:text-red-200">
                  <li>
                    <strong>❌ Manual DOM manipulation:</strong> Using
                    document.querySelector instead of Vue's reactivity system
                  </li>
                  <li>
                    <strong>❌ Missing key attributes:</strong> v-for loops
                    without proper :key bindings
                  </li>
                  <li>
                    <strong>❌ Improper props declaration:</strong> Not
                    declaring props with proper types and defaults
                  </li>
                  <li>
                    <strong>❌ Event emission without declaration:</strong>{" "}
                    Emitting events not declared in emits option
                  </li>
                  <li>
                    <strong>❌ Direct data mutation:</strong> Modifying props
                    directly instead of using events
                  </li>
                  <li>
                    <strong>❌ Missing lifecycle cleanup:</strong> Not clearing
                    timers/intervals in beforeUnmount
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-step Guide */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
            <span className="text-lg">📋</span>
            Step-by-Step Guide to Creating Vue.js Test Cases
          </h5>

          <div className="space-y-4">
            {/* Step 1: Component Structure */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
              <h6 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Component Structure & Template Validation
              </h6>
              <div className="space-y-3 text-sm">
                <div className="bg-white/50 dark:bg-gray-700/50 p-3 rounded">
                  <strong className="text-green-800 dark:text-green-200 text-base mb-2 block">
                    📐 Example: Basic Counter Component
                  </strong>
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <strong>Requirements:</strong> Create a counter component
                      with increment/decrement buttons
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                        ✅ CORRECT Test Cases:
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>vue:component:Counter;vue:api:options</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>Vue.js validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>vue:data:count;vue:reactive:data</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>Vue.js validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>vue:events;vue:directives</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>Vue.js validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>vue:hook:mounted;vue:lifecycle</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>Vue.js validation passed</code> ✓
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Keywords Reference */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🔑</span>
            Complete Vue.js Validation Keywords Reference
          </h5>

          <div className="space-y-4">
            {/* Component Structure */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-green-900 dark:text-green-100 cursor-pointer flex items-center gap-2">
                🧩 Component Structure
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "vue:component:name",
                    desc: "Check for specific component name",
                    example: "vue:component:MyComponent",
                  },
                  {
                    keyword: "vue:api:options",
                    desc: "Require Options API usage",
                    example: "vue:api:options",
                  },
                  {
                    keyword: "vue:api:composition",
                    desc: "Require Composition API usage",
                    example: "vue:api:composition",
                  },
                  {
                    keyword: "vue:api:setup",
                    desc: "Require setup script usage",
                    example: "vue:api:setup",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-green-800 dark:text-green-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Reactivity & Data */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-green-900 dark:text-green-100 cursor-pointer flex items-center gap-2">
                ⚛️ Reactivity & Data
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "vue:data:property",
                    desc: "Check for specific data property",
                    example: "vue:data:count",
                  },
                  {
                    keyword: "vue:reactive:data",
                    desc: "Require reactive data properties",
                    example: "vue:reactive:data",
                  },
                  {
                    keyword: "vue:computed:properties",
                    desc: "Require computed properties",
                    example: "vue:computed:properties",
                  },
                  {
                    keyword: "vue:watchers",
                    desc: "Require watchers usage",
                    example: "vue:watchers",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-green-800 dark:text-green-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Template & Directives */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-green-900 dark:text-green-100 cursor-pointer flex items-center gap-2">
                🎨 Template & Directives
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "vue:template:syntax",
                    desc: "Require proper template syntax",
                    example: "vue:template:syntax",
                  },
                  {
                    keyword: "vue:directives",
                    desc: "Require Vue directives usage",
                    example: "vue:directives",
                  },
                  {
                    keyword: "vue:events",
                    desc: "Require event handling",
                    example: "vue:events",
                  },
                  {
                    keyword: "vue:slots",
                    desc: "Require slots usage",
                    example: "vue:slots",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-green-800 dark:text-green-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Component Communication */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-green-900 dark:text-green-100 cursor-pointer flex items-center gap-2">
                📡 Component Communication
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "vue:props",
                    desc: "Require props declaration",
                    example: "vue:props",
                  },
                  {
                    keyword: "vue:emits",
                    desc: "Require emits declaration",
                    example: "vue:emits",
                  },
                  {
                    keyword: "vue:provide-inject",
                    desc: "Require provide/inject pattern",
                    example: "vue:provide-inject",
                  },
                  {
                    keyword: "vue:hook:name",
                    desc: "Check for specific lifecycle hook",
                    example: "vue:hook:mounted",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-green-800 dark:text-green-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition-colors"
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
        <div className="bg-green-100/50 dark:bg-green-900/30 rounded-xl border border-green-200 dark:border-green-700 p-4">
          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
            <span className="text-sm">📖</span>
            Complete Guide to Vue.js Test Case Validation
          </h5>

          <div className="space-y-4">
            {/* Basic Usage */}
            <div>
              <h6 className="font-medium text-green-900 dark:text-green-100 mb-2">
                🔧 Basic Usage
              </h6>
              <ul className="text-sm text-green-800 dark:text-green-200 space-y-1 ml-4">
                <li>
                  • <strong>Single validation:</strong>{" "}
                  <code>vue:component:MyComponent</code>
                </li>
                <li>
                  • <strong>Multiple validations:</strong>{" "}
                  <code>
                    vue:component:MyComponent;vue:api:composition;vue:reactive:data
                  </code>
                </li>
                <li>
                  • <strong>Expected output:</strong>{" "}
                  <code>Vue.js validation passed</code>
                </li>
              </ul>
            </div>

            {/* Validation Categories */}
            <div>
              <h6 className="font-medium text-green-900 dark:text-green-100 mb-2">
                📋 Validation Categories
              </h6>
              <ul className="text-sm text-green-800 dark:text-green-200 space-y-1 ml-4">
                <li>
                  • <strong>Component Structure:</strong> Validate component
                  naming, API choice, and file structure
                </li>
                <li>
                  • <strong>Reactivity:</strong> Test data properties, computed
                  values, and watchers
                </li>
                <li>
                  • <strong>Template:</strong> Check directives, event handling,
                  and template syntax
                </li>
                <li>
                  • <strong>Communication:</strong> Validate props, emits, and
                  dependency injection
                </li>
                <li>
                  • <strong>Lifecycle:</strong> Test component lifecycle hooks
                  and cleanup
                </li>
                <li>
                  • <strong>Ecosystem:</strong> Validate integration with Vue
                  Router, Vuex, and plugins
                </li>
              </ul>
            </div>

            {/* Tips for Instructors */}
            <div>
              <h6 className="font-medium text-green-900 dark:text-green-100 mb-2">
                💡 Tips for Creating Effective Vue.js Test Cases
              </h6>
              <ul className="text-sm text-green-800 dark:text-green-200 space-y-1 ml-4">
                <li>
                  • <strong>Start with component basics:</strong> Validate
                  component structure and naming
                </li>
                <li>
                  • <strong>Test reactivity:</strong> Ensure proper data binding
                  and reactive updates
                </li>
                <li>
                  • <strong>Include lifecycle hooks:</strong> Test mounted,
                  updated, and cleanup logic
                </li>
                <li>
                  • <strong>Validate communication:</strong> Check props and
                  event emission patterns
                </li>
                <li>
                  • <strong>API consistency:</strong> Choose either Options or
                  Composition API consistently
                </li>
                <li>
                  • <strong>Directive usage:</strong> Include v-if, v-for, and
                  v-bind in templates
                </li>
                <li>
                  • <strong>Best practices:</strong> Enforce Vue.js conventions
                  and modern patterns
                </li>
              </ul>
            </div>

            <div className="text-xs text-green-700 dark:text-green-300 mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <strong>Note:</strong> Vue.js validation keywords only work when
              Vue language is selected. For execution-based testing, use the
              standard input/output format without validation keywords.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
