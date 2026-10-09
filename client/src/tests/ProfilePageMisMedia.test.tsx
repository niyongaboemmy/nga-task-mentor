import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

let mockUser: any;
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));

import Profile from "../components/Profile/Profile";

const PHOTO = "https://api.amashuri.com/avatars/42/1790000000/md.webp?s=a";
const COVER = "https://api.amashuri.com/covers/42/1790000000/lg.webp?s=c";

beforeEach(() => {
  mockUser = {
    id: "7",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@nga.rw",
    role: "student",
    roles: [],
    permissions: [],
    mis_user_id: 42,
    profile_image: PHOTO,
    cover_url: null,
  };
});

describe("Task Mentor profile: photo and cover come from NGA MIS", () => {
  it("has no way to upload a picture here", () => {
    const { container } = render(<Profile />);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/upload/i)).not.toBeInTheDocument();
  });

  it("shows the MIS photo and links to the MIS profile to change it", () => {
    render(<Profile />);
    const link = screen.getByRole("link", { name: /change your photo in nga mis/i });
    expect(link.getAttribute("href")).toMatch(/\/profile$/);
    expect(link.getAttribute("target")).toBe("_blank");
    // No rel="opener": installed-app link capturing needs a no-opener link.
    expect(link.getAttribute("rel")).toBeNull();
    expect(screen.getByRole("img", { name: "Jane Doe" }).getAttribute("src")).toBe(PHOTO);
    expect(screen.getByRole("link", { name: /edit photo & cover in nga mis/i })).toBeInTheDocument();
  });

  it("uses plain system blue when there is no cover, and the MIS cover when there is", () => {
    const { unmount } = render(<Profile />);
    const banner = screen.getByTestId("profile-cover");
    expect(banner.className).toContain("bg-blue-600");
    expect(banner.className).not.toMatch(/gradient/);
    expect(banner.querySelector("img")).toBeNull();
    unmount();

    mockUser.cover_url = COVER;
    render(<Profile />);
    expect(screen.getByTestId("profile-cover").querySelector("img")?.getAttribute("src")).toBe(COVER);
  });

  it("falls back to initials when there is no photo or it fails to load", () => {
    mockUser.profile_image = "https://broken.example/x.webp";
    render(<Profile />);
    fireEvent.error(screen.getByRole("img", { name: "Jane Doe" }));
    expect(screen.getByRole("img", { name: "Jane Doe" }).textContent).toBe("JD");
  });

  it("accounts not linked to MIS just see their photo, with no MIS links", () => {
    mockUser.mis_user_id = null;
    render(<Profile />);
    expect(screen.queryByRole("link", { name: /nga mis/i })).not.toBeInTheDocument();
  });
});
