// The profile picture is NGA MIS's (one picture for every NGA app), changed in MIS only.
// Task Mentor keeps the MIS link in users.profile_image and refreshes it whenever MIS is
// asked about the user; the profile cover is passed through from MIS (services/misAvatar.ts).

jest.mock("../../models/User.model", () => ({ User: { findByPk: jest.fn(), findOne: jest.fn() } }));
jest.mock("../../models/Role.model", () => ({ Role: { findByPk: jest.fn(), findOne: jest.fn() } }));
jest.mock("../../models/Permission.model", () => ({ Permission: {} }));
jest.mock("../../services/misUserSync", () => ({ upsertMisUser: jest.fn() }));
jest.mock("../../access/snapshot", () => ({ noteAccessVersion: jest.fn() }));
jest.mock("../../utils/fileServer", () => ({
  __esModule: true,
  default: { uploadFile: jest.fn(), deleteFile: jest.fn(async () => undefined) },
}));
jest.mock("axios", () => {
  const a = { get: jest.fn(), put: jest.fn(), delete: jest.fn(), post: jest.fn() };
  return { __esModule: true, default: a, ...a };
});
import axios from "axios";
import { User } from "../../models/User.model";
import fs from "fs";
import path from "path";
import { getMe, verifyMisSession } from "../auth.controller";
import { applyMisAvatar, isMisAvatarUrl, misAvatarFrom, misCoverFrom } from "../../services/misAvatar";

const ax = axios as any;
const findByPk = (User as any).findByPk as jest.Mock;

const AVATAR = {
  version: 1790000000,
  sm: "https://api.amashuri.com/avatars/42/1790000000/sm.webp?s=abc",
  md: "https://api.amashuri.com/avatars/42/1790000000/md.webp?s=abc",
  lg: "https://api.amashuri.com/avatars/42/1790000000/lg.webp?s=abc",
};

const localUser = (profile_image: string | null, extra: any = {}) => {
  const u: any = { id: 7, mis_user_id: 42, profile_image, ...extra };
  u.save = jest.fn(async () => u);
  return u;
};

const res = () => {
  const r: any = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  r.cookie = jest.fn(() => r);
  return r;
};

const req = (extra: any = {}) =>
  ({ user: { id: 7, mis_user_id: 42 }, cookies: { misToken: "mis-token" }, headers: {}, query: {}, body: {}, ...extra }) as any;

beforeAll(() => {
  process.env.NGA_MIS_BASE_URL = "https://api.amashuri.com";
});

beforeEach(() => jest.clearAllMocks());

describe("misAvatar helpers", () => {
  it("reads the 256 px picture from any MIS payload shape", () => {
    expect(misAvatarFrom({ avatar: AVATAR })).toBe(AVATAR.md);
    expect(misAvatarFrom({ avatar: null })).toBeNull();
    expect(misAvatarFrom({ user: { avatar_url: AVATAR.md } })).toBe(AVATAR.md);
    expect(misAvatarFrom({ user: { avatar_url: null } })).toBeNull();
    // An older MIS that knows nothing about pictures: no opinion.
    expect(misAvatarFrom({ user: { user_id: 42 } })).toBeUndefined();
    expect(misAvatarFrom(undefined)).toBeUndefined();
  });

  it("tells MIS links from legacy Task Mentor filenames", () => {
    expect(isMisAvatarUrl(AVATAR.md)).toBe(true);
    expect(isMisAvatarUrl("profile-7-1712.png")).toBe(false);
    expect(isMisAvatarUrl(null)).toBe(false);
  });

  it("follows MIS, but never drops a legacy picture just because MIS has none", async () => {
    const fresh = localUser(null);
    expect(await applyMisAvatar(fresh, AVATAR.md)).toBe(true);
    expect(fresh.profile_image).toBe(AVATAR.md);

    const same = localUser(AVATAR.md);
    expect(await applyMisAvatar(same, AVATAR.md)).toBe(false);
    expect(same.save).not.toHaveBeenCalled();

    const removedInMis = localUser(AVATAR.md);
    expect(await applyMisAvatar(removedInMis, null)).toBe(true);
    expect(removedInMis.profile_image).toBeNull();

    const legacy = localUser("profile-7-1712.png");
    expect(await applyMisAvatar(legacy, null)).toBe(false);
    expect(legacy.profile_image).toBe("profile-7-1712.png");
    expect(await applyMisAvatar(legacy, AVATAR.md)).toBe(true);
    expect(legacy.profile_image).toBe(AVATAR.md);

    const untouched = localUser("x.png");
    expect(await applyMisAvatar(untouched, undefined)).toBe(false);
  });

  it("reads the MIS cover, ignoring links that are not http(s)", () => {
    const COVER = { version: 1, md: "https://api.amashuri.com/covers/42/1/md.webp?s=x", lg: "https://api.amashuri.com/covers/42/1/lg.webp?s=x" };
    expect(misCoverFrom({ cover: COVER })).toBe(COVER.lg);
    expect(misCoverFrom({ cover: null })).toBeNull();
    expect(misCoverFrom({ user: { cover_url: COVER.lg } })).toBe(COVER.lg);
    expect(misCoverFrom({ cover: { ...COVER, lg: "javascript:alert(1)" } })).toBeNull();
    expect(misCoverFrom({ user: {} })).toBeUndefined();
  });
});

describe("pictures are changed in MIS only", () => {
  it("Task Mentor has no upload or delete endpoint for profile pictures", () => {
    const routes = fs.readFileSync(path.join(__dirname, "../../routes/auth.ts"), "utf8");
    expect(routes).not.toMatch(/upload-profile-image|delete-profile-image/);
  });
});

describe("keeping the picture in sync with MIS", () => {
  it("the /auth/verify-mis poll applies MIS's current picture and reports it", async () => {
    const user = localUser(null);
    findByPk.mockResolvedValue(user);
    ax.get.mockResolvedValue({ data: { success: true, data: { userId: 42, access_version: 3, avatar: AVATAR } } });
    const r = res();
    await verifyMisSession(req(), r);
    expect(user.profile_image).toBe(AVATAR.md);
    expect(r.json.mock.calls[0][0].profile_image).toBe(AVATAR.md);
  });

  it("the poll says nothing about pictures when MIS doesn't (older MIS)", async () => {
    ax.get.mockResolvedValue({ data: { success: true, data: { userId: 42 } } });
    const r = res();
    await verifyMisSession(req(), r);
    expect(findByPk).not.toHaveBeenCalled();
    expect(r.json.mock.calls[0][0].profile_image).toBeUndefined();
  });

  it("GET /auth/me returns the MIS picture", async () => {
    const user = localUser(null, {
      first_name: "Jane",
      last_name: "Doe",
      email: "j@x.rw",
      role: "student",
      role_id: null,
      roleRecord: null,
    });
    findByPk.mockResolvedValue(user);
    ax.get.mockResolvedValue({
      data: { data: { user: { user_id: 42, avatar_url: AVATAR.md }, avatar: AVATAR, cover: { version: 1, md: "https://api.amashuri.com/covers/42/1/md.webp?s=c", lg: "https://api.amashuri.com/covers/42/1/lg.webp?s=c" }, profile: {}, roles: [] } },
    });
    const r = res();
    await getMe(req(), r);
    expect(r.json.mock.calls[0][0].data.user.profile_image).toBe(AVATAR.md);
    expect(r.json.mock.calls[0][0].data.user.cover_url).toBe("https://api.amashuri.com/covers/42/1/lg.webp?s=c");
  });
});
