import { Response } from "express";
import {
  ValidationError,
  ValidationErrorItem,
  UniqueConstraintError,
  ForeignKeyConstraintError,
  DatabaseError,
} from "sequelize";
import { sendControllerError } from "../controllerErrors";

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const body = (res: Response) => (res.json as jest.Mock).mock.calls[0][0];

describe("sendControllerError", () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("maps a Sequelize ValidationError to 400 with field errors", () => {
    const res = mockRes();
    const err = new ValidationError("Validation error", [
      new ValidationErrorItem(
        "Passing score cannot exceed 100%",
        "validation error",
        "passing_score",
        "150",
        undefined as any,
        "max",
        "max",
        [100],
      ),
    ]);
    sendControllerError(res, err, "creating the quiz");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res)).toEqual({
      success: false,
      message: "Validation failed: Passing score cannot exceed 100%",
      errors: [
        { field: "passing_score", message: "Passing score cannot exceed 100%" },
      ],
    });
  });

  it("maps a UniqueConstraintError to 409", () => {
    const res = mockRes();
    sendControllerError(
      res,
      new UniqueConstraintError({ errors: [] }),
      "creating the quiz",
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(body(res).success).toBe(false);
  });

  it("maps a ForeignKeyConstraintError to 400 naming the fields", () => {
    const res = mockRes();
    sendControllerError(
      res,
      new ForeignKeyConstraintError({
        fields: ["created_by"],
        parent: new Error("fk") as any,
      } as any),
      "creating the quiz",
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).message).toContain("created_by");
  });

  it("maps a MySQL bad-ENUM DatabaseError (WARN_DATA_TRUNCATED) to 400", () => {
    const res = mockRes();
    const original: any = new Error(
      "Data truncated for column 'type' at row 1",
    );
    original.code = "WARN_DATA_TRUNCATED";
    original.sqlMessage = "Data truncated for column 'type' at row 1";
    sendControllerError(res, new DatabaseError(original), "creating the quiz");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).message).toContain("column 'type'");
    expect(body(res).errorId).toBeDefined();
  });

  it("passes through an upstream (axios) status and message", () => {
    const res = mockRes();
    sendControllerError(
      res,
      {
        isAxiosError: true,
        message: "Request failed with status code 503",
        response: { status: 503, data: { message: "MIS is down" } },
      },
      "creating the quiz",
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(body(res).message).toBe("MIS is down");
  });

  it("returns 500 with the real message and an errorId outside production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const res = mockRes();
    sendControllerError(res, new Error("boom"), "creating the quiz");
    process.env.NODE_ENV = prev;

    expect(res.status).toHaveBeenCalledWith(500);
    expect(body(res).message).toBe("creating the quiz: boom");
    expect(body(res).errorId).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("hides internals but keeps the errorId in production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = mockRes();
    sendControllerError(res, new Error("secret sql"), "creating the quiz");
    process.env.NODE_ENV = prev;

    expect(res.status).toHaveBeenCalledWith(500);
    expect(body(res).message).not.toContain("secret sql");
    expect(body(res).message).toContain(body(res).errorId);
    expect(body(res).detail).toBeUndefined();
  });
});
