/**
 * HTML Keywords Helper - TypeScript Module
 * Provides HTML validation keywords for coding question test cases
 */

export interface KeywordItem {
  keyword: string;
  desc: string;
}

export interface HtmlKeywordsHelperType {
  documentStructure: KeywordItem[];
  contentElements: KeywordItem[];
  semanticsAccessibility: KeywordItem[];
  formsInteraction: KeywordItem[];
  advancedHtml5: KeywordItem[];
  seoSocial: KeywordItem[];
  performanceSecurity: KeywordItem[];
  getAllKeywords(): KeywordItem[];
  getKeywordsByCategory(category: string): KeywordItem[];
  searchKeywords(query: string): KeywordItem[];
  formatForTestCase(keywords: KeywordItem[]): string;
  getUsageInstructions(): string;
}

export const HtmlKeywordsHelper: HtmlKeywordsHelperType = {
  // Document Structure
  documentStructure: [
    { keyword: "doctype:html5", desc: "HTML5 DOCTYPE declaration" },
    { keyword: "valid-structure", desc: "Complete HTML document structure" },
    { keyword: "character-encoding", desc: "UTF-8 character encoding" },
    { keyword: "lang-attribute", desc: "Language attribute on html" },
    { keyword: "proper-closing-tags", desc: "All tags properly opened/closed" },
  ],

  // Content & Elements
  contentElements: [
    { keyword: "contains:h1", desc: "Must include h1 element" },
    { keyword: "count:p:2", desc: "Must have exactly 2 paragraphs" },
    {
      keyword: "has-attribute:img:alt",
      desc: "Images must have alt attribute",
    },
    {
      keyword: "attribute-value:meta:name:viewport",
      desc: "Meta tag with specific name",
    },
    { keyword: "text-content:Hello World", desc: "Must contain specific text" },
    { keyword: "has-class:container", desc: "Element with specific class" },
    { keyword: "has-id:main", desc: "Element with specific ID" },
  ],

  // Semantics & Accessibility
  semanticsAccessibility: [
    { keyword: "semantic-html", desc: "Use semantic HTML elements" },
    { keyword: "accessibility-basics", desc: "Basic accessibility checks" },
    { keyword: "aria:describedby", desc: "ARIA describedby attribute" },
    { keyword: "role:main", desc: "ARIA role attribute" },
    { keyword: "heading-hierarchy", desc: "Proper heading structure" },
    { keyword: "has-h1", desc: "Must include h1 element" },
    { keyword: "heading-content", desc: "Headings must have content" },
  ],

  // Forms & Interaction
  formsInteraction: [
    { keyword: "form-validation:has-form", desc: "Must include form element" },
    {
      keyword: "form-validation:has-submit",
      desc: "Form must have submit button",
    },
    {
      keyword: "form-validation:has-label",
      desc: "Form inputs must have labels",
    },
    { keyword: "form-method:post", desc: "Form must use POST method" },
    { keyword: "form-action", desc: "Form must have action attribute" },
    { keyword: "input-type:email", desc: "Must include email input" },
    { keyword: "data-list", desc: "Must include datalist element" },
    { keyword: "output-element", desc: "Must include output element" },
  ],

  // Advanced HTML5
  advancedHtml5: [
    { keyword: "canvas-element", desc: "Must include canvas element" },
    { keyword: "svg-inline", desc: "Must include inline SVG" },
    { keyword: "video-element", desc: "Must include video element" },
    { keyword: "audio-element", desc: "Must include audio element" },
    { keyword: "progress-element", desc: "Must include progress element" },
    { keyword: "meter-element", desc: "Must include meter element" },
    { keyword: "details-summary", desc: "Must include details/summary" },
    { keyword: "dialog-element", desc: "Must include dialog element" },
    { keyword: "template-element", desc: "Must include template element" },
    { keyword: "custom-elements", desc: "Must include custom elements" },
    { keyword: "time-element", desc: "Must include time element" },
    { keyword: "mark-element", desc: "Must include mark element" },
  ],

  // SEO & Social Media
  seoSocial: [
    { keyword: "open-graph", desc: "Must include Open Graph tags" },
    { keyword: "twitter-cards", desc: "Must include Twitter Card tags" },
    { keyword: "microdata-schema", desc: "Must include schema.org microdata" },
    { keyword: "meta-description", desc: "Must include meta description" },
    { keyword: "meta-author", desc: "Must include meta author" },
    { keyword: "meta-keywords", desc: "Must include meta keywords" },
  ],

  // Performance & Security
  performanceSecurity: [
    { keyword: "resource-hints", desc: "Must include resource hints" },
    { keyword: "lazy-loading", desc: "Must use lazy loading" },
    { keyword: "csp-meta", desc: "Must include Content Security Policy" },
    { keyword: "sri-integrity", desc: "Must use Subresource Integrity" },
    { keyword: "async-defer", desc: "Must use async/defer on scripts" },
    { keyword: "no-inline-js", desc: "Must avoid inline JavaScript" },
    {
      keyword: "no-inline-event-handlers",
      desc: "Must avoid inline event handlers",
    },
  ],

  /**
   * Get all HTML keywords as a flat array
   */
  getAllKeywords(): KeywordItem[] {
    return [
      ...this.documentStructure,
      ...this.contentElements,
      ...this.semanticsAccessibility,
      ...this.formsInteraction,
      ...this.advancedHtml5,
      ...this.seoSocial,
      ...this.performanceSecurity,
    ];
  },

  /**
   * Get keywords by category
   */
  getKeywordsByCategory(category: string): KeywordItem[] {
    return (this as any)[category] || [];
  },

  /**
   * Search keywords by description or keyword text
   */
  searchKeywords(query: string): KeywordItem[] {
    const allKeywords = this.getAllKeywords();
    const lowerQuery = query.toLowerCase();
    return allKeywords.filter(
      (item) =>
        item.keyword.toLowerCase().includes(lowerQuery) ||
        item.desc.toLowerCase().includes(lowerQuery)
    );
  },

  /**
   * Get keywords formatted for test case input
   */
  formatForTestCase(keywords: KeywordItem[]): string {
    return keywords.map((item) => item.keyword).join(";");
  },

  /**
   * Get usage instructions
   */
  getUsageInstructions(): string {
    return `
HTML Validation Keywords Usage:
• Single keyword: Use one keyword like "semantic-html"
• Multiple keywords: Separate with semicolons like "semantic-html;accessibility-basics;heading-hierarchy"
• Expected output: For HTML validation, use "HTML validation passed"
• Combine with other languages: Keywords only work for HTML language selection
    `.trim();
  },
};

export default HtmlKeywordsHelper;
