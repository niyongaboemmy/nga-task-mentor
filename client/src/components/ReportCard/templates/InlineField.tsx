import { useEffect, useRef, useState } from "react";

/**
 * One editable value on a report card template (the visual editor): looks
 * like the printed text, outlined on hover; click (or Enter/Space) turns it
 * into an input of the same type size. Enter or leaving keeps the change,
 * Escape puts it back. A changed value keeps a blue underline until saved.
 */
export default function InlineField({
  value,
  placeholder,
  label,
  changed,
  upper,
  disabled,
  maxLength,
  onChange,
}: {
  value: string;
  placeholder: string;
  label: string;
  changed?: boolean;
  upper?: boolean;
  disabled?: boolean;
  maxLength?: number;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) setText(value);
  }, [value, editing]);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const shown = value.trim() ? (upper ? value.toUpperCase() : value) : placeholder;
  if (editing) {
    return (
      <input
        ref={input}
        value={text}
        maxLength={maxLength}
        aria-label={label}
        data-testid={`edit-${label}`}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (text !== value) onChange(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setText(value);
            setEditing(false);
          }
        }}
        style={{
          font: "inherit",
          color: "inherit",
          textTransform: upper ? "uppercase" : "none",
          background: "#EFF6FF",
          border: "1px solid #2563EB",
          borderRadius: 4,
          padding: "0 4px",
          margin: "-1px 0",
          minWidth: 120,
          width: `${Math.max(12, text.length + 2)}ch`,
          maxWidth: "100%",
          outline: "none",
          boxShadow: "0 0 0 3px rgba(37,99,235,0.18)",
        }}
      />
    );
  }
  return (
    <span
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? undefined : 0}
      aria-label={disabled ? undefined : `Edit ${label}: ${value || "empty"}`}
      title={disabled ? undefined : `Click to edit ${label}`}
      data-testid={`field-${label}`}
      className={disabled ? undefined : "rc-inline-field"}
      onClick={() => !disabled && setEditing(true)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      style={{
        color: value.trim() ? "inherit" : "#93A4BA",
        fontStyle: value.trim() ? "normal" : "italic",
        borderBottom: changed ? "2px solid #2563EB" : undefined,
      }}
    >
      {shown}
    </span>
  );
}
