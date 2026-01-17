import React, { useState, useEffect } from "react";
import type {
  QuestionComponentProps,
  CodingData,
  CodingAnswer,
  AnswerDataType,
} from "../../../types/quiz.types";
import { Play, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { CodeEditor } from "../CodeEditor";
import { CodePreviewModal } from "../CodePreviewModal";

// Extended answer type for component state management
interface CodingAnswerWithState extends CodingAnswer {
  score?: number;
  testResults?: any[];
  submitted?: boolean;
}

export const CodingQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
}) => {
  const codingData: CodingData = question.question_data as CodingData;

  const [code, setCode] = useState(
    (answer as CodingAnswer)?.code || codingData.starter_code || ""
  );
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (answer) {
      const codingAnswer = answer as CodingAnswerWithState;
      if (codingAnswer?.code) {
        setCode(codingAnswer.code);
        setSubmitted(codingAnswer.submitted || false);
        setScore(codingAnswer.score || 0);
        if (codingAnswer.testResults) {
          setTestResults(codingAnswer.testResults);
        }
      }
    }
  }, [answer]);

  const executeCode = (testCase: {
    input: string;
    expected_output: string;
    is_hidden: boolean;
    points: number;
  }) => {
    try {
      // Handle different languages appropriately
      if (codingData.language.toLowerCase() === "html") {
        // For HTML, validate structure instead of executing
        return validateHTML(code, testCase);
      } else if (codingData.language.toLowerCase() === "css") {
        // For CSS, validate selectors and properties
        return validateCSS(code, testCase);
      } else {
        // For executable languages (JavaScript, Python, etc.)
        const func = new Function(`
          ${code}
          try {
            return String(${testCase.input});
          } catch (e) {
            throw e;
          }
        `);

        const result = func();
        return { success: true, output: result };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const validateProperTagClosing = (htmlCode: string) => {
    const errors: string[] = [];
    const tagStack: string[] = [];
    const selfClosingTags = new Set([
      "area",
      "base",
      "br",
      "col",
      "embed",
      "hr",
      "img",
      "input",
      "link",
      "meta",
      "param",
      "source",
      "track",
      "wbr",
    ]);

    // Regex to match HTML tags: <tag> or </tag> or <tag/> or <tag />
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?\/?>/g;
    let match;

    while ((match = tagRegex.exec(htmlCode)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      const isClosingTag = fullTag.startsWith("</");
      const isSelfClosingSyntax =
        fullTag.endsWith("/>") || fullTag.endsWith("/ >");

      if (isClosingTag) {
        // Closing tag
        if (tagStack.length === 0) {
          errors.push(
            `Unexpected closing tag </${tagName}> - no matching opening tag`
          );
        } else {
          const lastOpenedTag = tagStack.pop();
          if (lastOpenedTag !== tagName) {
            errors.push(
              `Mismatched tags: expected </${lastOpenedTag}> but found </${tagName}>`
            );
          }
        }
      } else {
        // Opening tag
        if (selfClosingTags.has(tagName) || isSelfClosingSyntax) {
          // Self-closing tag - don't push to stack
          if (isSelfClosingSyntax && !selfClosingTags.has(tagName)) {
            errors.push(
              `Tag <${tagName}> should not be self-closed; use </${tagName}> to close it`
            );
          }
        } else {
          // Regular opening tag - push to stack
          tagStack.push(tagName);
        }
      }
    }

    // Check for unclosed tags
    while (tagStack.length > 0) {
      const unclosedTag = tagStack.pop();
      errors.push(`Unclosed tag <${unclosedTag}> - missing </${unclosedTag}>`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const validateHTML = (htmlCode: string, testCase: any) => {
    // For HTML validation, check if the code contains required elements
    const validationRules = testCase.input
      .split(";")
      .map((rule: string) => rule.trim());

    let allRulesPassed = true;
    const failedRules: string[] = [];

    for (const rule of validationRules) {
      if (rule.startsWith("contains:")) {
        const tag = rule.substring(9); // Skip "contains:" (9 chars)
        const regex = new RegExp(`<${tag}[^>]*>`, "i");
        if (!regex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push(`Missing <${tag}> tag`);
        }
      } else if (rule.startsWith("has-attribute:")) {
        const attrSpec = rule.substring(14); // Skip "has-attribute:" (14 chars)
        const [tag, attr] = attrSpec.split(":");
        const regex = new RegExp(`<${tag}[^>]*${attr}[^>]*>`, "i");
        if (!regex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push(`Missing ${attr} attribute on <${tag}>`);
        }
      } else if (rule.startsWith("count:")) {
        const countSpec = rule.substring(6);
        const [tag, minCount] = countSpec.split(":");
        const regex = new RegExp(`<${tag}[^>]*>`, "gi");
        const matches = htmlCode.match(regex);
        const count = matches ? matches.length : 0;
        if (count < parseInt(minCount)) {
          allRulesPassed = false;
          failedRules.push(
            `Expected at least ${minCount} <${tag}> tags, found ${count}`
          );
        }
      } else if (rule === "valid-structure") {
        const hasDoctype = /<!DOCTYPE html>/i.test(htmlCode);
        const hasHtml = /<html[^>]*>/i.test(htmlCode);
        const hasHead = /<head[^>]*>/i.test(htmlCode);
        const hasBody = /<body[^>]*>/i.test(htmlCode);

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
          return !regex.test(htmlCode);
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
        if (!regex.test(htmlCode)) {
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
        if (!regex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push(`<${tag}> must have ${attr}="${expectedValue}"`);
        }
      } else if (rule.startsWith("not-contains:")) {
        // Check that HTML does NOT contain specific elements
        const tag = rule.substring(13);
        const regex = new RegExp(`<${tag}[^>]*>`, "i");
        if (regex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push(`Should not contain <${tag}> tag`);
        }
      } else if (rule.startsWith("required-attribute:")) {
        // Check for required attributes on specific elements
        const reqSpec = rule.substring(18);
        const [tag, attr] = reqSpec.split(":");
        const tagRegex = new RegExp(`<${tag}[^>]*>`, "gi");
        const attrRegex = new RegExp(`${attr}\\s*=\\s*["'][^"']*["']`, "i");

        const tagMatches = htmlCode.match(tagRegex);
        if (tagMatches) {
          const missingAttrTags = tagMatches.filter(
            (match) => !attrRegex.test(match)
          );
          if (missingAttrTags.length > 0) {
            allRulesPassed = false;
            failedRules.push(`<${tag}> elements must have ${attr} attribute`);
          }
        }
      } else if (rule.startsWith("title:")) {
        // Check for title tag with specific content
        const expectedTitle = rule.substring(6);
        const titleRegex = /<title[^>]*>([^<]*)<\/title>/i;
        const match = htmlCode.match(titleRegex);
        if (!match || match[1].trim() !== expectedTitle) {
          allRulesPassed = false;
          failedRules.push(`Page title must be "${expectedTitle}"`);
        }
      } else if (rule === "has-title") {
        // Check for presence of title tag
        const titleRegex = /<title[^>]*>.*<\/title>/i;
        if (!titleRegex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push("Missing <title> tag in <head>");
        }
      } else if (rule === "lang-attribute") {
        // Check for lang attribute on html element
        const langRegex = /<html[^>]*lang\s*=\s*["'][^"']*["'][^>]*>/i;
        if (!langRegex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push("Missing lang attribute on <html> element");
        }
      } else if (rule === "viewport-meta") {
        // Check for viewport meta tag
        const viewportRegex = /<meta[^>]*name\s*=\s*["']viewport["'][^>]*>/i;
        if (!viewportRegex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push("Missing viewport meta tag for responsive design");
        }
      } else if (rule === "charset-meta") {
        // Check for charset meta tag
        const charsetRegex = /<meta[^>]*charset\s*=\s*["'][^"']*["'][^>]*>/i;
        if (!charsetRegex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push("Missing charset meta tag");
        }
      } else if (rule.startsWith("heading-hierarchy")) {
        // Check for proper heading hierarchy (h1 before h2, etc.)
        const headings = [];
        for (let i = 1; i <= 6; i++) {
          const regex = new RegExp(`<h${i}[^>]*>`, "gi");
          const matches = htmlCode.match(regex);
          if (matches) headings.push(...matches.map(() => i));
        }

        let hasHierarchyIssue = false;
        let lastLevel = 0;
        for (const level of headings) {
          if (level > lastLevel + 1) {
            hasHierarchyIssue = true;
            break;
          }
          lastLevel = level;
        }

        if (hasHierarchyIssue) {
          allRulesPassed = false;
          failedRules.push(
            "Heading hierarchy is not proper (h1, then h2, etc.)"
          );
        }
      } else if (rule === "has-h1") {
        // Check for h1 element
        const h1Regex = /<h1[^>]*>/i;
        if (!h1Regex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push("Missing <h1> element");
        }
      } else if (rule.startsWith("form-validation:")) {
        // Check form structure
        const formReq = rule.substring(15);
        if (formReq === "has-form") {
          const formRegex = /<form[^>]*>/i;
          if (!formRegex.test(htmlCode)) {
            allRulesPassed = false;
            failedRules.push("Missing <form> element");
          }
        } else if (formReq === "has-submit") {
          const submitRegex =
            /<input[^>]*type\s*=\s*["']submit["'][^>]*>|<button[^>]*type\s*=\s*["']submit["'][^>]*>/i;
          if (!submitRegex.test(htmlCode)) {
            allRulesPassed = false;
            failedRules.push("Form missing submit button");
          }
        } else if (formReq === "has-label") {
          const inputRegex = /<input[^>]*>/gi;
          const labelRegex = /<label[^>]*>/gi;
          const inputs = htmlCode.match(inputRegex) || [];
          const labels = htmlCode.match(labelRegex) || [];
          if (inputs.length > labels.length) {
            allRulesPassed = false;
            failedRules.push("Some form inputs are missing associated labels");
          }
        }
      } else if (rule.startsWith("table-structure")) {
        // Check table structure
        const hasTable = /<table[^>]*>/i.test(htmlCode);
        const hasThead = /<thead[^>]*>/i.test(htmlCode);
        const hasTbody = /<tbody[^>]*>/i.test(htmlCode);
        const hasTh = /<th[^>]*>/i.test(htmlCode);

        if (hasTable && (!hasThead || !hasTbody || !hasTh)) {
          allRulesPassed = false;
          failedRules.push(
            "Table structure incomplete (missing thead, tbody, or th elements)"
          );
        }
      } else if (rule.startsWith("list-structure")) {
        // Check list structure
        const ulRegex = /<ul[^>]*>/gi;
        const olRegex = /<ol[^>]*>/gi;
        const liRegex = /<li[^>]*>/gi;

        const uls = htmlCode.match(ulRegex) || [];
        const ols = htmlCode.match(olRegex) || [];
        const lis = htmlCode.match(liRegex) || [];

        if (uls.length + ols.length > 0 && lis.length === 0) {
          allRulesPassed = false;
          failedRules.push("Lists must contain <li> elements");
        }
      } else if (rule.startsWith("no-inline-styles")) {
        // Check for absence of inline styles
        const styleRegex = /style\s*=\s*["'][^"']*["']/i;
        if (styleRegex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push("Avoid inline styles; use external CSS instead");
        }
      } else if (rule.startsWith("has-class:")) {
        // Check for specific CSS classes
        const className = rule.substring(10);
        const classRegex = new RegExp(
          `class\s*=\s*["'][^"']*${className}[^"']*["']`,
          "i"
        );
        if (!classRegex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push(`Missing CSS class "${className}"`);
        }
      } else if (rule.startsWith("has-id:")) {
        // Check for specific IDs
        const idName = rule.substring(7);
        const idRegex = new RegExp(`id\s*=\s*["']${idName}["']`, "i");
        if (!idRegex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push(`Missing element with id "${idName}"`);
        }
      } else if (rule.startsWith("text-content:")) {
        // Check for specific text content
        const expectedText = rule.substring(13);
        if (!htmlCode.includes(expectedText)) {
          allRulesPassed = false;
          failedRules.push(`Missing text content: "${expectedText}"`);
        }
      } else if (rule.startsWith("element-order:")) {
        // Check element order
        const orderSpec = rule.substring(14);
        const [first, second] = orderSpec.split(",");
        const firstIndex = htmlCode.indexOf(`<${first}`);
        const secondIndex = htmlCode.indexOf(`<${second}`);

        if (
          firstIndex === -1 ||
          secondIndex === -1 ||
          firstIndex > secondIndex
        ) {
          allRulesPassed = false;
          failedRules.push(`<${first}> should appear before <${second}>`);
        }
      } else if (rule.startsWith("role:")) {
        // Check for ARIA roles
        const roleName = rule.substring(5);
        const roleRegex = new RegExp(`role\s*=\s*["']${roleName}["']`, "i");
        if (!roleRegex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push(`Missing element with role "${roleName}"`);
        }
      } else if (rule === "accessibility-basics") {
        // Basic accessibility checks
        const imgWithoutAlt = /<img[^>]*>/gi;
        const imgs = htmlCode.match(imgWithoutAlt) || [];
        const imgsWithAlt = imgs.filter((img) =>
          /alt\s*=\s*["'][^"']*["']/i.test(img)
        );

        if (imgs.length > imgsWithAlt.length) {
          allRulesPassed = false;
          failedRules.push("All <img> elements must have alt attributes");
        }

        // Check for links without href
        const linksWithoutHref = /<a[^>]*>/gi;
        const links = htmlCode.match(linksWithoutHref) || [];
        const linksWithHref = links.filter((link) =>
          /href\s*=\s*["'][^"']*["']/i.test(link)
        );

        if (links.length > linksWithHref.length) {
          allRulesPassed = false;
          failedRules.push("All <a> elements must have href attributes");
        }
      } else if (rule.startsWith("max-nesting:")) {
        // Check maximum nesting depth
        const maxDepth = parseInt(rule.substring(12));
        let maxFoundDepth = 0;
        let currentDepth = 0;

        const tagRegex = /<\/?[^>]+>/g;
        const matches = htmlCode.match(tagRegex) || [];

        for (const match of matches) {
          if (!match.startsWith("</")) {
            currentDepth++;
            maxFoundDepth = Math.max(maxFoundDepth, currentDepth);
          } else {
            currentDepth--;
          }
        }

        if (maxFoundDepth > maxDepth) {
          allRulesPassed = false;
          failedRules.push(
            `HTML nesting depth exceeds maximum of ${maxDepth} levels`
          );
        }
      } else if (rule.startsWith("doctype:")) {
        // Check for specific DOCTYPE
        const expectedDoctype = rule.substring(8);
        if (expectedDoctype === "html5") {
          const hasDoctype = /<!DOCTYPE html>/i.test(htmlCode);
          if (!hasDoctype) {
            allRulesPassed = false;
            failedRules.push(
              "Missing HTML5 DOCTYPE declaration: <!DOCTYPE html>"
            );
          }
        } else if (expectedDoctype === "xhtml") {
          const hasXhtmlDoctype = /<!DOCTYPE html PUBLIC[^>]*>/.test(htmlCode);
          if (!hasXhtmlDoctype) {
            allRulesPassed = false;
            failedRules.push("Missing XHTML DOCTYPE declaration");
          }
        }
      } else if (rule === "external-css") {
        // Check for external CSS link
        const hasExternalCss =
          /<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["'][^"']*\.css[^"']*["'][^>]*>/i.test(
            htmlCode
          );
        if (!hasExternalCss) {
          allRulesPassed = false;
          failedRules.push("Missing external CSS stylesheet link");
        }
      } else if (rule === "favicon") {
        // Check for favicon link
        const hasFavicon =
          /<link[^>]*rel\s*=\s*["'](icon|shortcut icon)["'][^>]*href[^>]*>/i.test(
            htmlCode
          );
        if (!hasFavicon) {
          allRulesPassed = false;
          failedRules.push("Missing favicon link in <head>");
        }
      } else if (rule === "external-js") {
        // Check for external JavaScript
        const hasExternalJs =
          /<script[^>]*src\s*=\s*["'][^"']*\.js[^"']*["'][^>]*><\/script>/i.test(
            htmlCode
          );
        if (!hasExternalJs) {
          allRulesPassed = false;
          failedRules.push("Missing external JavaScript file");
        }
      } else if (rule === "no-inline-js") {
        // Check for absence of inline JavaScript
        const hasInlineJs =
          /<script[^>]*>[^<]*<\/script>/i.test(htmlCode) &&
          !/<script[^>]*src\s*=\s*["'][^"']*["'][^>]*><\/script>/i.test(
            htmlCode
          );
        if (hasInlineJs) {
          allRulesPassed = false;
          failedRules.push(
            "Avoid inline JavaScript; use external files instead"
          );
        }
      } else if (rule === "image-src") {
        // Check that all images have src attribute
        const imgWithoutSrc = /<img[^>]*>/gi;
        const imgs = htmlCode.match(imgWithoutSrc) || [];
        const imgsWithSrc = imgs.filter((img) =>
          /src\s*=\s*["'][^"']*["']/i.test(img)
        );

        if (imgs.length > imgsWithSrc.length) {
          allRulesPassed = false;
          failedRules.push("All <img> elements must have src attribute");
        }
      } else if (rule === "link-target-blank") {
        // Check for target="_blank" on external links
        const externalLinks =
          /<a[^>]*href\s*=\s*["']https?:\/\/[^"']*["'][^>]*>/gi;
        const links = htmlCode.match(externalLinks) || [];
        const linksWithTarget = links.filter((link) =>
          /target\s*=\s*["']_blank["']/i.test(link)
        );

        if (links.length > linksWithTarget.length) {
          allRulesPassed = false;
          failedRules.push(
            "External links should have target='_blank' for security"
          );
        }
      } else if (rule.startsWith("form-method:")) {
        // Check form method
        const expectedMethod = rule.substring(12);
        const formRegex = new RegExp(
          `<form[^>]*method\s*=\s*["']${expectedMethod}["'][^>]*>`,
          "i"
        );
        if (!formRegex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push(`Form should use method="${expectedMethod}"`);
        }
      } else if (rule === "form-action") {
        // Check that form has action attribute
        const formWithoutAction = /<form[^>]*>/gi;
        const forms = htmlCode.match(formWithoutAction) || [];
        const formsWithAction = forms.filter((form) =>
          /action\s*=\s*["'][^"']*["']/i.test(form)
        );

        if (forms.length > formsWithAction.length) {
          allRulesPassed = false;
          failedRules.push("Form elements must have action attribute");
        }
      } else if (rule.startsWith("input-type:")) {
        // Check for specific input types
        const inputType = rule.substring(11);
        const inputRegex = new RegExp(
          `<input[^>]*type\s*=\s*["']${inputType}["'][^>]*>`,
          "i"
        );
        if (!inputRegex.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push(`Missing input element with type="${inputType}"`);
        }
      } else if (rule === "table-caption") {
        // Check for table captions
        const hasTable = /<table[^>]*>/i.test(htmlCode);
        const hasCaption = /<caption[^>]*>/i.test(htmlCode);

        if (hasTable && !hasCaption) {
          allRulesPassed = false;
          failedRules.push(
            "Tables should have <caption> elements for accessibility"
          );
        }
      } else if (rule === "table-summary") {
        // Check for table summary (deprecated but still used)
        const hasTable = /<table[^>]*>/i.test(htmlCode);
        const hasSummary = /<table[^>]*summary\s*=\s*["'][^"']*["']/i.test(
          htmlCode
        );

        if (hasTable && !hasSummary) {
          allRulesPassed = false;
          failedRules.push(
            "Tables should have summary attribute (deprecated but accessible)"
          );
        }
      } else if (rule === "nested-lists") {
        // Check for proper list nesting
        const ulRegex = /<ul[^>]*>/gi;
        const olRegex = /<ol[^>]*>/gi;
        const nestedUl = /<ul[^>]*>[\s\S]*?<ul[^>]*>/i.test(htmlCode);
        const nestedOl = /<ol[^>]*>[\s\S]*?<ol[^>]*>/i.test(htmlCode);

        if (
          (ulRegex.test(htmlCode) || olRegex.test(htmlCode)) &&
          !nestedUl &&
          !nestedOl
        ) {
          // This is actually fine - not all lists need to be nested
          // Maybe check for mixed nesting or invalid nesting instead
        }
      } else if (rule === "heading-content") {
        // Check that headings have content
        const emptyHeadings = /<h[1-6][^>]*><\/h[1-6]>/gi;
        if (emptyHeadings.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push("Heading elements should not be empty");
        }
      } else if (rule === "main-content") {
        // Check that main element has content
        const mainRegex = /<main[^>]*>([\s\S]*?)<\/main>/i;
        const match = htmlCode.match(mainRegex);
        if (match && match[1].trim().length === 0) {
          allRulesPassed = false;
          failedRules.push("<main> element should contain content");
        }
      } else if (rule === "navigation-links") {
        // Check that nav element contains links
        const navRegex = /<nav[^>]*>([\s\S]*?)<\/nav>/i;
        const match = htmlCode.match(navRegex);
        if (match && !/<a[^>]*href[^>]*>/i.test(match[1])) {
          allRulesPassed = false;
          failedRules.push("<nav> element should contain navigation links");
        }
      } else if (rule === "no-inline-event-handlers") {
        // Check for inline event handlers
        const inlineEvents = /on\w+\s*=\s*["'][^"']*["']/i;
        if (inlineEvents.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push(
            "Avoid inline event handlers; use addEventListener instead"
          );
        }
      } else if (rule === "data-attributes") {
        // Check for custom data attributes
        const hasDataAttrs = /data-[a-zA-Z][a-zA-Z0-9-]*\s*=\s*["'][^"']*["']/i;
        if (!hasDataAttrs.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push(
            "Use custom data attributes (data-*) for JavaScript interaction"
          );
        }
      } else if (rule === "no-deprecated-elements") {
        // Check for deprecated elements
        const deprecatedElements = [
          "font",
          "center",
          "big",
          "strike",
          "tt",
          "u",
          "basefont",
          "dir",
          "isindex",
          "listing",
          "plaintext",
          "xmp",
        ];
        const foundDeprecated = deprecatedElements.filter((tag) => {
          const regex = new RegExp(`<${tag}[^>]*>`, "i");
          return regex.test(htmlCode);
        });

        if (foundDeprecated.length > 0) {
          allRulesPassed = false;
          failedRules.push(
            `Avoid deprecated elements: ${foundDeprecated.join(", ")}`
          );
        }
      } else if (rule === "valid-attributes") {
        // Check for valid HTML attributes (basic check)
        const invalidAttrs = ["align", "bgcolor", "border", "hspace", "vspace"];
        const foundInvalid = invalidAttrs.filter((attr) => {
          const regex = new RegExp(`${attr}\\s*=\\s*["'][^"']*["']`, "i");
          return regex.test(htmlCode);
        });

        if (foundInvalid.length > 0) {
          allRulesPassed = false;
          failedRules.push(
            `Avoid deprecated attributes: ${foundInvalid.join(", ")}`
          );
        }
      } else if (rule === "character-encoding") {
        // Check for proper character encoding
        const hasEncoding =
          /<meta[^>]*charset\s*=\s*["'](utf-8|utf8)["']/i.test(htmlCode);
        if (!hasEncoding) {
          allRulesPassed = false;
          failedRules.push(
            "Use UTF-8 character encoding: <meta charset='utf-8'>"
          );
        }
      } else if (rule === "html-comments") {
        // Check for HTML comments
        const hasComments = /<!--[\s\S]*?-->/;
        if (!hasComments.test(htmlCode)) {
          allRulesPassed = false;
          failedRules.push("Include HTML comments to explain code structure");
        }
      } else if (rule === "semantic-structure") {
        // Comprehensive semantic structure check
        const hasHeader = /<header[^>]*>/i.test(htmlCode);
        const hasNav = /<nav[^>]*>/i.test(htmlCode);
        const hasMain = /<main[^>]*>/i.test(htmlCode);
        const hasAside = /<aside[^>]*>/i.test(htmlCode);
        const hasFooter = /<footer[^>]*>/i.test(htmlCode);

        const semanticScore = [
          hasHeader,
          hasNav,
          hasMain,
          hasAside,
          hasFooter,
        ].filter(Boolean).length;

        if (semanticScore < 3) {
          allRulesPassed = false;
          failedRules.push(
            "Use more semantic HTML elements (header, nav, main, aside, footer)"
          );
        }
      } else if (rule === "microdata-schema") {
        // Check for schema.org microdata
        const hasMicrodata =
          /itemtype\s*=\s*["'][^"']*schema\.org[^"']*["']/i.test(htmlCode) ||
          /itemprop\s*=\s*["'][^"']*["']/i.test(htmlCode);
        if (!hasMicrodata) {
          allRulesPassed = false;
          failedRules.push("Include schema.org structured data (microdata)");
        }
      } else if (rule === "open-graph") {
        // Check for Open Graph meta tags
        const ogTags = ["og:title", "og:type", "og:url", "og:image"];
        const missingOg = ogTags.filter((tag) => {
          const regex = new RegExp(`property\s*=\s*["']${tag}["']`, "i");
          return !regex.test(htmlCode);
        });

        if (missingOg.length > 0) {
          allRulesPassed = false;
          failedRules.push(`Missing Open Graph tags: ${missingOg.join(", ")}`);
        }
      } else if (rule === "twitter-cards") {
        // Check for Twitter Card meta tags
        const twitterTags = [
          "twitter:card",
          "twitter:title",
          "twitter:description",
        ];
        const missingTwitter = twitterTags.filter((tag) => {
          const regex = new RegExp(`name\s*=\s*["']${tag}["']`, "i");
          return !regex.test(htmlCode);
        });

        if (missingTwitter.length > 0) {
          allRulesPassed = false;
          failedRules.push(
            `Missing Twitter Card tags: ${missingTwitter.join(", ")}`
          );
        }
      } else if (rule === "canvas-element") {
        // Check for HTML5 Canvas element
        const hasCanvas = /<canvas[^>]*>/i.test(htmlCode);
        if (!hasCanvas) {
          allRulesPassed = false;
          failedRules.push(
            "Include HTML5 <canvas> element for dynamic graphics"
          );
        }
      } else if (rule === "svg-inline") {
        // Check for inline SVG
        const hasSvg = /<svg[^>]*>/i.test(htmlCode);
        if (!hasSvg) {
          allRulesPassed = false;
          failedRules.push("Include inline SVG for scalable graphics");
        }
      } else if (rule === "video-element") {
        // Check for HTML5 video element
        const hasVideo = /<video[^>]*>/i.test(htmlCode);
        if (!hasVideo) {
          allRulesPassed = false;
          failedRules.push("Include HTML5 <video> element");
        }
      } else if (rule === "audio-element") {
        // Check for HTML5 audio element
        const hasAudio = /<audio[^>]*>/i.test(htmlCode);
        if (!hasAudio) {
          allRulesPassed = false;
          failedRules.push("Include HTML5 <audio> element");
        }
      } else if (rule === "progress-element") {
        // Check for progress element
        const hasProgress = /<progress[^>]*>/i.test(htmlCode);
        if (!hasProgress) {
          allRulesPassed = false;
          failedRules.push(
            "Include <progress> element for progress indication"
          );
        }
      } else if (rule === "meter-element") {
        // Check for meter element
        const hasMeter = /<meter[^>]*>/i.test(htmlCode);
        if (!hasMeter) {
          allRulesPassed = false;
          failedRules.push("Include <meter> element for measurements");
        }
      } else if (rule === "details-summary") {
        // Check for details/summary elements
        const hasDetails = /<details[^>]*>/i.test(htmlCode);
        const hasSummary = /<summary[^>]*>/i.test(htmlCode);

        if (!hasDetails || !hasSummary) {
          allRulesPassed = false;
          failedRules.push(
            "Include <details> and <summary> elements for collapsible content"
          );
        }
      } else if (rule === "dialog-element") {
        // Check for dialog element
        const hasDialog = /<dialog[^>]*>/i.test(htmlCode);
        if (!hasDialog) {
          allRulesPassed = false;
          failedRules.push("Include <dialog> element for modal dialogs");
        }
      } else if (rule === "template-element") {
        // Check for template element
        const hasTemplate = /<template[^>]*>/i.test(htmlCode);
        if (!hasTemplate) {
          allRulesPassed = false;
          failedRules.push("Include <template> element for reusable HTML");
        }
      } else if (rule === "custom-elements") {
        // Check for custom elements (web components)
        const hasCustomElement = /<[^>]*-[^>]*>/g;
        const matches = htmlCode.match(hasCustomElement) || [];
        const customElements = matches.filter((tag) => {
          const tagName = tag.match(/^<([a-zA-Z][a-zA-Z0-9]*)/)?.[1];
          return (
            tagName &&
            tagName.includes("-") &&
            !["data-", "aria-"].some((prefix) => tagName.startsWith(prefix))
          );
        });

        if (customElements.length === 0) {
          allRulesPassed = false;
          failedRules.push(
            "Include custom elements (web components) with hyphenated names"
          );
        }
      } else if (rule === "shadow-dom-ready") {
        // Check for elements that work well with Shadow DOM
        const hasSlots = /<slot[^>]*>/i.test(htmlCode);
        if (!hasSlots) {
          allRulesPassed = false;
          failedRules.push(
            "Include <slot> elements for Shadow DOM composition"
          );
        }
      } else if (rule === "noscript-element") {
        // Check for noscript element
        const hasNoscript = /<noscript[^>]*>/i.test(htmlCode);
        if (!hasNoscript) {
          allRulesPassed = false;
          failedRules.push(
            "Include <noscript> element for graceful degradation"
          );
        }
      } else if (rule === "html-entities") {
        // Check for proper HTML entities
        const hasEntities = /&[a-zA-Z0-9#]+;/g.test(htmlCode);
        if (!hasEntities) {
          allRulesPassed = false;
          failedRules.push(
            "Use HTML entities for special characters (&, <, etc.)"
          );
        }
      } else if (rule === "resource-hints") {
        // Check for resource hints
        const hints = [
          "dns-prefetch",
          "preconnect",
          "prefetch",
          "preload",
          "prerender",
        ];
        const hasHints = hints.some((hint) => {
          const regex = new RegExp(`rel\s*=\s*["']${hint}["']`, "i");
          return regex.test(htmlCode);
        });

        if (!hasHints) {
          allRulesPassed = false;
          failedRules.push(
            "Include resource hints (dns-prefetch, preload, etc.) for performance"
          );
        }
      } else if (rule === "critical-css") {
        // Check for critical CSS (inline styles in head)
        const hasCriticalCss = /<style[^>]*>[\s\S]*?<\/style>/i.test(htmlCode);
        if (!hasCriticalCss) {
          allRulesPassed = false;
          failedRules.push(
            "Include critical CSS inline in <head> for performance"
          );
        }
      } else if (rule === "csp-meta") {
        // Check for Content Security Policy
        const hasCsp = /http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(
          htmlCode
        );
        if (!hasCsp) {
          allRulesPassed = false;
          failedRules.push(
            "Include Content Security Policy meta tag for security"
          );
        }
      } else if (rule === "sri-integrity") {
        // Check for Subresource Integrity
        const hasSri = /integrity\s*=\s*["']sha[0-9]+-[^"']*["']/i.test(
          htmlCode
        );
        if (!hasSri) {
          allRulesPassed = false;
          failedRules.push(
            "Include integrity attributes for Subresource Integrity"
          );
        }
      } else if (rule === "lazy-loading") {
        // Check for lazy loading on images
        const hasLazy = /loading\s*=\s*["']lazy["']/i.test(htmlCode);
        if (!hasLazy) {
          allRulesPassed = false;
          failedRules.push("Use lazy loading for images: loading='lazy'");
        }
      } else if (rule === "async-defer") {
        // Check for async/defer on scripts
        const hasAsyncDefer =
          /<(script[^>]*(?:async|defer)[^>]*src[^>]*)>/i.test(htmlCode);
        if (!hasAsyncDefer) {
          allRulesPassed = false;
          failedRules.push(
            "Use async or defer attributes on script tags for performance"
          );
        }
      } else if (rule === "picture-element") {
        // Check for responsive images with picture element
        const hasPicture = /<picture[^>]*>/i.test(htmlCode);
        if (!hasPicture) {
          allRulesPassed = false;
          failedRules.push("Use <picture> element for responsive images");
        }
      } else if (rule === "source-element") {
        // Check for source elements in media
        const hasSource = /<source[^>]*>/i.test(htmlCode);
        if (!hasSource) {
          allRulesPassed = false;
          failedRules.push(
            "Include <source> elements for multiple media formats"
          );
        }
      } else if (rule === "track-element") {
        // Check for track elements in media
        const hasTrack = /<track[^>]*>/i.test(htmlCode);
        if (!hasTrack) {
          allRulesPassed = false;
          failedRules.push(
            "Include <track> elements for media captions/subtitles"
          );
        }
      } else if (rule === "figure-figcaption") {
        // Check for figure and figcaption elements
        const hasFigure = /<figure[^>]*>/i.test(htmlCode);
        const hasFigcaption = /<figcaption[^>]*>/i.test(htmlCode);

        if (!hasFigure || !hasFigcaption) {
          allRulesPassed = false;
          failedRules.push("Use <figure> and <figcaption> for image captions");
        }
      } else if (rule === "time-element") {
        // Check for time element
        const hasTime = /<time[^>]*>/i.test(htmlCode);
        if (!hasTime) {
          allRulesPassed = false;
          failedRules.push("Include <time> element for datetime information");
        }
      } else if (rule === "mark-element") {
        // Check for mark element
        const hasMark = /<mark[^>]*>/i.test(htmlCode);
        if (!hasMark) {
          allRulesPassed = false;
          failedRules.push("Use <mark> element to highlight text");
        }
      } else if (rule === "ruby-text") {
        // Check for ruby annotations
        const hasRuby = /<ruby[^>]*>/i.test(htmlCode);
        const hasRt = /<rt[^>]*>/i.test(htmlCode);

        if (!hasRuby || !hasRt) {
          allRulesPassed = false;
          failedRules.push(
            "Include <ruby> and <rt> elements for East Asian text annotations"
          );
        }
      } else if (rule === "bdi-element") {
        // Check for bdi element
        const hasBdi = /<bdi[^>]*>/i.test(htmlCode);
        if (!hasBdi) {
          allRulesPassed = false;
          failedRules.push(
            "Use <bdi> element for bidirectional text isolation"
          );
        }
      } else if (rule === "wbr-element") {
        // Check for wbr element
        const hasWbr = /<wbr[^>]*>/i.test(htmlCode);
        if (!hasWbr) {
          allRulesPassed = false;
          failedRules.push(
            "Include <wbr> element for word break opportunities"
          );
        }
      } else if (rule === "data-list") {
        // Check for datalist element
        const hasDatalist = /<datalist[^>]*>/i.test(htmlCode);
        if (!hasDatalist) {
          allRulesPassed = false;
          failedRules.push("Include <datalist> element for input suggestions");
        }
      } else if (rule === "output-element") {
        // Check for output element
        const hasOutput = /<output[^>]*>/i.test(htmlCode);
        if (!hasOutput) {
          allRulesPassed = false;
          failedRules.push("Include <output> element for calculation results");
        }
      } else if (rule === "keygen-deprecated") {
        // Check that keygen is not used (deprecated)
        const hasKeygen = /<keygen[^>]*>/i.test(htmlCode);
        if (hasKeygen) {
          allRulesPassed = false;
          failedRules.push(
            "<keygen> element is deprecated and should not be used"
          );
        }
      } else if (rule === "applet-deprecated") {
        // Check that applet is not used (deprecated)
        const hasApplet = /<applet[^>]*>/i.test(htmlCode);
        if (hasApplet) {
          allRulesPassed = false;
          failedRules.push(
            "<applet> element is deprecated; use <object> or <embed> instead"
          );
        }
      } else if (rule === "frames-deprecated") {
        // Check that frames are not used (deprecated)
        const hasFrames = /<(frame|frameset)[^>]*>/i.test(htmlCode);
        if (hasFrames) {
          allRulesPassed = false;
          failedRules.push("Frames are deprecated; use CSS for layout instead");
        }
      } else if (rule === "proper-closing-tags") {
        // Check that all tags are properly closed
        const validationResult = validateProperTagClosing(htmlCode);
        if (!validationResult.isValid) {
          allRulesPassed = false;
          failedRules.push(...validationResult.errors);
        }
      }
    }

    return {
      success: allRulesPassed,
      output: allRulesPassed
        ? "HTML validation passed"
        : `Validation failed: ${failedRules.join(", ")}`,
      error: allRulesPassed ? undefined : failedRules.join(", "),
    };
  };

  const validateCSS = (cssCode: string, testCase: any) => {
    // For CSS validation, check for required selectors and properties
    const validationRules = testCase.input
      .split(";")
      .map((rule: string) => rule.trim());

    let allRulesPassed = true;
    const failedRules: string[] = [];

    for (const rule of validationRules) {
      if (rule.startsWith("selector:")) {
        const selector = rule.substring(9);
        if (!cssCode.includes(selector)) {
          allRulesPassed = false;
          failedRules.push(`Missing selector: ${selector}`);
        }
      } else if (rule.startsWith("property:")) {
        const property = rule.substring(9);
        const regex = new RegExp(`${property}\\s*:`, "i");
        if (!regex.test(cssCode)) {
          allRulesPassed = false;
          failedRules.push(`Missing CSS property: ${property}`);
        }
      } else if (rule.startsWith("value:")) {
        const valueSpec = rule.substring(6);
        const [property, value] = valueSpec.split("=");
        const regex = new RegExp(`${property}\\s*:\\s*${value}`, "i");
        if (!regex.test(cssCode)) {
          allRulesPassed = false;
          failedRules.push(`Missing CSS value: ${property}: ${value}`);
        }
      }
    }

    return {
      success: allRulesPassed,
      output: allRulesPassed
        ? "CSS validation passed"
        : `Validation failed: ${failedRules.join(", ")}`,
      error: allRulesPassed ? undefined : failedRules.join(", "),
    };
  };

  const getUserFriendlyTestDescription = (input: string, language: string) => {
    if (language.toLowerCase() === "html") {
      const rules = input.split(";").map((r) => r.trim());
      const descriptions = rules.map((rule) => {
        if (rule.startsWith("contains:")) {
          const tag = rule.substring(9);
          return `Include <${tag}> element`;
        } else if (rule.startsWith("has-attribute:")) {
          const [tag, attr] = rule.substring(14).split(":");
          return `Add ${attr} attribute to <${tag}>`;
        } else if (rule.startsWith("count:")) {
          const [tag, minCount] = rule.substring(6).split(":");
          return `Use at least ${minCount} <${tag}> elements`;
        } else if (rule === "valid-structure") {
          return "Include proper HTML document structure";
        } else if (rule === "semantic-html") {
          return "Use semantic HTML elements (header, nav, main, etc.)";
        } else if (rule.startsWith("aria:")) {
          const attr = rule.substring(5);
          return `Add aria-${attr} for accessibility`;
        } else if (rule.startsWith("attribute-value:")) {
          const [tag, attr, value] = rule.substring(15).split(":");
          return `Set ${attr}="${value}" on <${tag}>`;
        } else if (rule.startsWith("not-contains:")) {
          const tag = rule.substring(13);
          return `Avoid using <${tag}> elements`;
        } else if (rule.startsWith("required-attribute:")) {
          const [tag, attr] = rule.substring(18).split(":");
          return `All <${tag}> elements need ${attr} attribute`;
        } else if (rule.startsWith("title:")) {
          const title = rule.substring(6);
          return `Set page title to "${title}"`;
        } else if (rule === "has-title") {
          return "Include a <title> tag";
        } else if (rule === "lang-attribute") {
          return "Add lang attribute to <html>";
        } else if (rule === "viewport-meta") {
          return "Include viewport meta tag";
        } else if (rule === "charset-meta") {
          return "Include charset meta tag";
        } else if (rule.startsWith("heading-hierarchy")) {
          return "Use proper heading hierarchy (h1, h2, etc.)";
        } else if (rule === "has-h1") {
          return "Include an <h1> element";
        } else if (rule.startsWith("form-validation:")) {
          const req = rule.substring(15);
          if (req === "has-form") return "Include a <form> element";
          if (req === "has-submit") return "Add a submit button to forms";
          if (req === "has-label") return "Label all form inputs";
        } else if (rule.startsWith("table-structure")) {
          return "Use proper table structure";
        } else if (rule.startsWith("list-structure")) {
          return "Structure lists properly";
        } else if (rule.startsWith("no-inline-styles")) {
          return "Avoid inline CSS styles";
        } else if (rule.startsWith("has-class:")) {
          const className = rule.substring(10);
          return `Include CSS class "${className}"`;
        } else if (rule.startsWith("has-id:")) {
          const idName = rule.substring(7);
          return `Include element with id "${idName}"`;
        } else if (rule.startsWith("text-content:")) {
          const text = rule.substring(13);
          return `Include text: "${text}"`;
        } else if (rule.startsWith("element-order:")) {
          const [first, second] = rule.substring(14).split(",");
          return `Place <${first}> before <${second}>`;
        } else if (rule.startsWith("role:")) {
          const roleName = rule.substring(5);
          return `Include element with role "${roleName}"`;
        } else if (rule === "accessibility-basics") {
          return "Follow basic accessibility guidelines";
        } else if (rule.startsWith("max-nesting:")) {
          const depth = rule.substring(12);
          return `Keep HTML nesting under ${depth} levels`;
        } else if (rule.startsWith("doctype:")) {
          const doctype = rule.substring(8);
          return `Use ${doctype.toUpperCase()} DOCTYPE declaration`;
        } else if (rule === "external-css") {
          return "Include external CSS stylesheet";
        } else if (rule === "favicon") {
          return "Add favicon to the page";
        } else if (rule === "external-js") {
          return "Include external JavaScript file";
        } else if (rule === "no-inline-js") {
          return "Avoid inline JavaScript code";
        } else if (rule === "image-src") {
          return "All images must have src attribute";
        } else if (rule === "link-target-blank") {
          return "External links should open in new tab";
        } else if (rule.startsWith("form-method:")) {
          const method = rule.substring(12);
          return `Form should use ${method.toUpperCase()} method`;
        } else if (rule === "form-action") {
          return "Form must have action attribute";
        } else if (rule.startsWith("input-type:")) {
          const type = rule.substring(11);
          return `Include ${type} input element`;
        } else if (rule === "table-caption") {
          return "Tables should have captions";
        } else if (rule === "table-summary") {
          return "Tables should have summary attribute";
        } else if (rule === "nested-lists") {
          return "Use proper list nesting structure";
        } else if (rule === "heading-content") {
          return "Headings should not be empty";
        } else if (rule === "main-content") {
          return "Main element should have content";
        } else if (rule === "navigation-links") {
          return "Navigation should contain links";
        } else if (rule === "no-inline-event-handlers") {
          return "Avoid inline event handlers";
        } else if (rule === "data-attributes") {
          return "Use custom data attributes";
        } else if (rule === "no-deprecated-elements") {
          return "Avoid deprecated HTML elements";
        } else if (rule === "valid-attributes") {
          return "Use valid HTML attributes only";
        } else if (rule === "character-encoding") {
          return "Specify UTF-8 character encoding";
        } else if (rule === "html-comments") {
          return "Include HTML comments";
        } else if (rule === "microdata-schema") {
          return "Include schema.org structured data";
        } else if (rule === "open-graph") {
          return "Add Open Graph meta tags for social sharing";
        } else if (rule === "twitter-cards") {
          return "Include Twitter Card meta tags";
        } else if (rule === "canvas-element") {
          return "Use HTML5 Canvas for dynamic graphics";
        } else if (rule === "svg-inline") {
          return "Include inline SVG graphics";
        } else if (rule === "video-element") {
          return "Add HTML5 video element";
        } else if (rule === "audio-element") {
          return "Include HTML5 audio element";
        } else if (rule === "progress-element") {
          return "Use progress element for progress bars";
        } else if (rule === "meter-element") {
          return "Include meter element for measurements";
        } else if (rule === "details-summary") {
          return "Use details and summary for collapsible content";
        } else if (rule === "dialog-element") {
          return "Include dialog element for modals";
        } else if (rule === "template-element") {
          return "Use template element for reusable HTML";
        } else if (rule === "custom-elements") {
          return "Implement custom elements (web components)";
        } else if (rule === "shadow-dom-ready") {
          return "Include slot elements for Shadow DOM";
        } else if (rule === "noscript-element") {
          return "Add noscript for graceful degradation";
        } else if (rule === "html-entities") {
          return "Use HTML entities for special characters";
        } else if (rule === "resource-hints") {
          return "Include resource hints for performance";
        } else if (rule === "critical-css") {
          return "Add critical CSS inline in head";
        } else if (rule === "csp-meta") {
          return "Include Content Security Policy";
        } else if (rule === "sri-integrity") {
          return "Use Subresource Integrity attributes";
        } else if (rule === "lazy-loading") {
          return "Implement lazy loading for images";
        } else if (rule === "async-defer") {
          return "Use async/defer on script tags";
        } else if (rule === "picture-element") {
          return "Use picture element for responsive images";
        } else if (rule === "source-element") {
          return "Include source elements for media";
        } else if (rule === "track-element") {
          return "Add track elements for media captions";
        } else if (rule === "figure-figcaption") {
          return "Use figure and figcaption for images";
        } else if (rule === "time-element") {
          return "Include time element for dates/times";
        } else if (rule === "mark-element") {
          return "Use mark element to highlight text";
        } else if (rule === "ruby-text") {
          return "Include ruby annotations for East Asian text";
        } else if (rule === "bdi-element") {
          return "Use bdi for bidirectional text isolation";
        } else if (rule === "wbr-element") {
          return "Include wbr for word break opportunities";
        } else if (rule === "data-list") {
          return "Add datalist for input suggestions";
        } else if (rule === "output-element") {
          return "Use output element for form results";
        } else if (rule === "keygen-deprecated") {
          return "Avoid deprecated keygen element";
        } else if (rule === "applet-deprecated") {
          return "Avoid deprecated applet element";
        } else if (rule === "frames-deprecated") {
          return "Avoid deprecated frame elements";
        } else if (rule === "semantic-structure") {
          return "Use comprehensive semantic HTML structure";
        } else if (rule === "proper-closing-tags") {
          return "Ensure all HTML tags are properly opened and closed";
        }
        return rule; // fallback to original rule
      });
      return descriptions.join("; ");
    }
    return input; // for other languages, show original input
  };

  const runTests = () => {
    setIsRunning(true);

    setTimeout(() => {
      const results = codingData.test_cases.map((testCase, idx) => {
        const result = executeCode(testCase);

        if (!result.success) {
          return {
            testCase: idx + 1,
            input: getUserFriendlyTestDescription(
              testCase.input,
              codingData.language
            ),
            expected: testCase.expected_output,
            actual: null,
            error: result.error,
            passed: false,
            hidden: testCase.is_hidden,
          };
        }

        const passed =
          String(result.output).trim() ===
          String(testCase.expected_output).trim();
        return {
          testCase: idx + 1,
          input: getUserFriendlyTestDescription(
            testCase.input,
            codingData.language
          ),
          expected: testCase.expected_output,
          actual: result.output,
          passed,
          hidden: testCase.is_hidden,
        };
      });

      setTestResults(results);
      setIsRunning(false);
    }, 500);
  };

  const handleSubmit = () => {
    runTests();
    setSubmitted(true);

    setTimeout(() => {
      const results = codingData.test_cases.map((testCase) => {
        const result = executeCode(testCase);
        if (!result.success) return false;
        return (
          String(result.output).trim() ===
          String(testCase.expected_output).trim()
        );
      });

      const passedTests = results.filter(Boolean).length;
      const totalTests = codingData.test_cases.length;
      const calculatedScore =
        totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

      setScore(calculatedScore);

      const codingAnswer: CodingAnswerWithState = {
        code,
        language: codingData.language,
        score: calculatedScore,
        testResults: results,
        submitted: true,
      };

      onAnswerChange(codingAnswer as AnswerDataType);
    }, 600);
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (!submitted) {
      const codingAnswer: CodingAnswerWithState = {
        code: newCode,
        language: codingData.language,
        score: 0,
        submitted: false,
      };
      onAnswerChange(codingAnswer as AnswerDataType);
    }
  };

  const visibleResults = testResults.filter((r) => !r.hidden);
  const allPassed =
    testResults.length > 0 && testResults.every((r) => r.passed);

  const uiLanguages = ["html", "css", "react", "vue", "angular", "nextjs"];
  const canPreview = uiLanguages.includes(codingData.language.toLowerCase());

  return (
    <div className="space-y-6">
      {/* Code Editor */}
      <CodeEditor
        value={code}
        onChange={handleCodeChange}
        language={codingData.language}
        disabled={disabled || submitted}
        placeholder={`// Write your ${codingData.language} solution here...\n// Make sure to test your code before submitting!`}
        onPreview={canPreview ? () => setIsPreviewOpen(true) : undefined}
      />
      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={runTests}
          disabled={disabled || isRunning || submitted}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-2xl hover:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="w-4 h-4" />
          {isRunning ? "Running..." : "Run Tests"}
        </button>

        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={
              disabled || isRunning || code === (codingData.starter_code || "")
            }
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-2xl hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-600 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Submit Solution
          </button>
        )}
      </div>
      {/* Test Results */}
      {visibleResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-6">
          <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <span>🧪</span>
            Test Results
          </h3>
          <div className="space-y-3">
            {visibleResults.map((result, idx) => (
              <div
                key={idx}
                className={`border rounded-2xl p-4 ${
                  result.passed
                    ? "border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
                    : "border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.passed ? (
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-base mb-2 text-gray-900 dark:text-gray-100">
                      Test Case {result.testCase}
                    </div>
                    <div className="text-sm mb-2 text-gray-700 dark:text-gray-300">
                      {result.input}
                    </div>
                    {result.error ? (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-red-800 dark:text-red-200">
                            <div className="font-medium mb-1">
                              Execution Error:
                            </div>
                            <div className="text-xs">{result.error}</div>
                          </div>
                        </div>
                      </div>
                    ) : result.passed ? (
                      <div className="text-sm text-green-800 dark:text-green-200 font-medium">
                        ✓ Test passed - Output matches expected result
                      </div>
                    ) : (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-red-800 dark:text-red-200">
                            <div className="font-medium mb-1">
                              Output mismatch:
                            </div>
                            <div className="text-xs space-y-1">
                              <div>
                                <strong>Expected:</strong> {result.expected}
                              </div>
                              <div>
                                <strong>Got:</strong> {result.actual}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Submission Status */}
      {submitted && (
        <div
          className={`border-2 rounded-2xl p-6 ${
            allPassed
              ? "border-green-300 dark:border-green-700 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
              : "border-yellow-300 dark:border-yellow-700 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20"
          }`}
        >
          <div className="flex items-start gap-4">
            {allPassed ? (
              <div className="bg-green-500 text-white rounded-full p-3">
                <CheckCircle className="w-8 h-8" />
              </div>
            ) : (
              <div className="bg-yellow-500 text-white rounded-full p-3">
                <AlertCircle className="w-8 h-8" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-2xl mb-2 text-gray-900 dark:text-white">
                {allPassed ? "🎉 Perfect Score!" : "✅ Solution Submitted"}
              </h3>
              <div className="flex items-center gap-4 mb-3">
                <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-2 border-2 border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Score
                  </span>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {score.toFixed(0)}%
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-2 border-2 border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Tests Passed
                  </span>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {testResults.filter((r) => r.passed).length}/
                    {testResults.length}
                  </p>
                </div>
              </div>
              {allPassed ? (
                <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                  Excellent work! Your solution passed all test cases including
                  hidden ones.
                </p>
              ) : (
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Your solution has been recorded. Review the test results above
                  to see which cases need improvement.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Correct Answer (for review mode) */}
      {showCorrectAnswer && question.correct_answer && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-4">
          <h3 className="font-semibold text-lg mb-2 text-blue-900 dark:text-blue-100">
            Model Solution
          </h3>
          <pre className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-blue-200 dark:border-blue-700 overflow-x-auto">
            <code className="text-sm font-mono text-gray-900 dark:text-gray-100">
              {typeof question.correct_answer === "string"
                ? question.correct_answer
                : JSON.stringify(question.correct_answer, null, 2)}
            </code>
          </pre>
        </div>
      )}

      {/* Code Preview Modal */}
      <CodePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        code={code}
        language={codingData.language}
      />
    </div>
  );
};

export default CodingQuestion;
