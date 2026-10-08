// The profile picture is NGA MIS's (one picture for every NGA app). Task Mentor keeps
// the MIS link in users.profile_image, refreshes it whenever MIS is asked about the
// user, and forwards its own upload/remove to MIS (services/misAvatar.ts).

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
// multer is exercised for real elsewhere; here the "upload" is whatever the test put on req.
jest.mock("../../middleware/upload", () => ({
  uploadProfilePicture: {
    single: () => (req: any, _res: any, next: (err?: any) => void) => next(req.__uploadError),
  },
}));

import axios from "axios";
import { User } from "../../models/User.model";
import fileServer from "../../utils/fileServer";
import { deleteProfileImage, getMe, uploadProfileImage, verifyMisSession } from "../auth.controller";
import { applyMisAvatar, isMisAvatarUrl, misAvatarFrom, uploadAvatarToMis } from "../../services/misAvatar";

const ax = axios as any;
const findByPk = (User as any).findByPk as jest.Mock;
const deleteFile = (fileServer as any).deleteFile as jest.Mock;
const uploadFile = (fileServer as any).uploadFile as jest.Mock;

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

/** The upload controller answers from inside multer's callback; wait for it. */
const settle = async (r: any) => {
  for (let i = 0; i < 50 && !r.json.mock.calls.length; i++) await new Promise((x) => setTimeout(x, 2));
};

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

  it("uploads to MIS as multipart with the crop and the user's MIS token", async () => {
    ax.put.mockResolvedValue({ data: { data: { avatar: AVATAR } } });
    const out = await uploadAvatarToMis(
      "tok",
      { buffer: Buffer.from("img"), originalname: "me.png", mimetype: "image/png" },
      '{"x":0,"y":0,"width":1,"height":1}',
    );
    expect(out).toEqual(AVATAR);
    const [url, form, opts] = ax.put.mock.calls[0];
    expect(url).toBe("https://api.amashuri.com/users/me/avatar");
    expect(opts.headers.Authorization).toBe("Bearer tok");
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get("crop")).toBe('{"x":0,"y":0,"width":1,"height":1}');
    const file = (form as FormData).get("avatar") as File;
    expect(file.name).toBe("me.png");
    expect(file.type).toBe("image/png");
  });
});

describe("POST /auth/upload-profile-image", () => {
  it("sends a MIS-linked user's picture to MIS and stores the MIS link", async () => {
    const user = localUser("profile-7-old.png");
    findByPk.mockResolvedValue(user);
    ax.put.mockResolvedValue({ data: { data: { avatar: AVATAR } } });

    const r = res();
    await uploadProfileImage(req({ file: { buffer: Buffer.from("img"), originalname: "a.png", mimetype: "image/png" } }), r);
    await settle(r);

    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.json.mock.calls[0][0].data.profile_image).toBe(AVATAR.md);
    expect(user.profile_image).toBe(AVATAR.md);
    expect(uploadFile).not.toHaveBeenCalled();
    // The old Task Mentor-only file is cleaned up.
    expect(deleteFile).toHaveBeenCalledWith("profile-pictures/profile-7-old.png");
  });

  it("passes MIS's validation message through", async () => {
    findByPk.mockResolvedValue(localUser(null));
    ax.put.mockRejectedValue({ response: { status: 400, data: { message: "That file is not a picture we can read." } } });
    const r = res();
    await uploadProfileImage(req({ file: { buffer: Buffer.from("x"), originalname: "a.png", mimetype: "image/png" } }), r);
    await settle(r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0].message).toMatch(/not a picture/);
  });

  it("answers 502 when MIS is unreachable, keeping the current picture", async () => {
    const user = localUser(AVATAR.md);
    findByPk.mockResolvedValue(user);
    ax.put.mockRejectedValue(Object.assign(new Error("ECONNREFUSED"), { code: "ECONNREFUSED" }));
    const r = res();
    await uploadProfileImage(req({ file: { buffer: Buffer.from("x"), originalname: "a.png", mimetype: "image/png" } }), r);
    await settle(r);
    expect(r.status).toHaveBeenCalledWith(502);
    expect(user.profile_image).toBe(AVATAR.md);
  });

  it("keeps the local file-server path for accounts not linked to MIS", async () => {
    const user = localUser(null, { mis_user_id: null });
    findByPk.mockResolvedValue(user);
    const r = res();
    await uploadProfileImage(req({ cookies: {}, file: { buffer: Buffer.from("x"), originalname: "a.png", mimetype: "image/png" } }), r);
    await settle(r);
    expect(ax.put).not.toHaveBeenCalled();
    expect(uploadFile).toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(200);
    expect(isMisAvatarUrl(user.profile_image)).toBe(false);
  });
});

describe("DELETE /auth/delete-profile-image", () => {
  it("removes a MIS picture in MIS", async () => {
    const user = localUser(AVATAR.md);
    findByPk.mockResolvedValue(user);
    ax.delete.mockResolvedValue({ data: { success: true } });
    const r = res();
    await deleteProfileImage(req(), r);
    expect(ax.delete).toHaveBeenCalledWith("https://api.amashuri.com/users/me/avatar", expect.objectContaining({
      headers: { Authorization: "Bearer mis-token" },
    }));
    expect(deleteFile).not.toHaveBeenCalled();
    expect(user.profile_image).toBeNull();
    expect(r.status).toHaveBeenCalledWith(200);
  });

  it("removes a legacy picture from the file-server", async () => {
    const user = localUser("profile-7-old.png");
    findByPk.mockResolvedValue(user);
    const r = res();
    await deleteProfileImage(req(), r);
    expect(ax.delete).not.toHaveBeenCalled();
    expect(deleteFile).toHaveBeenCalledWith("profile-pictures/profile-7-old.png");
    expect(user.profile_image).toBeNull();
  });

  it("keeps the picture when MIS can't be reached", async () => {
    const user = localUser(AVATAR.md);
    findByPk.mockResolvedValue(user);
    ax.delete.mockRejectedValue(new Error("timeout"));
    const r = res();
    await deleteProfileImage(req(), r);
    expect(r.status).toHaveBeenCalledWith(502);
    expect(user.profile_image).toBe(AVATAR.md);
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
      data: { data: { user: { user_id: 42, avatar_url: AVATAR.md }, avatar: AVATAR, profile: {}, roles: [] } },
    });
    const r = res();
    await getMe(req(), r);
    expect(r.json.mock.calls[0][0].data.user.profile_image).toBe(AVATAR.md);
  });
});
