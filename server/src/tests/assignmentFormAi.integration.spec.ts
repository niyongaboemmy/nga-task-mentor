import request from "supertest";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import { generateStructuredContent } from "../services/aiProviders/generate";
import fileServer from "../utils/fileServer";

/**
 * Assignment form helpers: AI rubric (provider mocked), rich-text image
 * upload/import (file-server mocked) and the attachment upload errors.
 * Real dev DB + middleware chain. Run with --runInBand.
 */

jest.mock("../services/aiProviders/generate", () => ({
  generateFreeformJSON: jest.fn(),
  generateStructuredContent: jest.fn(),
}));
const mockedAI = generateStructuredContent as jest.Mock;

const MIS_HEADER = { "x-mis-token": "test-mis-token" };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

let app: ReturnType<typeof buildTestApp>;
let instructorToken: string;
let studentToken: string;
let uploadSpy: jest.SpyInstance;

const as = (r: request.Test, token: string) =>
  r.set("Authorization", `Bearer ${token}`).set(MIS_HEADER);

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  instructorToken = signTokenFor((await findSeededUserByRole("instructor")).id);
  studentToken = signTokenFor((await findSeededUserByRole("student")).id);
});

beforeEach(() => {
  mockedAI.mockReset();
  uploadSpy = jest.spyOn(fileServer, "uploadFile").mockResolvedValue(undefined);
});

afterEach(() => uploadSpy.mockRestore());

afterAll(async () => {
  await sequelize.close();
});

describe("POST /api/assignments/ai/rubric", () => {
  const description = `<p><strong>Task:</strong> build a landing page.</p>
    <h3>Marking</h3><ul><li>Layout – 40%</li><li>Typography – 30%</li><li>Responsiveness – 30%</li></ul>`;

  it("returns the description's rubric scaled to exactly max_score", async () => {
    mockedAI.mockResolvedValue({
      providerUsed: "gemini",
      data: {
        found_in_description: true,
        note: "Taken from the Marking list.",
        criteria: [
          { name: "Layout", description: "Matches the design grid", points: 40 },
          { name: "Typography", description: "Fonts and hierarchy", points: 30 },
          { name: "Responsiveness", description: "Works on phones", points: 30 },
        ],
      },
    });
    const res = await as(request(app).post("/api/assignments/ai/rubric"), instructorToken).send({
      title: "Landing page",
      description,
      max_score: 20,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("description");
    expect(res.body.data.total).toBe(20);
    expect(res.body.data.criteria.map((c: any) => c.max_score)).toEqual([8, 6, 6]);
    expect(res.body.data.criteria[0]).toMatchObject({ criteria: "Layout", description: "Matches the design grid" });

    // The model sees text, not HTML, and the teacher's total.
    const prompt: string = mockedAI.mock.calls[0][0].prompt;
    expect(prompt).toContain("TOTAL MARKS: 20");
    expect(prompt).toContain("Layout – 40%");
    expect(prompt).not.toContain("<li>");
  });

  it("honours the requested number of criteria", async () => {
    mockedAI.mockResolvedValue({
      providerUsed: "groq",
      data: {
        found_in_description: false,
        note: "",
        criteria: [1, 2, 3, 4, 5].map((i) => ({ name: `C${i}`, description: "", points: 2 })),
      },
    });
    const res = await as(request(app).post("/api/assignments/ai/rubric"), instructorToken).send({
      description,
      max_score: 10,
      criteria_count: 3,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.criteria).toHaveLength(3);
    expect(res.body.data.total).toBe(10);
    expect(res.body.data.source).toBe("generated");
  });

  it("asks for the description when there is nothing to read", async () => {
    const res = await as(request(app).post("/api/assignments/ai/rubric"), instructorToken).send({
      description: "<p></p>",
      max_score: 10,
    });
    expect(res.status).toBe(400);
    expect(mockedAI).not.toHaveBeenCalled();
  });

  it("requires a positive max_score", async () => {
    const res = await as(request(app).post("/api/assignments/ai/rubric"), instructorToken).send({
      description,
      max_score: 0,
    });
    expect(res.status).toBe(400);
  });

  it("reports provider failures as 503 with the friendly message", async () => {
    mockedAI.mockRejectedValue(new Error("All AI providers are busy. Try again in a few minutes."));
    const res = await as(request(app).post("/api/assignments/ai/rubric"), instructorToken).send({
      description,
      max_score: 10,
    });
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/busy/);
  });

  it("is not available to students", async () => {
    const res = await as(request(app).post("/api/assignments/ai/rubric"), studentToken).send({
      description,
      max_score: 10,
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/media/editor-images", () => {
  it("stores a pasted image and returns its /uploads URL", async () => {
    const res = await as(request(app).post("/api/media/editor-images"), instructorToken).attach(
      "image",
      PNG,
      { filename: "Screenshot 2026-10-06.png", contentType: "image/png" },
    );
    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^\/uploads\/editor-images\/img-\d+-\d+-screenshot_2026_10_06\.png$/);
    expect(res.body.data.type).toBe("image/png");
    expect(uploadSpy).toHaveBeenCalledWith(expect.any(Buffer), expect.stringMatching(/^editor-images\//));
  });

  it("rejects a non-image even when it claims to be one", async () => {
    const res = await as(request(app).post("/api/media/editor-images"), instructorToken).attach(
      "image",
      Buffer.from("<html><script>alert(1)</script></html>"),
      { filename: "evil.png", contentType: "image/png" },
    );
    expect(res.status).toBe(415);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("is not available to students", async () => {
    const res = await as(request(app).post("/api/media/editor-images"), studentToken).attach("image", PNG, "a.png");
    expect(res.status).toBe(403);
  });

  it("refuses to import from internal addresses", async () => {
    const res = await as(request(app).post("/api/media/editor-images/import"), instructorToken).send({
      url: "http://127.0.0.1:5002/uploads/x.png",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not allowed/);
  });
});

describe("assignment attachment errors", () => {
  it("returns a 400 naming the file instead of a 500", async () => {
    const res = await as(request(app).post("/api/assignments"), instructorToken)
      .field("title", "x")
      .attach("attachments", Buffer.from("MZ"), "setup.exe");
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("setup.exe");
  });
});
