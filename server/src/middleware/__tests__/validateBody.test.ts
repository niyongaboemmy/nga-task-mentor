import { Request, Response } from "express";
import { z } from "zod";
import { validateBody } from "../validation.middleware";

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const schema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  count: z.number().int().optional().default(1),
});

describe("validateBody", () => {
  it("replaces req.body with the parsed (trimmed, defaulted, stripped) value", () => {
    const req = { body: { title: "  hi  ", extra: "drop me" } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ title: "hi", count: 1 });
  });

  it("responds 400 with field-level errors and a summary message", () => {
    const req = { body: { title: "", count: "x" } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.message).toMatch(/^Validation failed: /);
    expect(payload.errors).toEqual(
      expect.arrayContaining([
        { field: "title", message: "Title is required" },
        expect.objectContaining({ field: "count" }),
      ]),
    );
  });

  it("treats a missing body as an empty object", () => {
    const req = {} as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
