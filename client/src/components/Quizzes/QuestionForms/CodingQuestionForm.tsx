import React, { useState, useMemo } from "react";
import { toast } from "react-toastify";
import type { CodingData } from "../../../types/quiz.types";
import { AITestCaseGenerator } from "../AITestCaseGenerator";
import { TestCaseItem } from "../TestCaseItem";
import { JavaScriptTestCaseBuilderModal } from "../JavaScriptTestCaseBuilderModal";
import { JavaScriptValidationGuideModal } from "../JavaScriptValidationGuideModal";
import { ReactTestCaseBuilderModal } from "../ReactTestCaseBuilderModal";
import { ReactValidationGuideModal } from "../ReactValidationGuideModal";
import { TypeScriptTestCaseBuilderModal } from "../TypeScriptTestCaseBuilderModal";
import { TypeScriptValidationGuideModal } from "../TypeScriptValidationGuideModal";
import { NodeJSTestCaseBuilderModal } from "../NodeJSTestCaseBuilderModal";
import { NodeJSValidationGuideModal } from "../NodeJSValidationGuideModal";
import { CssTestCaseBuilderModal } from "../CssTestCaseBuilderModal";
import { CssValidationGuideModal } from "../CssValidationGuideModal";
import { HtmlTestCaseBuilderModal } from "../HtmlTestCaseBuilderModal";
import { HtmlValidationGuideModal } from "../HtmlValidationGuideModal";
import { VueTestCaseBuilderModal } from "../VueTestCaseBuilderModal";
import { VueValidationGuideModal } from "../VueValidationGuideModal";
import { PythonTestCaseBuilderModal } from "../PythonTestCaseBuilderModal";
import { PythonValidationGuideModal } from "../PythonValidationGuideModal";
import { JavaTestCaseBuilderModal } from "../JavaTestCaseBuilderModal";
import { JavaValidationGuideModal } from "../JavaValidationGuideModal";
import { CTestCaseBuilderModal } from "../CTestCaseBuilderModal";
import { CValidationGuideModal } from "../CValidationGuideModal";
import { CppTestCaseBuilderModal } from "../CppTestCaseBuilderModal";
import { CppValidationGuideModal } from "../CppValidationGuideModal";
import { PhpTestCaseBuilderModal } from "../PhpTestCaseBuilderModal";
import { PhpValidationGuideModal } from "../PhpValidationGuideModal";
import { Plus } from "lucide-react";
import { CodingProgressIndicator } from "./CodingProgressIndicator";
import { CodingSetupTab } from "./CodingSetupTab";
import { CodingTemplateTab } from "./CodingTemplateTab";

interface CodingQuestionFormProps {
  data: CodingData;
  onChange: (data: CodingData) => void;
}

export const CodingQuestionForm: React.FC<CodingQuestionFormProps> = ({
  data,
  onChange: parentOnChange,
}) => {
  const onChange = (newData: CodingData) => {
    parentOnChange({
      ...newData,
      correct_answer: {
        language: newData.language,
        test_cases: newData.test_cases,
        starter_code: newData.starter_code,
      },
    } as any);
  };

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!data.language) {
      errors.push("Please select a programming language");
    }
    if (!data.test_cases || data.test_cases.length === 0) {
      errors.push("At least one test case is required");
    } else {
      const hasVisible = data.test_cases.some((tc) => !tc.is_hidden);
      if (!hasVisible) {
        errors.push("At least one visible test case is recommended for students");
      }
    }
    // Check if test cases have input/output
    if (data.test_cases?.some((tc) => !tc.input && !tc.expected_output)) {
      errors.push("Some test cases are missing input/output");
    }
    return errors;
  }, [data]);

  // Initialize with empty test cases array if not provided
  const codingData = {
    ...data,
    test_cases: data.test_cases || [],
  };
  const [activeTab, setActiveTab] = useState<
    "setup" | "template" | "tests" | "constraints"
  >("setup");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isTestCaseBuilderOpen, setIsTestCaseBuilderOpen] = useState(false);
  const [isValidationGuideOpen, setIsValidationGuideOpen] = useState(false);
  const [isReactTestCaseBuilderOpen, setIsReactTestCaseBuilderOpen] =
    useState(false);
  const [isReactValidationGuideOpen, setIsReactValidationGuideOpen] =
    useState(false);
  const [isTypeScriptTestCaseBuilderOpen, setIsTypeScriptTestCaseBuilderOpen] =
    useState(false);
  const [isTypeScriptValidationGuideOpen, setIsTypeScriptValidationGuideOpen] =
    useState(false);
  const [isNodeJSTestCaseBuilderOpen, setIsNodeJSTestCaseBuilderOpen] =
    useState(false);
  const [isNodeJSValidationGuideOpen, setIsNodeJSValidationGuideOpen] =
    useState(false);
  const [isCssTestCaseBuilderOpen, setIsCssTestCaseBuilderOpen] =
    useState(false);
  const [isCssValidationGuideOpen, setIsCssValidationGuideOpen] =
    useState(false);
  const [isHtmlTestCaseBuilderOpen, setIsHtmlTestCaseBuilderOpen] =
    useState(false);
  const [isHtmlValidationGuideOpen, setIsHtmlValidationGuideOpen] =
    useState(false);
  const [isVueTestCaseBuilderOpen, setIsVueTestCaseBuilderOpen] =
    useState(false);
  const [isVueValidationGuideOpen, setIsVueValidationGuideOpen] =
    useState(false);
  const [isPythonTestCaseBuilderOpen, setIsPythonTestCaseBuilderOpen] =
    useState(false);
  const [isPythonValidationGuideOpen, setIsPythonValidationGuideOpen] =
    useState(false);
  const [isJavaTestCaseBuilderOpen, setIsJavaTestCaseBuilderOpen] =
    useState(false);
  const [isJavaValidationGuideOpen, setIsJavaValidationGuideOpen] =
    useState(false);
  const [isCTestCaseBuilderOpen, setIsCTestCaseBuilderOpen] = useState(false);
  const [isCValidationGuideOpen, setIsCValidationGuideOpen] = useState(false);
  const [isCppTestCaseBuilderOpen, setIsCppTestCaseBuilderOpen] =
    useState(false);
  const [isCppValidationGuideOpen, setIsCppValidationGuideOpen] =
    useState(false);
  const [isPhpTestCaseBuilderOpen, setIsPhpTestCaseBuilderOpen] =
    useState(false);
  const [isPhpValidationGuideOpen, setIsPhpValidationGuideOpen] =
    useState(false);

  const languageTemplates = {
    javascript: [
      {
        id: "fibonacci",
        name: "Fibonacci Sequence",
        description: "Calculate nth Fibonacci number",
        code: "function fibonacci(n) {\n  // Your solution here\n}",
      },
      {
        id: "palindrome",
        name: "Palindrome Check",
        description: "Check if string is palindrome",
        code: "function isPalindrome(str) {\n  // Your solution here\n}",
      },
      {
        id: "twosum",
        name: "Two Sum",
        description: "Find indices that sum to target",
        code: "function twoSum(nums, target) {\n  // Your solution here\n}",
      },
    ],
    python: [
      {
        id: "fibonacci",
        name: "Fibonacci Sequence",
        description: "Calculate nth Fibonacci number",
        code: "def fibonacci(n):\n    # Your solution here\n    pass",
      },
      {
        id: "palindrome",
        name: "Palindrome Check",
        description: "Check if string is palindrome",
        code: "def is_palindrome(s):\n    # Your solution here\n    pass",
      },
      {
        id: "twosum",
        name: "Two Sum",
        description: "Find indices that sum to target",
        code: "def two_sum(nums, target):\n    # Your solution here\n    pass",
      },
    ],
    java: [
      {
        id: "fibonacci",
        name: "Fibonacci Sequence",
        description: "Calculate nth Fibonacci number",
        code: "public int fibonacci(int n) {\n    // Your solution here\n}",
      },
      {
        id: "palindrome",
        name: "Palindrome Check",
        description: "Check if string is palindrome",
        code: "public boolean isPalindrome(String str) {\n    // Your solution here\n}",
      },
    ],
    html: [
      {
        id: "basic-page",
        name: "Basic HTML Page",
        description: "Create a simple HTML structure",
        code: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>My Page</title>\n</head>\n<body>\n    <!-- Your content here -->\n</body>\n</html>',
      },
      {
        id: "form",
        name: "HTML Form",
        description: "Create an HTML form with inputs",
        code: '<form action="/submit" method="POST">\n    <label for="name">Name:</label>\n    <input type="text" id="name" name="name" required>\n    \n    <label for="email">Email:</label>\n    <input type="email" id="email" name="email" required>\n    \n    <button type="submit">Submit</button>\n</form>',
      },
      {
        id: "navigation",
        name: "Navigation Menu",
        description: "Create a navigation structure",
        code: '<nav>\n    <ul>\n        <li><a href="/">Home</a></li>\n        <li><a href="/about">About</a></li>\n        <li><a href="/services">Services</a></li>\n        <li><a href="/contact">Contact</a></li>\n    </ul>\n</nav>',
      },
    ],
    css: [
      {
        id: "flexbox-layout",
        name: "Flexbox Layout",
        description: "Create a responsive layout with Flexbox",
        code: ".container {\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    padding: 20px;\n}\n\n.box {\n    flex: 1;\n    padding: 20px;\n    margin: 10px;\n    background-color: #f0f0f0;\n    border-radius: 8px;\n}",
      },
      {
        id: "responsive-design",
        name: "Responsive Design",
        description: "Create a responsive layout",
        code: ".header {\n    background-color: #333;\n    color: white;\n    padding: 1rem;\n}\n\n@media (max-width: 768px) {\n    .header {\n        padding: 0.5rem;\n        font-size: 0.9rem;\n    }\n}",
      },
      {
        id: "animations",
        name: "CSS Animations",
        description: "Create smooth animations",
        code: ".animate {\n    transition: all 0.3s ease;\n    transform: translateY(0);\n}\n\n.animate:hover {\n    transform: translateY(-10px);\n    box-shadow: 0 5px 15px rgba(0,0,0,0.2);\n}",
      },
    ],
    react: [
      {
        id: "functional-component",
        name: "Functional Component",
        description: "Create a basic React functional component",
        code: "import React from 'react';\n\nfunction MyComponent() {\n    return (\n        <div className=\"my-component\">\n            <h1>Hello World!</h1>\n            <p>This is a React component.</p>\n        </div>\n    );\n}\n\nexport default MyComponent;",
      },
      {
        id: "class-component",
        name: "Class Component",
        description: "Create a React class component",
        code: "import React, { Component } from 'react';\n\nclass MyComponent extends Component {\n    constructor(props) {\n        super(props);\n        this.state = {\n            count: 0\n        };\n    }\n    \n    render() {\n        return (\n            <div>\n                <h1>Count: {this.state.count}</h1>\n                <button onClick={() => this.setState({ count: this.state.count + 1 })}>\n                    Increment\n                </button>\n            </div>\n        );\n    }\n}\n\nexport default MyComponent;",
      },
      {
        id: "hooks",
        name: "React Hooks",
        description: "Create a component with useState and useEffect",
        code: "import React, { useState, useEffect } from 'react';\n\nfunction Counter() {\n    const [count, setCount] = useState(0);\n    \n    useEffect(() => {\n        document.title = `Count: ${count}`;\n    }, [count]);\n    \n    return (\n        <div>\n            <h1>{count}</h1>\n            <button onClick={() => setCount(count + 1)}>\n                Increment\n            </button>\n        </div>\n    );\n}\n\nexport default Counter;",
      },
    ],
    vue: [
      {
        id: "basic-component",
        name: "Vue Component",
        description: "Create a basic Vue component",
        code: "<template>\n  <div class=\"my-component\">\n    <h1>{{ title }}</h1>\n    <p>{{ message }}</p>\n    <button @click=\"increment\">{{ count }}</button>\n  </div>\n</template>\n\n<script>\nexport default {\n  name: 'MyComponent',\n  data() {\n    return {\n      title: 'Hello Vue!',\n      message: 'This is a Vue component',\n      count: 0\n    }\n  },\n  methods: {\n    increment() {\n      this.count++\n    }\n  }\n}\n</script>\n\n<style scoped>\n.my-component {\n  padding: 20px;\n  border: 1px solid #ddd;\n  border-radius: 8px;\n}\n</style>",
      },
      {
        id: "composition-api",
        name: "Vue 3 Composition API",
        description: "Create a Vue component with Composition API",
        code: "<template>\n  <div>\n    <h1>{{ title }}</h1>\n    <button @click=\"increment\">Count: {{ count }}</button>\n  </div>\n</template>\n\n<script setup>\nimport { ref } from 'vue'\n\nconst title = ref('Vue 3 Composition API')\nconst count = ref(0)\n\nconst increment = () => {\n  count.value++\n}\n</script>",
      },
    ],
    angular: [
      {
        id: "basic-component",
        name: "Angular Component",
        description: "Create a basic Angular component",
        code: "import { Component } from '@angular/core';\n\n@Component({\n  selector: 'app-my-component',\n  template: `\n    <div class=\"my-component\">\n      <h1>{{ title }}</h1>\n      <p>{{ message }}</p>\n      <button (click)=\"increment()\">{{ count }}</button>\n    </div>\n  `,\n  styles: [`\n    .my-component {\n      padding: 20px;\n      border: 1px solid #ddd;\n      border-radius: 8px;\n    }\n  `]\n})\nexport class MyComponentComponent {\n  title = 'Hello Angular!';\n  message = 'This is an Angular component';\n  count = 0;\n\n  increment() {\n    this.count++;\n  }\n}",
      },
    ],
    nextjs: [
      {
        id: "api-route",
        name: "API Route",
        description: "Create a Next.js API route",
        code: "import { NextApiRequest, NextApiResponse } from 'next'\n\nexport default function handler(\n  req: NextApiRequest,\n  res: NextApiResponse\n) {\n  if (req.method === 'GET') {\n    res.status(200).json({ message: 'Hello from Next.js API!' })\n  } else {\n    res.status(405).json({ message: 'Method not allowed' })\n  }\n}",
      },
      {
        id: "dynamic-page",
        name: "Dynamic Page",
        description: "Create a dynamic Next.js page",
        code: "import { useRouter } from 'next/router'\n\nexport default function DynamicPage() {\n  const router = useRouter()\n  const { id } = router.query\n\n  return (\n    <div>\n      <h1>Dynamic Page</h1>\n      <p>Page ID: {id}</p>\n    </div>\n  )\n}",
      },
    ],
    nodejs: [
      {
        id: "express-server",
        name: "Express Server",
        description: "Create a basic Express.js server",
        code: "const express = require('express')\nconst app = express()\nconst port = 3000\n\napp.use(express.json())\n\napp.get('/', (req, res) => {\n  res.json({ message: 'Hello from Express server!' })\n})\n\napp.post('/data', (req, res) => {\n  // Process the request data\n  res.json({ received: req.body })\n})\n\napp.listen(port, () => {\n  console.log(`Server running on port ${port}`)\n})",
      },
      {
        id: "http-server",
        name: "HTTP Server",
        description: "Create a basic Node.js HTTP server",
        code: "const http = require('http')\n\nconst server = http.createServer((req, res) => {\n  res.statusCode = 200\n  res.setHeader('Content-Type', 'application/json')\n  res.end(JSON.stringify({ message: 'Hello from Node.js HTTP server!' }))\n})\n\nconst port = 3000\nserver.listen(port, () => {\n  console.log(`Server running on port ${port}`)\n})",
      },
    ],
    typescript: [
      {
        id: "interface",
        name: "TypeScript Interface",
        description: "Create and use TypeScript interfaces",
        code: "interface User {\n  id: number;\n  name: string;\n  email: string;\n  isActive: boolean;\n}\n\nfunction createUser(name: string, email: string): User {\n  return {\n    id: Math.floor(Math.random() * 1000),\n    name,\n    email,\n    isActive: true\n  }\n}\n\nconst user = createUser('John Doe', 'john@example.com')\nconsole.log(user)",
      },
      {
        id: "generics",
        name: "TypeScript Generics",
        description: "Create generic functions and classes",
        code: "function identity<T>(arg: T): T {\n    return arg;\n}\n\nclass Stack<T> {\n    private items: T[] = [];\n\n    push(item: T): void {\n        this.items.push(item);\n    }\n\n    pop(): T | undefined {\n        return this.items.pop();\n    }\n}\n\nconst numberStack = new Stack<number>()\nnumberStack.push(1)\nnumberStack.push(2)\nconsole.log(numberStack.pop()) // 2",
      },
    ],
    cpp: [
      {
        id: "fibonacci",
        name: "Fibonacci Sequence",
        description: "Calculate nth Fibonacci number",
        code: "#include <iostream>\nusing namespace std;\n\nint fibonacci(int n) {\n    // Your solution here\n}\n\nint main() {\n    cout << fibonacci(10) << endl;\n    return 0;\n}",
      },
    ],
    csharp: [
      {
        id: "console-app",
        name: "Console Application",
        description: "Create a basic C# console app",
        code: 'using System;\n\nnamespace MyApp {\n    class Program {\n        static void Main(string[] args) {\n            Console.WriteLine("Hello from C#!");\n            // Your code here\n        }\n    }\n}',
      },
    ],
    php: [
      {
        id: "basic-script",
        name: "Basic PHP Script",
        description: "Create a simple PHP script",
        code: "<?php\n\nfunction fibonacci($n) {\n    // Your solution here\n}\n\necho fibonacci(10);\n?>",
      },
    ],
    ruby: [
      {
        id: "basic-script",
        name: "Ruby Script",
        description: "Create a basic Ruby script",
        code: "def fibonacci(n)\n  # Your solution here\nend\n\nputs fibonacci(10)",
      },
    ],
    go: [
      {
        id: "basic-function",
        name: "Go Function",
        description: "Create a basic Go function",
        code: 'package main\n\nimport "fmt"\n\nfunc fibonacci(n int) int {\n\t// Your solution here\n}\n\nfunc main() {\n\tfmt.Println(fibonacci(10))\n}',
      },
    ],
    swift: [
      {
        id: "basic-function",
        name: "Swift Function",
        description: "Create a basic Swift function",
        code: "import Foundation\n\nfunc fibonacci(_ n: Int) -> Int {\n    // Your solution here\n}\n\nprint(fibonacci(10))",
      },
    ],
    kotlin: [
      {
        id: "basic-function",
        name: "Kotlin Function",
        description: "Create a basic Kotlin function",
        code: "fun fibonacci(n: Int): Int {\n    // Your solution here\n}\n\nfun main() {\n    println(fibonacci(10))\n}",
      },
    ],
    dart: [
      {
        id: "basic-function",
        name: "Dart Function",
        description: "Create a basic Dart function",
        code: "int fibonacci(int n) {\n  // Your solution here\n}\n\nvoid main() {\n  print(fibonacci(10));\n}",
      },
    ],
    rust: [
      {
        id: "basic-function",
        name: "Rust Function",
        description: "Create a basic Rust function",
        code: 'fn fibonacci(n: i32) -> i32 {\n    // Your solution here\n}\n\nfn main() {\n    println!("{}", fibonacci(10));\n}',
      },
    ],
    sql: [
      {
        id: "select-query",
        name: "SELECT Query",
        description: "Create a basic SELECT query",
        code: "SELECT users.name, users.email, orders.total\nFROM users\nJOIN orders ON users.id = orders.user_id\nWHERE orders.total > 100\nORDER BY orders.total DESC\nLIMIT 10;",
      },
      {
        id: "insert-query",
        name: "INSERT Query",
        description: "Create an INSERT statement",
        code: "INSERT INTO products (name, price, category, created_at)\nVALUES \n    ('Laptop', 999.99, 'Electronics', NOW()),\n    ('Book', 19.99, 'Education', NOW());",
      },
      {
        id: "update-query",
        name: "UPDATE Query",
        description: "Create an UPDATE statement",
        code: "UPDATE users \nSET email = 'newemail@example.com', \n    updated_at = NOW()\nWHERE id = 123;",
      },
    ],
    c: [
      {
        id: "fibonacci",
        name: "Fibonacci Sequence",
        description: "Calculate nth Fibonacci number",
        code: '#include <stdio.h>\n\nint fibonacci(int n) {\n    // Your solution here\n}\n\nint main() {\n    printf("%d\\n", fibonacci(10));\n    return 0;\n}',
      },
      {
        id: "array-sum",
        name: "Array Sum",
        description: "Calculate sum of array elements",
        code: '#include <stdio.h>\n\nint sumArray(int arr[], int size) {\n    // Your solution here\n}\n\nint main() {\n    int arr[] = {1, 2, 3, 4, 5};\n    printf("%d\\n", sumArray(arr, 5));\n    return 0;\n}',
      },
      {
        id: "pointer-swap",
        name: "Pointer Swap",
        description: "Swap two values using pointers",
        code: '#include <stdio.h>\n\nvoid swap(int *a, int *b) {\n    // Your solution here\n}\n\nint main() {\n    int x = 5, y = 10;\n    swap(&x, &y);\n    printf("%d %d\\n", x, y);\n    return 0;\n}',
      },
    ],
  };

  const applyTemplate = (templateId: string) => {
    const templates =
      languageTemplates[
        codingData.language as keyof typeof languageTemplates
      ] || [];
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      onChange({
        ...codingData,
        starter_code: template.code,
      });
      setSelectedTemplate(templateId);
    }
  };

  return (
    <div className="space-y-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 border border-blue-100 dark:border-gray-700">
      {/* Header with cute design */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-full mb-3">
          <span className="text-2xl">💻</span>
          <span className="font-semibold text-blue-800 dark:text-blue-200">
            Coding Question Setup
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Create interactive coding challenges in 15+ programming languages
          including modern web technologies
        </p>
      </div>

      {/* Step Navigation */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[
          { key: "setup", label: "Setup", icon: "⚙️" },
          { key: "template", label: "Template", icon: "📝" },
          { key: "tests", label: "Test Cases", icon: "🧪" },
          { key: "constraints", label: "Constraints", icon: "📋" },
        ].map((step) => (
          <button
            key={step.key}
            type="button"
            onClick={() => setActiveTab(step.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === step.key
                ? "bg-blue-500 text-white shadow-md transform scale-105"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            <span className="mr-2">{step.icon}</span>
            {step.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "setup" && (
          <CodingSetupTab
            codingData={codingData}
            onChange={onChange}
            onLanguageChange={(language) => {
              onChange({
                ...codingData,
                language,
                starter_code: "", // Clear starter code when language changes
              });
              setSelectedTemplate("");
            }}
          />
        )}

        {activeTab === "template" && (
          <CodingTemplateTab
            codingData={codingData}
            languageTemplates={languageTemplates}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={applyTemplate}
          />
        )}

        {activeTab === "tests" && (
          <div className="space-y-6">
            {/* AI Test Case Generator */}
            <AITestCaseGenerator
              language={codingData.language}
              problemDescription={codingData.constraints || ""}
              starterCode={codingData.starter_code}
              onTestCasesGenerated={(generatedCases) => {
                // Clear existing test cases and replace with AI-generated ones
                onChange({
                  ...codingData,
                  test_cases: generatedCases,
                });
              }}
            />

            {/* Test Cases Header with Stats */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-700 rounded-3xl p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="">
                    <span className="text-2xl">🧪</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      Test Cases Management
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Define inputs and expected outputs for your coding problem
                    </p>
                  </div>
                </div>

                {/* Test Case Stats */}
                <div className="flex flex-wrap gap-3">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-2 border-2 border-green-200 dark:border-green-700">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Total Tests
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {codingData.test_cases.length}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-2 border-2 border-blue-200 dark:border-blue-700">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Visible
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {
                        codingData.test_cases.filter((tc) => !tc.is_hidden)
                          .length
                      }
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-2 border-2 border-purple-200 dark:border-purple-700">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Hidden
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {
                        codingData.test_cases.filter((tc) => tc.is_hidden)
                          .length
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Add Test Case Button */}
              <button
                type="button"
                onClick={() => {
                  const exampleInputs = {
                    javascript: "[\n  [2, 7, 11, 15],\n  9\n]",
                    python: "[\n  [2, 7, 11, 15],\n  9\n]",
                    java: "new int[]{2, 7, 11, 15},\n9",
                    cpp: "{2, 7, 11, 15},\n9",
                    csharp: "new int[]{2, 7, 11, 15},\n9",
                    html: "valid-structure;contains:h1;contains:p",
                    css: "selector:.container;property:display;value:flex-direction=column",
                    react: '{\n  "props": {\n    "items": [1, 2, 3]\n  }\n}',
                    vue: '{\n  "props": {\n    "items": [1, 2, 3]\n  }\n}',
                    angular: '{\n  "items": [1, 2, 3]\n}',
                    nextjs: '{\n  "params": {\n    "id": "123"\n  }\n}',
                    nodejs: '{\n  "method": "GET",\n  "url": "/api/test"\n}',
                    typescript:
                      '{\n  "data": [1, 2, 3],\n  "options": {\n    "sort": true\n  }\n}',
                    php: "$numbers = [2, 7, 11, 15];\n$target = 9;",
                    ruby: "[2, 7, 11, 15],\n9",
                    go: "[]int{2, 7, 11, 15},\n9",
                    swift: "[2, 7, 11, 15],\n9",
                    kotlin: "intArrayOf(2, 7, 11, 15),\n9",
                    dart: "[2, 7, 11, 15],\n9",
                    rust: "vec![2, 7, 11, 15],\n9",
                    c: "int arr[] = {2, 7, 11, 15};\nint target = 9;",
                    sql: "SELECT * FROM users WHERE id = 1;",
                  };

                  const exampleOutputs = {
                    javascript: "[\n  0,\n  1\n]",
                    python: "[\n  0,\n  1\n]",
                    java: "[0, 1]",
                    cpp: "{0, 1}",
                    csharp: "[0, 1]",
                    html: "HTML validation passed",
                    css: "CSS validation passed",
                    react:
                      '<div className="result">\n  <span>Items: 1, 2, 3</span>\n</div>',
                    vue: '<div class="result">\n  <span>Items: 1, 2, 3</span>\n</div>',
                    angular: '<div class="result">\n  Items: 1, 2, 3\n</div>',
                    nextjs: '{\n  "id": "123",\n  "data": "Page content"\n}',
                    nodejs: '{\n  "status": 200,\n  "data": "Response data"\n}',
                    typescript:
                      '{\n  "result": [1, 2, 3],\n  "sorted": true\n}',
                    php: "[0, 1]",
                    ruby: "[0, 1]",
                    go: "[0 1]",
                    swift: "[0, 1]",
                    kotlin: "[0, 1]",
                    dart: "[0, 1]",
                    rust: "[0, 1]",
                    c: "[0, 1]",
                    sql: '{\n  "id": 1,\n  "name": "John Doe",\n  "email": "john@example.com"\n}',
                  };

                  const newTestCase = {
                    id: (codingData.test_cases.length + 1).toString(),
                    input: exampleInputs[codingData.language as keyof typeof exampleInputs] || "",
                    expected_output: exampleOutputs[codingData.language as keyof typeof exampleOutputs] || "",
                    is_hidden: false,
                    points: 10,
                    time_limit: 5000,
                  };
                  onChange({
                    ...codingData,
                    test_cases: [...codingData.test_cases, newTestCase],
                  });
                }}
                className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-500 hover:from-blue-600 hover:to-blue-600 text-white rounded-full font-medium transition-all flex items-center justify-center gap-2"
              >
                <span className="text-xs">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="text-sm font-light">Add New Test Case</span>
              </button>
            </div>

            {/* JavaScript Test Case Builder */}
            {codingData.language === "javascript" && (
              <>
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-3xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">🛠️</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-yellow-900 dark:text-yellow-100 mb-3">
                        JavaScript Test Case Tools
                      </h4>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-6">
                        Use our interactive tools to create comprehensive
                        JavaScript test cases with validation keywords.
                      </p>

                      <div className="grid md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setIsTestCaseBuilderOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-yellow-200 dark:border-yellow-700 hover:border-yellow-300 dark:hover:border-yellow-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🔧</span>
                            <h5 className="font-semibold text-yellow-900 dark:text-yellow-100 group-hover:text-yellow-800 dark:group-hover:text-yellow-200">
                              Test Case Builder
                            </h5>
                          </div>
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            Visual builder to create test cases with function
                            details, input/output examples, and validation
                            requirements.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsValidationGuideOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-yellow-200 dark:border-yellow-700 hover:border-yellow-300 dark:hover:border-yellow-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">📚</span>
                            <h5 className="font-semibold text-yellow-900 dark:text-yellow-100 group-hover:text-yellow-800 dark:group-hover:text-yellow-200">
                              Validation Keywords Guide
                            </h5>
                          </div>
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            Comprehensive guide to all JavaScript validation
                            keywords with examples and usage instructions.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* JavaScript Validation Guide Modal */}
                <JavaScriptValidationGuideModal
                  isOpen={isValidationGuideOpen}
                  onClose={() => setIsValidationGuideOpen(false)}
                />

                {/* JavaScript Test Case Builder Modal */}
                <JavaScriptTestCaseBuilderModal
                  isOpen={isTestCaseBuilderOpen}
                  onClose={() => setIsTestCaseBuilderOpen(false)}
                  onTestCaseGenerated={(testCase) => {
                    // Add the generated test case to the test cases list
                    onChange({
                      ...codingData,
                      test_cases: [...codingData.test_cases, testCase],
                    });
                    toast.success("Test case added successfully!", {
                      autoClose: 2000,
                    });
                  }}
                />
              </>
            )}

            {/* React Test Case Builder */}
            {codingData.language === "react" && (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-3xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">⚛️</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-3">
                        React Test Case Tools
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-6">
                        Use our interactive tools to create comprehensive React
                        component test cases with validation keywords.
                      </p>

                      <div className="grid md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setIsReactTestCaseBuilderOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🔧</span>
                            <h5 className="font-semibold text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200">
                              Test Case Builder
                            </h5>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Visual builder to create test cases with component
                            details, hook requirements, and validation rules.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsReactValidationGuideOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">📚</span>
                            <h5 className="font-semibold text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200">
                              Validation Keywords Guide
                            </h5>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Comprehensive guide to all React validation keywords
                            with examples and usage instructions.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* React Validation Guide Modal */}
                <ReactValidationGuideModal
                  isOpen={isReactValidationGuideOpen}
                  onClose={() => setIsReactValidationGuideOpen(false)}
                />

                {/* React Test Case Builder Modal */}
                <ReactTestCaseBuilderModal
                  isOpen={isReactTestCaseBuilderOpen}
                  onClose={() => setIsReactTestCaseBuilderOpen(false)}
                  onTestCaseGenerated={(testCase) => {
                    // Add the generated test case to the test cases list
                    onChange({
                      ...codingData,
                      test_cases: [...codingData.test_cases, testCase],
                    });
                    toast.success("React test case added successfully!", {
                      autoClose: 2000,
                    });
                  }}
                />
              </>
            )}

            {/* TypeScript Test Case Builder */}
            {codingData.language === "typescript" && (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-3xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">🔷</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-3">
                        TypeScript Test Case Tools
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-6">
                        Use our interactive tools to create comprehensive
                        TypeScript test cases with type safety validation.
                      </p>

                      <div className="grid md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() =>
                            setIsTypeScriptTestCaseBuilderOpen(true)
                          }
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🔧</span>
                            <h5 className="font-semibold text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200">
                              Test Case Builder
                            </h5>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Visual builder to create test cases with type
                            definitions, generics, and validation rules.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setIsTypeScriptValidationGuideOpen(true)
                          }
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">📚</span>
                            <h5 className="font-semibold text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200">
                              Validation Keywords Guide
                            </h5>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Comprehensive guide to all TypeScript validation
                            keywords with examples and usage instructions.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TypeScript Validation Guide Modal */}
                <TypeScriptValidationGuideModal
                  isOpen={isTypeScriptValidationGuideOpen}
                  onClose={() => setIsTypeScriptValidationGuideOpen(false)}
                />

                {/* TypeScript Test Case Builder Modal */}
                <TypeScriptTestCaseBuilderModal
                  isOpen={isTypeScriptTestCaseBuilderOpen}
                  onClose={() => setIsTypeScriptTestCaseBuilderOpen(false)}
                  onTestCaseGenerated={(testCase) => {
                    // Add the generated test case to the test cases list
                    onChange({
                      ...codingData,
                      test_cases: [...codingData.test_cases, testCase],
                    });
                    toast.success("TypeScript test case added successfully!", {
                      autoClose: 2000,
                    });
                  }}
                />
              </>
            )}

            {/* Node.js Test Case Builder */}
            {codingData.language === "nodejs" && (
              <>
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-700 rounded-3xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">🟢</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-green-900 dark:text-green-100 mb-3">
                        Node.js Test Case Tools
                      </h4>
                      <p className="text-sm text-green-800 dark:text-green-200 mb-6">
                        Use our interactive tools to create comprehensive
                        Node.js application test cases with server validation.
                      </p>

                      <div className="grid md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setIsNodeJSTestCaseBuilderOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🔧</span>
                            <h5 className="font-semibold text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-200">
                              Test Case Builder
                            </h5>
                          </div>
                          <p className="text-sm text-green-800 dark:text-green-200">
                            Visual builder to create test cases with server
                            configuration, API endpoints, and validation rules.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsNodeJSValidationGuideOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">📚</span>
                            <h5 className="font-semibold text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-200">
                              Validation Keywords Guide
                            </h5>
                          </div>
                          <p className="text-sm text-green-800 dark:text-green-200">
                            Comprehensive guide to all Node.js validation
                            keywords with examples and usage instructions.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Node.js Validation Guide Modal */}
                <NodeJSValidationGuideModal
                  isOpen={isNodeJSValidationGuideOpen}
                  onClose={() => setIsNodeJSValidationGuideOpen(false)}
                />

                {/* Node.js Test Case Builder Modal */}
                <NodeJSTestCaseBuilderModal
                  isOpen={isNodeJSTestCaseBuilderOpen}
                  onClose={() => setIsNodeJSTestCaseBuilderOpen(false)}
                  onTestCaseGenerated={(testCase) => {
                    // Add the generated test case to the test cases list
                    onChange({
                      ...codingData,
                      test_cases: [...codingData.test_cases, testCase],
                    });
                    toast.success("Node.js test case added successfully!", {
                      autoClose: 2000,
                    });
                  }}
                />
              </>
            )}

            {/* CSS Test Case Builder Modal */}
            <CssTestCaseBuilderModal
              isOpen={isCssTestCaseBuilderOpen}
              onClose={() => setIsCssTestCaseBuilderOpen(false)}
              onTestCaseGenerated={(testCase) => {
                // Add the generated test case to the test cases list
                onChange({
                  ...codingData,
                  test_cases: [...codingData.test_cases, testCase],
                });
                toast.success("CSS test case added successfully!", {
                  autoClose: 2000,
                });
              }}
            />

            {/* HTML Test Case Builder Modal */}
            <HtmlTestCaseBuilderModal
              isOpen={isHtmlTestCaseBuilderOpen}
              onClose={() => setIsHtmlTestCaseBuilderOpen(false)}
              onTestCaseGenerated={(testCase) => {
                // Add the generated test case to the test cases list
                onChange({
                  ...codingData,
                  test_cases: [...codingData.test_cases, testCase],
                });
                toast.success("HTML test case added successfully!", {
                  autoClose: 2000,
                });
              }}
            />

            {/* CSS Validation Guide Modal */}
            <CssValidationGuideModal
              isOpen={isCssValidationGuideOpen}
              onClose={() => setIsCssValidationGuideOpen(false)}
            />

            {/* HTML Validation Guide Modal */}
            <HtmlValidationGuideModal
              isOpen={isHtmlValidationGuideOpen}
              onClose={() => setIsHtmlValidationGuideOpen(false)}
            />

            {/* Vue.js Test Case Builder */}
            {codingData.language === "vue" && (
              <>
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-700 rounded-3xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">🟢</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-green-900 dark:text-green-100 mb-3">
                        Vue.js Test Case Tools
                      </h4>
                      <p className="text-sm text-green-800 dark:text-green-200 mb-6">
                        Use our interactive tools to create comprehensive Vue.js
                        component test cases with reactivity validation.
                      </p>

                      <div className="grid md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setIsVueTestCaseBuilderOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🔧</span>
                            <h5 className="font-semibold text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-200">
                              Test Case Builder
                            </h5>
                          </div>
                          <p className="text-sm text-green-800 dark:text-green-200">
                            Visual builder to create test cases with component
                            details, reactivity requirements, and validation
                            rules.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsVueValidationGuideOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">📚</span>
                            <h5 className="font-semibold text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-200">
                              Validation Keywords Guide
                            </h5>
                          </div>
                          <p className="text-sm text-green-800 dark:text-green-200">
                            Comprehensive guide to all Vue.js validation
                            keywords with examples and usage instructions.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vue.js Validation Guide Modal */}
                <VueValidationGuideModal
                  isOpen={isVueValidationGuideOpen}
                  onClose={() => setIsVueValidationGuideOpen(false)}
                />

                {/* Vue.js Test Case Builder Modal */}
                <VueTestCaseBuilderModal
                  isOpen={isVueTestCaseBuilderOpen}
                  onClose={() => setIsVueTestCaseBuilderOpen(false)}
                  onTestCaseGenerated={(testCase) => {
                    // Add the generated test case to the test cases list
                    onChange({
                      ...codingData,
                      test_cases: [...codingData.test_cases, testCase],
                    });
                    toast.success("Vue.js test case added successfully!", {
                      autoClose: 2000,
                    });
                  }}
                />
              </>
            )}

            {/* Python Test Case Builder */}
            {codingData.language === "python" && (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-3xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">🐍</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-3">
                        Python Test Case Tools
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-6">
                        Use our interactive tools to create comprehensive Python
                        function test cases with validation keywords.
                      </p>

                      <div className="grid md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setIsPythonTestCaseBuilderOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🔧</span>
                            <h5 className="font-semibold text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200">
                              Test Case Builder
                            </h5>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Visual builder to create test cases with function
                            details, input/output examples, and validation
                            rules.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsPythonValidationGuideOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">📚</span>
                            <h5 className="font-semibold text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200">
                              Validation Keywords Guide
                            </h5>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Comprehensive guide to all Python validation
                            keywords with examples and usage instructions.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Python Validation Guide Modal */}
                <PythonValidationGuideModal
                  isOpen={isPythonValidationGuideOpen}
                  onClose={() => setIsPythonValidationGuideOpen(false)}
                />

                {/* Python Test Case Builder Modal */}
                <PythonTestCaseBuilderModal
                  isOpen={isPythonTestCaseBuilderOpen}
                  onClose={() => setIsPythonTestCaseBuilderOpen(false)}
                  onTestCaseGenerated={(testCase) => {
                    // Add the generated test case to the test cases list
                    onChange({
                      ...codingData,
                      test_cases: [...codingData.test_cases, testCase],
                    });
                    toast.success("Python test case added successfully!", {
                      autoClose: 2000,
                    });
                  }}
                />
              </>
            )}

            {/* Java Test Case Builder */}
            {codingData.language === "java" && (
              <>
                <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-3xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">☕</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-orange-900 dark:text-orange-100 mb-3">
                        Java Test Case Tools
                      </h4>
                      <p className="text-sm text-orange-800 dark:text-orange-200 mb-6">
                        Use our interactive tools to create comprehensive Java
                        method test cases with validation keywords.
                      </p>

                      <div className="grid md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setIsJavaTestCaseBuilderOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-orange-200 dark:border-orange-700 hover:border-orange-300 dark:hover:border-orange-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🔧</span>
                            <h5 className="font-semibold text-orange-900 dark:text-orange-100 group-hover:text-orange-800 dark:group-hover:text-orange-200">
                              Test Case Builder
                            </h5>
                          </div>
                          <p className="text-sm text-orange-800 dark:text-orange-200">
                            Visual builder to create test cases with method
                            details, input/output examples, and validation
                            rules.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsJavaValidationGuideOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-orange-200 dark:border-orange-700 hover:border-orange-300 dark:hover:border-orange-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">📚</span>
                            <h5 className="font-semibold text-orange-900 dark:text-orange-100 group-hover:text-orange-800 dark:group-hover:text-orange-200">
                              Validation Keywords Guide
                            </h5>
                          </div>
                          <p className="text-sm text-orange-800 dark:text-orange-200">
                            Comprehensive guide to all Java validation keywords
                            with examples and usage instructions.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Java Validation Guide Modal */}
                <JavaValidationGuideModal
                  isOpen={isJavaValidationGuideOpen}
                  onClose={() => setIsJavaValidationGuideOpen(false)}
                />

                {/* Java Test Case Builder Modal */}
                <JavaTestCaseBuilderModal
                  isOpen={isJavaTestCaseBuilderOpen}
                  onClose={() => setIsJavaTestCaseBuilderOpen(false)}
                  onTestCaseGenerated={(testCase) => {
                    // Add the generated test case to the test cases list
                    onChange({
                      ...codingData,
                      test_cases: [...codingData.test_cases, testCase],
                    });
                    toast.success("Java test case added successfully!", {
                      autoClose: 2000,
                    });
                  }}
                />
              </>
            )}

            {/* C Test Case Builder */}
            {codingData.language === "c" && (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-3xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">🔵</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-3">
                        C Test Case Tools
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-6">
                        Use our interactive tools to create comprehensive C
                        function test cases with memory safety validation.
                      </p>

                      <div className="grid md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setIsCTestCaseBuilderOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🔧</span>
                            <h5 className="font-semibold text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200">
                              Test Case Builder
                            </h5>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Visual builder to create test cases with function
                            details, memory management, and validation rules.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsCValidationGuideOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">📚</span>
                            <h5 className="font-semibold text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200">
                              Validation Keywords Guide
                            </h5>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Comprehensive guide to all C validation keywords
                            with examples and usage instructions.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* C Validation Guide Modal */}
                <CValidationGuideModal
                  isOpen={isCValidationGuideOpen}
                  onClose={() => setIsCValidationGuideOpen(false)}
                />

                {/* C Test Case Builder Modal */}
                <CTestCaseBuilderModal
                  isOpen={isCTestCaseBuilderOpen}
                  onClose={() => setIsCTestCaseBuilderOpen(false)}
                  onTestCaseGenerated={(testCase) => {
                    // Add the generated test case to the test cases list
                    onChange({
                      ...codingData,
                      test_cases: [...codingData.test_cases, testCase],
                    });
                    toast.success("C test case added successfully!", {
                      autoClose: 2000,
                    });
                  }}
                />
              </>
            )}

            {/* C++ Test Case Builder */}
            {codingData.language === "cpp" && (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-3xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">🔵</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-3">
                        C++ Test Case Tools
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-6">
                        Use our interactive tools to create comprehensive C++
                        function test cases with modern C++ validation.
                      </p>

                      <div className="grid md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setIsCppTestCaseBuilderOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🔧</span>
                            <h5 className="font-semibold text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200">
                              Test Case Builder
                            </h5>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Visual builder to create test cases with function
                            details, STL usage, and validation rules.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsCppValidationGuideOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">📚</span>
                            <h5 className="font-semibold text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200">
                              Validation Keywords Guide
                            </h5>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Comprehensive guide to all C++ validation keywords
                            with examples and usage instructions.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* C++ Validation Guide Modal */}
                <CppValidationGuideModal
                  isOpen={isCppValidationGuideOpen}
                  onClose={() => setIsCppValidationGuideOpen(false)}
                />

                {/* C++ Test Case Builder Modal */}
                <CppTestCaseBuilderModal
                  isOpen={isCppTestCaseBuilderOpen}
                  onClose={() => setIsCppTestCaseBuilderOpen(false)}
                  onTestCaseGenerated={(testCase) => {
                    // Add the generated test case to the test cases list
                    onChange({
                      ...codingData,
                      test_cases: [...codingData.test_cases, testCase],
                    });
                    toast.success("C++ test case added successfully!", {
                      autoClose: 2000,
                    });
                  }}
                />
              </>
            )}

            {/* PHP Test Case Builder */}
            {codingData.language === "php" && (
              <>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-3xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">🐘</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-purple-900 dark:text-purple-100 mb-3">
                        PHP Test Case Tools
                      </h4>
                      <p className="text-sm text-purple-800 dark:text-purple-200 mb-6">
                        Use our interactive tools to create comprehensive PHP
                        function test cases with security validation.
                      </p>

                      <div className="grid md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setIsPhpTestCaseBuilderOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-purple-200 dark:border-purple-700 hover:border-purple-300 dark:hover:border-purple-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🔧</span>
                            <h5 className="font-semibold text-purple-900 dark:text-purple-100 group-hover:text-purple-800 dark:group-hover:text-purple-200">
                              Test Case Builder
                            </h5>
                          </div>
                          <p className="text-sm text-purple-800 dark:text-purple-200">
                            Visual builder to create test cases with function
                            details, security requirements, and validation
                            rules.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsPhpValidationGuideOpen(true)}
                          className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-purple-200 dark:border-purple-700 hover:border-purple-300 dark:hover:border-purple-600 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">📚</span>
                            <h5 className="font-semibold text-purple-900 dark:text-purple-100 group-hover:text-purple-800 dark:group-hover:text-purple-200">
                              Validation Keywords Guide
                            </h5>
                          </div>
                          <p className="text-sm text-purple-800 dark:text-purple-200">
                            Comprehensive guide to all PHP validation keywords
                            with examples and usage instructions.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PHP Validation Guide Modal */}
                <PhpValidationGuideModal
                  isOpen={isPhpValidationGuideOpen}
                  onClose={() => setIsPhpValidationGuideOpen(false)}
                />

                {/* PHP Test Case Builder Modal */}
                <PhpTestCaseBuilderModal
                  isOpen={isPhpTestCaseBuilderOpen}
                  onClose={() => setIsPhpTestCaseBuilderOpen(false)}
                  onTestCaseGenerated={(testCase) => {
                    // Add the generated test case to the test cases list
                    onChange({
                      ...codingData,
                      test_cases: [...codingData.test_cases, testCase],
                    });
                    toast.success("PHP test case added successfully!", {
                      autoClose: 2000,
                    });
                  }}
                />
              </>
            )}

            {/* CSS Test Case Tools for CSS Language */}
            {codingData.language === "css" && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-3xl p-6">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">🎨</div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-purple-900 dark:text-purple-100 mb-3">
                      CSS Test Case Tools
                    </h4>
                    <p className="text-sm text-purple-800 dark:text-purple-200 mb-6">
                      Use our interactive tools to create comprehensive CSS test
                      cases with validation keywords.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setIsCssTestCaseBuilderOpen(true)}
                        className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-purple-200 dark:border-purple-700 hover:border-purple-300 dark:hover:border-purple-600 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">🔧</span>
                          <h5 className="font-semibold text-purple-900 dark:text-purple-100 group-hover:text-purple-800 dark:group-hover:text-purple-200">
                            Test Case Builder
                          </h5>
                        </div>
                        <p className="text-sm text-purple-800 dark:text-purple-200">
                          Visual builder to create test cases with selector
                          details, property requirements, and validation rules.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCssValidationGuideOpen(true)}
                        className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-purple-200 dark:border-purple-700 hover:border-purple-300 dark:hover:border-purple-600 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">📚</span>
                          <h5 className="font-semibold text-purple-900 dark:text-purple-100 group-hover:text-purple-800 dark:group-hover:text-purple-200">
                            Validation Keywords Guide
                          </h5>
                        </div>
                        <p className="text-sm text-purple-800 dark:text-purple-200">
                          Comprehensive guide to all CSS validation keywords
                          with examples and usage instructions.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* HTML Test Case Tools for HTML Language */}
            {codingData.language === "html" && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-700 rounded-3xl p-6">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">🏷️</div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mb-3">
                      HTML Test Case Tools
                    </h4>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200 mb-6">
                      Use our interactive tools to create comprehensive HTML
                      test cases with validation keywords.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setIsHtmlTestCaseBuilderOpen(true)}
                        className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">🔧</span>
                          <h5 className="font-semibold text-emerald-900 dark:text-emerald-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-200">
                            Test Case Builder
                          </h5>
                        </div>
                        <p className="text-sm text-emerald-800 dark:text-emerald-200">
                          Visual builder to create test cases with element
                          details, attribute requirements, and validation rules.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsHtmlValidationGuideOpen(true)}
                        className="p-6 bg-white/70 dark:bg-gray-800/70 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">📚</span>
                          <h5 className="font-semibold text-emerald-900 dark:text-emerald-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-200">
                            Validation Keywords Guide
                          </h5>
                        </div>
                        <p className="text-sm text-emerald-800 dark:text-emerald-200">
                          Comprehensive guide to all HTML validation keywords
                          with examples and usage instructions.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Original Helper Info */}
            {codingData.test_cases.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-3xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      Quick Test Case Tips
                    </h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <li>
                        • <strong>Visible tests</strong> help students
                        understand the problem
                      </li>
                      <li>
                        • <strong>Hidden tests</strong> prevent hardcoding and
                        ensure thorough solutions
                      </li>
                      <li>
                        • Include edge cases like empty inputs, large numbers,
                        or special characters
                      </li>
                      <li>• Distribute points based on test difficulty</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Test Cases List */}
            <div className="space-y-4">
              {codingData.test_cases.map((testCase, index) => (
                <TestCaseItem
                  key={testCase.id}
                  testCase={testCase}
                  index={index}
                  language={codingData.language}
                  onUpdate={(updatedCase) => {
                    const newTestCases = [...codingData.test_cases];
                    newTestCases[index] = updatedCase;
                    onChange({
                      ...codingData,
                      test_cases: newTestCases,
                    });
                  }}
                  onDelete={() => {
                    const newTestCases = codingData.test_cases.filter(
                      (_, i) => i !== index
                    );
                    onChange({
                      ...codingData,
                      test_cases: newTestCases,
                    });
                    toast.success(
                      `Test Case #${index + 1} deleted successfully!`,
                      {
                        position: "top-right",
                        autoClose: 2000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                      }
                    );
                  }}
                  canDelete={codingData.test_cases.length > 1}
                />
              ))}
            </div>

            {/* Empty State */}
            {codingData.test_cases.length === 0 && (
              <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-3xl p-12 text-center">
                <div className="text-6xl mb-4">🧪</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No Test Cases Yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Use the AI generator above or manually add test cases to
                  evaluate student solutions
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const exampleInputs = {
                      javascript: "[\n  [2, 7, 11, 15],\n  9\n]",
                      python: "[\n  [2, 7, 11, 15],\n  9\n]",
                      java: "new int[]{2, 7, 11, 15},\n9",
                      cpp: "{2, 7, 11, 15},\n9",
                      csharp: "new int[]{2, 7, 11, 15},\n9",
                      html: "valid-structure;contains:h1;contains:p",
                      css: "selector:.container;property:display;value:flex-direction=column",
                      react: '{\n  "props": {\n    "items": [1, 2, 3]\n  }\n}',
                      vue: '{\n  "props": {\n    "items": [1, 2, 3]\n  }\n}',
                      angular: '{\n  "items": [1, 2, 3]\n}',
                      nextjs: '{\n  "params": {\n    "id": "123"\n  }\n}',
                      nodejs: '{\n  "method": "GET",\n  "url": "/api/test"\n}',
                      typescript:
                        '{\n  "data": [1, 2, 3],\n  "options": {\n    "sort": true\n  }\n}',
                      php: "$numbers = [2, 7, 11, 15];\n$target = 9;",
                      ruby: "[2, 7, 11, 15],\n9",
                      go: "[]int{2, 7, 11, 15},\n9",
                      swift: "[2, 7, 11, 15],\n9",
                      kotlin: "intArrayOf(2, 7, 11, 15),\n9",
                      dart: "[2, 7, 11, 15],\n9",
                      rust: "vec![2, 7, 11, 15],\n9",
                      c: "int arr[] = {2, 7, 11, 15};\nint target = 9;",
                      sql: "SELECT * FROM users WHERE id = 1;",
                    };

                    const exampleOutputs = {
                      javascript: "[\n  0,\n  1\n]",
                      python: "[\n  0,\n  1\n]",
                      java: "[0, 1]",
                      cpp: "{0, 1}",
                      csharp: "[0, 1]",
                      html: "HTML validation passed",
                      css: "CSS validation passed",
                      react:
                        '<div className="result">\n  <span>Items: 1, 2, 3</span>\n</div>',
                      vue: '<div class="result">\n  <span>Items: 1, 2, 3</span>\n</div>',
                      angular: '<div class="result">\n  Items: 1, 2, 3\n</div>',
                      nextjs: '{\n  "id": "123",\n  "data": "Page content"\n}',
                      nodejs:
                        '{\n  "status": 200,\n  "data": "Response data"\n}',
                      typescript:
                        '{\n  "result": [1, 2, 3],\n  "sorted": true\n}',
                      php: "[0, 1]",
                      ruby: "[0, 1]",
                      go: "[0 1]",
                      swift: "[0, 1]",
                      kotlin: "[0, 1]",
                      dart: "[0, 1]",
                      rust: "[0, 1]",
                      c: "[0, 1]",
                      sql: '{\n  "id": 1,\n  "name": "John Doe",\n  "email": "john@example.com"\n}',
                    };

                    const newTestCase = {
                      id: "1",
                      input: "",
                      expected_output: "",
                      is_hidden: false,
                      points: 10,
                      time_limit: 5000,
                    };
                    onChange({
                      ...codingData,
                      test_cases: [newTestCase],
                    });
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-full font-medium transition-all inline-flex items-center gap-2"
                >
                  <span className="text-xl">➕</span>
                  <span>Create First Test Case</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "constraints" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl">📋</span>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Constraints & Instructions
                </label>
              </div>
              <textarea
                value={data.constraints || ""}
                onChange={(e) =>
                  onChange({
                    ...codingData,
                    constraints: e.target.value,
                  })
                }
                placeholder="Add constraints like time complexity, space complexity, input size limits, or special instructions for students..."
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
              />
              <div className="mt-3 text-xs text-gray-500">
                💡 Tip: Include constraints like "O(n) time complexity required"
                or "Input size ≤ 10^5"
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-3xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">💡</span>
                <div>
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Pro Tips for Great Coding Questions
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>
                      • Start with 2-3 basic test cases, then add edge cases
                    </li>
                    <li>• Include both visible and hidden test cases</li>
                    <li>
                      • Set appropriate time limits (5s for most problems)
                    </li>
                    <li>• Consider different input/output formats</li>
                    <li>• Add clear constraints and requirements</li>
                    <li>
                      • Use templates to get started quickly with common
                      patterns
                    </li>
                    <li>
                      • For web languages (HTML, CSS, React), focus on practical
                      implementations
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-3xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">🎯</span>
                <div>
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                    Language-Specific Tips
                  </h4>
                  <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>
                      <strong>HTML/CSS:</strong> Focus on semantic structure and
                      responsive design
                    </li>
                    <li>
                      <strong>React/Vue/Angular:</strong> Test component logic
                      and state management
                    </li>
                    <li>
                      <strong>Node.js:</strong> Include server-side logic and
                      API testing
                    </li>
                    <li>
                      <strong>TypeScript:</strong> Test type safety and
                      interface usage
                    </li>
                    <li>
                      <strong>SQL:</strong> Focus on query optimization and data
                      relationships
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* C++ Test Case Builder Modal */}
      <CppTestCaseBuilderModal
        isOpen={isCppTestCaseBuilderOpen}
        onClose={() => setIsCppTestCaseBuilderOpen(false)}
        onTestCaseGenerated={(testCase) => {
          // Add the generated test case to the test cases list
          onChange({
            ...codingData,
            test_cases: [...codingData.test_cases, testCase],
          });
          toast.success("C++ test case added successfully!", {
            autoClose: 2000,
          });
        }}
      />

      {/* C++ Validation Guide Modal */}
      <CppValidationGuideModal
        isOpen={isCppValidationGuideOpen}
        onClose={() => setIsCppValidationGuideOpen(false)}
      />

      {validationErrors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <h4 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2">
            Validation Issues
          </h4>
          <ul className="list-disc list-inside space-y-1">
            {validationErrors.map((error, index) => (
              <li
                key={index}
                className="text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CodingProgressIndicator codingData={codingData} />
    </div>
  );
};
