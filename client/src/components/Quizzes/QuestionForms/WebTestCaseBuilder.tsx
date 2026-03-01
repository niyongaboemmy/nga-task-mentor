/**
 * WebTestCaseBuilder.tsx
 *
 * An inline (no modal) structured validation rule builder for web languages.
 * Each rule is added as a card — no raw text needed.
 *
 * Supported rule types:
 *  - DOM: contains element, has class, has ID
 *  - Attribute: element has attribute, element attribute = value
 *  - CSS: selector → property = value
 *  - Text: element contains text
 *  - Structural: valid-structure, semantic-html, has-h1, accessibility-basics
 *  - Script: console output / returned value check (for JS/TS/Node)
 *  - React/Vue: component renders, props check
 *  - API: endpoint returns status, response body check (for Node)
 */
import React, { useState } from "react";
import { Plus, Trash2, ChevronDown, Check, X } from "lucide-react";
import { toast } from "react-toastify";

// ─── Rule type catalogue ───────────────────────────────────────────────────────
interface RuleType {
  id: string;
  label: string;
  description: string;
  languages: string[]; // "*" = all web
  fields: RuleField[];
  /** Build the rule string from field values */
  serialize: (values: Record<string, string>) => string;
}

interface RuleField {
  key: string;
  label: string;
  type: "text" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
}

const RULE_TYPES: RuleType[] = [
  // ── DOM rules (HTML, CSS)
  {
    id: "contains-tag",
    label: "Contains HTML tag",
    description: "Page must include a specific HTML element",
    languages: ["html", "css"],
    fields: [
      {
        key: "tag",
        label: "Tag name",
        type: "text",
        placeholder: "h1, nav, footer, section…",
        required: true,
      },
    ],
    serialize: (v) => `contains:${v.tag}`,
  },
  {
    id: "has-class",
    label: "Element has CSS class",
    description: "Element uses a specific class name",
    languages: ["html", "css"],
    fields: [
      {
        key: "className",
        label: "Class name (no dot)",
        type: "text",
        placeholder: "container, card, navbar…",
        required: true,
      },
    ],
    serialize: (v) => `has-class:${v.className}`,
  },
  {
    id: "has-attribute",
    label: "Element has attribute",
    description: "An element must have a specific attribute",
    languages: ["html", "css"],
    fields: [
      {
        key: "tag",
        label: "Tag",
        type: "text",
        placeholder: "input, img, a…",
        required: true,
      },
      {
        key: "attr",
        label: "Attribute",
        type: "text",
        placeholder: "alt, type, href, required…",
        required: true,
      },
    ],
    serialize: (v) => `has-attribute:${v.tag}:${v.attr}`,
  },
  {
    id: "attribute-value",
    label: "Attribute equals value",
    description: "An element attribute must equal a specific value",
    languages: ["html", "css"],
    fields: [
      {
        key: "tag",
        label: "Tag",
        type: "text",
        placeholder: "input",
        required: true,
      },
      {
        key: "attr",
        label: "Attribute",
        type: "text",
        placeholder: "type",
        required: true,
      },
      {
        key: "value",
        label: "Value",
        type: "text",
        placeholder: "email, submit…",
        required: true,
      },
    ],
    serialize: (v) => `attribute-value:${v.tag}:${v.attr}:${v.value}`,
  },
  {
    id: "text-content",
    label: "Element text content",
    description: "Page must contain specific text",
    languages: ["html", "css", "javascript", "react", "vue"],
    fields: [
      {
        key: "text",
        label: "Expected text",
        type: "text",
        placeholder: "Hello World, Submit…",
        required: true,
      },
    ],
    serialize: (v) => `text-content:${v.text}`,
  },

  // ── Structural / semantic rules
  {
    id: "structural-preset",
    label: "Structural requirement",
    description: "Enforce HTML document structure or semantics",
    languages: ["html", "css"],
    fields: [
      {
        key: "rule",
        label: "Requirement",
        type: "select",
        options: [
          { value: "valid-structure", label: "Valid HTML document structure" },
          { value: "doctype:html5", label: "HTML5 DOCTYPE declaration" },
          {
            value: "semantic-html",
            label: "Uses semantic elements (header, main, footer…)",
          },
          { value: "has-h1", label: "Contains exactly one <h1>" },
          {
            value: "accessibility-basics",
            label: "Basic accessibility (alt, aria-label…)",
          },
          {
            value: "heading-hierarchy",
            label: "Proper heading hierarchy (h1→h2→h3)",
          },
          { value: "meta-description", label: "Has <meta name='description'>" },
          { value: "responsive-viewport", label: "Has viewport meta tag" },
          {
            value: "form-validation:has-form",
            label: "Contains a <form> element",
          },
          {
            value: "form-validation:has-label",
            label: "All inputs have <label>",
          },
        ],
        required: true,
      },
    ],
    serialize: (v) => v.rule,
  },

  // ── CSS property rules
  {
    id: "css-property",
    label: "CSS property check",
    description: "A selector must use a specific CSS property+value",
    languages: ["css", "html"],
    fields: [
      {
        key: "selector",
        label: "CSS selector",
        type: "text",
        placeholder: ".container, body, nav…",
        required: true,
      },
      {
        key: "property",
        label: "Property",
        type: "text",
        placeholder: "display, color, flex-direction…",
        required: true,
      },
      {
        key: "value",
        label: "Value",
        type: "text",
        placeholder: "flex, grid, center…",
        required: true,
      },
    ],
    serialize: (v) =>
      `selector:${v.selector};property:${v.property};value:${v.value}`,
  },

  // ── JavaScript / console output
  {
    id: "console-output",
    label: "Console output equals",
    description: "console.log() must output a specific value",
    languages: ["javascript", "typescript", "nodejs"],
    fields: [
      {
        key: "expected",
        label: "Expected output",
        type: "text",
        placeholder: "true, 42, [0, 1]…",
        required: true,
      },
    ],
    serialize: (v) => v.expected,
  },
  {
    id: "return-value",
    label: "Function return value",
    description: "Function must return a specific value for given input",
    languages: ["javascript", "typescript", "nodejs"],
    fields: [
      {
        key: "input",
        label: "Function input",
        type: "text",
        placeholder: "([2,7,11,15], 9)…",
        required: true,
      },
      {
        key: "expected",
        label: "Expected return",
        type: "text",
        placeholder: "[0, 1]…",
        required: true,
      },
    ],
    serialize: (v) => `${v.input}|||${v.expected}`,
  },

  // ── React / Vue
  {
    id: "component-renders",
    label: "Component renders element",
    description: "React/Vue component must render a specific element",
    languages: ["react", "vue", "angular"],
    fields: [
      {
        key: "element",
        label: "Element/selector",
        type: "text",
        placeholder: "button, .card, [role='button']…",
        required: true,
      },
    ],
    serialize: (v) => `renders:${v.element}`,
  },
  {
    id: "component-text",
    label: "Component text content",
    description: "Component renders text with specific content",
    languages: ["react", "vue", "angular"],
    fields: [
      {
        key: "text",
        label: "Expected text",
        type: "text",
        placeholder: "Hello World…",
        required: true,
      },
    ],
    serialize: (v) => `text-content:${v.text}`,
  },
  {
    id: "state-change",
    label: "State/ interaction check",
    description: "After clicking an element, state/UI must change",
    languages: ["react", "vue"],
    fields: [
      {
        key: "trigger",
        label: "Click element",
        type: "text",
        placeholder: "button, #btn, .submit…",
        required: true,
      },
      {
        key: "expect",
        label: "Expected result",
        type: "text",
        placeholder: "counter=1, .modal.visible…",
        required: true,
      },
    ],
    serialize: (v) => `click:${v.trigger};expect:${v.expect}`,
  },

  // ── Node.js / API
  {
    id: "api-status",
    label: "API route returns status",
    description: "An HTTP route must return a specific status code",
    languages: ["nodejs"],
    fields: [
      {
        key: "method",
        label: "Method",
        type: "select",
        options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
          { value: "DELETE", label: "DELETE" },
        ],
        required: true,
      },
      {
        key: "path",
        label: "Route path",
        type: "text",
        placeholder: "/todos, /api/users…",
        required: true,
      },
      {
        key: "status",
        label: "Expected status",
        type: "select",
        options: [
          { value: "200", label: "200 OK" },
          { value: "201", label: "201 Created" },
          { value: "204", label: "204 No Content" },
          { value: "400", label: "400 Bad Request" },
          { value: "404", label: "404 Not Found" },
          { value: "500", label: "500 Server Error" },
        ],
        required: true,
      },
    ],
    serialize: (v) =>
      `{"method":"${v.method}","url":"${v.path}"}|||{"status":${v.status}}`,
  },
];

// ─── Individual rule card ──────────────────────────────────────────────────────
interface ValidationRule {
  id: string;
  typeId: string;
  values: Record<string, string>;
  points: number;
  isHidden: boolean;
}

const RuleSelector: React.FC<{
  language: string;
  onSelect: (typeId: string) => void;
  onCancel: () => void;
}> = ({ language, onSelect, onCancel }) => {
  const [search, setSearch] = useState("");

  const langKey =
    language === "html" || language === "css"
      ? language
      : language === "react" || language === "vue" || language === "angular"
        ? language
        : language === "nodejs"
          ? "nodejs"
          : language === "javascript" || language === "typescript"
            ? language
            : "*";

  const filtered = RULE_TYPES.filter((r) => {
    const matchesLang =
      r.languages.includes(langKey) ||
      r.languages.includes(language) ||
      r.languages.includes("*");
    const matchesSearch =
      !search ||
      r.label.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    return matchesLang && matchesSearch;
  });

  return (
    <div className="border-2 border-blue-300 dark:border-blue-600 rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
          Choose validation type:
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X size={14} />
        </button>
      </div>
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search rule types…"
        className="w-full px-3 py-1.5 text-xs border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2"
      />
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {filtered.map((rt) => (
          <button
            key={rt.id}
            type="button"
            onClick={() => onSelect(rt.id)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors group"
          >
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              {rt.label}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              {rt.description}
            </p>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-3">
            No matching rule types
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Active rule card ─────────────────────────────────────────────────────────
const RuleCard: React.FC<{
  rule: ValidationRule;
  index: number;
  onUpdate: (r: ValidationRule) => void;
  onDelete: () => void;
}> = ({ rule, index, onUpdate, onDelete }) => {
  const ruleType = RULE_TYPES.find((r) => r.id === rule.typeId);
  if (!ruleType) return null;

  const preview = (() => {
    try {
      return ruleType.serialize(rule.values);
    } catch {
      return "";
    }
  })();

  const isComplete = ruleType.fields
    .filter((f) => f.required)
    .every((f) => rule.values[f.key]?.trim());

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50">
        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center bg-blue-600 text-white text-[9px] font-bold rounded-full">
          {index + 1}
        </span>
        <span className="font-semibold text-xs text-gray-800 dark:text-gray-200">
          {ruleType.label}
        </span>
        {isComplete && <Check size={12} className="text-green-500 ml-1" />}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={rule.isHidden}
              onChange={(e) =>
                onUpdate({ ...rule, isHidden: e.target.checked })
              }
              className="w-3 h-3"
            />
            Hidden
          </label>
          <input
            type="number"
            value={rule.points}
            onChange={(e) =>
              onUpdate({ ...rule, points: parseInt(e.target.value) || 10 })
            }
            min={1}
            max={100}
            className="w-14 text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-right font-mono focus:outline-none"
            title="Points for this rule"
          />
          <span className="text-[9px] text-gray-400">pts</span>
          <button
            type="button"
            onClick={onDelete}
            className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="px-3 py-2 flex flex-wrap gap-2">
        {ruleType.fields.map((field) => (
          <div key={field.key} className="flex-1 min-w-[120px]">
            <label className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">
              {field.label}
            </label>
            {field.type === "select" ? (
              <div className="relative">
                <select
                  value={rule.values[field.key] ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      ...rule,
                      values: { ...rule.values, [field.key]: e.target.value },
                    })
                  }
                  className="w-full mt-1 appearance-none text-xs px-2 py-1.5 pr-6 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Select…</option>
                  {field.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={10}
                  className="absolute right-2 top-1/2 -translate-y-0 mt-0.5 text-gray-400 pointer-events-none"
                />
              </div>
            ) : (
              <input
                type="text"
                value={rule.values[field.key] ?? ""}
                onChange={(e) =>
                  onUpdate({
                    ...rule,
                    values: { ...rule.values, [field.key]: e.target.value },
                  })
                }
                placeholder={field.placeholder}
                className="w-full mt-1 text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
              />
            )}
          </div>
        ))}
      </div>

      {/* Preview */}
      {isComplete && preview && (
        <div className="px-3 py-1.5 bg-gray-50/80 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700/50">
          <span className="text-[9px] text-gray-400 uppercase font-bold mr-1">
            Rule:
          </span>
          <code className="text-[10px] text-green-600 dark:text-green-400 font-mono break-all">
            {preview}
          </code>
        </div>
      )}
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────
interface WebTestCaseBuilderProps {
  language: string;
  onTestCasesChange: (
    testCases: {
      id: string;
      input: string;
      expected_output: string;
      is_hidden: boolean;
      points: number;
    }[],
  ) => void;
  initialTestCases?: {
    id: string;
    input: string;
    expected_output: string;
    is_hidden: boolean;
    points: number;
  }[];
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

export const WebTestCaseBuilder: React.FC<WebTestCaseBuilderProps> = ({
  language,
  onTestCasesChange,
  initialTestCases: _initial,
}) => {
  const [rules, setRules] = useState<ValidationRule[]>(() => {
    if (!_initial || _initial.length === 0) return [];

    // Try to deserialize existing test cases into rules
    const deserialized: ValidationRule[] = [];

    _initial.forEach((tc) => {
      // 1. Try to find a matching rule type by prefixing
      for (const rt of RULE_TYPES) {
        // Special case for return-value (complex split)
        if (rt.id === "return-value" && tc.input.includes("|||")) {
          // This doesn't actually happen in current serialize since it joins with |||
          // but return-value serialize is `${v.input}|||${v.expected}`
          // and WebTestCaseBuilder map takes parts[0] as input.
          // Wait, serialize for return-value is `${v.input}|||${v.expected}`
          // map: input = parts[0], expected = parts[1]
          // So if we see tc.input and tc.expected_output, we can reconstruct
        }

        // Generic prefix match
        const prefix = rt.serialize({}).split(":")[0] + ":";
        if (prefix !== ":" && tc.input.startsWith(prefix)) {
          // Found potential match. Now extract fields.
          const values: Record<string, string> = {};
          const content = tc.input.slice(prefix.length);

          if (rt.id === "contains-tag") values.tag = content;
          else if (rt.id === "has-class") values.className = content;
          else if (rt.id === "text-content" || rt.id === "component-text")
            values.text = content;
          else if (rt.id === "has-attribute") {
            const p = content.split(":");
            values.tag = p[0];
            values.attr = p[1];
          } else if (rt.id === "attribute-value") {
            const p = content.split(":");
            values.tag = p[0];
            values.attr = p[1];
            values.value =
              tc.expected_output === "validation passed"
                ? p[2]
                : tc.expected_output;
          } else if (rt.id === "css-property") {
            // selector:${v.selector};property:${v.property};value:${v.value}
            const p = tc.input.split(";");
            values.selector = p[0].replace("selector:", "");
            values.property = p[1].replace("property:", "");
            values.value = p[2].replace("value:", "");
          } else if (rt.id === "component-renders") values.element = content;
          else if (rt.id === "state-change") {
            // click:${v.trigger};expect:${v.expect}
            const p = tc.input.split(";");
            values.trigger = p[0].replace("click:", "");
            values.expect = p[1].replace("expect:", "");
          }

          deserialized.push({
            id: tc.id,
            typeId: rt.id,
            values,
            points: tc.points,
            isHidden: tc.is_hidden,
          });
          return;
        }
      }

      // Check structural presets (exact matches)
      const structural = RULE_TYPES.find((r) => r.id === "structural-preset");
      const option = structural?.fields[0].options?.find(
        (o) => o.value === tc.input,
      );
      if (option) {
        deserialized.push({
          id: tc.id,
          typeId: "structural-preset",
          values: { rule: tc.input },
          points: tc.points,
          isHidden: tc.is_hidden,
        });
        return;
      }

      // Check return-value or console-output (no prefix)
      if (tc.input.includes("(") && tc.input.includes(")")) {
        deserialized.push({
          id: tc.id,
          typeId: "return-value",
          values: { input: tc.input, expected: tc.expected_output },
          points: tc.points,
          isHidden: tc.is_hidden,
        });
      } else if (language !== "html" && language !== "css") {
        deserialized.push({
          id: tc.id,
          typeId: "console-output",
          values: { expected: tc.input },
          points: tc.points,
          isHidden: tc.is_hidden,
        });
      }
    });

    return deserialized;
  });
  const [showSelector, setShowSelector] = useState(false);

  const updateRules = (next: ValidationRule[]) => {
    setRules(next);
    // Map each rule to a test case
    const testCases = next
      .filter((r) => {
        const rt = RULE_TYPES.find((t) => t.id === r.typeId);
        if (!rt) return false;
        return rt.fields
          .filter((f) => f.required)
          .every((f) => r.values[f.key]?.trim());
      })
      .map((r) => {
        const rt = RULE_TYPES.find((t) => t.id === r.typeId)!;
        const serialized = rt.serialize(r.values);
        // For function return rules, split by |||
        const parts = serialized.split("|||");
        return {
          id: r.id,
          input: parts[0] ?? serialized,
          expected_output:
            parts[1] ??
            (language === "html" || language === "css"
              ? "validation passed"
              : "true"),
          is_hidden: r.isHidden,
          points: r.points,
        };
      });

    onTestCasesChange(testCases);
  };

  const addRule = (typeId: string) => {
    const newRule: ValidationRule = {
      id: makeId(),
      typeId,
      values: {},
      points: 10,
      isHidden: false,
    };
    updateRules([...rules, newRule]);
    setShowSelector(false);
  };

  const updateRule = (idx: number, updated: ValidationRule) => {
    const next = [...rules];
    next[idx] = updated;
    updateRules(next);
  };

  const deleteRule = (idx: number) => {
    const next = rules.filter((_, i) => i !== idx);
    updateRules(next);
    toast.success("Rule removed", { autoClose: 1500 });
  };

  const completedCount = rules.filter((r) => {
    const rt = RULE_TYPES.find((t) => t.id === r.typeId);
    return rt?.fields
      .filter((f) => f.required)
      .every((f) => r.values[f.key]?.trim());
  }).length;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Validation Rules
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {rules.length === 0
              ? "Add rules to define what the student's code must do"
              : `${completedCount}/${rules.length} rule${rules.length !== 1 ? "s" : ""} defined`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSelector(!showSelector)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg font-semibold transition-all"
        >
          <Plus size={13} /> Add Rule
        </button>
      </div>

      {/* Rule type selector */}
      {showSelector && (
        <RuleSelector
          language={language}
          onSelect={addRule}
          onCancel={() => setShowSelector(false)}
        />
      )}

      {/* Rule cards */}
      {rules.length > 0 ? (
        <div className="space-y-2">
          {rules.map((rule, i) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={i}
              onUpdate={(r) => updateRule(i, r)}
              onDelete={() => deleteRule(i)}
            />
          ))}
        </div>
      ) : (
        !showSelector && (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-3xl mb-2">🧩</p>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              No validation rules yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              Click "Add Rule" to define what the student must implement
            </p>
          </div>
        )
      )}

      {/* Summary */}
      {completedCount > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2 flex items-center gap-2">
          <Check size={14} className="text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-green-800 dark:text-green-200">
              {completedCount} rule{completedCount !== 1 ? "s" : ""} ready ·{" "}
              {rules.reduce((s, r) => s + r.points, 0)} total points
            </p>
            <p className="text-[10px] text-green-600 dark:text-green-400 font-mono mt-0.5 truncate">
              {rules
                .map((r) => {
                  const rt = RULE_TYPES.find((t) => t.id === r.typeId);
                  return rt?.serialize(r.values) ?? "";
                })
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
