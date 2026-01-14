import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface GeneratedReactTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface ReactTestCaseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCaseGenerated?: (testCase: GeneratedReactTestCase) => void;
}

export const ReactTestCaseBuilderModal: React.FC<
  ReactTestCaseBuilderModalProps
> = ({ isOpen, onClose, onTestCaseGenerated }) => {
  const [componentType, setComponentType] = useState("functional");
  const [componentName, setComponentName] = useState("");
  const [hookName, setHookName] = useState("");
  const [propsStructure, setPropsStructure] = useState("");
  const [stateStructure, setStateStructure] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [validationRules, setValidationRules] = useState<string[]>([]);

  const handleValidationToggle = (rule: string) => {
    setValidationRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]
    );
  };

  const generateTestCase = () => {
    if (!componentName.trim()) {
      toast.error("Please enter a component name");
      return;
    }

    const rules: string[] = [`component:${componentName}`];

    if (componentType === "functional") {
      rules.push("component-type:functional");
    } else if (componentType === "class") {
      rules.push("component-type:class");
    } else if (componentType === "hook") {
      rules.push("component-type:hook");
      if (hookName.trim()) {
        rules.push(`hook:${hookName}`);
      }
    }

    if (propsStructure.trim()) {
      rules.push(`props-structure:${propsStructure}`);
    }

    if (stateStructure.trim()) {
      rules.push(`state-structure:${stateStructure}`);
    }

    if (expectedBehavior.trim()) {
      rules.push(`behavior:${expectedBehavior}`);
    }

    rules.push(...validationRules);

    if (rules.length === 0) {
      toast.error("Please specify at least one validation rule");
      return;
    }

    const testCaseDescriptor = rules.join(";");

    navigator.clipboard.writeText(testCaseDescriptor);
    toast.success("React test case copied to clipboard!", { autoClose: 2000 });

    if (onTestCaseGenerated) {
      const generated: GeneratedReactTestCase = {
        id: Date.now().toString(),
        input: testCaseDescriptor,
        expected_output: "React validation passed",
        is_hidden: false,
        points: 10,
        time_limit: 5000,
      };

      onTestCaseGenerated(generated);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚛️ React Test Case Builder"
      subtitle="Create comprehensive test cases for React components and hooks"
      size="xl"
    >
      <div className="space-y-6">
        {/* Component Details */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <span className="text-lg">⚛️</span>
            Component Details
          </h5>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Component Type
              </label>
              <select
                value={componentType}
                onChange={(e) => setComponentType(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="functional">Functional Component</option>
                <option value="class">Class Component</option>
                <option value="hook">Custom Hook</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Component/Hook Name
              </label>
              <input
                type="text"
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                placeholder={
                  componentType === "hook"
                    ? "useCounter, useFetch"
                    : "Button, UserCard, TodoList"
                }
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {componentType === "hook" && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Hook Name (Optional)
              </label>
              <input
                type="text"
                value={hookName}
                onChange={(e) => setHookName(e.target.value)}
                placeholder="useState, useEffect, useCallback"
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Props Structure (Optional)
              </label>
              <input
                type="text"
                value={propsStructure}
                onChange={(e) => setPropsStructure(e.target.value)}
                placeholder="title:string, items:array, onClick:function"
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                State Structure (Optional)
              </label>
              <input
                type="text"
                value={stateStructure}
                onChange={(e) => setStateStructure(e.target.value)}
                placeholder="count:number, isLoading:boolean, data:object"
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              Expected Behavior (Optional)
            </label>
            <input
              type="text"
              value={expectedBehavior}
              onChange={(e) => setExpectedBehavior(e.target.value)}
              placeholder="renders list, handles click, updates state"
              className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Validation Requirements */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <span className="text-lg">✅</span>
            React-Specific Validation Requirements
          </h5>

          <div className="grid gap-3">
            {[
              {
                key: "uses:jsx",
                label: "Use JSX Syntax",
                desc: "Require JSX return statements",
              },
              {
                key: "uses:hooks",
                label: "Use React Hooks",
                desc: "Require React hooks usage",
              },
              {
                key: "uses:useState",
                label: "Use useState Hook",
                desc: "Require useState for state management",
              },
              {
                key: "uses:useEffect",
                label: "Use useEffect Hook",
                desc: "Require useEffect for side effects",
              },
              {
                key: "uses:useCallback",
                label: "Use useCallback Hook",
                desc: "Require useCallback for optimization",
              },
              {
                key: "uses:useMemo",
                label: "Use useMemo Hook",
                desc: "Require useMemo for computation caching",
              },
              {
                key: "uses:props",
                label: "Accept Props",
                desc: "Require component to accept props",
              },
              {
                key: "uses:children",
                label: "Render Children",
                desc: "Require component to render children",
              },
              {
                key: "uses:event-handlers",
                label: "Event Handlers",
                desc: "Require event handler functions",
              },
              {
                key: "uses:conditional-rendering",
                label: "Conditional Rendering",
                desc: "Require conditional rendering logic",
              },
              {
                key: "uses:list-rendering",
                label: "List Rendering",
                desc: "Require array mapping for lists",
              },
              {
                key: "uses:fragment",
                label: "React Fragment",
                desc: "Require React.Fragment or <> syntax",
              },
              {
                key: "lifecycle:componentDidMount",
                label: "Component Did Mount",
                desc: "Require componentDidMount logic (class components)",
              },
              {
                key: "lifecycle:componentDidUpdate",
                label: "Component Did Update",
                desc: "Require componentDidUpdate logic (class components)",
              },
              {
                key: "best-practice:key-prop",
                label: "List Key Props",
                desc: "Require key props in mapped elements",
              },
              {
                key: "best-practice:prop-types",
                label: "Prop Types",
                desc: "Require PropTypes or TypeScript interfaces",
              },
              {
                key: "best-practice:default-props",
                label: "Default Props",
                desc: "Require defaultProps or default parameters",
              },
              {
                key: "performance:memo",
                label: "React.memo",
                desc: "Require React.memo for optimization",
              },
              {
                key: "performance:lazy-loading",
                label: "Lazy Loading",
                desc: "Require React.lazy and Suspense",
              },
              {
                key: "accessibility:aria-labels",
                label: "ARIA Labels",
                desc: "Require ARIA accessibility attributes",
              },
              {
                key: "accessibility:focus-management",
                label: "Focus Management",
                desc: "Require proper focus management",
              },
              {
                key: "testing:jest-compatible",
                label: "Jest Compatible",
                desc: "Require code compatible with Jest testing",
              },
            ].map((rule) => (
              <label
                key={rule.key}
                className="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={validationRules.includes(rule.key)}
                  onChange={() => handleValidationToggle(rule.key)}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-blue-900 dark:text-blue-100">
                    {rule.label}
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    {rule.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Generated Test Case */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4">
          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🎯</span>
            Generated React Test Case
          </h5>

          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg font-mono text-sm mb-4">
            {(() => {
              const rules: string[] = [];
              if (componentName.trim()) {
                rules.push(`component:${componentName}`);
                if (componentType === "functional") {
                  rules.push("component-type:functional");
                } else if (componentType === "class") {
                  rules.push("component-type:class");
                } else if (componentType === "hook") {
                  rules.push("component-type:hook");
                  if (hookName.trim()) {
                    rules.push(`hook:${hookName}`);
                  }
                }
              }
              if (propsStructure.trim()) {
                rules.push(`props-structure:${propsStructure}`);
              }
              if (stateStructure.trim()) {
                rules.push(`state-structure:${stateStructure}`);
              }
              if (expectedBehavior.trim()) {
                rules.push(`behavior:${expectedBehavior}`);
              }
              rules.push(...validationRules);

              return rules.length > 0 ? (
                <div className="space-y-2">
                  <div>
                    <strong className="text-green-700 dark:text-green-300">
                      Test Case:
                    </strong>{" "}
                    <code className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded break-all">
                      {rules.join(";")}
                    </code>
                  </div>
                  {componentName && (
                    <div>
                      <strong className="text-green-700 dark:text-green-300">
                        Validates:
                      </strong>{" "}
                      {componentType === "hook"
                        ? `Custom hook ${componentName}`
                        : `${componentType} component ${componentName}`}
                      {propsStructure && (
                        <span>
                          {" with props: "}
                          <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                            {propsStructure}
                          </code>
                        </span>
                      )}
                      {expectedBehavior && (
                        <span>
                          {" (expected: "}
                          <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">
                            {expectedBehavior}
                          </code>
                          {")"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-gray-500">
                  Configure component details to generate test case...
                </span>
              );
            })()}
          </div>

          <button
            onClick={generateTestCase}
            disabled={!componentName.trim()}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed"
          >
            📋 Copy React Test Case to Clipboard
          </button>
        </div>

        {/* Quick Help */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <span className="text-sm">💡</span>
            React Test Case Tips
          </h6>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>
              • Start with basic component structure validation, then add
              specific behavior requirements
            </li>
            <li>• Combine multiple React patterns for comprehensive testing</li>
            <li>• Test both functional and class component implementations</li>
            <li>• Include performance and accessibility requirements</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
