import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface GeneratedHtmlTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface HtmlTestCaseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCaseGenerated?: (testCase: GeneratedHtmlTestCase) => void;
}

export const HtmlTestCaseBuilderModal: React.FC<
  HtmlTestCaseBuilderModalProps
> = ({ isOpen, onClose, onTestCaseGenerated }) => {
  const [elementType, setElementType] = useState("tag");
  const [elementName, setElementName] = useState("");
  const [attributeName, setAttributeName] = useState("");
  const [attributeValue, setAttributeValue] = useState("");
  const [textContent, setTextContent] = useState("");
  const [validationRules, setValidationRules] = useState<string[]>([]);

  const handleValidationToggle = (rule: string) => {
    setValidationRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]
    );
  };

  const generateTestCase = () => {
    const rules: string[] = [];

    // Add element validation
    if (elementName.trim()) {
      if (elementType === "tag") {
        rules.push(`contains:${elementName}`);
      } else if (elementType === "class") {
        rules.push(`has-class:${elementName}`);
      } else if (elementType === "id") {
        rules.push(`has-id:${elementName}`);
      }
    }

    // Add attribute validation
    if (attributeName.trim()) {
      if (elementName.trim()) {
        rules.push(`has-attribute:${elementName}:${attributeName}`);
      }
    }

    // Add attribute value validation
    if (attributeName.trim() && attributeValue.trim() && elementName.trim()) {
      rules.push(
        `attribute-value:${elementName}:${attributeName}:${attributeValue}`
      );
    }

    // Add text content validation
    if (textContent.trim()) {
      rules.push(`text-content:${textContent}`);
    }

    // Add selected validation rules
    rules.push(...validationRules);

    if (rules.length === 0) {
      toast.error("Please specify at least one validation rule");
      return;
    }

    const testCaseDescriptor = rules.join(";");

    navigator.clipboard.writeText(testCaseDescriptor);
    toast.success("HTML test case copied to clipboard!", { autoClose: 2000 });

    if (onTestCaseGenerated) {
      const generated: GeneratedHtmlTestCase = {
        id: Date.now().toString(),
        input: testCaseDescriptor,
        expected_output: "HTML validation passed",
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
      title="🏷️ HTML Test Case Builder"
      subtitle="Create comprehensive test cases for HTML validation"
      size="xl"
    >
      <div className="space-y-6">
        {/* Element & Attribute Details */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🏗️</span>
            Element & Attribute Details
          </h5>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-2">
                Element Type
              </label>
              <select
                value={elementType}
                onChange={(e) => setElementType(e.target.value)}
                className="w-full px-3 py-2 border border-emerald-300 dark:border-emerald-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="tag">HTML Tag (div, p, h1, etc.)</option>
                <option value="class">CSS Class (.classname)</option>
                <option value="id">ID (#idname)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-2">
                Element Name
              </label>
              <input
                type="text"
                value={elementName}
                onChange={(e) => setElementName(e.target.value)}
                placeholder={
                  elementType === "tag"
                    ? "div, p, h1, img"
                    : elementType === "class"
                    ? "container, header"
                    : "main, content"
                }
                className="w-full px-3 py-2 border border-emerald-300 dark:border-emerald-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-2">
                Attribute Name (Optional)
              </label>
              <input
                type="text"
                value={attributeName}
                onChange={(e) => setAttributeName(e.target.value)}
                placeholder="alt, href, type, required"
                className="w-full px-3 py-2 border border-emerald-300 dark:border-emerald-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-2">
                Attribute Value (Optional)
              </label>
              <input
                type="text"
                value={attributeValue}
                onChange={(e) => setAttributeValue(e.target.value)}
                placeholder="text, email, #, _blank"
                className="w-full px-3 py-2 border border-emerald-300 dark:border-emerald-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-2">
              Text Content (Optional)
            </label>
            <input
              type="text"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Hello World, Click here, etc."
              className="w-full px-3 py-2 border border-emerald-300 dark:border-emerald-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Validation Requirements */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-4 flex items-center gap-2">
            <span className="text-lg">✅</span>
            Additional Validation Requirements
          </h5>

          <div className="grid gap-3">
            {[
              {
                key: "doctype:html5",
                label: "HTML5 DOCTYPE",
                desc: "Require HTML5 DOCTYPE declaration",
              },
              {
                key: "valid-structure",
                label: "Valid Document Structure",
                desc: "Require proper HTML document structure",
              },
              {
                key: "semantic-html",
                label: "Semantic HTML",
                desc: "Require semantic HTML elements",
              },
              {
                key: "accessibility-basics",
                label: "Accessibility Basics",
                desc: "Require basic accessibility features",
              },
              {
                key: "form-validation:has-form",
                label: "Form Element",
                desc: "Require form element presence",
              },
              {
                key: "form-validation:has-label",
                label: "Form Labels",
                desc: "Require labels for form inputs",
              },
              {
                key: "heading-hierarchy",
                label: "Heading Hierarchy",
                desc: "Require proper heading structure",
              },
              {
                key: "has-h1",
                label: "H1 Element",
                desc: "Require h1 element presence",
              },
              {
                key: "open-graph",
                label: "Open Graph Tags",
                desc: "Require Open Graph meta tags",
              },
              {
                key: "meta-description",
                label: "Meta Description",
                desc: "Require meta description tag",
              },
            ].map((rule) => (
              <label
                key={rule.key}
                className="flex items-start gap-3 p-3 border border-emerald-200 dark:border-emerald-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={validationRules.includes(rule.key)}
                  onChange={() => handleValidationToggle(rule.key)}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-emerald-900 dark:text-emerald-100">
                    {rule.label}
                  </div>
                  <div className="text-sm text-emerald-700 dark:text-emerald-300">
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
            Generated HTML Test Case
          </h5>

          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg font-mono text-sm mb-4">
            {(() => {
              const rules: string[] = [];
              if (elementName.trim()) {
                if (elementType === "tag") {
                  rules.push(`contains:${elementName}`);
                } else if (elementType === "class") {
                  rules.push(`has-class:${elementName}`);
                } else if (elementType === "id") {
                  rules.push(`has-id:${elementName}`);
                }
              }
              if (attributeName.trim() && elementName.trim()) {
                rules.push(`has-attribute:${elementName}:${attributeName}`);
              }
              if (
                attributeName.trim() &&
                attributeValue.trim() &&
                elementName.trim()
              ) {
                rules.push(
                  `attribute-value:${elementName}:${attributeName}:${attributeValue}`
                );
              }
              if (textContent.trim()) {
                rules.push(`text-content:${textContent}`);
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
                  {(elementName || textContent) && (
                    <div>
                      <strong className="text-green-700 dark:text-green-300">
                        Validates:
                      </strong>{" "}
                      {elementName && (
                        <span>
                          {elementType === "tag"
                            ? `<${elementName}>`
                            : elementType === "class"
                            ? `.${elementName}`
                            : `#${elementName}`}
                          {attributeName && (
                            <span>
                              {" with "}
                              <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                                {attributeName}
                                {attributeValue && `="${attributeValue}"`}
                              </code>
                            </span>
                          )}
                        </span>
                      )}
                      {elementName && textContent && " and "}
                      {textContent && (
                        <span>
                          text content:{" "}
                          <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">
                            "{textContent}"
                          </code>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-gray-500">
                  Configure element/attribute details to generate test case...
                </span>
              );
            })()}
          </div>

          <button
            onClick={generateTestCase}
            disabled={(() => {
              const rules: string[] = [];
              if (elementName.trim()) {
                rules.push(`contains:${elementName}`);
              }
              if (attributeName.trim() && elementName.trim()) {
                rules.push(`has-attribute:${elementName}:${attributeName}`);
              }
              if (textContent.trim()) {
                rules.push(`text-content:${textContent}`);
              }
              rules.push(...validationRules);
              return rules.length === 0;
            })()}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed"
          >
            📋 Copy HTML Test Case to Clipboard
          </button>
        </div>

        {/* Quick Help */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <span className="text-sm">💡</span>
            HTML Test Case Tips
          </h6>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>
              • Start with basic element validation, then add attribute
              requirements
            </li>
            <li>
              • Combine structure, accessibility, and semantic requirements
            </li>
            <li>• Test both element presence and specific attribute values</li>
            <li>
              • Include form validation and SEO requirements for comprehensive
              testing
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
