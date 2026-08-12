import { Request, Response } from "express";
import {
  authorizePermission,
  authorizeAllPermissions,
  selfOrPermission,
} from "../auth";

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function mockReq(overrides: Partial<Request> = {}) {
  return {
    user: { id: 1, permissions: new Set<string>() },
    params: {},
    ...overrides,
  } as unknown as Request;
}

describe("authorizePermission", () => {
  it("calls next() when the user holds one of the required permissions (OR semantics)", () => {
    const req = mockReq({ user: { id: 1, permissions: new Set(["QUIZZES_VIEW"]) } } as any);
    const res = mockRes();
    const next = jest.fn();

    authorizePermission("QUIZZES_VIEW", "QUIZZES_EDIT")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responds 403 when the user holds none of the required permissions", () => {
    const req = mockReq({ user: { id: 1, permissions: new Set(["QUIZZES_VIEW"]) } } as any);
    const res = mockRes();
    const next = jest.fn();

    authorizePermission("QUIZZES_EDIT", "QUIZZES_DELETE")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  it("responds 403 when req.user.permissions is missing entirely", () => {
    const req = { user: { id: 1 }, params: {} } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    authorizePermission("QUIZZES_VIEW")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("authorizeAllPermissions", () => {
  it("calls next() only when ALL required permissions are present (AND semantics)", () => {
    const req = mockReq({
      user: { id: 1, permissions: new Set(["A", "B"]) },
    } as any);
    const res = mockRes();
    const next = jest.fn();

    authorizeAllPermissions("A", "B")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("responds 403 when only some required permissions are present", () => {
    const req = mockReq({
      user: { id: 1, permissions: new Set(["A"]) },
    } as any);
    const res = mockRes();
    const next = jest.fn();

    authorizeAllPermissions("A", "B")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("selfOrPermission", () => {
  it("allows access when the requester is acting on their own resource", () => {
    const req = mockReq({
      user: { id: 42, permissions: new Set() },
      params: { userId: "42" },
    } as any);
    const res = mockRes();
    const next = jest.fn();

    selfOrPermission("userId", "USERS_VIEW_ALL")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows access to another user's resource when the override permission is held", () => {
    const req = mockReq({
      user: { id: 1, permissions: new Set(["USERS_VIEW_ALL"]) },
      params: { userId: "999" },
    } as any);
    const res = mockRes();
    const next = jest.fn();

    selfOrPermission("userId", "USERS_VIEW_ALL")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("denies access to another user's resource without the override permission", () => {
    const req = mockReq({
      user: { id: 1, permissions: new Set() },
      params: { userId: "999" },
    } as any);
    const res = mockRes();
    const next = jest.fn();

    selfOrPermission("userId", "USERS_VIEW_ALL")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
