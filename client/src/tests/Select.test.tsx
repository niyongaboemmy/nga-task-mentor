import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import Select from "../components/ui/Select";
import { layoutClasses, parseSelectChildren } from "../components/ui/selectUtils";

/** The app-wide select: native-compatible API, custom listbox. */

function Controlled(props: { onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void; children?: React.ReactNode }) {
  const [v, setV] = useState("published");
  return (
    <Select
      aria-label="Status"
      name="status"
      value={v}
      onChange={(e) => {
        setV(e.target.value);
        props.onChange?.(e);
      }}
    >
      {props.children ?? (
        <>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="removed" disabled>
            Removed
          </option>
        </>
      )}
    </Select>
  );
}

const trigger = () => screen.getByRole("combobox", { name: "Status" });
const list = () => document.getElementById(trigger().getAttribute("aria-controls")!)!;

describe("Select", () => {
  it("shows the selected label and opens a listbox with the options", () => {
    render(<Controlled />);
    expect(trigger()).toHaveTextContent("Published");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    const opts = within(list()).getAllByRole("option");
    expect(opts.map((o) => o.textContent)).toEqual(["All statuses", "Draft", "Published", "Removed"]);
    expect(within(list()).getByRole("option", { name: "Published" })).toHaveAttribute("aria-selected", "true");
    expect(within(list()).getByRole("option", { name: "Removed" })).toHaveAttribute("aria-disabled", "true");
  });

  it("calls onChange with a native-like event (target.value / target.name)", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.click(within(list()).getByRole("option", { name: "Draft" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const e = onChange.mock.calls[0][0];
    expect(e.target.value).toBe("draft");
    expect(e.target.name).toBe("status");
    expect(trigger()).toHaveTextContent("Draft");
    expect(trigger()).toHaveAttribute("data-value", "draft");
    // the hidden mirror carries the value for plain form submissions
    expect(document.querySelector<HTMLSelectElement>('select[name="status"]')!.value).toBe("draft");
  });

  it("ignores disabled options and re-picking the current one", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.click(within(list()).getByRole("option", { name: "Removed" }));
    fireEvent.click(within(list()).getByRole("option", { name: "Published" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is fully keyboard operable", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    trigger().focus();
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    // starts on the selected option; Down skips the disabled "Removed" and wraps
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(trigger().getAttribute("aria-activedescendant")).toMatch(/-o0$/);
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(trigger(), { key: "Enter" });
    expect(onChange.mock.calls[0][0].target.value).toBe("draft");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveFocus();
    // Escape closes without changing
    fireEvent.keyDown(trigger(), { key: " " });
    fireEvent.keyDown(trigger(), { key: "Escape" });
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("jumps by typing, like a native select", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.keyDown(trigger(), { key: "d" });
    expect(onChange.mock.calls[0][0].target.value).toBe("draft");
  });

  it("closes on an outside click", () => {
    render(
      <div>
        <Controlled />
        <button>outside</button>
      </div>,
    );
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByText("outside"));
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("adds a search box to long lists, matching without accents", () => {
    render(
      <Controlled>
        {["Anglais", "Biologie", "Chimie", "Économie", "Français", "Géographie", "Histoire", "Kinyarwanda", "Mathématiques"].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
        <option value="published">Published</option>
      </Controlled>,
    );
    fireEvent.click(trigger());
    const search = screen.getByRole("textbox", { name: "Search options" });
    fireEvent.change(search, { target: { value: "econ" } });
    expect(within(list()).getAllByRole("option").map((o) => o.textContent)).toEqual(["Économie"]);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(trigger()).toHaveTextContent("Économie");
  });

  it("renders option groups as headings", () => {
    render(
      <Controlled>
        <optgroup label="S4">
          <option value="a">S4 MCB</option>
        </optgroup>
        <optgroup label="S5">
          <option value="published">S5 PCM</option>
        </optgroup>
      </Controlled>,
    );
    fireEvent.click(trigger());
    expect(list()).toHaveTextContent(/S4.*S4 MCB.*S5.*S5 PCM/);
    expect(within(list()).getAllByRole("option")).toHaveLength(2);
  });

  it("works uncontrolled and when disabled", () => {
    const { rerender } = render(
      <Select aria-label="Size" defaultValue="20">
        <option value="10">10</option>
        <option value="20">20</option>
      </Select>,
    );
    const t = screen.getByRole("combobox", { name: "Size" });
    expect(t).toHaveTextContent("20");
    fireEvent.click(t);
    fireEvent.click(screen.getByRole("option", { name: "10" }));
    expect(t).toHaveTextContent("10");
    rerender(
      <Select aria-label="Size" disabled>
        <option value="10">10</option>
      </Select>,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Size" }));
    expect(screen.getByRole("combobox", { name: "Size" })).toHaveAttribute("aria-expanded", "false");
  });

  it("is labelled by a <label htmlFor>", () => {
    render(
      <>
        <label htmlFor="quiz-type">Quiz Type</label>
        <Select id="quiz-type" value="Quiz" onChange={() => {}}>
          <option value="Quiz">Quiz</option>
        </Select>
      </>,
    );
    expect(screen.getByLabelText("Quiz Type")).toHaveAttribute("role", "combobox");
  });
});

describe("select helpers", () => {
  it("keeps only placement classes from old select class lists", () => {
    expect(
      layoutClasses("rounded-xl border bg-surface-light px-3 py-2.5 text-sm focus:ring-2 lg:w-56 w-full mt-1 sm:hidden flex-1"),
    ).toBe("lg:w-56 w-full mt-1 sm:hidden flex-1");
  });

  it("reads options through fragments, arrays and conditionals", () => {
    const show = (flag: boolean) => flag;
    const { options } = parseSelectChildren(
      <>
        {show(false) && <option value="x">x</option>}
        {[1, 2].map((n) => (
          <option key={n} value={n}>
            Page {n}
          </option>
        ))}
        <option>No value attr</option>
      </>,
    );
    expect(options.map((o) => [o.value, o.label])).toEqual([
      ["1", "Page 1"],
      ["2", "Page 2"],
      ["No value attr", "No value attr"],
    ]);
  });
});
