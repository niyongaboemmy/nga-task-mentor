import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

/**
 * Admin → AI: premium & own keys: premium models from the server, the BYOK switch, the entitled
 * people (limit, revoke) and granting premium to someone found by search.
 */

const get = vi.fn();
const put = vi.fn();
const del = vi.fn();
vi.mock("../utils/axiosConfig", () => ({
  default: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a), delete: (...a: unknown[]) => del(...a) },
}));

import AiSettingsPage from "../pages/Admin/AiSettingsPage";

const settings = (allow_byok = true) => ({
  allow_byok,
  premium_default_limit: 50,
  premium_models: [{ id: "premium:openai/gpt-4.1", label: "gpt-4.1", provider: "openai", providerLabel: "OpenAI" }],
  premium_unavailable: [{ entry: "anthropic/claude-sonnet-4-5", reason: "No Anthropic (Claude) key on the server" }],
  byok_providers: [],
});
const row = (over: Record<string, unknown> = {}) => ({
  user_id: 7,
  name: "Ada Teacher",
  email: "ada@school.rw",
  role: "instructor",
  premium: true,
  entitled: true,
  via: "grant",
  daily_limit: null,
  effective_limit: 50,
  used_today: 3,
  note: "grading pilot",
  granted_by: { id: 1, name: "Admin" },
  updated_at: "2026-10-25T08:00:00.000Z",
  ...over,
});

beforeEach(() => {
  get.mockReset();
  put.mockReset();
  del.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url === "/admin/ai/settings") return { data: { data: settings() } };
    if (url === "/admin/ai/entitlements") return { data: { data: { users: [row()], roles_with_premium: [], default_limit: 50 } } };
    if (url === "/admin/ai/users") return { data: { data: { users: [{ id: 9, name: "Bob Mentor", email: "bob@school.rw", role: "instructor", entitled: false }] } } };
    throw new Error(url);
  });
});

describe("AiSettingsPage", () => {
  it("shows the premium models, what isn't offered, and the entitled people", async () => {
    render(<AiSettingsPage />);
    expect(await screen.findByTestId("premium-models")).toHaveTextContent("OpenAI · gpt-4.1");
    expect(screen.getByText(/No Anthropic \(Claude\) key on the server/)).toBeInTheDocument();
    const r = screen.getByTestId("entitled-7");
    expect(r).toHaveTextContent("Ada Teacher");
    expect(r).toHaveTextContent("3 / 50");
    expect(screen.getByText(/Free AI stays everyone's default/)).toBeInTheDocument();
  });

  it("switches own API keys off", async () => {
    put.mockResolvedValueOnce({ data: { data: settings(false) } });
    render(<AiSettingsPage />);
    const sw = await screen.findByTestId("byok-switch");
    expect(sw).toHaveAttribute("aria-checked", "true");
    fireEvent.click(sw);
    await waitFor(() => expect(put).toHaveBeenCalledWith("/admin/ai/settings", { allow_byok: false }));
    await waitFor(() => expect(screen.getByTestId("byok-switch")).toHaveAttribute("aria-checked", "false"));
  });

  it("grants premium to someone found by search", async () => {
    put.mockResolvedValueOnce({ data: { data: { user: row({ user_id: 9, name: "Bob Mentor", note: null }) } } });
    render(<AiSettingsPage />);
    await screen.findByTestId("entitled-7");
    fireEvent.change(screen.getByPlaceholderText("Search by name or email"), { target: { value: "bob" } });
    fireEvent.click(await screen.findByRole("option", { name: /Bob Mentor/ }));
    fireEvent.click(screen.getByRole("button", { name: /Give premium/ }));
    await waitFor(() => expect(put).toHaveBeenCalledWith("/admin/ai/entitlements/9", { premium: true, daily_limit: null, note: null }));
    expect(await screen.findByTestId("entitled-9")).toHaveTextContent("Bob Mentor");
  });

  it("revokes after confirming", async () => {
    del.mockResolvedValueOnce({ data: { data: { ok: true, removed: true } } });
    render(<AiSettingsPage />);
    const r = await screen.findByTestId("entitled-7");
    fireEvent.click(within(r).getByRole("button", { name: /Revoke/ }));
    const dialogButtons = await screen.findAllByRole("button", { name: "Revoke" });
    fireEvent.click(dialogButtons[dialogButtons.length - 1]);
    await waitFor(() => expect(del).toHaveBeenCalledWith("/admin/ai/entitlements/7"));
    await waitFor(() => expect(screen.queryByTestId("entitled-7")).not.toBeInTheDocument());
  });
});
