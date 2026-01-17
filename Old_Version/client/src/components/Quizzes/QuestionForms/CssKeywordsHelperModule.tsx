/**
 * CSS Keywords Helper - TypeScript Module
 * Provides CSS validation keywords for coding question test cases
 */

export interface KeywordItem {
  keyword: string;
  desc: string;
}

export interface CssKeywordsHelperType {
  basicSelectors: KeywordItem[];
  advancedSelectors: KeywordItem[];
  layoutPositioning: KeywordItem[];
  responsiveDesign: KeywordItem[];
  animationsEffects: KeywordItem[];
  colorsTypography: KeywordItem[];
  validationStructure: KeywordItem[];
  getAllKeywords(): KeywordItem[];
  getKeywordsByCategory(category: string): KeywordItem[];
  searchKeywords(query: string): KeywordItem[];
  formatForTestCase(keywords: KeywordItem[]): string;
  getUsageInstructions(): string;
}

export const CssKeywordsHelper: CssKeywordsHelperType = {
  // Basic Selectors & Properties
  basicSelectors: [
    {
      keyword: "selector:.class-name",
      desc: "Must include specific class selector",
    },
    { keyword: "selector:#id-name", desc: "Must include specific ID selector" },
    { keyword: "selector:element", desc: "Must include element selector" },
    { keyword: "property:display", desc: "Must include display property" },
    { keyword: "property:color", desc: "Must include color property" },
    {
      keyword: "property:background",
      desc: "Must include background property",
    },
    { keyword: "value:display=flex", desc: "Must have display:flex" },
    { keyword: "value:color=#333", desc: "Must have specific color value" },
  ],

  // Advanced Selectors
  advancedSelectors: [
    { keyword: "pseudo-class:hover", desc: "Must include :hover pseudo-class" },
    { keyword: "pseudo-class:focus", desc: "Must include :focus pseudo-class" },
    {
      keyword: "pseudo-element:before",
      desc: "Must include ::before pseudo-element",
    },
    {
      keyword: "pseudo-element:after",
      desc: "Must include ::after pseudo-element",
    },
    {
      keyword: "combinator:descendant",
      desc: "Must use descendant combinator (space)",
    },
    { keyword: "combinator:child", desc: "Must use child combinator (>)" },
    { keyword: "combinator:adjacent", desc: "Must use adjacent sibling (+)" },
  ],

  // Layout & Positioning
  layoutPositioning: [
    { keyword: "layout:flexbox", desc: "Must include flexbox layout" },
    { keyword: "layout:grid", desc: "Must include CSS grid layout" },
    {
      keyword: "layout:positioning",
      desc: "Must include advanced positioning",
    },
    {
      keyword: "has-property:.container:flex-direction",
      desc: "Container must have flex-direction",
    },
    {
      keyword: "property-value:.header:position:fixed",
      desc: "Header must be position:fixed",
    },
    {
      keyword: "count-selectors:class:3",
      desc: "Must have at least 3 class selectors",
    },
  ],

  // Responsive Design
  responsiveDesign: [
    {
      keyword: "responsive-design",
      desc: "Must include responsive design patterns",
    },
    {
      keyword: "media-query:(max-width: 768px)",
      desc: "Must include mobile media query",
    },
    {
      keyword: "media-query:(min-width: 1024px)",
      desc: "Must include desktop media query",
    },
    { keyword: "property:width", desc: "Must include width property" },
    { keyword: "value:width=100%", desc: "Must have width: 100%" },
  ],

  // Animations & Effects
  animationsEffects: [
    {
      keyword: "animation:keyframes",
      desc: "Must include @keyframes animation",
    },
    { keyword: "animation:transition", desc: "Must include CSS transition" },
    { keyword: "animation:transform", desc: "Must include CSS transform" },
    { keyword: "property:animation", desc: "Must include animation property" },
    {
      keyword: "property:transition",
      desc: "Must include transition property",
    },
    { keyword: "property:transform", desc: "Must include transform property" },
  ],

  // Colors & Typography
  colorsTypography: [
    { keyword: "color:hex", desc: "Must include hex color values" },
    { keyword: "color:rgb", desc: "Must include RGB color values" },
    { keyword: "color:hsl", desc: "Must include HSL color values" },
    { keyword: "font:family", desc: "Must include font-family" },
    { keyword: "font:size", desc: "Must include font-size" },
    { keyword: "font:weight", desc: "Must include font-weight" },
    { keyword: "property:line-height", desc: "Must include line-height" },
    { keyword: "property:text-align", desc: "Must include text-align" },
  ],

  // Validation & Structure
  validationStructure: [
    { keyword: "valid-css", desc: "Basic CSS structure validation" },
    { keyword: "not-contains:important", desc: "Should not use !important" },
    {
      keyword: "not-contains:inline-styles",
      desc: "Should avoid inline styles",
    },
    { keyword: "property:margin", desc: "Must include margin property" },
    { keyword: "property:padding", desc: "Must include padding property" },
    { keyword: "property:border", desc: "Must include border property" },
  ],

  /**
   * Get all CSS keywords as a flat array
   */
  getAllKeywords(): KeywordItem[] {
    return [
      ...this.basicSelectors,
      ...this.advancedSelectors,
      ...this.layoutPositioning,
      ...this.responsiveDesign,
      ...this.animationsEffects,
      ...this.colorsTypography,
      ...this.validationStructure,
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
CSS Validation Keywords Usage:
• Single keyword: Use one keyword like "selector:.container"
• Multiple keywords: Separate with semicolons like "selector:.container;property:display;value:display=flex"
• Expected output: For CSS validation, use "CSS validation passed"
• Combine with other languages: Keywords only work for CSS language selection
    `.trim();
  },
};

export default CssKeywordsHelper;
