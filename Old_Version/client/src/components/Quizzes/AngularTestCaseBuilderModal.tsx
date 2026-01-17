import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface GeneratedAngularTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface AngularTestCaseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCaseGenerated?: (testCase: GeneratedAngularTestCase) => void;
}

export const AngularTestCaseBuilderModal: React.FC<
  AngularTestCaseBuilderModalProps
> = ({ isOpen, onClose, onTestCaseGenerated }) => {
  const [componentName, setComponentName] = useState("");
  const [decoratorType, setDecoratorType] = useState("component");
  const [lifecycleHook, setLifecycleHook] = useState("");
  const [serviceName, setServiceName] = useState("");
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

    // Add component/service validation
    if (decoratorType === "component") {
      rules.push(`angular:component:${componentName}`);
    } else if (decoratorType === "service") {
      rules.push(`angular:service:${componentName}`);
    } else if (decoratorType === "directive") {
      rules.push(`angular:directive:${componentName}`);
    }

    // Add lifecycle hook validation
    if (lifecycleHook.trim()) {
      rules.push(`angular:hook:${lifecycleHook}`);
    }

    // Add service validation
    if (serviceName.trim()) {
      rules.push(`angular:service:${serviceName}`);
    }

    // Add selected validation rules
    rules.push(...validationRules);

    if (rules.length === 0) {
      toast.error("Please specify at least one validation rule");
      return;
    }

    const testCaseDescriptor = rules.join(";");

    navigator.clipboard.writeText(testCaseDescriptor);
    toast.success("Angular test case copied to clipboard!", {
      autoClose: 2000,
    });

    if (onTestCaseGenerated) {
      const generated: GeneratedAngularTestCase = {
        id: Date.now().toString(),
        input: testCaseDescriptor,
        expected_output: "Angular validation passed",
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
      title="🅰️ Angular Test Case Builder"
      subtitle="Create comprehensive test cases for Angular components and services"
      size="xl"
    >
      <div className="space-y-6">
        {/* Component/Service Configuration */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-red-900 dark:text-red-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🏗️</span>
            Component/Service Configuration
          </h5>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                Type
              </label>
              <select
                value={decoratorType}
                onChange={(e) => setDecoratorType(e.target.value)}
                className="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="component">Component</option>
                <option value="service">Service</option>
                <option value="directive">Directive</option>
                <option value="pipe">Pipe</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                Name
              </label>
              <input
                type="text"
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                placeholder="MyComponent, DataService, etc."
                className="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                Lifecycle Hook (Optional)
              </label>
              <input
                type="text"
                value={lifecycleHook}
                onChange={(e) => setLifecycleHook(e.target.value)}
                placeholder="ngOnInit, ngOnDestroy, etc."
                className="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                Service Injection (Optional)
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="HttpClient, Router, etc."
                className="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Validation Requirements */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-red-900 dark:text-red-100 mb-4 flex items-center gap-2">
            <span className="text-lg">✅</span>
            Additional Validation Requirements
          </h5>

          <div className="grid gap-3">
            {[
              {
                key: "angular:typescript",
                label: "TypeScript Usage",
                desc: "Require TypeScript with proper typing",
              },
              {
                key: "angular:decorators",
                label: "Decorator Usage",
                desc: "Require proper Angular decorators",
              },
              {
                key: "angular:dependency-injection",
                label: "Dependency Injection",
                desc: "Require dependency injection patterns",
              },
              {
                key: "angular:reactive-forms",
                label: "Reactive Forms",
                desc: "Require reactive forms usage",
              },
              {
                key: "angular:http-client",
                label: "HTTP Client",
                desc: "Require HttpClient usage",
              },
              {
                key: "angular:routing",
                label: "Routing",
                desc: "Require Angular Router usage",
              },
              {
                key: "angular:observables",
                label: "RxJS Observables",
                desc: "Require observable patterns",
              },
              {
                key: "angular:change-detection",
                label: "Change Detection",
                desc: "Require proper change detection strategy",
              },
              {
                key: "angular:modules",
                label: "Module Declaration",
                desc: "Require NgModule declaration",
              },
              {
                key: "angular:guards",
                label: "Route Guards",
                desc: "Require route guard implementation",
              },
            ].map((rule) => (
              <label
                key={rule.key}
                className="flex items-start gap-3 p-3 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={validationRules.includes(rule.key)}
                  onChange={() => handleValidationToggle(rule.key)}
                  className="mt-1 text-red-600 focus:ring-red-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-red-900 dark:text-red-100">
                    {rule.label}
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    {rule.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Generated Test Case */}
        <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-lg p-4">
          <h5 className="font-semibold text-red-900 dark:text-red-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🎯</span>
            Generated Angular Test Case
          </h5>

          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg font-mono text-sm mb-4">
            {(() => {
              const rules: string[] = [];
              if (componentName.trim()) {
                rules.push(`angular:${decoratorType}:${componentName}`);
              }
              if (lifecycleHook.trim()) {
                rules.push(`angular:hook:${lifecycleHook}`);
              }
              if (serviceName.trim()) {
                rules.push(`angular:service:${serviceName}`);
              }
              rules.push(...validationRules);

              return rules.length > 0 ? (
                <div className="space-y-2">
                  <div>
                    <strong className="text-red-700 dark:text-red-300">
                      Test Case:
                    </strong>{" "}
                    <code className="bg-red-100 dark:bg-red-900 px-2 py-1 rounded break-all">
                      {rules.join(";")}
                    </code>
                  </div>
                  {componentName && (
                    <div>
                      <strong className="text-red-700 dark:text-red-300">
                        Validates:
                      </strong>{" "}
                      Angular {decoratorType} "{componentName}"
                      {lifecycleHook && ` with ${lifecycleHook} hook`}
                      {serviceName && ` injecting ${serviceName}`}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-gray-500">
                  Configure component/service details to generate test case...
                </span>
              );
            })()}
          </div>

          <button
            onClick={generateTestCase}
            disabled={!componentName.trim()}
            className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed"
          >
            📋 Copy Angular Test Case to Clipboard
          </button>
        </div>

        {/* Quick Help */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <span className="text-sm">💡</span>
            Angular Test Case Tips
          </h6>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>
              • Start with component/service structure, then add lifecycle hooks
            </li>
            <li>• Always include proper TypeScript typing and decorators</li>
            <li>• Test dependency injection and service usage patterns</li>
            <li>
              • Include reactive forms and HTTP client for full-stack components
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
