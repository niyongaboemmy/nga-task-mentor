import React from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface ReactValidationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReactValidationGuideModal: React.FC<
  ReactValidationGuideModalProps
> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚛️ React Validation Keywords Guide"
      subtitle="Complete reference for creating comprehensive React component test cases"
      size="full"
    >
      <div className="space-y-6">
        {/* Comprehensive Test Case Design Guide */}
        <div className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-200 dark:border-blue-700 p-6">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <span className="text-sm">🎯</span>
            Comprehensive React Test Case Design Principles
          </h5>

          <div className="space-y-4">
            {/* The 5 Pillars of Test Case Design */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                🏗️ The 5 Pillars of Effective React Test Cases
              </h6>
              <div className="grid gap-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    1. Component Structure & Props
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Verify proper component structure, prop handling, and data
                    flow. Ensure components accept and process props correctly.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    2. State Management & Hooks
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Test state management patterns, hook usage, and state
                    updates. Validate proper use of useState, useEffect, and
                    custom hooks.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    3. Event Handling & User Interaction
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Validate event handlers, user interactions, and component
                    responses to user actions. Test click handlers, form
                    submissions, and state changes.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    4. Rendering & Lifecycle
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Test conditional rendering, list rendering, and component
                    lifecycle. Ensure proper mounting, updating, and unmounting
                    behavior.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    5. Performance & Best Practices
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Validate performance optimizations, accessibility, and React
                    best practices. Test memoization, lazy loading, and proper
                    component patterns.
                  </p>
                </div>
              </div>
            </div>

            {/* Real-World Examples */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                🌍 Real-World React Test Case Examples
              </h6>
              <div className="space-y-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200 text-base mb-2 block">
                    Interactive Counter Component
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Props & State:</strong> Accepts initial count,
                      manages internal state
                    </div>
                    <div>
                      <strong>🎯 Events:</strong> Handles increment/decrement
                      clicks
                    </div>
                    <div>
                      <strong>🔄 Rendering:</strong> Updates display on state
                      change
                    </div>
                    <div>
                      <strong>⚡ Performance:</strong> Uses useCallback for
                      event handlers
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200 text-base mb-2 block">
                    Data Fetching Component with Loading States
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Hooks:</strong> useState for loading/data,
                      useEffect for fetching
                    </div>
                    <div>
                      <strong>🎯 Async:</strong> Handles loading, success, error
                      states
                    </div>
                    <div>
                      <strong>🔄 Conditional:</strong> Renders different UI
                      based on state
                    </div>
                    <div>
                      <strong>♿ Accessibility:</strong> Proper ARIA labels for
                      loading states
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Common React Testing Mistakes */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                🚨 Common React Test Case Mistakes to Avoid
              </h6>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <ul className="space-y-2 text-sm text-red-800 dark:text-red-200">
                  <li>
                    <strong>❌ Testing implementation details:</strong> Testing
                    internal state or methods instead of component behavior
                  </li>
                  <li>
                    <strong>❌ Ignoring prop validation:</strong> Not testing
                    how components handle missing or invalid props
                  </li>
                  <li>
                    <strong>❌ Missing edge cases:</strong> Not testing error
                    states, loading states, or empty data scenarios
                  </li>
                  <li>
                    <strong>❌ Over-testing hooks:</strong> Testing hook
                    implementation instead of component behavior
                  </li>
                  <li>
                    <strong>❌ Accessibility neglect:</strong> Ignoring ARIA
                    attributes, keyboard navigation, and screen reader support
                  </li>
                  <li>
                    <strong>❌ Performance ignorance:</strong> Not testing
                    re-rendering behavior or optimization techniques
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-step Guide */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <span className="text-lg">📋</span>
            Step-by-Step Guide to Creating React Test Cases
          </h5>

          <div className="space-y-4">
            {/* Step 1: Understand Component Requirements */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
              <h6 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Understand Component Requirements & Test Case Strategy
              </h6>
              <div className="space-y-3 text-sm">
                {/* Basic Component Example */}
                <div className="bg-white/50 dark:bg-gray-700/50 p-3 rounded">
                  <strong className="text-green-800 dark:text-green-200 text-base mb-2 block">
                    📱 Example: Todo List Component
                  </strong>
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <strong>Requirements:</strong> Display todos, add new
                      todos, mark as complete
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                        ✅ CORRECT Test Cases:
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            component:TodoList;uses:useState;uses:list-rendering
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>React validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            uses:event-handlers;uses:conditional-rendering;best-practice:key-prop
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>React validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            props-structure:todos:array,onToggle:function;behavior:updates-state
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>React validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            accessibility:aria-labels;performance:memo
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>React validation passed</code> ✓
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                        ❌ INCORRECT Test Cases (Common Mistakes):
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>uses:div</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>React validation passed</code> ✗ (Too generic,
                          doesn't test React-specific behavior)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            component-type:class;lifecycle:componentDidMount
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>React validation passed</code> ✗ (Class
                          components are legacy, focus on functional components)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>uses:state</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>React validation passed</code> ✗ (Too vague,
                          specify which state management pattern)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>uses:useEffect;uses:useState</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>React validation passed</code> ✗ (Missing
                          context of how they're used together)
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <strong className="text-blue-800 dark:text-blue-200">
                        🎯 React Test Case Strategy:
                      </strong>
                      <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-300">
                        <li>
                          • <strong>Component structure:</strong> Validate
                          component type, props interface, and basic structure
                        </li>
                        <li>
                          • <strong>State management:</strong> Test state
                          initialization, updates, and hook usage
                        </li>
                        <li>
                          • <strong>Event handling:</strong> Verify event
                          handlers and user interaction responses
                        </li>
                        <li>
                          • <strong>Rendering logic:</strong> Check conditional
                          rendering and list rendering patterns
                        </li>
                        <li>
                          • <strong>Performance:</strong> Validate optimization
                          techniques and re-rendering behavior
                        </li>
                        <li>
                          • <strong>Accessibility:</strong> Ensure proper ARIA
                          attributes and keyboard navigation
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
                      Validate component structure, props, and basic setup
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                    <strong className="text-orange-800 dark:text-orange-200 flex items-center gap-1">
                      🎯 Behavior Tests
                    </strong>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      Test component behavior, events, and state changes
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <strong className="text-red-800 dark:text-red-200 flex items-center gap-1">
                      ⚡ Performance Tests
                    </strong>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      Validate optimizations and rendering efficiency
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Keywords Reference */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🔑</span>
            Complete React Validation Keywords Reference
          </h5>

          <div className="space-y-4">
            {/* Component Structure */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2">
                🏗️ Component Structure
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "component:name",
                    desc: "Must include specific component name",
                    example: "component:Button",
                  },
                  {
                    keyword: "component-type:functional",
                    desc: "Must be a functional component",
                    example: "component-type:functional",
                  },
                  {
                    keyword: "component-type:class",
                    desc: "Must be a class component",
                    example: "component-type:class",
                  },
                  {
                    keyword: "component-type:hook",
                    desc: "Must be a custom hook",
                    example: "component-type:hook",
                  },
                  {
                    keyword: "hook:name",
                    desc: "Must include specific hook name",
                    example: "hook:useCounter",
                  },
                  {
                    keyword: "props-structure:type1:type2",
                    desc: "Must accept props with specific structure",
                    example: "props-structure:title:string,items:array",
                  },
                  {
                    keyword: "state-structure:key:type",
                    desc: "Must manage state with specific structure",
                    example: "state-structure:count:number,isLoading:boolean",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* React Hooks & State */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2">
                🎣 React Hooks & State
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "uses:hooks",
                    desc: "Must use React hooks",
                    example: "uses:hooks",
                  },
                  {
                    keyword: "uses:useState",
                    desc: "Must use useState hook",
                    example: "uses:useState",
                  },
                  {
                    keyword: "uses:useEffect",
                    desc: "Must use useEffect hook",
                    example: "uses:useEffect",
                  },
                  {
                    keyword: "uses:useCallback",
                    desc: "Must use useCallback hook",
                    example: "uses:useCallback",
                  },
                  {
                    keyword: "uses:useMemo",
                    desc: "Must use useMemo hook",
                    example: "uses:useMemo",
                  },
                  {
                    keyword: "uses:useRef",
                    desc: "Must use useRef hook",
                    example: "uses:useRef",
                  },
                  {
                    keyword: "uses:useContext",
                    desc: "Must use useContext hook",
                    example: "uses:useContext",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Rendering & JSX */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2">
                🔄 Rendering & JSX
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "uses:jsx",
                    desc: "Must use JSX syntax",
                    example: "uses:jsx",
                  },
                  {
                    keyword: "uses:props",
                    desc: "Must accept and use props",
                    example: "uses:props",
                  },
                  {
                    keyword: "uses:children",
                    desc: "Must render children",
                    example: "uses:children",
                  },
                  {
                    keyword: "uses:event-handlers",
                    desc: "Must include event handlers",
                    example: "uses:event-handlers",
                  },
                  {
                    keyword: "uses:conditional-rendering",
                    desc: "Must use conditional rendering",
                    example: "uses:conditional-rendering",
                  },
                  {
                    keyword: "uses:list-rendering",
                    desc: "Must render lists with map",
                    example: "uses:list-rendering",
                  },
                  {
                    keyword: "uses:fragment",
                    desc: "Must use React.Fragment",
                    example: "uses:fragment",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Performance & Best Practices */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2">
                ⚡ Performance & Best Practices
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "performance:memo",
                    desc: "Must use React.memo",
                    example: "performance:memo",
                  },
                  {
                    keyword: "performance:lazy-loading",
                    desc: "Must use React.lazy",
                    example: "performance:lazy-loading",
                  },
                  {
                    keyword: "best-practice:key-prop",
                    desc: "Must use key props in lists",
                    example: "best-practice:key-prop",
                  },
                  {
                    keyword: "best-practice:prop-types",
                    desc: "Must define prop types",
                    example: "best-practice:prop-types",
                  },
                  {
                    keyword: "best-practice:default-props",
                    desc: "Must provide default props",
                    example: "best-practice:default-props",
                  },
                  {
                    keyword: "lifecycle:componentDidMount",
                    desc: "Must implement componentDidMount",
                    example: "lifecycle:componentDidMount",
                  },
                  {
                    keyword: "lifecycle:componentDidUpdate",
                    desc: "Must implement componentDidUpdate",
                    example: "lifecycle:componentDidUpdate",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Accessibility */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2">
                ♿ Accessibility
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "accessibility:basics",
                    desc: "Must include basic accessibility features",
                    example: "accessibility:basics",
                  },
                  {
                    keyword: "accessibility:aria-labels",
                    desc: "Must use ARIA labels",
                    example: "accessibility:aria-labels",
                  },
                  {
                    keyword: "accessibility:focus-management",
                    desc: "Must manage focus properly",
                    example: "accessibility:focus-management",
                  },
                  {
                    keyword: "accessibility:keyboard-navigation",
                    desc: "Must support keyboard navigation",
                    example: "accessibility:keyboard-navigation",
                  },
                  {
                    keyword: "accessibility:screen-reader",
                    desc: "Must support screen readers",
                    example: "accessibility:screen-reader",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Testing & Quality */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2">
                🧪 Testing & Quality
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "testing:jest-compatible",
                    desc: "Must be compatible with Jest testing",
                    example: "testing:jest-compatible",
                  },
                  {
                    keyword: "testing:react-testing-library",
                    desc: "Must work with React Testing Library",
                    example: "testing:react-testing-library",
                  },
                  {
                    keyword: "behavior:updates-state",
                    desc: "Must update state correctly",
                    example: "behavior:updates-state",
                  },
                  {
                    keyword: "behavior:handles-events",
                    desc: "Must handle events properly",
                    example: "behavior:handles-events",
                  },
                  {
                    keyword: "behavior:renders-correctly",
                    desc: "Must render correct output",
                    example: "behavior:renders-correctly",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
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
        <div className="bg-blue-100/50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700 p-4">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <span className="text-sm">📖</span>
            Complete Guide to React Test Case Validation
          </h5>

          <div className="space-y-4">
            {/* Basic Usage */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                🔧 Basic Usage
              </h6>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4">
                <li>
                  • <strong>Single validation:</strong>{" "}
                  <code>uses:useState</code>
                </li>
                <li>
                  • <strong>Multiple validations:</strong>{" "}
                  <code>
                    component:Button;uses:hooks;uses:event-handlers;best-practice:key-prop
                  </code>
                </li>
                <li>
                  • <strong>Expected output:</strong>{" "}
                  <code>React validation passed</code>
                </li>
              </ul>
            </div>

            {/* Validation Categories */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                📋 Validation Categories
              </h6>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4">
                <li>
                  • <strong>Component Structure:</strong> Validate component
                  types, props, and basic setup
                </li>
                <li>
                  • <strong>Hooks & State:</strong> Test React hooks usage and
                  state management patterns
                </li>
                <li>
                  • <strong>Rendering:</strong> Check JSX usage, conditional
                  rendering, and list rendering
                </li>
                <li>
                  • <strong>Event Handling:</strong> Validate user interactions
                  and event handler implementations
                </li>
                <li>
                  • <strong>Performance:</strong> Test optimization techniques
                  and rendering efficiency
                </li>
                <li>
                  • <strong>Accessibility:</strong> Ensure inclusive design and
                  proper ARIA implementation
                </li>
                <li>
                  • <strong>Best Practices:</strong> Validate React conventions
                  and modern patterns
                </li>
              </ul>
            </div>

            {/* Tips for Instructors */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                💡 Tips for Creating Effective React Test Cases
              </h6>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4">
                <li>
                  • <strong>Focus on behavior:</strong> Test what components do,
                  not how they do it
                </li>
                <li>
                  • <strong>Start with basics:</strong> Validate component
                  structure and props first
                </li>
                <li>
                  • <strong>Test user interactions:</strong> Include event
                  handling and state updates
                </li>
                <li>
                  • <strong>Include edge cases:</strong> Test error states,
                  loading states, and empty data
                </li>
                <li>
                  • <strong>Performance matters:</strong> Validate optimization
                  techniques for complex components
                </li>
                <li>
                  • <strong>Accessibility first:</strong> Always include
                  accessibility requirements
                </li>
                <li>
                  • <strong>Modern patterns:</strong> Prefer functional
                  components and hooks over class components
                </li>
                <li>
                  • <strong>Testing compatibility:</strong> Ensure components
                  work with testing libraries
                </li>
              </ul>
            </div>

            <div className="text-xs text-blue-700 dark:text-blue-300 mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <strong>Note:</strong> React validation keywords only work when
              React language is selected. For execution-based testing, use the
              standard input/output format without validation keywords.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
