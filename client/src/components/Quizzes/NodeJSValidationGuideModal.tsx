import React from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface NodeJSValidationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NodeJSValidationGuideModal: React.FC<
  NodeJSValidationGuideModalProps
> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🟢 Node.js Validation Keywords Guide"
      subtitle="Complete reference for creating comprehensive Node.js application test cases"
      size="full"
    >
      <div className="space-y-6">
        {/* Comprehensive Test Case Design Guide */}
        <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl border border-green-200 dark:border-green-700 p-6">
          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
            <span className="text-sm">🎯</span>
            Comprehensive Node.js Test Case Design Principles
          </h5>

          <div className="space-y-4">
            {/* The 5 Pillars of Test Case Design */}
            <div>
              <h6 className="font-medium text-green-900 dark:text-green-100 mb-3">
                🏗️ The 5 Pillars of Effective Node.js Test Cases
              </h6>
              <div className="grid gap-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200">
                    1. Module System & Dependencies
                  </strong>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Verify proper module imports, exports, and dependency
                    management. Ensure correct usage of CommonJS vs ES modules
                    and proper package.json configuration.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200">
                    2. Asynchronous Programming
                  </strong>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Test async/await patterns, Promises, callbacks, and
                    event-driven programming. Validate proper error handling in
                    asynchronous operations and resource cleanup.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200">
                    3. Server & API Development
                  </strong>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Validate HTTP server creation, routing, middleware usage,
                    and API endpoint implementation. Test request/response
                    handling and proper HTTP status codes.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200">
                    4. File System & I/O Operations
                  </strong>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Test file reading/writing, directory operations, streams,
                    and buffer usage. Ensure proper error handling and resource
                    management for I/O operations.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200">
                    5. Production-Ready Features
                  </strong>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Validate security, performance, logging, testing, and
                    deployment configurations. Ensure applications are ready for
                    production environments.
                  </p>
                </div>
              </div>
            </div>

            {/* Real-World Examples */}
            <div>
              <h6 className="font-medium text-green-900 dark:text-green-100 mb-3">
                🌍 Real-World Node.js Test Case Examples
              </h6>
              <div className="space-y-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200 text-base mb-2 block">
                    REST API with File Upload
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Modules:</strong> Proper Express setup with
                      multer for file handling
                    </div>
                    <div>
                      <strong>🔄 Async:</strong> Async file processing with
                      proper error handling
                    </div>
                    <div>
                      <strong>🛡️ Security:</strong> File type validation and
                      size limits
                    </div>
                    <div>
                      <strong>📊 Performance:</strong> Streaming for large files
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-green-800 dark:text-green-200 text-base mb-2 block">
                    Database Service with Connection Pooling
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Modules:</strong> Database driver with
                      connection management
                    </div>
                    <div>
                      <strong>🔄 Async:</strong> Promise-based queries with
                      transaction support
                    </div>
                    <div>
                      <strong>🛡️ Error Handling:</strong> Connection failures
                      and query errors
                    </div>
                    <div>
                      <strong>⚡ Performance:</strong> Connection pooling and
                      query optimization
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Common Node.js Testing Mistakes */}
            <div>
              <h6 className="font-medium text-green-900 dark:text-green-100 mb-3">
                🚨 Common Node.js Test Case Mistakes to Avoid
              </h6>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <ul className="space-y-2 text-sm text-red-800 dark:text-red-200">
                  <li>
                    <strong>❌ Blocking operations:</strong> Synchronous file
                    I/O in production code
                  </li>
                  <li>
                    <strong>❌ Memory leaks:</strong> Not properly closing
                    streams or database connections
                  </li>
                  <li>
                    <strong>❌ No error handling:</strong> Missing try-catch
                    blocks in async operations
                  </li>
                  <li>
                    <strong>❌ Insecure code:</strong> No input validation or
                    security headers
                  </li>
                  <li>
                    <strong>❌ Poor performance:</strong> Not using streams for
                    large data processing
                  </li>
                  <li>
                    <strong>❌ Callback hell:</strong> Deeply nested callbacks
                    instead of Promises/async-await
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Keywords Reference */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🔑</span>
            Complete Node.js Validation Keywords Reference
          </h5>

          <div className="space-y-4">
            {/* Core Node.js Modules */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-green-900 dark:text-green-100 cursor-pointer flex items-center gap-2">
                📦 Core Node.js Modules
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "nodejs:function:name",
                    desc: "Must include specific function",
                    example: "nodejs:function:createServer",
                  },
                  {
                    keyword: "nodejs:module:commonjs",
                    desc: "Must use CommonJS modules",
                    example: "nodejs:module:commonjs",
                  },
                  {
                    keyword: "nodejs:module:esm",
                    desc: "Must use ES modules",
                    example: "nodejs:module:esm",
                  },
                  {
                    keyword: "nodejs:api:express",
                    desc: "Must use Express.js framework",
                    example: "nodejs:api:express",
                  },
                  {
                    keyword: "nodejs:api:http",
                    desc: "Must use Node.js HTTP module",
                    example: "nodejs:api:http",
                  },
                  {
                    keyword: "nodejs:api:fastify",
                    desc: "Must use Fastify framework",
                    example: "nodejs:api:fastify",
                  },
                  {
                    keyword: "nodejs:endpoint:path",
                    desc: "Must include specific endpoint",
                    example: "nodejs:endpoint:/api/users",
                  },
                  {
                    keyword: "nodejs:http-method:method",
                    desc: "Must handle specific HTTP method",
                    example: "nodejs:http-method:POST",
                  },
                  {
                    keyword: "nodejs:operation:file-system",
                    desc: "Must include file system operations",
                    example: "nodejs:operation:file-system",
                  },
                  {
                    keyword: "nodejs:operation:http-server",
                    desc: "Must include HTTP server operations",
                    example: "nodejs:operation:http-server",
                  },
                  {
                    keyword: "nodejs:operation:database",
                    desc: "Must include database operations",
                    example: "nodejs:operation:database",
                  },
                  {
                    keyword: "nodejs:operation:async",
                    desc: "Must include async operations",
                    example: "nodejs:operation:async",
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

            {/* Asynchronous Programming */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-green-900 dark:text-green-100 cursor-pointer flex items-center gap-2">
                🔄 Asynchronous Programming
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "uses:async-await",
                    desc: "Must use async/await syntax",
                    example: "uses:async-await",
                  },
                  {
                    keyword: "uses:promises",
                    desc: "Must use Promise objects",
                    example: "uses:promises",
                  },
                  {
                    keyword: "uses:callbacks",
                    desc: "Must use callback patterns",
                    example: "uses:callbacks",
                  },
                  {
                    keyword: "uses:streams",
                    desc: "Must use stream processing",
                    example: "uses:streams",
                  },
                  {
                    keyword: "uses:events",
                    desc: "Must use EventEmitter",
                    example: "uses:events",
                  },
                  {
                    keyword: "uses:buffer",
                    desc: "Must use Buffer operations",
                    example: "uses:buffer",
                  },
                  {
                    keyword: "uses:child-process",
                    desc: "Must use child_process module",
                    example: "uses:child-process",
                  },
                  {
                    keyword: "uses:cluster",
                    desc: "Must use cluster module",
                    example: "uses:cluster",
                  },
                  {
                    keyword: "uses:worker-threads",
                    desc: "Must use worker_threads module",
                    example: "uses:worker-threads",
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

            {/* Security & Performance */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-green-900 dark:text-green-100 cursor-pointer flex items-center gap-2">
                🛡️ Security & Performance
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "error-handling:try-catch",
                    desc: "Must use try-catch blocks",
                    example: "error-handling:try-catch",
                  },
                  {
                    keyword: "error-handling:process-events",
                    desc: "Must handle process events",
                    example: "error-handling:process-events",
                  },
                  {
                    keyword: "security:input-validation",
                    desc: "Must validate user input",
                    example: "security:input-validation",
                  },
                  {
                    keyword: "security:helmet",
                    desc: "Must use security middleware",
                    example: "security:helmet",
                  },
                  {
                    keyword: "performance:compression",
                    desc: "Must use response compression",
                    example: "performance:compression",
                  },
                  {
                    keyword: "performance:caching",
                    desc: "Must implement caching",
                    example: "performance:caching",
                  },
                  {
                    keyword: "testing:jest",
                    desc: "Must use Jest testing",
                    example: "testing:jest",
                  },
                  {
                    keyword: "testing:supertest",
                    desc: "Must use Supertest for API testing",
                    example: "testing:supertest",
                  },
                  {
                    keyword: "deployment:docker",
                    desc: "Must include Docker configuration",
                    example: "deployment:docker",
                  },
                  {
                    keyword: "deployment:pm2",
                    desc: "Must use PM2 process manager",
                    example: "deployment:pm2",
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
        <div className="bg-blue-100/50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700 p-4">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <span className="text-sm">📖</span>
            Complete Guide to Node.js Test Case Validation
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
                  <code>uses:express-middleware</code>
                </li>
                <li>
                  • <strong>Multiple validations:</strong>{" "}
                  <code>
                    nodejs:function:createServer;nodejs:api:express;uses:async-await;error-handling:try-catch
                  </code>
                </li>
                <li>
                  • <strong>Expected output:</strong>{" "}
                  <code>Node.js validation passed</code>
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
                  • <strong>Core Modules:</strong> Validate Node.js built-in
                  modules and their proper usage
                </li>
                <li>
                  • <strong>Asynchronous Programming:</strong> Test async/await,
                  Promises, callbacks, and event-driven patterns
                </li>
                <li>
                  • <strong>Web Frameworks:</strong> Validate Express, Fastify,
                  and HTTP server implementations
                </li>
                <li>
                  • <strong>File System & I/O:</strong> Test file operations,
                  streams, and buffer usage
                </li>
                <li>
                  • <strong>Database Integration:</strong> Validate database
                  connections, queries, and ORM usage
                </li>
                <li>
                  • <strong>Security & Authentication:</strong> Test input
                  validation, authentication, and security headers
                </li>
                <li>
                  • <strong>Performance & Scalability:</strong> Validate
                  compression, caching, and process management
                </li>
                <li>
                  • <strong>Testing & Deployment:</strong> Ensure proper testing
                  setup and deployment configurations
                </li>
              </ul>
            </div>

            {/* Tips for Instructors */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                💡 Tips for Creating Effective Node.js Test Cases
              </h6>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4">
                <li>
                  • <strong>Start with basics:</strong> Begin with module system
                  and basic server setup
                </li>
                <li>
                  • <strong>Async first:</strong> Always include proper async
                  patterns and error handling
                </li>
                <li>
                  • <strong>Security matters:</strong> Include input validation
                  and security middleware requirements
                </li>
                <li>
                  • <strong>Performance considerations:</strong> Test with
                  streams, caching, and compression
                </li>
                <li>
                  • <strong>Production ready:</strong> Include logging, testing,
                  and deployment configurations
                </li>
                <li>
                  • <strong>Resource management:</strong> Ensure proper cleanup
                  of connections and streams
                </li>
                <li>
                  • <strong>Framework specific:</strong> Tailor validations to
                  the chosen framework (Express, Fastify, etc.)
                </li>
                <li>
                  • <strong>Real-world scenarios:</strong> Test complete
                  application workflows, not just isolated functions
                </li>
              </ul>
            </div>

            <div className="text-xs text-blue-700 dark:text-blue-300 mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <strong>Note:</strong> Node.js validation keywords only work when
              Node.js language is selected. For execution-based testing, use the
              standard input/output format without validation keywords.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
