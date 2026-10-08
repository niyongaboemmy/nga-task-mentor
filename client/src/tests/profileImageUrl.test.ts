import { describe, it, expect } from "vitest";
import { getProfileImageUrl } from "../utils/imageUrl";

describe("getProfileImageUrl", () => {
  it("uses the central NGA MIS picture link as is", () => {
    const mis = "https://api.amashuri.com/avatars/42/1790000000/md.webp?s=abc";
    expect(getProfileImageUrl(mis)).toBe(mis);
    expect(getProfileImageUrl("http://localhost:5001/avatars/1/2/md.webp?s=x")).toBe("http://localhost:5001/avatars/1/2/md.webp?s=x");
  });

  it("serves legacy Task Mentor uploads from this app's API", () => {
    expect(getProfileImageUrl("profile-7-1712.png")).toMatch(/\/api\/users\/profile-picture\/profile-7-1712\.png$/);
  });

  it("returns null when there is no picture", () => {
    expect(getProfileImageUrl(null)).toBeNull();
    expect(getProfileImageUrl("")).toBeNull();
    expect(getProfileImageUrl(undefined)).toBeNull();
  });
});
