import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SystemsMenu from "../components/Layout/SystemsMenu";
import { withLaunchMarker } from "../pwa/ngaLaunch";

const auth = vi.hoisted(() => ({ authorizeSSO: vi.fn() }));
vi.mock("../services/authService", () => ({ authorizeSSO: auth.authorizeSSO }));

const tendo = {
  system_id: 7,
  name: "Tendo",
  client_id: "tendo_app",
  allowed_redirect_uris: "https://tendo.amashuri.com/sso/callback",
  home_url: "https://tendo.amashuri.com",
  icon_url: null,
} as any;

describe("Task Mentor Apps menu opens apps with real links", () => {
  beforeEach(() => {
    auth.authorizeSSO.mockReset();
  });

  it("tiles are new-tab noopener links with a pre-minted SSO code; Back to MIS is a link too", async () => {
    auth.authorizeSSO.mockResolvedValue({ code: "c0de", state: "st" });
    render(<SystemsMenu isOpen onClose={vi.fn()} systems={[tendo]} />);

    const tile = await screen.findByTitle("Open Tendo");
    await waitFor(() => expect(tile).toHaveAttribute("href", "https://tendo.amashuri.com/sso/callback?code=c0de&state=st"));
    expect(tile.tagName).toBe("A");
    expect(tile).toHaveAttribute("target", "_blank");
    expect(tile.getAttribute("rel")).toContain("noopener");
    expect(auth.authorizeSSO).toHaveBeenCalledWith("tendo_app", "https://tendo.amashuri.com/sso/callback", "code", expect.any(String));

    const mis = screen.getByTitle("Open NGA MIS");
    expect(mis.tagName).toBe("A");
    expect(mis).toHaveAttribute("target", "_blank");
  });

  it("while the code is still coming, links to the app's home page (never a bare callback)", async () => {
    auth.authorizeSSO.mockReturnValue(new Promise(() => undefined));
    render(<SystemsMenu isOpen onClose={vi.fn()} systems={[tendo]} />);
    const tile = await screen.findByTitle("Open Tendo");
    expect(tile).toHaveAttribute("href", "https://tendo.amashuri.com");
    expect(tile).toHaveAttribute("aria-busy", "true");
  });

  it("marks links only when running as an installed app", () => {
    expect(withLaunchMarker("https://tendo.amashuri.com/x", true)).toBe("https://tendo.amashuri.com/x?nga_launch=app");
    expect(withLaunchMarker("https://tendo.amashuri.com/x", false)).toBe("https://tendo.amashuri.com/x");
  });
});
