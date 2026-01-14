import React from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface AngularValidationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AngularValidationGuideModal: React.FC<
  AngularValidationGuideModalProps
> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🅰️ Angular Validation Keywords Guide"
      subtitle="Complete reference for creating comprehensive Angular test cases"
      size="full"
    >
      <div className="space-y-6">
        {/* Comprehensive Test Case Design Guide */}
        <div className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/30 dark:to-pink-900/30 rounded-xl border border-red-200 dark:border-red-700 p-6">
          <h5 className="font-semibold text-red-900 dark:text-red-100 mb-4 flex items-center gap-2">
            <span className="text-sm">🎯</span>
            Comprehensive Angular Test Case Design Principles
          </h5>

          <div className="space-y-4">
            {/* The 5 Pillars of Test Case Design */}
            <div>
              <h6 className="font-medium text-red-900 dark:text-red-100 mb-3">
                🏗️ The 5 Pillars of Effective Angular Test Cases
              </h6>
              <div className="grid gap-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-red-800 dark:text-red-200">
                    1. Component Architecture
                  </strong>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Verify proper Angular component structure with decorators,
                    templates, and TypeScript classes. Ensure single
                    responsibility principle and proper separation of concerns.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-red-800 dark:text-red-200">
                    2. Dependency Injection
                  </strong>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Test proper dependency injection patterns, service usage,
                    and constructor injection. Validate service instantiation
                    and provider configuration.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-red-800 dark:text-red-200">
                    3. Reactive Programming
                  </strong>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Validate RxJS observable usage, async pipe implementation,
                    and reactive forms. Test proper subscription management and
                    memory leak prevention.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-red-800 dark:text-red-200">
                    4. Module System
                  </strong>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Test NgModule declarations, imports, exports, and providers.
                    Validate lazy loading, feature modules, and proper module
                    organization.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-red-800 dark:text-red-200">
                    5. Angular Ecosystem Integration
                  </strong>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Validate integration with Angular Router, HttpClient, forms,
                    and other Angular ecosystem tools. Test proper usage of
                    Angular CLI and build tools.
                  </p>
                </div>
              </div>
            </div>

            {/* Real-World Examples */}
            <div>
              <h6 className="font-medium text-red-900 dark:text-red-100 mb-3">
                🌍 Real-World Angular Test Case Examples
              </h6>
              <div className="space-y-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-red-800 dark:text-red-200 text-base mb-2 block">
                    HTTP Service Component
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> Fetches data from API and
                      displays it properly
                    </div>
                    <div>
                      <strong>⚠️ DI:</strong> HttpClient properly injected and
                      used
                    </div>
                    <div>
                      <strong>📊 Reactive:</strong> Uses observables and async
                      pipe
                    </div>
                    <div>
                      <strong>🎯 Error Handling:</strong> Proper error handling
                      and loading states
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-red-800 dark:text-red-200 text-base mb-2 block">
                    Reactive Form Component
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> Form validation and
                      submission work correctly
                    </div>
                    <div>
                      <strong>⚠️ Forms:</strong> Reactive forms properly
                      configured
                    </div>
                    <div>
                      <strong>📊 Validation:</strong> Custom validators and
                      error messages
                    </div>
                    <div>
                      <strong>🎯 TypeScript:</strong> Proper typing for form
                      controls
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Common Angular Testing Mistakes */}
            <div>
              <h6 className="font-medium text-red-900 dark:text-red-100 mb-3">
                🚨 Common Angular Test Case Mistakes to Avoid
              </h6>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <ul className="space-y-2 text-sm text-red-800 dark:text-red-200">
                  <li>
                    <strong>❌ Missing decorators:</strong> Components without
                    @Component decorator or improper selector usage
                  </li>
                  <li>
                    <strong>❌ Improper DI:</strong> Services not properly
                    injected or missing @Injectable decorator
                  </li>
                  <li>
                    <strong>❌ Memory leaks:</strong> Unsubscribed observables
                    or missing ngOnDestroy cleanup
                  </li>
                  <li>
                    <strong>❌ Template binding issues:</strong> Incorrect
                    property binding or event binding syntax
                  </li>
                  <li>
                    <strong>❌ Module configuration:</strong> Missing imports in
                    NgModule or improper provider configuration
                  </li>
                  <li>
                    <strong>❌ Change detection problems:</strong> Improper
                    OnPush strategy usage or manual change detection triggering
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-step Guide */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-red-900 dark:text-red-100 mb-4 flex items-center gap-2">
            <span className="text-lg">📋</span>
            Step-by-Step Guide to Creating Angular Test Cases
          </h5>

          <div className="space-y-4">
            {/* Step 1: Component Structure */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
              <h6 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Component Structure & Decorator Validation
              </h6>
              <div className="space-y-3 text-sm">
                <div className="bg-white/50 dark:bg-gray-700/50 p-3 rounded">
                  <strong className="text-green-800 dark:text-green-200 text-base mb-2 block">
                    📐 Example: Basic Angular Component
                  </strong>
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <strong>Requirements:</strong> Create a component with
                      proper Angular structure and TypeScript typing
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                        ✅ CORRECT Test Cases:
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            angular:component:UserList;angular:typescript
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>Angular validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>angular:decorators;angular:hook:ngOnInit</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>Angular validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            angular:dependency-injection;angular:http-client
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>Angular validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            angular:observables;angular:reactive-forms
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>Angular validation passed</code> ✓
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
          <h5 className="font-semibold text-red-900 dark:text-red-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🔑</span>
            Complete Angular Validation Keywords Reference
          </h5>

          <div className="space-y-4">
            {/* Component & Class Structure */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-red-900 dark:text-red-100 cursor-pointer flex items-center gap-2">
                🏗️ Component & Class Structure
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "angular:component:name",
                    desc: "Check for specific component class name",
                    example: "angular:component:AppComponent",
                  },
                  {
                    keyword: "angular:service:name",
                    desc: "Check for specific service class name",
                    example: "angular:service:DataService",
                  },
                  {
                    keyword: "angular:directive:name",
                    desc: "Check for specific directive name",
                    example: "angular:directive:HighlightDirective",
                  },
                  {
                    keyword: "angular:pipe:name",
                    desc: "Check for specific pipe name",
                    example: "angular:pipe:CurrencyPipe",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-red-100 dark:bg-red-900 px-2 py-1 rounded text-red-800 dark:text-red-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Decorators & Metadata */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-red-900 dark:text-red-100 cursor-pointer flex items-center gap-2">
                🎭 Decorators & Metadata
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "angular:decorators",
                    desc: "Require proper Angular decorators",
                    example: "angular:decorators",
                  },
                  {
                    keyword: "angular:typescript",
                    desc: "Require TypeScript usage",
                    example: "angular:typescript",
                  },
                  {
                    keyword: "angular:selector:name",
                    desc: "Check for specific selector",
                    example: "angular:selector:app-root",
                  },
                  {
                    keyword: "angular:template-url",
                    desc: "Require external template",
                    example: "angular:template-url",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-red-100 dark:bg-red-900 px-2 py-1 rounded text-red-800 dark:text-red-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Dependency Injection */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-red-900 dark:text-red-100 cursor-pointer flex items-center gap-2">
                💉 Dependency Injection
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "angular:dependency-injection",
                    desc: "Require dependency injection",
                    example: "angular:dependency-injection",
                  },
                  {
                    keyword: "angular:http-client",
                    desc: "Require HttpClient injection",
                    example: "angular:http-client",
                  },
                  {
                    keyword: "angular:routing",
                    desc: "Require Router injection",
                    example: "angular:routing",
                  },
                  {
                    keyword: "angular:hook:name",
                    desc: "Check for specific lifecycle hook",
                    example: "angular:hook:ngOnInit",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-red-100 dark:bg-red-900 px-2 py-1 rounded text-red-800 dark:text-red-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Reactive Programming */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-red-900 dark:text-red-100 cursor-pointer flex items-center gap-2">
                ⚛️ Reactive Programming
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "angular:observables",
                    desc: "Require RxJS observables",
                    example: "angular:observables",
                  },
                  {
                    keyword: "angular:reactive-forms",
                    desc: "Require reactive forms",
                    example: "angular:reactive-forms",
                  },
                  {
                    keyword: "angular:async-pipe",
                    desc: "Require async pipe usage",
                    example: "angular:async-pipe",
                  },
                  {
                    keyword: "angular:change-detection",
                    desc: "Require change detection strategy",
                    example: "angular:change-detection",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-red-100 dark:bg-red-900 px-2 py-1 rounded text-red-800 dark:text-red-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Modules & Routing */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-red-900 dark:text-red-100 cursor-pointer flex items-center gap-2">
                🗂️ Modules & Routing
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "angular:modules",
                    desc: "Require NgModule declaration",
                    example: "angular:modules",
                  },
                  {
                    keyword: "angular:guards",
                    desc: "Require route guards",
                    example: "angular:guards",
                  },
                  {
                    keyword: "angular:lazy-loading",
                    desc: "Require lazy loading",
                    example: "angular:lazy-loading",
                  },
                  {
                    keyword: "angular:interceptors",
                    desc: "Require HTTP interceptors",
                    example: "angular:interceptors",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-red-100 dark:bg-red-900 px-2 py-1 rounded text-red-800 dark:text-red-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
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
                      className="ml-3 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
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
        <div className="bg-red-100/50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-700 p-4">
          <h5 className="font-semibold text-red-900 dark:text-red-100 mb-3 flex items-center gap-2">
            <span className="text-sm">📖</span>
            Complete Guide to Angular Test Case Validation
          </h5>

          <div className="space-y-4">
            {/* Basic Usage */}
            <div>
              <h6 className="font-medium text-red-900 dark:text-red-100 mb-2">
                🔧 Basic Usage
              </h6>
              <ul className="text-sm text-red-800 dark:text-red-200 space-y-1 ml-4">
                <li>
                  • <strong>Single validation:</strong>{" "}
                  <code>angular:component:AppComponent</code>
                </li>
                <li>
                  • <strong>Multiple validations:</strong>{" "}
                  <code>
                    angular:component:AppComponent;angular:typescript;angular:dependency-injection
                  </code>
                </li>
                <li>
                  • <strong>Expected output:</strong>{" "}
                  <code>Angular validation passed</code>
                </li>
              </ul>
            </div>

            {/* Validation Categories */}
            <div>
              <h6 className="font-medium text-red-900 dark:text-red-100 mb-2">
                📋 Validation Categories
              </h6>
              <ul className="text-sm text-red-800 dark:text-red-200 space-y-1 ml-4">
                <li>
                  • <strong>Component Structure:</strong> Validate decorators,
                  selectors, and class structure
                </li>
                <li>
                  • <strong>Dependency Injection:</strong> Test service
                  injection and provider configuration
                </li>
                <li>
                  • <strong>Reactive Programming:</strong> Validate observables,
                  forms, and async operations
                </li>
                <li>
                  • <strong>Module System:</strong> Check NgModule declarations
                  and routing configuration
                </li>
                <li>
                  • <strong>TypeScript Integration:</strong> Ensure proper
                  typing and Angular-specific types
                </li>
                <li>
                  • <strong>Lifecycle Management:</strong> Test component
                  lifecycle hooks and cleanup
                </li>
              </ul>
            </div>

            {/* Tips for Instructors */}
            <div>
              <h6 className="font-medium text-red-900 dark:text-red-100 mb-2">
                💡 Tips for Creating Effective Angular Test Cases
              </h6>
              <ul className="text-sm text-red-800 dark:text-red-200 space-y-1 ml-4">
                <li>
                  • <strong>Start with component basics:</strong> Validate
                  @Component decorator and class structure
                </li>
                <li>
                  • <strong>Test dependency injection:</strong> Ensure proper
                  service injection and constructor usage
                </li>
                <li>
                  • <strong>Include lifecycle hooks:</strong> Test ngOnInit,
                  ngOnDestroy, and other lifecycle methods
                </li>
                <li>
                  • <strong>Validate reactive patterns:</strong> Check
                  observables, async pipe, and reactive forms
                </li>
                <li>
                  • <strong>Module configuration:</strong> Include NgModule
                  declarations and routing setup
                </li>
                <li>
                  • <strong>TypeScript integration:</strong> Require proper
                  typing and Angular-specific types
                </li>
                <li>
                  • <strong>Best practices:</strong> Enforce Angular style guide
                  and modern patterns
                </li>
              </ul>
            </div>

            <div className="text-xs text-red-700 dark:text-red-300 mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
              <strong>Note:</strong> Angular validation keywords only work when
              Angular language is selected. For execution-based testing, use the
              standard input/output format without validation keywords.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
