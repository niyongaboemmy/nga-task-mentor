import request from "supertest";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import { Assignment, Submission } from "../models";
import fileServer from "../utils/fileServer";

/**
 * Student assignment submission with a file attached. Real dev DB and
 * middleware chain; the file-server is mocked. Run with --runInBand.
 *
 * Regression: multer moved to memoryStorage (shared file-server) but
 * submitAssignment kept reading req.file.path, which memoryStorage never
 * sets -- the file was dropped and "file"/"both" assignments failed
 * ("Server error" from the model hook's "File submission is required").
 */

const MIS_HEADER = { "x-mis-token": "test-mis-token" };
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const RUN = `${Date.now()}`;

let app: ReturnType<typeof buildTestApp>;
let studentId: number;
let instructorId: number;
let studentToken: string;
let uploadSpy: jest.SpyInstance;
let deleteSpy: jest.SpyInstance;
const assignmentIds: number[] = [];

const as = (r: request.Test) => r.set("Authorization", `Bearer ${studentToken}`).set(MIS_HEADER);

async function makeAssignment(overrides: Record<string, unknown> = {}) {
  const a = await Assignment.create({
    title: `Upload fixture ${RUN} ${assignmentIds.length}`,
    description: "submission upload fixture",
    due_date: new Date(Date.now() + 3 * 86_400_000),
    max_score: 20,
    submission_type: "file",
    course_id: 999_001,
    academic_term_id: null,
    created_by: instructorId,
    status: "published",
    allowed_file_types: [],
    ...overrides,
  } as any);
  assignmentIds.push(a.id!);
  return a;
}

const submit = (assignmentId: number) => as(request(app).post(`/api/assignments/${assignmentId}/submit`));

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const student = await findSeededUserByRole("student");
  studentId = student.id;
  instructorId = (await findSeededUserByRole("instructor")).id;
  studentToken = signTokenFor(studentId);
});

beforeEach(() => {
  uploadSpy = jest.spyOn(fileServer, "uploadFile").mockResolvedValue(undefined);
  deleteSpy = jest.spyOn(fileServer, "deleteFile").mockResolvedValue(undefined);
});

afterEach(() => {
  uploadSpy.mockRestore();
  deleteSpy.mockRestore();
});

afterAll(async () => {
  if (assignmentIds.length) {
    await Submission.destroy({ where: { assignment_id: assignmentIds }, force: true } as any);
    await Assignment.destroy({ where: { id: assignmentIds }, force: true } as any);
  }
  await sequelize.close();
});

describe("POST /api/assignments/:id/submit with a file", () => {
  it("stores the file on the file-server and records it (file-only assignment)", async () => {
    const a = await makeAssignment();
    const res = await submit(a.id!).attach("file_submission", PDF, {
      filename: "My Essay.pdf",
      contentType: "application/pdf",
    });

    expect(res.status).toBe(201);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    const [buffer, remotePath] = uploadSpy.mock.calls[0];
    expect(Buffer.compare(buffer, PDF)).toBe(0);
    expect(remotePath).toMatch(/^submissions\/submission-\d+-\d+-my_essay\.pdf$/);

    const saved = await Submission.findOne({ where: { assignment_id: a.id, student_id: studentId } });
    expect(saved?.status).toBe("submitted");
    expect(saved?.file_submissions).toEqual([
      expect.objectContaining({
        originalname: "My Essay.pdf",
        path: remotePath,
        size: PDF.length,
        mimetype: "application/pdf",
      }),
    ]);
  });

  it("accepts text + file on a 'both' assignment", async () => {
    const a = await makeAssignment({ submission_type: "both" });
    const res = await submit(a.id!)
      .field("text_submission", "My reflection")
      .attach("file_submission", PDF, { filename: "work.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(201);
    expect(res.body.data.text_submission).toBe("My reflection");
    expect(res.body.data.file_submissions).toHaveLength(1);
  });

  it("accepts the types the teacher allowed, in any stored shape (.PPTX, upper case)", async () => {
    const a = await makeAssignment({ allowed_file_types: [".PPTX", "pdf"] });
    const res = await submit(a.id!).attach("file_submission", Buffer.from("PK\x03\x04slides"), {
      filename: "Deck.pptx",
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    expect(res.status).toBe(201);
  });

  it("accepts web-code files when the teacher allowed them (Web code preset)", async () => {
    const a = await makeAssignment({ allowed_file_types: ["html", "css", "js"] });
    const res = await submit(a.id!).attach("file_submission", Buffer.from("<h1>hi</h1>"), {
      filename: "index.html",
      contentType: "text/html",
    });
    expect(res.status).toBe(201);
  });

  it("refuses a type the teacher didn't allow with a 400 that says what is accepted", async () => {
    const a = await makeAssignment({ allowed_file_types: ["pdf", "docx"] });
    const res = await submit(a.id!).attach("file_submission", Buffer.from("png"), {
      filename: "photo.png",
      contentType: "image/png",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/accepts \.pdf, \.docx files only/);
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(await Submission.count({ where: { assignment_id: a.id } })).toBe(0);
  });

  it("refuses executables before anything is stored", async () => {
    const a = await makeAssignment();
    const res = await submit(a.id!).attach("file_submission", Buffer.from("MZ"), {
      filename: "setup.exe",
      contentType: "application/octet-stream",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/\.exe files are not accepted/);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("answers 413 (not 500) for a file over 10 MB", async () => {
    const a = await makeAssignment();
    const res = await submit(a.id!).attach("file_submission", Buffer.alloc(10 * 1024 * 1024 + 1), {
      filename: "big.pdf",
      contentType: "application/pdf",
    });
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/at most 10 MB/);
  });

  it("asks for the file instead of failing when a file-only assignment gets none", async () => {
    const a = await makeAssignment();
    const res = await submit(a.id!).field("text_submission", "only text");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/attach your submission file/i);
  });

  it("reports a file-server outage as a retryable 502 and saves nothing", async () => {
    uploadSpy.mockRejectedValue(new Error("Failed to upload file: 500"));
    const a = await makeAssignment();
    const res = await submit(a.id!).attach("file_submission", PDF, {
      filename: "essay.pdf",
      contentType: "application/pdf",
    });
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/could not be saved/);
    expect(await Submission.count({ where: { assignment_id: a.id } })).toBe(0);
  });
});

describe("PUT /api/submissions/:id with a new file", () => {
  it("replaces the file and enforces the teacher's types", async () => {
    const a = await makeAssignment({ allowed_file_types: ["pdf"] });
    const first = await submit(a.id!).attach("file_submission", PDF, {
      filename: "v1.pdf",
      contentType: "application/pdf",
    });
    expect(first.status).toBe(201);
    const id = first.body.data.id;

    const wrong = await as(request(app).put(`/api/submissions/${id}`)).attach(
      "file_submission",
      Buffer.from("x"),
      { filename: "v2.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    );
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toMatch(/accepts \.pdf files only/);

    const ok = await as(request(app).put(`/api/submissions/${id}`)).attach("file_submission", PDF, {
      filename: "v2.pdf",
      contentType: "application/pdf",
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.file_submissions[0].originalname).toBe("v2.pdf");
  });

  it("ignores a client-supplied file record (can't point at someone else's file)", async () => {
    const a = await makeAssignment({ submission_type: "both" });
    const first = await submit(a.id!)
      .field("text_submission", "hello")
      .attach("file_submission", PDF, { filename: "mine.pdf", contentType: "application/pdf" });
    const id = first.body.data.id;

    const res = await as(request(app).put(`/api/submissions/${id}`)).send({
      file_submissions: [{ filename: "x", originalname: "x.pdf", path: "submissions/someone-else.pdf", size: 1, mimetype: "application/pdf" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.file_submissions[0].originalname).toBe("mine.pdf");
  });
});
