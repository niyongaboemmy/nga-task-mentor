/**
 * ConstraintChips.tsx
 *
 * A quick-add constraint chip selector. Users can click chips to append
 * standard constraints to the textarea, saving time and encouraging best practices.
 */
import React from "react";
import { Plus } from "lucide-react";

export interface ConstraintCategory {
  label: string;
  chips: string[];
}

const COMMON_CONSTRAINTS: Record<string, ConstraintCategory[]> = {
  web: [
    {
      label: "Architecture",
      chips: [
        "Mobile-first approach",
        "Responsive on all screens",
        "Component-based architecture",
      ],
    },
    {
      label: "CSS/Styling",
      chips: [
        "Use Flexbox",
        "Use CSS Grid",
        "No inline styles",
        "BEM naming convention",
      ],
    },
    {
      label: "Accessibility",
      chips: [
        "Keyboard navigable",
        "Screen reader friendly",
        "WCAG AA contrast",
      ],
    },
    {
      label: "JavaScript",
      chips: [
        "Use ES6+ syntax",
        "No global variables",
        "Async/await for promises",
      ],
    },
  ],
  react: [
    {
      label: "React Best Practices",
      chips: [
        "Functional components only",
        "Use custom hooks",
        "No direct DOM manipulation",
        "Memoize expensive renders",
      ],
    },
  ],
  nodejs: [
    {
      label: "Node/API",
      chips: [
        "RESTful routing",
        "Input validation required",
        "Proper error handling",
        "Use environment variables",
      ],
    },
  ],
  general: [
    {
      label: "Complexity",
      chips: [
        "O(N) time complexity",
        "O(1) space complexity",
        "In-place modification",
      ],
    },
    {
      label: "Style",
      chips: [
        "Follow DRY principle",
        "Add JSDoc comments",
        "Descriptive variable names",
      ],
    },
  ],
};

interface ConstraintChipsProps {
  language: string;
  currentText: string;
  onChange: (newText: string) => void;
}

export const ConstraintChips: React.FC<ConstraintChipsProps> = ({
  language,
  currentText,
  onChange,
}) => {
  // Determine relevant categories based on language
  const categories: ConstraintCategory[] = [];

  if (
    [
      "html",
      "css",
      "javascript",
      "typescript",
      "react",
      "vue",
      "angular",
    ].includes(language)
  ) {
    categories.push(...COMMON_CONSTRAINTS.web);
  }
  if (language === "react") {
    categories.push(...COMMON_CONSTRAINTS.react);
  }
  if (language === "nodejs") {
    categories.push(...COMMON_CONSTRAINTS.nodejs);
  }
  categories.push(...COMMON_CONSTRAINTS.general);

  const appendConstraint = (chip: string) => {
    const trimmed = currentText.trim();
    if (trimmed.includes(chip)) return; // Don't duplicate

    // Check if we already have a numbered or bulleted list
    const lines = trimmed.split("\\n");
    const lastLine = lines[lines.length - 1] || "";

    let prefix = "- ";
    if (lastLine.match(/^\\d+\\./)) {
      // It's a numbered list, figure out the next number
      const match = lastLine.match(/^(\\d+)\\./);
      if (match) {
        prefix = `${parseInt(match[1]) + 1}. `;
      }
    } else if (trimmed && !lastLine.match(/^[-*]/)) {
      // It's just text, start a bullet list on a new line
      prefix = "\\n- ";
    }

    const separator = trimmed ? (trimmed.endsWith("\\n") ? "" : "\\n") : "";
    onChange(trimmed + separator + prefix + chip);
  };

  return (
    <div className="space-y-3 mt-3">
      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
        Quick-add standard constraints
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {categories.map((cat, i) => (
          <div key={i} className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-semibold">
              {cat.label}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {cat.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => appendConstraint(chip)}
                  disabled={currentText.includes(chip)}
                  className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={10} /> {chip}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
