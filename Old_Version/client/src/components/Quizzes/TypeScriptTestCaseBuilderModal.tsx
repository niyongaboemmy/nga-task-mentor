import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface GeneratedTypeScriptTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface TypeScriptTestCaseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCaseGenerated?: (testCase: GeneratedTypeScriptTestCase) => void;
}

export const TypeScriptTestCaseBuilderModal: React.FC<
  TypeScriptTestCaseBuilderModalProps
> = ({ isOpen, onClose, onTestCaseGenerated }) => {
  const [constructType, setConstructType] = useState("interface");
  const [constructName, setConstructName] = useState("");
  const [typeDefinition, setTypeDefinition] = useState("");
  const [genericTypes, setGenericTypes] = useState("");
  const [returnType, setReturnType] = useState("");
  const [validationRules, setValidationRules] = useState<string[]>([]);

  const handleValidationToggle = (rule: string) => {
    setValidationRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]
    );
  };

  const generateTestCase = () => {
    if (!constructName.trim()) {
      toast.error("Please enter a construct name");
      return;
    }

    const rules: string[] = [`typescript:${constructType}:${constructName}`];

    if (typeDefinition.trim()) {
      rules.push(`type-definition:${typeDefinition}`);
    }

    if (genericTypes.trim()) {
      rules.push(`generics:${genericTypes}`);
    }

    if (returnType.trim()) {
      rules.push(`return-type:${returnType}`);
    }

    rules.push(...validationRules);

    if (rules.length === 0) {
      toast.error("Please specify at least one validation rule");
      return;
    }

    const testCaseDescriptor = rules.join(";");

    navigator.clipboard.writeText(testCaseDescriptor);
    toast.success("TypeScript test case copied to clipboard!", {
      autoClose: 2000,
    });

    if (onTestCaseGenerated) {
      const generated: GeneratedTypeScriptTestCase = {
        id: Date.now().toString(),
        input: testCaseDescriptor,
        expected_output: "TypeScript validation passed",
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
      title="🔷 TypeScript Test Case Builder"
      subtitle="Create comprehensive test cases for TypeScript type definitions and constructs"
      size="xl"
    >
      <div className="space-y-6">
        {/* TypeScript Construct Details */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🔷</span>
            TypeScript Construct Details
          </h5>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Construct Type
              </label>
              <select
                value={constructType}
                onChange={(e) => setConstructType(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="interface">Interface</option>
                <option value="type">Type Alias</option>
                <option value="class">Class</option>
                <option value="function">Function</option>
                <option value="enum">Enum</option>
                <option value="generic">Generic Function</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Construct Name
              </label>
              <input
                type="text"
                value={constructName}
                onChange={(e) => setConstructName(e.target.value)}
                placeholder={
                  constructType === "interface"
                    ? "User, Product, ApiResponse"
                    : constructType === "type"
                    ? "UserId, Status, Result"
                    : constructType === "class"
                    ? "UserService, Calculator"
                    : constructType === "function"
                    ? "calculateSum, fetchUser"
                    : constructType === "enum"
                    ? "Status, Role, Priority"
                    : "genericFunction"
                }
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Type Definition
              </label>
              <input
                type="text"
                value={typeDefinition}
                onChange={(e) => setTypeDefinition(e.target.value)}
                placeholder={
                  constructType === "interface"
                    ? "id: number; name: string; email: string"
                    : constructType === "type"
                    ? "string | number | boolean"
                    : constructType === "function"
                    ? "(a: number, b: number) => number"
                    : "T | U | V"
                }
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Generic Types (Optional)
              </label>
              <input
                type="text"
                value={genericTypes}
                onChange={(e) => setGenericTypes(e.target.value)}
                placeholder="T, U, K, V"
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {(constructType === "function" || constructType === "generic") && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Return Type
              </label>
              <input
                type="text"
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                placeholder="number, string, boolean, void, Promise<T>"
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          )}
        </div>

        {/* Validation Requirements */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <span className="text-lg">✅</span>
            TypeScript-Specific Validation Requirements
          </h5>

          <div className="grid gap-3">
            {[
              {
                key: "uses:strict-types",
                label: "Strict Type Checking",
                desc: "Require explicit type annotations",
              },
              {
                key: "uses:interfaces",
                label: "Use Interfaces",
                desc: "Require interface definitions",
              },
              {
                key: "uses:type-aliases",
                label: "Use Type Aliases",
                desc: "Require type alias definitions",
              },
              {
                key: "uses:generics",
                label: "Use Generics",
                desc: "Require generic type parameters",
              },
              {
                key: "uses:union-types",
                label: "Use Union Types",
                desc: "Require union type definitions",
              },
              {
                key: "uses:intersection-types",
                label: "Use Intersection Types",
                desc: "Require intersection type definitions",
              },
              {
                key: "uses:literal-types",
                label: "Use Literal Types",
                desc: "Require string/number literal types",
              },
              {
                key: "uses:mapped-types",
                label: "Use Mapped Types",
                desc: "Require mapped type definitions",
              },
              {
                key: "uses:conditional-types",
                label: "Use Conditional Types",
                desc: "Require conditional type definitions",
              },
              {
                key: "uses:utility-types",
                label: "Use Utility Types",
                desc: "Require TypeScript utility types (Partial, Pick, etc.)",
              },
              {
                key: "uses:enums",
                label: "Use Enums",
                desc: "Require enum definitions",
              },
              {
                key: "uses:readonly",
                label: "Use Readonly Modifier",
                desc: "Require readonly properties",
              },
              {
                key: "uses:optional-properties",
                label: "Use Optional Properties",
                desc: "Require optional property syntax",
              },
              {
                key: "uses:index-signatures",
                label: "Use Index Signatures",
                desc: "Require index signature definitions",
              },
              {
                key: "uses:function-overloads",
                label: "Use Function Overloads",
                desc: "Require function overload definitions",
              },
              {
                key: "uses:namespaces",
                label: "Use Namespaces",
                desc: "Require namespace declarations",
              },
              {
                key: "uses:modules",
                label: "Use ES6 Modules",
                desc: "Require import/export statements",
              },
              {
                key: "uses:decorators",
                label: "Use Decorators",
                desc: "Require decorator usage",
              },
              {
                key: "uses:access-modifiers",
                label: "Use Access Modifiers",
                desc: "Require public/private/protected modifiers",
              },
              {
                key: "uses:abstract-classes",
                label: "Use Abstract Classes",
                desc: "Require abstract class definitions",
              },
              {
                key: "uses:implements",
                label: "Use Implements",
                desc: "Require interface implementation",
              },
              {
                key: "uses:extends",
                label: "Use Extends",
                desc: "Require class inheritance",
              },
              {
                key: "type-safety:strict-null-checks",
                label: "Strict Null Checks",
                desc: "Require proper null/undefined handling",
              },
              {
                key: "type-safety:no-any",
                label: "No Any Type",
                desc: "Prohibit use of 'any' type",
              },
              {
                key: "type-safety:no-implicit-any",
                label: "No Implicit Any",
                desc: "Require explicit types for all variables",
              },
              {
                key: "compilation:no-errors",
                label: "No Compilation Errors",
                desc: "Require code to compile without errors",
              },
              {
                key: "best-practice:type-guards",
                label: "Use Type Guards",
                desc: "Require type guard functions",
              },
              {
                key: "best-practice:discriminated-unions",
                label: "Use Discriminated Unions",
                desc: "Require discriminated union patterns",
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
            Generated TypeScript Test Case
          </h5>

          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg font-mono text-sm mb-4">
            {(() => {
              const rules: string[] = [];
              if (constructName.trim()) {
                rules.push(`typescript:${constructType}:${constructName}`);
              }
              if (typeDefinition.trim()) {
                rules.push(`type-definition:${typeDefinition}`);
              }
              if (genericTypes.trim()) {
                rules.push(`generics:${genericTypes}`);
              }
              if (returnType.trim()) {
                rules.push(`return-type:${returnType}`);
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
                  {constructName && (
                    <div>
                      <strong className="text-green-700 dark:text-green-300">
                        Validates:
                      </strong>{" "}
                      {constructType} {constructName}
                      {typeDefinition && (
                        <span>
                          {" with type "}
                          <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                            {typeDefinition}
                          </code>
                        </span>
                      )}
                      {genericTypes && (
                        <span>
                          {" <"}
                          <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">
                            {genericTypes}
                          </code>
                          {">"}
                        </span>
                      )}
                      {returnType && (
                        <span>
                          {" → "}
                          <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">
                            {returnType}
                          </code>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-gray-500">
                  Configure TypeScript construct details to generate test
                  case...
                </span>
              );
            })()}
          </div>

          <button
            onClick={generateTestCase}
            disabled={!constructName.trim()}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed"
          >
            📋 Copy TypeScript Test Case to Clipboard
          </button>
        </div>

        {/* Quick Help */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <span className="text-sm">💡</span>
            TypeScript Test Case Tips
          </h6>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>
              • Start with basic type definitions, then add advanced TypeScript
              features
            </li>
            <li>
              • Combine multiple type system features for comprehensive testing
            </li>
            <li>• Test both type definitions and their practical usage</li>
            <li>• Include compilation and type safety requirements</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
