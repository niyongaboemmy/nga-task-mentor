import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

const postMock = vi.fn();
vi.mock("../utils/axiosConfig", () => ({ default: { post: (...a: any[]) => postMock(...a) } }));

import UserAvatar from "../components/ui/UserAvatar";
import { requestAvatar, keyFor, _resetAvatarDirectoryForTests } from "../lib/avatarDirectory";

const MIS = (id: number) => `https://api.amashuri.com/avatars/${id}/1/md.webp?s=x`;
const settle = () => act(() => new Promise((r) => setTimeout(r, 40)));

beforeEach(() => {
  _resetAvatarDirectoryForTests();
  postMock.mockReset();
});

describe("Task Mentor photo directory", () => {
  it("batches local and MIS ids into one lookup and keeps them apart", async () => {
    postMock.mockResolvedValue({ data: { data: { by_user: { 7: MIS(70) }, by_mis: { 7: MIS(7) } } } });
    render(
      <>
        <UserAvatar userId={7} name="Local Seven" />
        <UserAvatar misUserId={7} name="Mis Seven" />
        <UserAvatar misUserId={8} name="Mis Eight" />
      </>,
    );
    await waitFor(() => expect(screen.getByRole("img", { name: "Mis Seven" }).tagName).toBe("IMG"));
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith("/users/avatars/lookup", { user_ids: [7], mis_user_ids: [7, 8] });
    // Same number, different id spaces: different people, different photos.
    expect(screen.getByRole("img", { name: "Local Seven" }).getAttribute("src")).toBe(MIS(70));
    expect(screen.getByRole("img", { name: "Mis Seven" }).getAttribute("src")).toBe(MIS(7));
    expect(screen.getByRole("img", { name: "Mis Eight" }).textContent).toBe("ME");
  });

  it("prefers a known photo and turns legacy filenames into this app's URL", async () => {
    render(<UserAvatar src="profile-3-old.png" userId={3} name="Old Upload" />);
    const img = screen.getByRole("img", { name: "Old Upload" });
    expect(img.getAttribute("src")).toMatch(/\/api\/users\/profile-picture\/profile-3-old\.png$/);
    await settle();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("shows initials when nothing is known, and never asks twice", async () => {
    postMock.mockResolvedValue({ data: { data: { by_user: {}, by_mis: {} } } });
    requestAvatar(keyFor({ userId: 5 }));
    await settle();
    requestAvatar(keyFor({ userId: 5 }));
    await settle();
    expect(postMock).toHaveBeenCalledTimes(1);
    render(<UserAvatar name="No Photo" />);
    expect(screen.getByRole("img", { name: "No Photo" }).textContent).toBe("NP");
  });

  it("falls back to initials when the lookup fails", async () => {
    postMock.mockRejectedValue(new Error("offline"));
    render(<UserAvatar misUserId={9} name="Jane Doe" />);
    await settle();
    expect(screen.getByRole("img", { name: "Jane Doe" }).textContent).toBe("JD");
  });

  it("an id of a local user wins over an MIS id when both are given", () => {
    expect(keyFor({ userId: 1, misUserId: 2 })).toBe("u:1");
    expect(keyFor({ userId: null, misUserId: 2 })).toBe("m:2");
    expect(keyFor({})).toBeNull();
  });
});
