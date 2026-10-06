import { act, fireEvent, screen, within } from "@testing-library/react";

/**
 * Helpers for the app's custom <Select> (components/ui/Select.tsx): it is a
 * button with role="combobox" that opens a listbox, so native-select
 * shortcuts (fireEvent.change, toHaveValue, userEvent.selectOptions) don't
 * apply. These drive it the way a user does.
 */

/** The value currently selected. */
export const selectValue = (trigger: HTMLElement) => trigger.getAttribute("data-value");

/** Option values in order, read from the hidden native mirror. */
export function optionValues(trigger: HTMLElement): string[] {
  const native = trigger.closest("[data-select-root]")?.querySelector("select");
  return native ? Array.from(native.options).map((o) => o.value) : [];
}

/** Open the select and click the option with this value (or, failing that, this label). */
export function pickOption(trigger: HTMLElement, valueOrLabel: string | number) {
  const wanted = String(valueOrLabel);
  act(() => {
    fireEvent.click(trigger);
  });
  // the list this trigger controls (another one may still be animating out)
  const listId = trigger.getAttribute("aria-controls");
  const list = (listId && document.getElementById(listId)) || screen.getByRole("listbox");
  const byValue = list.querySelector<HTMLElement>(`[role="option"][data-value="${CSS.escape(wanted)}"]`);
  const option = byValue ?? within(list).getByRole("option", { name: wanted });
  act(() => {
    fireEvent.click(option);
  });
}
