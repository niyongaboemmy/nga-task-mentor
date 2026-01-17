import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface GeneratedCssTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface CssTestCaseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCaseGenerated?: (testCase: GeneratedCssTestCase) => void;
}

export const CssTestCaseBuilderModal: React.FC<
  CssTestCaseBuilderModalProps
> = ({ isOpen, onClose, onTestCaseGenerated }) => {
  const [selectorType, setSelectorType] = useState("class");
  const [selectorName, setSelectorName] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [propertyValue, setPropertyValue] = useState("");
  const [validationRules, setValidationRules] = useState<string[]>([]);

  const handleValidationToggle = (rule: string) => {
    setValidationRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]
    );
  };

  const generateTestCase = () => {
    const rules: string[] = [];

    // Add selector validation
    if (selectorName.trim()) {
      if (selectorType === "class") {
        rules.push(`selector:.${selectorName}`);
      } else if (selectorType === "id") {
        rules.push(`selector:#${selectorName}`);
      } else if (selectorType === "element") {
        rules.push(`selector:${selectorName}`);
      }
    }

    // Add property validation
    if (propertyName.trim()) {
      rules.push(`property:${propertyName}`);
    }

    // Add property-value validation
    if (propertyName.trim() && propertyValue.trim()) {
      rules.push(`value:${propertyName}=${propertyValue}`);
    }

    // Add selected validation rules
    rules.push(...validationRules);

    if (rules.length === 0) {
      toast.error("Please specify at least one validation rule");
      return;
    }

    const testCaseDescriptor = rules.join(";");

    navigator.clipboard.writeText(testCaseDescriptor);
    toast.success("CSS test case copied to clipboard!", { autoClose: 2000 });

    if (onTestCaseGenerated) {
      const generated: GeneratedCssTestCase = {
        id: Date.now().toString(),
        input: testCaseDescriptor,
        expected_output: "CSS validation passed",
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
      title="🎨 CSS Test Case Builder"
      subtitle="Create comprehensive test cases for CSS validation"
      size="xl"
    >
      <div className="space-y-6">
        {/* Selector & Property Details */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🎯</span>
            Selector & Property Details
          </h5>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
                Selector Type
              </label>
              <select
                value={selectorType}
                onChange={(e) => setSelectorType(e.target.value)}
                className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="class">Class (.classname)</option>
                <option value="id">ID (#idname)</option>
                <option value="element">Element (div, p, etc.)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
                Selector Name
              </label>
              <input
                type="text"
                value={selectorName}
                onChange={(e) => setSelectorName(e.target.value)}
                placeholder={
                  selectorType === "class"
                    ? "container"
                    : selectorType === "id"
                    ? "main"
                    : "div"
                }
                className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
                CSS Property
              </label>
              <input
                type="text"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="display, color, margin, etc."
                className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
              Property Value (Optional)
            </label>
            <input
              type="text"
              value={propertyValue}
              onChange={(e) => setPropertyValue(e.target.value)}
              placeholder="flex, #333, 20px, etc."
              className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Validation Requirements */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
            <span className="text-lg">✅</span>
            Additional Validation Requirements
          </h5>

          <div className="grid gap-3">
            {[
              {
                key: "layout:flexbox",
                label: "Flexbox Layout",
                desc: "Require flexbox layout implementation",
              },
              {
                key: "layout:grid",
                label: "CSS Grid Layout",
                desc: "Require CSS grid layout implementation",
              },
              {
                key: "responsive-design",
                label: "Responsive Design",
                desc: "Require responsive design patterns",
              },
              {
                key: "animation:keyframes",
                label: "CSS Keyframes",
                desc: "Require @keyframes animation",
              },
              {
                key: "animation:transition",
                label: "CSS Transitions",
                desc: "Require CSS transition properties",
              },
              {
                key: "color:hex",
                label: "Hex Color Values",
                desc: "Require hexadecimal color values",
              },
              {
                key: "color:rgb",
                label: "RGB Color Values",
                desc: "Require RGB color values",
              },
              {
                key: "font:family",
                label: "Font Family",
                desc: "Require font-family property",
              },
              {
                key: "not-contains:!important",
                label: "No !important",
                desc: "Prohibit use of !important",
              },
              {
                key: "valid-css",
                label: "Valid CSS Syntax",
                desc: "Require valid CSS syntax",
              },
            ].map((rule) => (
              <label
                key={rule.key}
                className="flex items-start gap-3 p-3 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={validationRules.includes(rule.key)}
                  onChange={() => handleValidationToggle(rule.key)}
                  className="mt-1 text-purple-600 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-purple-900 dark:text-purple-100">
                    {rule.label}
                  </div>
                  <div className="text-sm text-purple-700 dark:text-purple-300">
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
            Generated CSS Test Case
          </h5>

          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg font-mono text-sm mb-4">
            {(() => {
              const rules: string[] = [];
              if (selectorName.trim()) {
                if (selectorType === "class") {
                  rules.push(`selector:.${selectorName}`);
                } else if (selectorType === "id") {
                  rules.push(`selector:#${selectorName}`);
                } else if (selectorType === "element") {
                  rules.push(`selector:${selectorName}`);
                }
              }
              if (propertyName.trim()) {
                rules.push(`property:${propertyName}`);
              }
              if (propertyName.trim() && propertyValue.trim()) {
                rules.push(`value:${propertyName}=${propertyValue}`);
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
                  {(selectorName || propertyName) && (
                    <div>
                      <strong className="text-green-700 dark:text-green-300">
                        Validates:
                      </strong>{" "}
                      {selectorName && (
                        <span>
                          {selectorType === "class"
                            ? `.${selectorName}`
                            : selectorType === "id"
                            ? `#${selectorName}`
                            : selectorName}
                        </span>
                      )}
                      {selectorName && propertyName && " with "}
                      {propertyName && (
                        <span>
                          <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                            {propertyName}
                          </code>
                          {propertyValue && (
                            <span>
                              {" = "}
                              <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">
                                {propertyValue}
                              </code>
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-gray-500">
                  Configure selector/property details to generate test case...
                </span>
              );
            })()}
          </div>

          <button
            onClick={generateTestCase}
            disabled={(() => {
              const rules: string[] = [];
              if (selectorName.trim()) {
                rules.push(`selector:.${selectorName}`);
              }
              if (propertyName.trim()) {
                rules.push(`property:${propertyName}`);
              }
              rules.push(...validationRules);
              return rules.length === 0;
            })()}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed"
          >
            📋 Copy CSS Test Case to Clipboard
          </button>
        </div>

        {/* Quick Help */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <span className="text-sm">💡</span>
            CSS Test Case Tips
          </h6>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>
              • Start with basic selector validation, then add property
              requirements
            </li>
            <li>• Combine multiple rules for comprehensive CSS testing</li>
            <li>• Test both presence and specific values of properties</li>
            <li>• Include layout and responsive design requirements</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
