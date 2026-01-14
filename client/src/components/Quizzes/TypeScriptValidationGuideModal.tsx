import React from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface TypeScriptValidationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TypeScriptValidationGuideModal: React.FC<
  TypeScriptValidationGuideModalProps
> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🔷 TypeScript Validation Keywords Guide"
      subtitle="Complete reference for creating comprehensive TypeScript test cases"
      size="full"
    >
      <div className="space-y-6">
        {/* Comprehensive Test Case Design Guide */}
        <div className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-200 dark:border-blue-700 p-6">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <span className="text-sm">🎯</span>
            Comprehensive TypeScript Test Case Design Principles
          </h5>

          <div className="space-y-4">
            {/* The 5 Pillars of Test Case Design */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                🏗️ The 5 Pillars of Effective TypeScript Test Cases
              </h6>
              <div className="grid gap-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    1. Type Safety & Correctness
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Verify that TypeScript code compiles without errors and uses
                    proper type annotations. Ensure type safety and prevent
                    runtime errors through compile-time checks.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    2. Type System Features
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Test advanced TypeScript features like generics, union
                    types, conditional types, and mapped types. Validate proper
                    usage of the type system capabilities.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    3. Interface & Type Definitions
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Validate interface definitions, type aliases, and class
                    structures. Ensure proper inheritance, implementation, and
                    type relationships.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    4. Advanced Patterns & Best Practices
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Test utility types, decorators, namespaces, and modern
                    TypeScript patterns. Validate adherence to TypeScript best
                    practices and conventions.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    5. Compilation & Tooling
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Ensure code compiles with strict TypeScript settings, uses
                    proper module systems, and integrates well with build tools
                    and development workflows.
                  </p>
                </div>
              </div>
            </div>

            {/* Real-World Examples */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                🌍 Real-World TypeScript Test Case Examples
              </h6>
              <div className="space-y-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200 text-base mb-2 block">
                    Generic Data Structure with Type Safety
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Type Safety:</strong> Generic types prevent
                      incorrect data types
                    </div>
                    <div>
                      <strong>🔧 Generics:</strong> Proper generic constraints
                      and type parameters
                    </div>
                    <div>
                      <strong>📝 Interfaces:</strong> Well-defined interfaces
                      for data structures
                    </div>
                    <div>
                      <strong>🛡️ Compilation:</strong> No TypeScript compilation
                      errors
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200 text-base mb-2 block">
                    API Response Handler with Discriminated Unions
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Union Types:</strong> Proper union type
                      definitions for API responses
                    </div>
                    <div>
                      <strong>🎯 Discriminated Unions:</strong> Type-safe
                      handling of different response types
                    </div>
                    <div>
                      <strong>🔍 Type Guards:</strong> Runtime type checking
                      with compile-time safety
                    </div>
                    <div>
                      <strong>⚡ Utility Types:</strong> Proper use of Pick,
                      Omit, and other utilities
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Common TypeScript Testing Mistakes */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                🚨 Common TypeScript Test Case Mistakes to Avoid
              </h6>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <ul className="space-y-2 text-sm text-red-800 dark:text-red-200">
                  <li>
                    <strong>❌ Using 'any' type:</strong> Defeats the purpose of
                    TypeScript's type safety
                  </li>
                  <li>
                    <strong>❌ Implicit any:</strong> Not providing explicit
                    types for variables and parameters
                  </li>
                  <li>
                    <strong>❌ Ignoring strict mode:</strong> Not enabling
                    strict TypeScript compiler options
                  </li>
                  <li>
                    <strong>❌ Overusing type assertions:</strong> Using 'as'
                    keyword instead of proper typing
                  </li>
                  <li>
                    <strong>❌ Missing interface definitions:</strong> Using
                    object literals instead of defined interfaces
                  </li>
                  <li>
                    <strong>❌ Not using generics:</strong> Hard-coding types
                    instead of using generic parameters
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
            Step-by-Step Guide to Creating TypeScript Test Cases
          </h5>

          <div className="space-y-4">
            {/* Step 1: Understand Type Requirements */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
              <h6 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Understand Type Requirements & Test Case Strategy
              </h6>
              <div className="space-y-3 text-sm">
                {/* Basic Interface Example */}
                <div className="bg-white/50 dark:bg-gray-700/50 p-3 rounded">
                  <strong className="text-green-800 dark:text-green-200 text-base mb-2 block">
                    🏗️ Example: User Management System with Type Safety
                  </strong>
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <strong>Requirements:</strong> Create type-safe user
                      management with interfaces, generics, and proper error
                      handling
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                        ✅ CORRECT Test Cases:
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            typescript:interface:User;uses:interfaces;uses:optional-properties
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>TypeScript validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            uses:generics;uses:union-types;type-safety:no-any
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>TypeScript validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            uses:utility-types;compilation:no-errors;best-practice:type-guards
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>TypeScript validation passed</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>
                            uses:discriminated-unions;uses:conditional-types;type-safety:strict-null-checks
                          </code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>TypeScript validation passed</code> ✓
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                        ❌ INCORRECT Test Cases (Common Mistakes):
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>uses:any</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>TypeScript validation passed</code> ✗ (Should
                          prohibit 'any' type)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>typescript:interface:User</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>TypeScript validation passed</code> ✗ (Too
                          basic, doesn't test type safety)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>no-implicit-any:false</code>
                          <br />
                          <strong>Output:</strong>{" "}
                          <code>TypeScript validation passed</code> ✗ (Should
                          require strict mode)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong>{" "}
                          <code>uses:interfaces;uses:classes</code>
                          <br />
                          <strong>Output:</strong> <strong>Output:</strong>{" "}
                          <code>TypeScript validation passed</code> ✗ (Missing
                          implementation requirements)
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <strong className="text-blue-800 dark:text-blue-200">
                        🎯 TypeScript Test Case Strategy:
                      </strong>
                      <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-300">
                        <li>
                          • <strong>Type definitions first:</strong> Start with
                          interfaces and type aliases
                        </li>
                        <li>
                          • <strong>Generic constraints:</strong> Test generic
                          functions and classes with proper constraints
                        </li>
                        <li>
                          • <strong>Type safety:</strong> Ensure no 'any' types
                          and strict null checks
                        </li>
                        <li>
                          • <strong>Advanced features:</strong> Include union
                          types, conditional types, and utility types
                        </li>
                        <li>
                          • <strong>Compilation:</strong> Require error-free
                          compilation with strict settings
                        </li>
                        <li>
                          • <strong>Best practices:</strong> Enforce TypeScript
                          conventions and patterns
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Test Case Categories */}
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <strong className="text-blue-800 dark:text-blue-200 flex items-center gap-1">
                      🔷 Type Definitions
                    </strong>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Validate interfaces, types, and class definitions
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                    <strong className="text-orange-800 dark:text-orange-200 flex items-center gap-1">
                      🎯 Advanced Types
                    </strong>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      Test generics, unions, and conditional types
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <strong className="text-red-800 dark:text-red-200 flex items-center gap-1">
                      🛡️ Type Safety
                    </strong>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      Ensure compilation and runtime type safety
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
            Complete TypeScript Validation Keywords Reference
          </h5>

          <div className="space-y-4">
            {/* Basic Type Constructs */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2">
                🔷 Basic Type Constructs
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "typescript:interface:name",
                    desc: "Must include specific interface definition",
                    example: "typescript:interface:User",
                  },
                  {
                    keyword: "typescript:type:name",
                    desc: "Must include specific type alias",
                    example: "typescript:type:UserId",
                  },
                  {
                    keyword: "typescript:class:name",
                    desc: "Must include specific class definition",
                    example: "typescript:class:UserService",
                  },
                  {
                    keyword: "typescript:function:name",
                    desc: "Must include specific function with types",
                    example: "typescript:function:calculateSum",
                  },
                  {
                    keyword: "typescript:enum:name",
                    desc: "Must include specific enum definition",
                    example: "typescript:enum:Status",
                  },
                  {
                    keyword: "type-definition:structure",
                    desc: "Must match specific type structure",
                    example: "type-definition:id:number;name:string",
                  },
                  {
                    keyword: "generics:types",
                    desc: "Must use specified generic types",
                    example: "generics:T,U",
                  },
                  {
                    keyword: "return-type:type",
                    desc: "Must have specific return type",
                    example: "return-type:Promise<User>",
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

            {/* Advanced Type Features */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2">
                🎯 Advanced Type Features
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "uses:strict-types",
                    desc: "Must use explicit type annotations",
                    example: "uses:strict-types",
                  },
                  {
                    keyword: "uses:interfaces",
                    desc: "Must use interface definitions",
                    example: "uses:interfaces",
                  },
                  {
                    keyword: "uses:type-aliases",
                    desc: "Must use type alias definitions",
                    example: "uses:type-aliases",
                  },
                  {
                    keyword: "uses:generics",
                    desc: "Must use generic type parameters",
                    example: "uses:generics",
                  },
                  {
                    keyword: "uses:union-types",
                    desc: "Must use union type definitions",
                    example: "uses:union-types",
                  },
                  {
                    keyword: "uses:intersection-types",
                    desc: "Must use intersection type definitions",
                    example: "uses:intersection-types",
                  },
                  {
                    keyword: "uses:literal-types",
                    desc: "Must use literal type definitions",
                    example: "uses:literal-types",
                  },
                  {
                    keyword: "uses:mapped-types",
                    desc: "Must use mapped type definitions",
                    example: "uses:mapped-types",
                  },
                  {
                    keyword: "uses:conditional-types",
                    desc: "Must use conditional type definitions",
                    example: "uses:conditional-types",
                  },
                  {
                    keyword: "uses:utility-types",
                    desc: "Must use TypeScript utility types",
                    example: "uses:utility-types",
                  },
                  {
                    keyword: "uses:enums",
                    desc: "Must use enum definitions",
                    example: "uses:enums",
                  },
                  {
                    keyword: "uses:readonly",
                    desc: "Must use readonly modifier",
                    example: "uses:readonly",
                  },
                  {
                    keyword: "uses:optional-properties",
                    desc: "Must use optional property syntax",
                    example: "uses:optional-properties",
                  },
                  {
                    keyword: "uses:index-signatures",
                    desc: "Must use index signature definitions",
                    example: "uses:index-signatures",
                  },
                  {
                    keyword: "uses:function-overloads",
                    desc: "Must use function overload definitions",
                    example: "uses:function-overloads",
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

            {/* Type Safety & Compilation */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2">
                🛡️ Type Safety & Compilation
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "type-safety:strict-null-checks",
                    desc: "Must handle null/undefined properly",
                    example: "type-safety:strict-null-checks",
                  },
                  {
                    keyword: "type-safety:no-any",
                    desc: "Must not use 'any' type",
                    example: "type-safety:no-any",
                  },
                  {
                    keyword: "type-safety:no-implicit-any",
                    desc: "Must provide explicit types",
                    example: "type-safety:no-implicit-any",
                  },
                  {
                    keyword: "compilation:no-errors",
                    desc: "Must compile without errors",
                    example: "compilation:no-errors",
                  },
                  {
                    keyword: "uses:namespaces",
                    desc: "Must use namespace declarations",
                    example: "uses:namespaces",
                  },
                  {
                    keyword: "uses:modules",
                    desc: "Must use ES6 modules",
                    example: "uses:modules",
                  },
                  {
                    keyword: "uses:decorators",
                    desc: "Must use decorators",
                    example: "uses:decorators",
                  },
                  {
                    keyword: "uses:access-modifiers",
                    desc: "Must use access modifiers",
                    example: "uses:access-modifiers",
                  },
                  {
                    keyword: "uses:abstract-classes",
                    desc: "Must use abstract classes",
                    example: "uses:abstract-classes",
                  },
                  {
                    keyword: "uses:implements",
                    desc: "Must use interface implementation",
                    example: "uses:implements",
                  },
                  {
                    keyword: "uses:extends",
                    desc: "Must use class inheritance",
                    example: "uses:extends",
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

            {/* Best Practices & Patterns */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2">
                ✨ Best Practices & Patterns
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "best-practice:type-guards",
                    desc: "Must use type guard functions",
                    example: "best-practice:type-guards",
                  },
                  {
                    keyword: "best-practice:discriminated-unions",
                    desc: "Must use discriminated union patterns",
                    example: "best-practice:discriminated-unions",
                  },
                  {
                    keyword: "best-practice:generic-constraints",
                    desc: "Must use proper generic constraints",
                    example: "best-practice:generic-constraints",
                  },
                  {
                    keyword: "best-practice:utility-types",
                    desc: "Must use built-in utility types",
                    example: "best-practice:utility-types",
                  },
                  {
                    keyword: "best-practice:const-assertions",
                    desc: "Must use const assertions where appropriate",
                    example: "best-practice:const-assertions",
                  },
                  {
                    keyword: "best-practice:keyof-operator",
                    desc: "Must use keyof operator",
                    example: "best-practice:keyof-operator",
                  },
                  {
                    keyword: "best-practice:typeof-operator",
                    desc: "Must use typeof operator in types",
                    example: "best-practice:typeof-operator",
                  },
                  {
                    keyword: "best-practice:infer-keyword",
                    desc: "Must use infer keyword in conditional types",
                    example: "best-practice:infer-keyword",
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
            Complete Guide to TypeScript Test Case Validation
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
                  <code>uses:interfaces</code>
                </li>
                <li>
                  • <strong>Multiple validations:</strong>{" "}
                  <code>
                    typescript:interface:User;uses:generics;type-safety:no-any;compilation:no-errors
                  </code>
                </li>
                <li>
                  • <strong>Expected output:</strong>{" "}
                  <code>TypeScript validation passed</code>
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
                  • <strong>Basic Constructs:</strong> Validate interfaces,
                  types, classes, and functions
                </li>
                <li>
                  • <strong>Advanced Types:</strong> Test generics, unions,
                  intersections, and conditional types
                </li>
                <li>
                  • <strong>Type Safety:</strong> Ensure strict typing and
                  compilation requirements
                </li>
                <li>
                  • <strong>Best Practices:</strong> Validate TypeScript
                  patterns and conventions
                </li>
                <li>
                  • <strong>Tooling Integration:</strong> Test module systems
                  and build tool compatibility
                </li>
              </ul>
            </div>

            {/* Tips for Instructors */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                💡 Tips for Creating Effective TypeScript Test Cases
              </h6>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4">
                <li>
                  • <strong>Start with basics:</strong> Begin with interface and
                  type definitions
                </li>
                <li>
                  • <strong>Enable strict mode:</strong> Always require strict
                  TypeScript compiler settings
                </li>
                <li>
                  • <strong>Avoid 'any' type:</strong> Prohibit the use of 'any'
                  and implicit any
                </li>
                <li>
                  • <strong>Test generics:</strong> Include generic functions
                  and classes with proper constraints
                </li>
                <li>
                  • <strong>Advanced features:</strong> Gradually introduce
                  union types, conditional types, and utility types
                </li>
                <li>
                  • <strong>Type safety first:</strong> Prioritize compile-time
                  type checking over runtime behavior
                </li>
                <li>
                  • <strong>Best practices:</strong> Enforce TypeScript
                  conventions and modern patterns
                </li>
                <li>
                  • <strong>Tooling compatibility:</strong> Ensure code works
                  with modern build tools and IDEs
                </li>
              </ul>
            </div>

            <div className="text-xs text-blue-700 dark:text-blue-300 mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <strong>Note:</strong> TypeScript validation keywords only work
              when TypeScript language is selected. For execution-based testing,
              use the standard input/output format without validation keywords.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
