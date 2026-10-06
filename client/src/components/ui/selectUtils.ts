import React from "react";

export interface SelectOption {
  kind: "option";
  key: string;
  value: string;
  label: string;
  disabled: boolean;
}
export interface SelectGroup {
  kind: "group";
  key: string;
  label: string;
}
export type SelectItem = SelectOption | SelectGroup;

/** Text of an <option>'s children: strings, numbers, arrays, fragments. */
export function nodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (React.isValidElement(node)) {
    return nodeText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

/**
 * Flatten <option> / <optgroup> children (through fragments, arrays and
 * conditionals) into list items, like a browser builds a select's options.
 */
export function parseSelectChildren(children: React.ReactNode): {
  items: SelectItem[];
  options: SelectOption[];
} {
  const items: SelectItem[] = [];
  const options: SelectOption[] = [];
  let n = 0;

  const walk = (nodes: React.ReactNode, groupDisabled: boolean) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return;
      const props = child.props as {
        value?: string | number;
        disabled?: boolean;
        label?: string;
        children?: React.ReactNode;
      };
      if (child.type === React.Fragment) {
        walk(props.children, groupDisabled);
      } else if (child.type === "optgroup") {
        items.push({ kind: "group", key: `g${n++}`, label: String(props.label ?? "") });
        walk(props.children, groupDisabled || !!props.disabled);
      } else if (child.type === "option") {
        const label = nodeText(props.children).trim();
        const opt: SelectOption = {
          kind: "option",
          key: `o${n++}`,
          // a native option without a value attribute submits its text
          value: props.value !== undefined && props.value !== null ? String(props.value) : label,
          label,
          disabled: groupDisabled || !!props.disabled,
        };
        items.push(opt);
        options.push(opt);
      }
    });
  };
  walk(children, false);
  return { items, options };
}

const LAYOUT = [
  /^-?m[trblxyse]?-/, // margins
  /^(w|min-w|max-w)-/,
  /^(flex|grow|shrink|basis|order)(-|$)/,
  /^(col|row)-(span|start|end)-/,
  /^(self|justify-self|place-self)-/,
  /^(hidden|block|inline-block|inline-flex|flex|contents)$/,
];

/**
 * Keep only the classes that place the control (width, margins, flex/grid
 * placement, responsive visibility), so a caller's old padding, border or
 * colour classes can't make one select look different from the others.
 */
export function layoutClasses(className: string): string {
  return className
    .split(/\s+/)
    .filter(Boolean)
    .filter((cls) => {
      const base = cls.split(":").pop() || "";
      return LAYOUT.some((re) => re.test(base));
    })
    .join(" ");
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Case- and accent-insensitive "contains". */
export const matchesQuery = (label: string, query: string) => fold(label).includes(fold(query.trim()));
