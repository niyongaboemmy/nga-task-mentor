import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
  memory_limit?: number;
}

export interface ExecutionResult {
  testCaseId: string;
  passed: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
}

export interface CodeExecutionOptions {
  language: string;
  code: string;
  testCases: TestCase[];
  timeLimit?: number; // seconds
  memoryLimit?: number; // MB
}

export class CodeExecutor {
  private static readonly SANDBOX_DIR = path.join(
    os.tmpdir(),
    "spwms-code-sandbox"
  );

  static async executeTests(
    options: CodeExecutionOptions
  ): Promise<ExecutionResult[]> {
    const {
      language,
      code,
      testCases,
      timeLimit = 5,
      memoryLimit = 256,
    } = options;

    // Create sandbox directory if it doesn't exist
    if (!fs.existsSync(this.SANDBOX_DIR)) {
      fs.mkdirSync(this.SANDBOX_DIR, { recursive: true });
    }

    const results: ExecutionResult[] = [];

    for (const testCase of testCases) {
      try {
        const result = await this.executeSingleTest(
          language,
          code,
          testCase,
          timeLimit,
          memoryLimit
        );
        results.push(result);
      } catch (error) {
        results.push({
          testCaseId: testCase.id,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
          executionTime: 0,
        });
      }
    }

    return results;
  }

  private static async executeSingleTest(
    language: string,
    code: string,
    testCase: TestCase,
    timeLimit: number,
    memoryLimit: number
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    switch (language.toLowerCase()) {
      case "javascript":
      case "js":
        return this.executeJavaScript(code, testCase, timeLimit);

      case "python":
      case "py":
        return this.executePython(code, testCase, timeLimit);

      case "java":
        return this.executeJava(code, testCase, timeLimit);

      case "html":
        return this.validateHTML(code, testCase);

      case "css":
        return this.validateCSS(code, testCase);

      case "javascript-validation":
        return this.validateJavaScript(code, testCase);

      case "react":
        return this.validateReact(code, testCase);

      case "typescript":
        return this.validateTypeScript(code, testCase);

      case "nodejs":
        return this.validateNodeJS(code, testCase);

      case "vue":
        return this.validateVue(code, testCase);

      default:
        throw new Error(`Language '${language}' is not supported yet`);
    }
  }

  private static async executeJavaScript(
    code: string,
    testCase: TestCase,
    timeLimit: number
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      try {
        // Create a safe execution context
        const sandbox = {
          console: { log: () => {}, error: () => {}, warn: () => {} },
          Math,
          Date,
          Array,
          Object,
          String,
          Number,
          Boolean,
          RegExp,
          JSON,
          parseInt,
          parseFloat,
          isNaN,
          encodeURIComponent,
          decodeURIComponent,
        };

        // Wrap user code in a function with the test input
        const userFunction = new Function(
          ...Object.keys(sandbox),
          "input",
          `
          "use strict";
          try {
            ${code}
            return (${testCase.input});
          } catch (e) {
            throw e;
          }
        `
        );

        // Execute with timeout
        const timeout = setTimeout(() => {
          resolve({
            testCaseId: testCase.id,
            passed: false,
            error: "Execution timeout",
            executionTime: Date.now() - startTime,
          });
        }, timeLimit * 1000);

        const result = userFunction(...Object.values(sandbox), testCase.input);
        clearTimeout(timeout);

        const executionTime = Date.now() - startTime;
        const passed = this.compareOutputs(result, testCase.expected_output);

        resolve({
          testCaseId: testCase.id,
          passed,
          output: String(result),
          executionTime,
        });
      } catch (error) {
        resolve({
          testCaseId: testCase.id,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
          executionTime: Date.now() - startTime,
        });
      }
    });
  }

  private static async executePython(
    code: string,
    testCase: TestCase,
    timeLimit: number
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      // Create temporary file
      const tempFile = path.join(
        this.SANDBOX_DIR,
        `temp_${Date.now()}_${Math.random()}.py`
      );
      const inputFile = path.join(
        this.SANDBOX_DIR,
        `input_${Date.now()}_${Math.random()}.txt`
      );

      try {
        // Write code to file
        fs.writeFileSync(tempFile, code);
        fs.writeFileSync(inputFile, testCase.input);

        // Execute Python code
        const python = spawn("python3", [tempFile], {
          stdio: ["pipe", "pipe", "pipe"],
          timeout: timeLimit * 1000,
        });

        let output = "";
        let errorOutput = "";

        python.stdout.on("data", (data) => {
          output += data.toString();
        });

        python.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        python.on("close", (code) => {
          // Clean up temp files
          try {
            fs.unlinkSync(tempFile);
            fs.unlinkSync(inputFile);
          } catch (e) {
            // Ignore cleanup errors
          }

          const executionTime = Date.now() - startTime;

          if (code !== 0) {
            resolve({
              testCaseId: testCase.id,
              passed: false,
              error: errorOutput || `Process exited with code ${code}`,
              executionTime,
            });
            return;
          }

          const passed = this.compareOutputs(
            output.trim(),
            testCase.expected_output
          );

          resolve({
            testCaseId: testCase.id,
            passed,
            output: output.trim(),
            executionTime,
          });
        });

        python.on("error", (error) => {
          // Clean up temp files
          try {
            fs.unlinkSync(tempFile);
            fs.unlinkSync(inputFile);
          } catch (e) {
            // Ignore cleanup errors
          }

          resolve({
            testCaseId: testCase.id,
            passed: false,
            error: error.message,
            executionTime: Date.now() - startTime,
          });
        });
      } catch (error) {
        // Clean up temp files
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
        } catch (e) {
          // Ignore cleanup errors
        }

        resolve({
          testCaseId: testCase.id,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
          executionTime: Date.now() - startTime,
        });
      }
    });
  }

  private static async executeJava(
    code: string,
    testCase: TestCase,
    timeLimit: number
  ): Promise<ExecutionResult> {
    // Java execution would require more complex setup with compilation
    // For now, return not implemented
    return {
      testCaseId: testCase.id,
      passed: false,
      error: "Java execution not implemented yet",
      executionTime: 0,
    };
  }

  private static async validateHTML(
    code: string,
    testCase: TestCase
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // For HTML validation, we check if the student's code contains required elements
      // The testCase.input can specify what to check for (e.g., "contains:h1", "has-attribute:input:type=email")
      const validationRules = testCase.input
        .split(";")
        .map((rule) => rule.trim());

      let allRulesPassed = true;
      const failedRules: string[] = [];

      for (const rule of validationRules) {
        if (rule.startsWith("contains:")) {
          // Check if HTML contains specific tag/element
          const tag = rule.substring(9); // Skip "contains:" (9 chars)
          const regex = new RegExp(`<${tag}[^>]*>`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing <${tag}> tag`);
          }
        } else if (rule.startsWith("has-attribute:")) {
          // Check for specific attributes
          const attrSpec = rule.substring(14); // Skip "has-attribute:" (14 chars)
          const [tag, attr] = attrSpec.split(":");
          const regex = new RegExp(`<${tag}[^>]*${attr}[^>]*>`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing ${attr} attribute on <${tag}>`);
          }
        } else if (rule.startsWith("count:")) {
          // Check minimum count of elements
          const countSpec = rule.substring(6);
          const [tag, minCount] = countSpec.split(":");
          const regex = new RegExp(`<${tag}[^>]*>`, "gi");
          const matches = code.match(regex);
          const count = matches ? matches.length : 0;
          if (count < parseInt(minCount)) {
            allRulesPassed = false;
            failedRules.push(
              `Expected at least ${minCount} <${tag}> tags, found ${count}`
            );
          }
        } else if (rule === "valid-structure") {
          // Basic structure validation
          const hasDoctype = /<!DOCTYPE html>/i.test(code);
          const hasHtml = /<html[^>]*>/i.test(code);
          const hasHead = /<head[^>]*>/i.test(code);
          const hasBody = /<body[^>]*>/i.test(code);

          if (!hasDoctype) failedRules.push("Missing DOCTYPE declaration");
          if (!hasHtml) failedRules.push("Missing <html> tag");
          if (!hasHead) failedRules.push("Missing <head> tag");
          if (!hasBody) failedRules.push("Missing <body> tag");

          if (!hasDoctype || !hasHtml || !hasHead || !hasBody) {
            allRulesPassed = false;
          }
        } else if (rule === "semantic-html") {
          // Check for semantic HTML elements
          const semanticTags = [
            "header",
            "nav",
            "main",
            "section",
            "article",
            "aside",
            "footer",
          ];
          const missingSemantic = semanticTags.filter((tag) => {
            const regex = new RegExp(`<${tag}[^>]*>`, "i");
            return !regex.test(code);
          });

          if (missingSemantic.length > 0) {
            allRulesPassed = false;
            failedRules.push(
              `Missing semantic elements: ${missingSemantic.join(", ")}`
            );
          }
        } else if (rule.startsWith("aria:")) {
          // Check for ARIA attributes
          const ariaAttr = rule.substring(5);
          const regex = new RegExp(`aria-${ariaAttr}`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing aria-${ariaAttr} attribute`);
          }
        } else if (rule.startsWith("attribute-value:")) {
          // Check for specific attribute values
          const valueSpec = rule.substring(15);
          const [tag, attr, expectedValue] = valueSpec.split(":");
          const regex = new RegExp(
            `<${tag}[^>]*${attr}\\s*=\\s*["']${expectedValue}["'][^>]*>`,
            "i"
          );
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`<${tag}> must have ${attr}="${expectedValue}"`);
          }
        } else if (rule.startsWith("not-contains:")) {
          // Check that HTML does NOT contain specific elements
          const tag = rule.substring(13);
          const regex = new RegExp(`<${tag}[^>]*>`, "i");
          if (regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Should not contain <${tag}> tag`);
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const passed = allRulesPassed;

      return {
        testCaseId: testCase.id,
        passed,
        output: passed
          ? "HTML validation passed"
          : `Validation failed: ${failedRules.join(", ")}`,
        error: passed ? undefined : failedRules.join(", "),
        executionTime,
      };
    } catch (error) {
      return {
        testCaseId: testCase.id,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  private static async validateCSS(
    code: string,
    testCase: TestCase
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // For CSS validation, check for required selectors, properties, and advanced rules
      const validationRules = testCase.input
        .split(";")
        .map((rule) => rule.trim());

      let allRulesPassed = true;
      const failedRules: string[] = [];

      for (const rule of validationRules) {
        if (rule.startsWith("selector:")) {
          // Check if CSS contains specific selector
          const selector = rule.substring(9);
          if (!code.includes(selector)) {
            allRulesPassed = false;
            failedRules.push(`Missing selector: ${selector}`);
          }
        } else if (rule.startsWith("property:")) {
          // Check for specific CSS property
          const property = rule.substring(9);
          const regex = new RegExp(`${property}\\s*:`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing CSS property: ${property}`);
          }
        } else if (rule.startsWith("value:")) {
          // Check for specific CSS value
          const valueSpec = rule.substring(6);
          const [property, value] = valueSpec.split("=");
          const regex = new RegExp(`${property}\\s*:\\s*${value}`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing CSS value: ${property}: ${value}`);
          }
        } else if (rule.startsWith("has-property:")) {
          // Check if selector has specific property
          const propSpec = rule.substring(12);
          const [selector, property] = propSpec.split(":");
          const selectorRegex = new RegExp(
            `${selector}\\s*\\{[^}]*${property}\\s*:`,
            "i"
          );
          if (!selectorRegex.test(code)) {
            allRulesPassed = false;
            failedRules.push(
              `Selector ${selector} missing property: ${property}`
            );
          }
        } else if (rule.startsWith("property-value:")) {
          // Check if selector has specific property with specific value
          const valueSpec = rule.substring(14);
          const [selector, property, expectedValue] = valueSpec.split(":");
          const regex = new RegExp(
            `${selector}\\s*\\{[^}]*${property}\\s*:\\s*${expectedValue}[^}]*\\}`,
            "i"
          );
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(
              `Selector ${selector} must have ${property}: ${expectedValue}`
            );
          }
        } else if (rule.startsWith("count-selectors:")) {
          // Check minimum count of selectors
          const countSpec = rule.substring(15);
          const [selectorType, minCount] = countSpec.split(":");
          let count = 0;
          if (selectorType === "class") {
            const matches = code.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);
            count = matches ? matches.length : 0;
          } else if (selectorType === "id") {
            const matches = code.match(/#[a-zA-Z][a-zA-Z0-9-_]*/g);
            count = matches ? matches.length : 0;
          } else if (selectorType === "element") {
            const matches = code.match(/^[a-zA-Z][a-zA-Z0-9]*\s*\{/gm);
            count = matches ? matches.length : 0;
          }
          if (count < parseInt(minCount)) {
            allRulesPassed = false;
            failedRules.push(
              `Expected at least ${minCount} ${selectorType} selectors, found ${count}`
            );
          }
        } else if (rule === "valid-css") {
          // Basic CSS structure validation
          const hasValidBraces =
            (code.match(/\{/g) || []).length ===
            (code.match(/\}/g) || []).length;
          const hasDeclarations = /\{[^}]*:[^}]*\}/.test(code);
          const noEmptyRules = !/\{\s*\}/.test(code);

          if (!hasValidBraces) failedRules.push("Unmatched braces");
          if (!hasDeclarations)
            failedRules.push("No valid CSS declarations found");
          if (!noEmptyRules) failedRules.push("Empty CSS rules found");

          if (!hasValidBraces || !hasDeclarations || !noEmptyRules) {
            allRulesPassed = false;
          }
        } else if (rule === "responsive-design") {
          // Check for responsive design patterns
          const hasMediaQueries = /@media/.test(code);
          const hasFlexbox = /display\s*:\s*flex/.test(code);
          const hasGrid = /display\s*:\s*grid/.test(code);

          if (!hasMediaQueries)
            failedRules.push("Missing media queries for responsive design");
          if (!hasFlexbox && !hasGrid)
            failedRules.push("Missing flexbox or grid layout");

          if (!hasMediaQueries || (!hasFlexbox && !hasGrid)) {
            allRulesPassed = false;
          }
        } else if (rule.startsWith("media-query:")) {
          // Check for specific media query
          const mediaQuery = rule.substring(12);
          const regex = new RegExp(`@media\\s*${mediaQuery}`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing media query: @media ${mediaQuery}`);
          }
        } else if (rule.startsWith("pseudo-class:")) {
          // Check for pseudo-classes
          const pseudoClass = rule.substring(13);
          const regex = new RegExp(`:${pseudoClass}`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing pseudo-class: :${pseudoClass}`);
          }
        } else if (rule.startsWith("pseudo-element:")) {
          // Check for pseudo-elements
          const pseudoElement = rule.substring(15);
          const regex = new RegExp(`::${pseudoElement}`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing pseudo-element: ::${pseudoElement}`);
          }
        } else if (rule.startsWith("animation:")) {
          // Check for CSS animations
          const animationType = rule.substring(10);
          if (animationType === "keyframes") {
            if (!/@keyframes/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing @keyframes animation");
            }
          } else if (animationType === "transition") {
            if (!/transition/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing CSS transition");
            }
          } else if (animationType === "transform") {
            if (!/transform/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing CSS transform");
            }
          }
        } else if (rule.startsWith("color:")) {
          // Check for color usage
          const colorType = rule.substring(6);
          if (colorType === "hex") {
            if (!/#[0-9a-fA-F]{3,6}/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing hex color values");
            }
          } else if (colorType === "rgb") {
            if (!/rgb\(/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing RGB color values");
            }
          } else if (colorType === "hsl") {
            if (!/hsl\(/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing HSL color values");
            }
          }
        } else if (rule.startsWith("font:")) {
          // Check for typography
          const fontType = rule.substring(5);
          if (fontType === "family") {
            if (!/font-family/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing font-family declaration");
            }
          } else if (fontType === "size") {
            if (!/font-size/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing font-size declaration");
            }
          } else if (fontType === "weight") {
            if (!/font-weight/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing font-weight declaration");
            }
          }
        } else if (rule.startsWith("layout:")) {
          // Check for layout properties
          const layoutType = rule.substring(7);
          if (layoutType === "flexbox") {
            if (!/display\s*:\s*flex/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing flexbox layout");
            }
          } else if (layoutType === "grid") {
            if (!/display\s*:\s*grid/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing CSS grid layout");
            }
          } else if (layoutType === "positioning") {
            if (!/position\s*:\s*(absolute|relative|fixed|sticky)/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Missing advanced positioning");
            }
          }
        } else if (rule.startsWith("not-contains:")) {
          // Check that CSS does NOT contain specific property
          const property = rule.substring(12);
          const regex = new RegExp(`${property}\\s*:`, "i");
          if (regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Should not contain property: ${property}`);
          }
        } else if (rule.startsWith("combinator:")) {
          // Check for CSS combinators
          const combinator = rule.substring(11);
          let regex: RegExp;
          if (combinator === "descendant") {
            regex = /\s+/; // Space combinator
          } else if (combinator === "child") {
            regex = />/;
          } else if (combinator === "adjacent") {
            regex = /\+/;
          } else if (combinator === "general-sibling") {
            regex = /~/;
          } else {
            continue; // Unknown combinator
          }
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing ${combinator} combinator`);
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const passed = allRulesPassed;

      return {
        testCaseId: testCase.id,
        passed,
        output: passed
          ? "CSS validation passed"
          : `Validation failed: ${failedRules.join(", ")}`,
        error: passed ? undefined : failedRules.join(", "),
        executionTime,
      };
    } catch (error) {
      return {
        testCaseId: testCase.id,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  private static async validateJavaScript(
    code: string,
    testCase: TestCase
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // For JavaScript validation, check for required functions, variables, patterns, and best practices
      const validationRules = testCase.input
        .split(";")
        .map((rule) => rule.trim());

      let allRulesPassed = true;
      const failedRules: string[] = [];

      for (const rule of validationRules) {
        if (rule.startsWith("function:")) {
          // Check if function exists
          const funcName = rule.substring(9);
          const regex = new RegExp(
            `function\\s+${funcName}\\s*\\(|${funcName}\\s*=\\s*(function|=>)`,
            "i"
          );
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing function: ${funcName}`);
          }
        } else if (rule.startsWith("variable:")) {
          // Check if variable is declared
          const varName = rule.substring(9);
          const regex = new RegExp(
            `(?:var|let|const)\\s+${varName}\\b|\\b${varName}\\s*=`,
            "i"
          );
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing variable declaration: ${varName}`);
          }
        } else if (rule.startsWith("uses:")) {
          // Check if code uses specific construct
          const construct = rule.substring(5);
          let regex: RegExp;
          if (construct === "for-loop") {
            regex = /\bfor\s*\(/;
          } else if (construct === "while-loop") {
            regex = /\bwhile\s*\(/;
          } else if (construct === "if-statement") {
            regex = /\bif\s*\(/;
          } else if (construct === "array") {
            regex = /\[.*\]/;
          } else if (construct === "object") {
            regex = /\{[^}]*:[^}]*\}/;
          } else if (construct === "arrow-function") {
            regex = /=>/;
          } else if (construct === "async") {
            regex = /\basync\b/;
          } else if (construct === "await") {
            regex = /\bawait\b/;
          } else if (construct === "try-catch") {
            regex = /\btry\s*\{/;
          } else if (construct === "recursion") {
            // Check for function calling itself
            const funcMatch = code.match(/function\s+(\w+)/);
            if (funcMatch) {
              const funcName = funcMatch[1];
              regex = new RegExp(`${funcName}\\s*\\(`);
            } else {
              continue;
            }
          } else if (construct === "array-method") {
            regex = /\.(map|filter|reduce|forEach|find|some|every)\s*\(/;
          } else if (construct === "string-method") {
            regex =
              /\.(split|join|replace|substring|slice|indexOf|includes)\s*\(/;
          } else {
            continue;
          }
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing ${construct} usage`);
          }
        } else if (rule.startsWith("algorithm:")) {
          // Check for algorithmic patterns
          const algorithm = rule.substring(10);
          if (algorithm === "sorting") {
            // Check for sorting patterns
            const hasSort = /\bsort\s*\(/.test(code);
            const hasBubbleSort = /for.*for.*if.*>/.test(
              code.replace(/\s+/g, "")
            );
            const hasQuickSort = /partition|pivot/.test(code);
            if (!hasSort && !hasBubbleSort && !hasQuickSort) {
              allRulesPassed = false;
              failedRules.push("Missing sorting algorithm implementation");
            }
          } else if (algorithm === "searching") {
            // Check for searching patterns
            const hasIndexOf = /\.indexOf\s*\(/.test(code);
            const hasFind = /\.find\s*\(/.test(code);
            const hasLinearSearch = /for.*if.*===/.test(
              code.replace(/\s+/g, "")
            );
            const hasBinarySearch = /mid|middle|Math\.floor.*\/.*2/.test(code);
            if (
              !hasIndexOf &&
              !hasFind &&
              !hasLinearSearch &&
              !hasBinarySearch
            ) {
              allRulesPassed = false;
              failedRules.push("Missing searching algorithm implementation");
            }
          } else if (algorithm === "recursion") {
            const funcMatch = code.match(/function\s+(\w+)/);
            if (funcMatch) {
              const funcName = funcMatch[1];
              const hasRecursion = new RegExp(`${funcName}\\s*\\(`).test(
                code.replace(new RegExp(`function\\s+${funcName}`), "")
              );
              if (!hasRecursion) {
                allRulesPassed = false;
                failedRules.push("Missing recursive implementation");
              }
            }
          }
        } else if (rule.startsWith("complexity:")) {
          // Check for complexity indicators
          const complexity = rule.substring(11);
          if (complexity === "o-n") {
            // Should have single loop
            const loopCount =
              (code.match(/\bfor\s*\(/g) || []).length +
              (code.match(/\bwhile\s*\(/g) || []).length;
            if (loopCount !== 1) {
              allRulesPassed = false;
              failedRules.push("Expected O(n) complexity (single loop)");
            }
          } else if (complexity === "o-n2") {
            // Should have nested loops
            const hasNestedLoops = /for.*\{[^}]*for.*\}/.test(
              code.replace(/\s+/g, "")
            );
            if (!hasNestedLoops) {
              allRulesPassed = false;
              failedRules.push("Expected O(n²) complexity (nested loops)");
            }
          } else if (complexity === "o-log-n") {
            // Should have binary search or similar
            const hasBinarySearch = /mid|middle|Math\.floor.*\/.*2/.test(code);
            if (!hasBinarySearch) {
              allRulesPassed = false;
              failedRules.push("Expected O(log n) complexity pattern");
            }
          }
        } else if (rule.startsWith("best-practice:")) {
          // Check for best practices
          const practice = rule.substring(13);
          if (practice === "const-over-var") {
            const hasVar = /\bvar\s+/.test(code);
            const hasConst = /\bconst\s+/.test(code);
            if (hasVar && !hasConst) {
              allRulesPassed = false;
              failedRules.push("Use const instead of var for constants");
            }
          } else if (practice === "descriptive-names") {
            // Check for single-letter variable names (except loop counters)
            const badNames = code.match(/\b(let|var|const)\s+([a-z])\b/g);
            if (
              badNames &&
              badNames.some(
                (match) => !/\b(let|var|const)\s+[ij]\b/.test(match)
              )
            ) {
              allRulesPassed = false;
              failedRules.push("Use descriptive variable names");
            }
          } else if (practice === "error-handling") {
            const hasTryCatch = /\btry\s*\{/.test(code);
            const hasThrow = /\bthrow\b/.test(code);
            if (!hasTryCatch && !hasThrow) {
              allRulesPassed = false;
              failedRules.push("Missing error handling");
            }
          }
        } else if (rule.startsWith("avoids:")) {
          // Check that code avoids certain patterns
          const avoid = rule.substring(7);
          if (avoid === "global-variables") {
            // Check for global variable assignments
            const hasGlobalVars = /\bwindow\.|\bdocument\.|\bglobal\./.test(
              code
            );
            if (hasGlobalVars) {
              allRulesPassed = false;
              failedRules.push("Avoid global variable pollution");
            }
          } else if (avoid === "eval") {
            if (/\beval\s*\(/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Avoid using eval()");
            }
          } else if (avoid === "with-statement") {
            if (/\bwith\s*\(/.test(code)) {
              allRulesPassed = false;
              failedRules.push("Avoid using with statement");
            }
          }
        } else if (rule.startsWith("performance:")) {
          // Check for performance considerations
          const perf = rule.substring(11);
          if (perf === "efficient-loops") {
            // Check for inefficient patterns
            const hasInefficient = /for.*in.*Array|\.length.*in.*for/.test(
              code
            );
            if (hasInefficient) {
              allRulesPassed = false;
              failedRules.push("Use efficient loop patterns");
            }
          } else if (perf === "avoids-nested-loops") {
            const nestedLoops = /for.*\{[^}]*for.*\{[^}]*for.*\}/.test(
              code.replace(/\s+/g, "")
            );
            if (nestedLoops) {
              allRulesPassed = false;
              failedRules.push("Avoid deeply nested loops for performance");
            }
          }
        } else if (rule === "valid-js") {
          // Basic JavaScript syntax validation
          try {
            // Try to parse the code
            new Function(code);
          } catch (e) {
            allRulesPassed = false;
            failedRules.push("Invalid JavaScript syntax");
          }
        } else if (rule.startsWith("output-type:")) {
          // Check output type (this would be validated during execution)
          const expectedType = rule.substring(12);
          // This will be checked in the execution phase
          continue;
        } else if (rule.startsWith("not-contains:")) {
          // Check that code does NOT contain specific pattern
          const pattern = rule.substring(12);
          if (code.includes(pattern)) {
            allRulesPassed = false;
            failedRules.push(`Should not contain: ${pattern}`);
          }
        } else if (rule.startsWith("input-validation:")) {
          // Check for input validation patterns
          const validationType = rule.substring(16);
          if (validationType === "type-check") {
            // Check if code validates input types
            const hasTypeof = /\btypeof\s+/.test(code);
            const hasInstanceof = /\binstanceof\b/.test(code);
            if (!hasTypeof && !hasInstanceof) {
              allRulesPassed = false;
              failedRules.push("Missing input type validation");
            }
          } else if (validationType === "range-check") {
            // Check for range validation
            const hasComparison = /[<>]=?|\bMath\.(min|max)\b/.test(code);
            if (!hasComparison) {
              allRulesPassed = false;
              failedRules.push("Missing input range validation");
            }
          } else if (validationType === "null-undefined") {
            // Check for null/undefined handling
            const hasNullCheck = /\bnull\b|\bundefined\b|===|!==/.test(code);
            if (!hasNullCheck) {
              allRulesPassed = false;
              failedRules.push("Missing null/undefined input validation");
            }
          }
        } else if (rule.startsWith("output-format:")) {
          // Check output format requirements
          const formatType = rule.substring(13);
          if (formatType === "sorted-array") {
            // Should return sorted array
            const hasSort = /\.sort\s*\(/.test(code);
            const hasSortedOutput = /return.*\.sort|return.*sorted/.test(code);
            if (!hasSort && !hasSortedOutput) {
              allRulesPassed = false;
              failedRules.push("Output should be a sorted array");
            }
          } else if (formatType === "unique-array") {
            // Should return array with unique elements
            const hasSet = /\bSet\b|\bnew Set/.test(code);
            const hasFilter = /\.filter\s*\(/.test(code);
            if (!hasSet && !hasFilter) {
              allRulesPassed = false;
              failedRules.push("Output should contain unique elements");
            }
          } else if (formatType === "object-properties") {
            // Should return object with specific properties
            const hasObjectLiteral = /\{[^}]*\}/.test(code);
            const hasReturnObject = /return\s*\{/.test(code);
            if (!hasObjectLiteral && !hasReturnObject) {
              allRulesPassed = false;
              failedRules.push("Output should be an object with properties");
            }
          }
        } else if (rule.startsWith("edge-case:")) {
          // Check for edge case handling
          const edgeCase = rule.substring(10);
          if (edgeCase === "empty-array") {
            // Should handle empty arrays
            const hasLengthCheck = /\.length\s*[=!<>]/.test(code);
            const hasEmptyArrayCheck = /\[\s*\]/.test(code);
            if (!hasLengthCheck && !hasEmptyArrayCheck) {
              allRulesPassed = false;
              failedRules.push("Missing empty array handling");
            }
          } else if (edgeCase === "negative-numbers") {
            // Should handle negative numbers
            const hasNegativeCheck = /<\s*0|>=\s*0/.test(code);
            if (!hasNegativeCheck) {
              allRulesPassed = false;
              failedRules.push("Missing negative number handling");
            }
          } else if (edgeCase === "large-inputs") {
            // Should handle large inputs efficiently
            const hasLoop = /\bfor\b|\bwhile\b/.test(code);
            const hasRecursion = /function.*\{[^}]*\w+\s*\(/.test(
              code.replace(/function\s+\w+/g, "")
            );
            if (!hasLoop && !hasRecursion) {
              allRulesPassed = false;
              failedRules.push("Missing efficient large input handling");
            }
          }
        } else if (rule.startsWith("math-operation:")) {
          // Check for mathematical operations
          const operation = rule.substring(14);
          if (operation === "arithmetic") {
            const hasArithmetic = /[+\-*/%]/.test(code);
            if (!hasArithmetic) {
              allRulesPassed = false;
              failedRules.push("Missing arithmetic operations");
            }
          } else if (operation === "comparison") {
            const hasComparison = /[<>]=?/.test(code);
            if (!hasComparison) {
              allRulesPassed = false;
              failedRules.push("Missing comparison operations");
            }
          } else if (operation === "math-functions") {
            const hasMath = /\bMath\./.test(code);
            if (!hasMath) {
              allRulesPassed = false;
              failedRules.push("Missing Math library usage");
            }
          }
        } else if (rule.startsWith("string-operation:")) {
          // Check for string operations
          const operation = rule.substring(16);
          if (operation === "manipulation") {
            const hasStringMethod =
              /\.(split|join|replace|substring|slice|indexOf|includes|toLowerCase|toUpperCase)\s*\(/.test(
                code
              );
            if (!hasStringMethod) {
              allRulesPassed = false;
              failedRules.push("Missing string manipulation methods");
            }
          } else if (operation === "validation") {
            const hasStringCheck = /\.(length|trim|match|test)\s*\(/.test(code);
            if (!hasStringCheck) {
              allRulesPassed = false;
              failedRules.push("Missing string validation");
            }
          }
        } else if (rule.startsWith("array-operation:")) {
          // Check for array operations
          const operation = rule.substring(15);
          if (operation === "iteration") {
            const hasIteration =
              /\.(forEach|map|filter|reduce|some|every|find)\s*\(/.test(code);
            if (!hasIteration) {
              allRulesPassed = false;
              failedRules.push("Missing array iteration methods");
            }
          } else if (operation === "modification") {
            const hasModification =
              /\.(push|pop|shift|unshift|splice|sort|reverse)\s*\(/.test(code);
            if (!hasModification) {
              allRulesPassed = false;
              failedRules.push("Missing array modification methods");
            }
          } else if (operation === "search") {
            const hasSearch = /\.(indexOf|findIndex|includes|find)\s*\(/.test(
              code
            );
            if (!hasSearch) {
              allRulesPassed = false;
              failedRules.push("Missing array search methods");
            }
          }
        } else if (rule.startsWith("object-operation:")) {
          // Check for object operations
          const operation = rule.substring(16);
          if (operation === "property-access") {
            const hasPropertyAccess = /\.\w+|\[.*\]/.test(code);
            if (!hasPropertyAccess) {
              allRulesPassed = false;
              failedRules.push("Missing object property access");
            }
          } else if (operation === "method-calls") {
            const hasMethodCall = /\.\w+\s*\(/.test(code);
            if (!hasMethodCall) {
              allRulesPassed = false;
              failedRules.push("Missing object method calls");
            }
          } else if (operation === "destructuring") {
            const hasDestructuring = /\{\s*\w+\s*\}|\[\s*\w+\s*\]/.test(code);
            if (!hasDestructuring) {
              allRulesPassed = false;
              failedRules.push("Missing object/array destructuring");
            }
          }
        } else if (rule.startsWith("algorithm-pattern:")) {
          // Check for specific algorithm patterns
          const pattern = rule.substring(17);
          if (pattern === "two-pointers") {
            // Should use two pointers
            const hasTwoPointers =
              /let.*=.*0.*let.*=.*length|let.*left.*let.*right/.test(code);
            if (!hasTwoPointers) {
              allRulesPassed = false;
              failedRules.push("Missing two-pointer technique");
            }
          } else if (pattern === "sliding-window") {
            // Should use sliding window
            const hasSlidingWindow = /let.*window|let.*start.*let.*end/.test(
              code
            );
            if (!hasSlidingWindow) {
              allRulesPassed = false;
              failedRules.push("Missing sliding window technique");
            }
          } else if (pattern === "hash-table") {
            // Should use hash table (object or Map)
            const hasHashTable = /\bMap\b|new Map|\{\s*\w+:\s*\w+\s*\}/.test(
              code
            );
            if (!hasHashTable) {
              allRulesPassed = false;
              failedRules.push("Missing hash table usage");
            }
          } else if (pattern === "dynamic-programming") {
            // Should use DP (memoization or tabulation)
            const hasDP = /memo|cache|dp\[|new Array.*fill/.test(code);
            if (!hasDP) {
              allRulesPassed = false;
              failedRules.push("Missing dynamic programming approach");
            }
          }
        } else if (rule.startsWith("performance-pattern:")) {
          // Check for performance patterns
          const pattern = rule.substring(19);
          if (pattern === "early-return") {
            // Should use early returns
            const hasEarlyReturn = /if.*return/.test(code);
            if (!hasEarlyReturn) {
              allRulesPassed = false;
              failedRules.push("Missing early return optimization");
            }
          } else if (pattern === "constant-space") {
            // Should use constant extra space
            const hasExtraSpace = /new Array|new Object|new Map|new Set/.test(
              code
            );
            if (hasExtraSpace) {
              allRulesPassed = false;
              failedRules.push("Should use constant extra space");
            }
          } else if (pattern === "in-place") {
            // Should modify array in place
            const hasInPlace =
              /\.sort\s*\(\)|\.reverse\s*\(\)|\.splice\s*\(/.test(code);
            if (!hasInPlace) {
              allRulesPassed = false;
              failedRules.push("Should modify array in place");
            }
          }
        } else if (rule.startsWith("code-quality:")) {
          // Check for code quality metrics
          const quality = rule.substring(12);
          if (quality === "readability") {
            // Check for readable variable names
            const hasDescriptiveNames =
              /\b(result|sum|count|index|temp|max|min)\b/.test(code);
            const hasSingleLetters =
              /\blet\s+[a-z]\b|\bvar\s+[a-z]\b|\bconst\s+[a-z]\b/.test(code);
            if (!hasDescriptiveNames && hasSingleLetters) {
              allRulesPassed = false;
              failedRules.push(
                "Use descriptive variable names for readability"
              );
            }
          } else if (quality === "modularity") {
            // Check for function decomposition
            const hasMultipleFunctions = /function\s+\w+/g;
            const functionCount = (code.match(hasMultipleFunctions) || [])
              .length;
            if (functionCount < 2) {
              allRulesPassed = false;
              failedRules.push(
                "Consider breaking code into multiple functions"
              );
            }
          } else if (quality === "documentation") {
            // Check for comments
            const hasComments = /\/\/|\/\*/.test(code);
            if (!hasComments) {
              allRulesPassed = false;
              failedRules.push("Add comments for better code documentation");
            }
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const passed = allRulesPassed;

      return {
        testCaseId: testCase.id,
        passed,
        output: passed
          ? "JavaScript validation passed"
          : `Validation failed: ${failedRules.join(", ")}`,
        error: passed ? undefined : failedRules.join(", "),
        executionTime,
      };
    } catch (error) {
      return {
        testCaseId: testCase.id,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  private static async validateReact(
    code: string,
    testCase: TestCase
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // For React validation, check for React-specific patterns and best practices
      const validationRules = testCase.input
        .split(";")
        .map((rule) => rule.trim());

      let allRulesPassed = true;
      const failedRules: string[] = [];

      for (const rule of validationRules) {
        if (rule.startsWith("component:")) {
          // Check for component patterns
          const componentType = rule.substring(10);
          if (componentType === "functional") {
            const hasFunctionalComponent =
              /function\s+\w+|const\s+\w+\s*=\s*\(\s*\)\s*=>/.test(code);
            if (!hasFunctionalComponent) {
              allRulesPassed = false;
              failedRules.push("Missing functional component");
            }
          } else if (componentType === "class") {
            const hasClassComponent =
              /class\s+\w+\s+extends\s+(React\.)?Component/.test(code);
            if (!hasClassComponent) {
              allRulesPassed = false;
              failedRules.push("Missing class component");
            }
          }
        } else if (rule.startsWith("hook:")) {
          // Check for React hooks
          const hookName = rule.substring(5);
          const regex = new RegExp(`use${hookName}\\s*\\(`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing use${hookName} hook`);
          }
        } else if (rule.startsWith("jsx:")) {
          // Check for JSX patterns
          const jsxPattern = rule.substring(4);
          if (jsxPattern === "return") {
            const hasJSXReturn = /return\s*\(?\s*<[^>]+>/.test(code);
            if (!hasJSXReturn) {
              allRulesPassed = false;
              failedRules.push("Missing JSX return statement");
            }
          } else if (jsxPattern === "fragment") {
            const hasFragment = /<>\s*.*\s*<\/>|<React\.Fragment/.test(code);
            if (!hasFragment) {
              allRulesPassed = false;
              failedRules.push("Missing React Fragment usage");
            }
          }
        } else if (rule.startsWith("state:")) {
          // Check for state management
          const stateType = rule.substring(5);
          if (stateType === "usestate") {
            const hasUseState = /useState\s*\(/.test(code);
            if (!hasUseState) {
              allRulesPassed = false;
              failedRules.push("Missing useState hook");
            }
          } else if (stateType === "useeffect") {
            const hasUseEffect = /useEffect\s*\(/.test(code);
            if (!hasUseEffect) {
              allRulesPassed = false;
              failedRules.push("Missing useEffect hook");
            }
          }
        } else if (rule.startsWith("props:")) {
          // Check for props usage
          const propsPattern = rule.substring(5);
          if (propsPattern === "destructuring") {
            const hasPropsDestructuring =
              /const\s*\{\s*\w+\s*\}\s*=\s*props|function\s+\w+\s*\(\s*\{\s*\w+\s*\}\s*\)/.test(
                code
              );
            if (!hasPropsDestructuring) {
              allRulesPassed = false;
              failedRules.push("Missing props destructuring");
            }
          }
        } else if (rule.startsWith("event:")) {
          // Check for event handling
          const eventType = rule.substring(5);
          if (eventType === "handler") {
            const hasEventHandler = /onClick|onChange|onSubmit/.test(code);
            if (!hasEventHandler) {
              allRulesPassed = false;
              failedRules.push("Missing event handler");
            }
          }
        } else if (rule === "react-import") {
          const hasReactImport = /import\s+React|import\s+\*\s+as\s+React/.test(
            code
          );
          if (!hasReactImport) {
            allRulesPassed = false;
            failedRules.push("Missing React import");
          }
        } else if (rule === "export-default") {
          const hasDefaultExport = /export\s+default/.test(code);
          if (!hasDefaultExport) {
            allRulesPassed = false;
            failedRules.push("Missing default export");
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const passed = allRulesPassed;

      return {
        testCaseId: testCase.id,
        passed,
        output: passed
          ? "React validation passed"
          : `Validation failed: ${failedRules.join(", ")}`,
        error: passed ? undefined : failedRules.join(", "),
        executionTime,
      };
    } catch (error) {
      return {
        testCaseId: testCase.id,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  private static async validateTypeScript(
    code: string,
    testCase: TestCase
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // For TypeScript validation, check for type annotations and TypeScript features
      const validationRules = testCase.input
        .split(";")
        .map((rule) => rule.trim());

      let allRulesPassed = true;
      const failedRules: string[] = [];

      for (const rule of validationRules) {
        if (rule.startsWith("type:")) {
          // Check for type annotations
          const typePattern = rule.substring(5);
          if (typePattern === "parameter") {
            const hasTypedParams = /\w+\s*:\s*\w+/.test(code);
            if (!hasTypedParams) {
              allRulesPassed = false;
              failedRules.push("Missing parameter type annotations");
            }
          } else if (typePattern === "return") {
            const hasReturnType = /:\s*\w+\s*\{|\)\s*:\s*\w+/.test(code);
            if (!hasReturnType) {
              allRulesPassed = false;
              failedRules.push("Missing return type annotation");
            }
          } else if (typePattern === "variable") {
            const hasTypedVars = /(let|const|var)\s+\w+\s*:\s*\w+/.test(code);
            if (!hasTypedVars) {
              allRulesPassed = false;
              failedRules.push("Missing variable type annotations");
            }
          }
        } else if (rule.startsWith("interface:")) {
          // Check for interface usage
          const interfaceName = rule.substring(10);
          const regex = new RegExp(`interface\\s+${interfaceName}`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing interface: ${interfaceName}`);
          }
        } else if (rule.startsWith("generic:")) {
          // Check for generic types
          const genericType = rule.substring(7);
          const regex = new RegExp(`<${genericType}>`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing generic type: ${genericType}`);
          }
        } else if (rule.startsWith("enum:")) {
          // Check for enum usage
          const enumName = rule.substring(5);
          const regex = new RegExp(`enum\\s+${enumName}`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing enum: ${enumName}`);
          }
        } else if (rule.startsWith("union:")) {
          // Check for union types
          const hasUnion = /\w+\s*\|\s*\w+/.test(code);
          if (!hasUnion) {
            allRulesPassed = false;
            failedRules.push("Missing union type usage");
          }
        } else if (rule.startsWith("optional:")) {
          // Check for optional properties
          const hasOptional = /\w+\?:/.test(code);
          if (!hasOptional) {
            allRulesPassed = false;
            failedRules.push("Missing optional property usage");
          }
        } else if (rule === "strict-mode") {
          // Check for strict TypeScript features
          const hasStrict = /noImplicitAny|strictNullChecks|strict/.test(code);
          if (!hasStrict) {
            allRulesPassed = false;
            failedRules.push("Missing strict TypeScript configuration");
          }
        } else if (rule === "type-assertion") {
          const hasTypeAssertion = /as\s+\w+|<.*>/.test(code);
          if (!hasTypeAssertion) {
            allRulesPassed = false;
            failedRules.push("Missing type assertion");
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const passed = allRulesPassed;

      return {
        testCaseId: testCase.id,
        passed,
        output: passed
          ? "TypeScript validation passed"
          : `Validation failed: ${failedRules.join(", ")}`,
        error: passed ? undefined : failedRules.join(", "),
        executionTime,
      };
    } catch (error) {
      return {
        testCaseId: testCase.id,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  private static async validateNodeJS(
    code: string,
    testCase: TestCase
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // For Node.js validation, check for server-side patterns and Node.js features
      const validationRules = testCase.input
        .split(";")
        .map((rule) => rule.trim());

      let allRulesPassed = true;
      const failedRules: string[] = [];

      for (const rule of validationRules) {
        if (rule.startsWith("nodejs:function:")) {
          // Check for specific Node.js functions
          const funcName = rule.substring(15);
          const regex = new RegExp(`${funcName}\\s*\\(`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing Node.js function: ${funcName}`);
          }
        } else if (rule.startsWith("nodejs:api:")) {
          // Check for Node.js API usage
          const apiType = rule.substring(10);
          if (apiType === "express") {
            const hasExpress =
              /express\s*\(\)|require\s*\(\s*['"]express['"]\s*\)/.test(code);
            if (!hasExpress) {
              allRulesPassed = false;
              failedRules.push("Missing Express.js setup");
            }
          } else if (apiType === "http") {
            const hasHttp = /require\s*\(\s*['"]http['"]\s*\)/.test(code);
            if (!hasHttp) {
              allRulesPassed = false;
              failedRules.push("Missing HTTP module usage");
            }
          }
        } else if (rule.startsWith("nodejs:endpoint:")) {
          // Check for API endpoints
          const endpoint = rule.substring(16);
          const regex = new RegExp(`['"]${endpoint}['"]`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing endpoint: ${endpoint}`);
          }
        } else if (rule.startsWith("nodejs:http-method:")) {
          // Check for HTTP methods
          const method = rule.substring(18);
          const regex = new RegExp(`\.${method.toLowerCase()}\\s*\\(`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing HTTP method: ${method}`);
          }
        } else if (rule.startsWith("uses:")) {
          // Check for specific Node.js patterns
          const pattern = rule.substring(5);
          if (pattern === "async-await") {
            const hasAsyncAwait = /\basync\b|\bawait\b/.test(code);
            if (!hasAsyncAwait) {
              allRulesPassed = false;
              failedRules.push("Missing async/await usage");
            }
          } else if (pattern === "promises") {
            const hasPromises = /\bPromise\b|\.then\s*\(|\.catch\s*\(/.test(
              code
            );
            if (!hasPromises) {
              allRulesPassed = false;
              failedRules.push("Missing Promise usage");
            }
          } else if (pattern === "streams") {
            const hasStreams = /\bstream\b|\.pipe\s*\(|\.createReadStream/.test(
              code
            );
            if (!hasStreams) {
              allRulesPassed = false;
              failedRules.push("Missing stream usage");
            }
          } else if (pattern === "events") {
            const hasEvents = /\bEventEmitter\b|\.on\s*\(|\.emit\s*\(/.test(
              code
            );
            if (!hasEvents) {
              allRulesPassed = false;
              failedRules.push("Missing event handling");
            }
          } else if (pattern === "express-middleware") {
            const hasMiddleware = /\.use\s*\(|\.get\s*\(|\.post\s*\(/.test(
              code
            );
            if (!hasMiddleware) {
              allRulesPassed = false;
              failedRules.push("Missing Express middleware");
            }
          }
        } else if (rule.startsWith("error-handling:")) {
          // Check for error handling patterns
          const errorType = rule.substring(14);
          if (errorType === "try-catch") {
            const hasTryCatch = /\btry\s*\{/.test(code);
            if (!hasTryCatch) {
              allRulesPassed = false;
              failedRules.push("Missing try-catch error handling");
            }
          } else if (errorType === "process-events") {
            const hasProcessEvents = /process\.on\s*\(/.test(code);
            if (!hasProcessEvents) {
              allRulesPassed = false;
              failedRules.push("Missing process event handling");
            }
          }
        } else if (rule.startsWith("security:")) {
          // Check for security patterns
          const securityType = rule.substring(9);
          if (securityType === "input-validation") {
            const hasValidation = /\btypeof\b|\binstanceof\b|isNaN\s*\(/.test(
              code
            );
            if (!hasValidation) {
              allRulesPassed = false;
              failedRules.push("Missing input validation");
            }
          }
        } else if (rule.startsWith("database:")) {
          // Check for database patterns
          const dbType = rule.substring(9);
          if (dbType === "mongoose") {
            const hasMongoose = /require\s*\(\s*['"]mongoose['"]\s*\)/.test(
              code
            );
            if (!hasMongoose) {
              allRulesPassed = false;
              failedRules.push("Missing Mongoose setup");
            }
          }
        } else if (rule.startsWith("authentication:")) {
          // Check for authentication patterns
          const authType = rule.substring(15);
          if (authType === "jwt") {
            const hasJWT = /jsonwebtoken|jwt/.test(code);
            if (!hasJWT) {
              allRulesPassed = false;
              failedRules.push("Missing JWT authentication");
            }
          }
        } else if (rule.startsWith("logging:")) {
          // Check for logging patterns
          const logType = rule.substring(8);
          if (logType === "winston") {
            const hasWinston = /require\s*\(\s*['"]winston['"]\s*\)/.test(code);
            if (!hasWinston) {
              allRulesPassed = false;
              failedRules.push("Missing Winston logging");
            }
          }
        } else if (rule.startsWith("performance:")) {
          // Check for performance patterns
          const perfType = rule.substring(12);
          if (perfType === "compression") {
            const hasCompression = /compression|gzip/.test(code);
            if (!hasCompression) {
              allRulesPassed = false;
              failedRules.push("Missing response compression");
            }
          }
        } else if (rule.startsWith("testing:")) {
          // Check for testing patterns
          const testType = rule.substring(8);
          if (testType === "jest") {
            const hasJest = /describe\s*\(|it\s*\(|test\s*\(/.test(code);
            if (!hasJest) {
              allRulesPassed = false;
              failedRules.push("Missing Jest testing framework");
            }
          }
        } else if (rule.startsWith("deployment:")) {
          // Check for deployment patterns
          const deployType = rule.substring(11);
          if (deployType === "pm2") {
            const hasPM2 = /pm2/.test(code);
            if (!hasPM2) {
              allRulesPassed = false;
              failedRules.push("Missing PM2 process manager");
            }
          } else if (deployType === "docker") {
            const hasDocker = /FROM\s+|EXPOSE\s+|CMD\s+/.test(code);
            if (!hasDocker) {
              allRulesPassed = false;
              failedRules.push("Missing Docker configuration");
            }
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const passed = allRulesPassed;

      return {
        testCaseId: testCase.id,
        passed,
        output: passed
          ? "Node.js validation passed"
          : `Validation failed: ${failedRules.join(", ")}`,
        error: passed ? undefined : failedRules.join(", "),
        executionTime,
      };
    } catch (error) {
      return {
        testCaseId: testCase.id,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  private static async validateVue(
    code: string,
    testCase: TestCase
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // For Vue validation, check for Vue-specific patterns and best practices
      const validationRules = testCase.input
        .split(";")
        .map((rule) => rule.trim());

      let allRulesPassed = true;
      const failedRules: string[] = [];

      for (const rule of validationRules) {
        if (rule.startsWith("vue:component:")) {
          // Check for specific component name
          const componentName = rule.substring(14);
          const regex = new RegExp(
            `export default.*${componentName}|name:\\s*['"]${componentName}['"]`,
            "i"
          );
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing component: ${componentName}`);
          }
        } else if (rule.startsWith("vue:api:")) {
          // Check for API type
          const apiType = rule.substring(8);
          if (apiType === "options") {
            const hasOptionsAPI =
              /data\s*\(\s*\)|methods\s*:\s*\{|computed\s*:\s*\{/.test(code);
            if (!hasOptionsAPI) {
              allRulesPassed = false;
              failedRules.push("Missing Options API usage");
            }
          } else if (apiType === "composition") {
            const hasCompositionAPI = /setup\s*\(|ref\s*\(|reactive\s*\(/.test(
              code
            );
            if (!hasCompositionAPI) {
              allRulesPassed = false;
              failedRules.push("Missing Composition API usage");
            }
          } else if (apiType === "setup") {
            const hasSetupScript = /<script setup>/.test(code);
            if (!hasSetupScript) {
              allRulesPassed = false;
              failedRules.push("Missing setup script");
            }
          }
        } else if (rule.startsWith("vue:data:")) {
          // Check for data property
          const dataProp = rule.substring(9);
          const regex = new RegExp(`${dataProp}\\s*:\\s*`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing data property: ${dataProp}`);
          }
        } else if (rule.startsWith("vue:hook:")) {
          // Check for lifecycle hook
          const hookName = rule.substring(9);
          const regex = new RegExp(`${hookName}\\s*\\(`, "i");
          if (!regex.test(code)) {
            allRulesPassed = false;
            failedRules.push(`Missing lifecycle hook: ${hookName}`);
          }
        } else if (rule === "vue:template:syntax") {
          const hasTemplate = /<template>/.test(code);
          const hasProperSyntax = /<\/template>/.test(code);
          if (!hasTemplate || !hasProperSyntax) {
            allRulesPassed = false;
            failedRules.push("Invalid template syntax");
          }
        } else if (rule === "vue:reactive:data") {
          const hasReactiveData = /data\s*\(\s*\)|reactive\s*\(|ref\s*\(/.test(
            code
          );
          if (!hasReactiveData) {
            allRulesPassed = false;
            failedRules.push("Missing reactive data");
          }
        } else if (rule === "vue:computed:properties") {
          const hasComputed = /computed\s*:\s*\{|computed\s*\(/.test(code);
          if (!hasComputed) {
            allRulesPassed = false;
            failedRules.push("Missing computed properties");
          }
        } else if (rule === "vue:watchers") {
          const hasWatchers = /watch\s*:\s*\{|watch\s*\(/.test(code);
          if (!hasWatchers) {
            allRulesPassed = false;
            failedRules.push("Missing watchers");
          }
        } else if (rule === "vue:directives") {
          const hasDirectives = /v-if|v-for|v-bind|v-model|v-on/.test(code);
          if (!hasDirectives) {
            allRulesPassed = false;
            failedRules.push("Missing Vue directives");
          }
        } else if (rule === "vue:events") {
          const hasEvents = /@click|@input|v-on:/.test(code);
          if (!hasEvents) {
            allRulesPassed = false;
            failedRules.push("Missing event handling");
          }
        } else if (rule === "vue:props") {
          const hasProps = /props\s*:\s*\[|props\s*:\s*\{/.test(code);
          if (!hasProps) {
            allRulesPassed = false;
            failedRules.push("Missing props declaration");
          }
        } else if (rule === "vue:emits") {
          const hasEmits = /emits\s*:\s*\[|emits\s*:\s*\{/.test(code);
          if (!hasEmits) {
            allRulesPassed = false;
            failedRules.push("Missing emits declaration");
          }
        } else if (rule === "vue:slots") {
          const hasSlots = /<slot|<template #/.test(code);
          if (!hasSlots) {
            allRulesPassed = false;
            failedRules.push("Missing slots usage");
          }
        } else if (rule === "vue:provide-inject") {
          const hasProvideInject = /provide\s*\(|inject\s*:\s*\[/.test(code);
          if (!hasProvideInject) {
            allRulesPassed = false;
            failedRules.push("Missing provide/inject pattern");
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const passed = allRulesPassed;

      return {
        testCaseId: testCase.id,
        passed,
        output: passed
          ? "Vue.js validation passed"
          : `Validation failed: ${failedRules.join(", ")}`,
        error: passed ? undefined : failedRules.join(", "),
        executionTime,
      };
    } catch (error) {
      return {
        testCaseId: testCase.id,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  private static compareOutputs(actual: any, expected: string): boolean {
    // Handle different types of comparisons
    if (typeof actual === "number" && typeof expected === "string") {
      // Try to parse expected as number
      const expectedNum = parseFloat(expected);
      if (!isNaN(expectedNum)) {
        return Math.abs(actual - expectedNum) < 0.001; // Allow small floating point differences
      }
    }

    if (typeof expected === "number" && typeof actual === "string") {
      const actualNum = parseFloat(actual);
      if (!isNaN(actualNum)) {
        return Math.abs(actualNum - expected) < 0.001;
      }
    }

    // Convert both to strings for comparison
    const actualStr = String(actual).trim();
    const expectedStr = String(expected).trim();

    return actualStr === expectedStr;
  }

  static cleanup(): void {
    // Clean up old temp files (older than 1 hour)
    try {
      // Check if directory exists before trying to read it
      if (!fs.existsSync(this.SANDBOX_DIR)) {
        return; // Directory doesn't exist, nothing to clean up
      }

      const files = fs.readdirSync(this.SANDBOX_DIR);
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.SANDBOX_DIR, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime.getTime() < oneHourAgo) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn("Failed to cleanup temp files:", error);
    }
  }
}

// Cleanup on module load
CodeExecutor.cleanup();
