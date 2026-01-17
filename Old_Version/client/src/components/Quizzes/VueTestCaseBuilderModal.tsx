import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface GeneratedVueTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface VueTestCaseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCaseGenerated?: (testCase: GeneratedVueTestCase) => void;
}

export const VueTestCaseBuilderModal: React.FC<
  VueTestCaseBuilderModalProps
> = ({ isOpen, onClose, onTestCaseGenerated }) => {
  const [componentName, setComponentName] = useState("");
  const [apiType, setApiType] = useState("options");
  const [hookName, setHookName] = useState("");
  const [dataProperty, setDataProperty] = useState("");
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

    const rules: string[] = [];

    // Add component validation
    rules.push(`vue:component:${componentName}`);

    // Add API type validation
    rules.push(`vue:api:${apiType}`);

    // Add hook validation
    if (hookName.trim()) {
      rules.push(`vue:hook:${hookName}`);
    }

    // Add data property validation
    if (dataProperty.trim()) {
      rules.push(`vue:data:${dataProperty}`);
    }

    // Add selected validation rules
    rules.push(...validationRules);

    if (rules.length === 0) {
      toast.error("Please specify at least one validation rule");
      return;
    }

    const testCaseDescriptor = rules.join(";");

    navigator.clipboard.writeText(testCaseDescriptor);
    toast.success("Vue.js test case copied to clipboard!", { autoClose: 2000 });

    if (onTestCaseGenerated) {
      const generated: GeneratedVueTestCase = {
        id: Date.now().toString(),
        input: testCaseDescriptor,
        expected_output: "Vue.js validation passed",
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
      title="🟢 Vue.js Test Case Builder"
      subtitle="Create comprehensive test cases for Vue.js components"
      size="xl"
    >
      <div className="space-y-6">
        {/* Component Configuration */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🧩</span>
            Component Configuration
          </h5>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                Component Name
              </label>
              <input
                type="text"
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                placeholder="MyComponent"
                className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                Vue API Type
              </label>
              <select
                value={apiType}
                onChange={(e) => setApiType(e.target.value)}
                className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="options">Options API</option>
                <option value="composition">Composition API</option>
                <option value="setup">Setup Script</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                Lifecycle Hook (Optional)
              </label>
              <input
                type="text"
                value={hookName}
                onChange={(e) => setHookName(e.target.value)}
                placeholder="mounted, created, updated"
                className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                Data Property (Optional)
              </label>
              <input
                type="text"
                value={dataProperty}
                onChange={(e) => setDataProperty(e.target.value)}
                placeholder="message, count, items"
                className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Validation Requirements */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
            <span className="text-lg">✅</span>
            Additional Validation Requirements
          </h5>

          <div className="grid gap-3">
            {[
              {
                key: "vue:template:syntax",
                label: "Template Syntax",
                desc: "Require proper Vue template syntax",
              },
              {
                key: "vue:reactive:data",
                label: "Reactive Data",
                desc: "Require reactive data properties",
              },
              {
                key: "vue:computed:properties",
                label: "Computed Properties",
                desc: "Require computed properties usage",
              },
              {
                key: "vue:watchers",
                label: "Watchers",
                desc: "Require watchers for reactive updates",
              },
              {
                key: "vue:directives",
                label: "Vue Directives",
                desc: "Require v-bind, v-if, v-for directives",
              },
              {
                key: "vue:events",
                label: "Event Handling",
                desc: "Require @click, v-on event handlers",
              },
              {
                key: "vue:props",
                label: "Props Declaration",
                desc: "Require props declaration and validation",
              },
              {
                key: "vue:emits",
                label: "Emits Declaration",
                desc: "Require emits declaration",
              },
              {
                key: "vue:slots",
                label: "Slots Usage",
                desc: "Require slot usage for content distribution",
              },
              {
                key: "vue:provide-inject",
                label: "Provide/Inject",
                desc: "Require dependency injection pattern",
              },
            ].map((rule) => (
              <label
                key={rule.key}
                className="flex items-start gap-3 p-3 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={validationRules.includes(rule.key)}
                  onChange={() => handleValidationToggle(rule.key)}
                  className="mt-1 text-green-600 focus:ring-green-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-green-900 dark:text-green-100">
                    {rule.label}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
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
            Generated Vue.js Test Case
          </h5>

          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg font-mono text-sm mb-4">
            {(() => {
              const rules: string[] = [];
              if (componentName.trim()) {
                rules.push(`vue:component:${componentName}`);
              }
              rules.push(`vue:api:${apiType}`);
              if (hookName.trim()) {
                rules.push(`vue:hook:${hookName}`);
              }
              if (dataProperty.trim()) {
                rules.push(`vue:data:${dataProperty}`);
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
                      Vue component "{componentName}" with {apiType} API
                      {hookName && ` and ${hookName} hook`}
                      {dataProperty && ` with ${dataProperty} data`}
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
            📋 Copy Vue.js Test Case to Clipboard
          </button>
        </div>

        {/* Quick Help */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <span className="text-sm">💡</span>
            Vue.js Test Case Tips
          </h6>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>
              • Start with basic component structure, then add reactivity and
              lifecycle hooks
            </li>
            <li>• Always include proper template syntax and directives</li>
            <li>• Test both Options API and Composition API patterns</li>
            <li>
              • Include props validation and event emission for complete
              components
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
