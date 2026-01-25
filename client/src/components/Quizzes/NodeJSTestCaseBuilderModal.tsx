import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface GeneratedNodeJSTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface NodeJSTestCaseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCaseGenerated?: (testCase: GeneratedNodeJSTestCase) => void;
}

export const NodeJSTestCaseBuilderModal: React.FC<
  NodeJSTestCaseBuilderModalProps
> = ({ isOpen, onClose, onTestCaseGenerated }) => {
  const [serverType, setServerType] = useState("express");
  const [endpoint, setEndpoint] = useState("");
  const [httpMethod, setHttpMethod] = useState("GET");
  const [middleware, setMiddleware] = useState("");
  const [validationRules, setValidationRules] = useState<string[]>([]);

  const handleValidationToggle = (rule: string) => {
    setValidationRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]
    );
  };

  const generateTestCase = () => {
    const rules: string[] = [];

    // Add server type validation
    if (serverType) {
      rules.push(`nodejs:api:${serverType}`);
    }

    // Add endpoint validation
    if (endpoint.trim()) {
      rules.push(`nodejs:endpoint:${endpoint}`);
    }

    // Add HTTP method validation
    if (httpMethod) {
      rules.push(`nodejs:http-method:${httpMethod}`);
    }

    // Add middleware validation
    if (middleware.trim()) {
      rules.push(`uses:${middleware}`);
    }

    // Add selected validation rules
    rules.push(...validationRules);

    if (rules.length === 0) {
      toast.error("Please specify at least one validation rule");
      return;
    }

    const testCaseDescriptor = rules.join(";");

    navigator.clipboard.writeText(testCaseDescriptor);
    toast.success("Node.js test case copied to clipboard!", {
      autoClose: 2000,
    });

    if (onTestCaseGenerated) {
      const generated: GeneratedNodeJSTestCase = {
        id: Date.now().toString(),
        input: testCaseDescriptor,
        expected_output: "Node.js validation passed",
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
      title="🟢 Node.js Test Case Builder"
      subtitle="Create comprehensive test cases for Node.js applications"
      size="xl"
    >
      <div className="space-y-6">
        {/* Server Configuration */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🖥️</span>
            Server Configuration
          </h5>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                Server Framework
              </label>
              <select
                value={serverType}
                onChange={(e) => setServerType(e.target.value)}
                className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="express">Express.js</option>
                <option value="fastify">Fastify</option>
                <option value="http">Node.js HTTP</option>
                <option value="koa">Koa.js</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                HTTP Method
              </label>
              <select
                value={httpMethod}
                onChange={(e) => setHttpMethod(e.target.value)}
                className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                API Endpoint
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder=" /users"
                className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                Middleware
              </label>
              <input
                type="text"
                value={middleware}
                onChange={(e) => setMiddleware(e.target.value)}
                placeholder="cors, helmet, morgan"
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
                key: "uses:async-await",
                label: "Async/Await Pattern",
                desc: "Require async/await syntax",
              },
              {
                key: "error-handling:try-catch",
                desc: "Require try-catch error handling",
              },
              {
                key: "security:input-validation",
                label: "Input Validation",
                desc: "Require input validation middleware",
              },
              {
                key: "database:mongoose",
                label: "MongoDB with Mongoose",
                desc: "Require Mongoose ODM usage",
              },
              {
                key: "authentication:jwt",
                label: "JWT Authentication",
                desc: "Require JWT authentication",
              },
              {
                key: "logging:winston",
                label: "Winston Logging",
                desc: "Require Winston logger",
              },
              {
                key: "performance:compression",
                label: "Response Compression",
                desc: "Require gzip compression",
              },
              {
                key: "testing:jest",
                label: "Jest Testing",
                desc: "Require Jest test framework",
              },
              {
                key: "uses:express-middleware",
                label: "Express Middleware",
                desc: "Require custom middleware",
              },
              {
                key: "uses:streams",
                label: "Stream Processing",
                desc: "Require stream usage for large data",
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
            Generated Node.js Test Case
          </h5>

          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg font-mono text-sm mb-4">
            {(() => {
              const rules: string[] = [];
              if (serverType) {
                rules.push(`nodejs:api:${serverType}`);
              }
              if (endpoint.trim()) {
                rules.push(`nodejs:endpoint:${endpoint}`);
              }
              if (httpMethod) {
                rules.push(`nodejs:http-method:${httpMethod}`);
              }
              if (middleware.trim()) {
                rules.push(`uses:${middleware}`);
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
                  {(serverType || endpoint) && (
                    <div>
                      <strong className="text-green-700 dark:text-green-300">
                        Validates:
                      </strong>{" "}
                      {serverType && <span>{serverType} server</span>}
                      {serverType && endpoint && " with "}
                      {endpoint && (
                        <span>
                          <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                            {httpMethod} {endpoint}
                          </code>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-gray-500">
                  Configure server details to generate test case...
                </span>
              );
            })()}
          </div>

          <button
            onClick={generateTestCase}
            disabled={(() => {
              const rules: string[] = [];
              if (serverType) {
                rules.push(`nodejs:api:${serverType}`);
              }
              if (endpoint.trim()) {
                rules.push(`nodejs:endpoint:${endpoint}`);
              }
              rules.push(...validationRules);
              return rules.length === 0;
            })()}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed"
          >
            📋 Copy Node.js Test Case to Clipboard
          </button>
        </div>

        {/* Quick Help */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <span className="text-sm">💡</span>
            Node.js Test Case Tips
          </h6>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>
              • Start with basic server setup, then add middleware and security
            </li>
            <li>• Always include proper error handling and async patterns</li>
            <li>• Test both API endpoints and data processing logic</li>
            <li>• Include security, performance, and logging requirements</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
