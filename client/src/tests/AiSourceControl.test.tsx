import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../utils/axiosConfig", () => ({ default: { get } }));

import { AiAnsweredBy, AiSourceControl } from "../components/ai/AiSourceControl";
import { clearMyAiRoutesCache, describeAiAnswer, type MyAiRoutes } from "../services/myAiApi";
import { optionValues, pickOption, selectValue } from "./helpers/select";

const ROUTES: MyAiRoutes = {
  enabled: true,
  byTask: { author: { route: "school", reason: "NO_ROUTE" } },
  choices: [
    { credentialId: 12, provider: "anthropic", model: "claude-sonnet-5-5", label: "My Claude" },
    { credentialId: 14, provider: "openrouter", model: "llama:free", label: null },
  ],
};

function Harness({ routes, onValue }: { routes?: MyAiRoutes | null; onValue?: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <AiSourceControl
      idPrefix="t"
      value={v}
      routes={routes}
      onChange={(x) => {
        setV(x);
        onValue?.(x);
      }}
    />
  );
}

const trigger = () => screen.getByRole("combobox");

beforeEach(() => {
  vi.clearAllMocks();
  clearMyAiRoutesCache();
});

describe("AiSourceControl", () => {
  it("lists School AI, the person's keys and Manage My AI; the value is the aiRoute to send", () => {
    const onValue = vi.fn();
    render(<Harness routes={ROUTES} onValue={onValue} />);
    expect(screen.getByText("Answers with:")).toBeInTheDocument();
    expect(optionValues(trigger())).toEqual(["", "12:claude-sonnet-5-5", "14:llama:free", "__manage__"]);
    expect(trigger()).toHaveTextContent("School AI");

    pickOption(trigger(), "12:claude-sonnet-5-5");
    expect(onValue).toHaveBeenLastCalledWith("12:claude-sonnet-5-5");
    expect(selectValue(trigger())).toBe("12:claude-sonnet-5-5");
    expect(trigger()).toHaveTextContent("My Claude · claude-sonnet-5-5");
  });

  it("'Manage My AI ↗' opens the MIS /my-ai page and keeps the current choice", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const onValue = vi.fn();
    render(<Harness routes={ROUTES} onValue={onValue} />);
    pickOption(trigger(), "__manage__");
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/\/my-ai$/), "_blank", "noopener,noreferrer");
    expect(onValue).not.toHaveBeenCalled();
    expect(selectValue(trigger())).toBe("");
  });

  it("when a personal key is the default, it is the first option and School AI is offered", () => {
    render(
      <Harness
        routes={{
          ...ROUTES,
          byTask: { author: { route: "personal", reason: "PERSONAL", credentialId: 12, provider: "anthropic", model: "claude-sonnet-5-5", label: "My Claude" } },
        }}
      />,
    );
    expect(optionValues(trigger())).toEqual(["", "school", "14:llama:free", "__manage__"]);
    expect(trigger()).toHaveTextContent("My Claude · claude-sonnet-5-5");
  });

  it("renders nothing when My AI is off or the person has no key here", () => {
    const { container, rerender } = render(<Harness routes={{ enabled: false }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<Harness routes={{ enabled: true, choices: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("fetches /ai/my-routes when no routes are given, and hides itself if that fails", async () => {
    get.mockResolvedValueOnce({ data: { success: true, data: ROUTES } });
    render(<Harness />);
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/ai/my-routes");

    clearMyAiRoutesCache();
    get.mockRejectedValueOnce(new Error("offline"));
    const { container } = render(<Harness />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});

describe("AiAnsweredBy", () => {
  it("says which key answered, or why School AI did", () => {
    const { rerender } = render(<AiAnsweredBy ai={{ route: "personal", reason: "PERSONAL", label: "My Claude", model: "claude-sonnet-5-5" }} />);
    expect(screen.getByTestId("ai-answered-by")).toHaveTextContent("via My Claude · claude-sonnet-5-5");
    rerender(<AiAnsweredBy ai={{ route: "school", reason: "KEY_NOT_ACTIVE", fallbackFrom: "AI_KEY_NO_CREDIT", label: "My Claude" }} />);
    expect(screen.getByTestId("ai-answered-by")).toHaveTextContent("Your key 'My Claude' was out of credit, so School AI answered.");
    rerender(<AiAnsweredBy ai={{ route: "school", reason: "PERSONAL_OFF" }} />);
    expect(screen.queryByTestId("ai-answered-by")).toBeNull();
    expect(describeAiAnswer(null)).toBeNull();
  });
});
