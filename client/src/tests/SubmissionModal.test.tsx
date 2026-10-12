import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/** Student assignment submission: file attach, type/size limits, notifications. */

const post = vi.fn();
const put = vi.fn();
vi.mock("../utils/axiosConfig", () => ({
  default: { post: (...a: unknown[]) => post(...a), put: (...a: unknown[]) => put(...a), get: vi.fn() },
}));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("react-toastify", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import SubmissionModal from "../components/Assignments/SubmissionModal";
import { allowedTypesString } from "../utils/fileList";

const assignment = (extra: Record<string, unknown> = {}) => ({
  id: "41",
  title: "Lab report",
  submission_type: "file",
  max_score: 20,
  due_date: new Date(Date.now() + 86_400_000).toISOString(),
  status: "published",
  allowed_file_types: ["pdf", "docx"],
  ...extra,
});

const pdf = (name = "report.pdf", size = 2048) =>
  new File([new Uint8Array(size)], name, { type: "application/pdf", lastModified: 1 });

const renderModal = (extra: Record<string, unknown> = {}, props: Record<string, unknown> = {}) => {
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  render(
    <SubmissionModal
      isOpen
      onClose={onClose}
      assignment={assignment(extra) as never}
      onSubmissionSuccess={onSuccess}
      {...props}
    />,
  );
  return { onSuccess, onClose, input: screen.getByTestId("file-dropzone-input") as HTMLInputElement };
};

beforeEach(() => {
  post.mockReset();
  put.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("allowedTypesString", () => {
  it("reads every stored shape", () => {
    expect(allowedTypesString(["pdf", "docx"])).toBe("pdf,docx");
    expect(allowedTypesString('["pdf","zip"]')).toBe("pdf,zip");
    expect(allowedTypesString("pdf, docx")).toBe("pdf, docx");
    expect(allowedTypesString(null)).toBe("");
  });
});

describe("SubmissionModal", () => {
  it("offers only the teacher's file types in the picker", () => {
    const { input } = renderModal();
    expect(input.accept.split(",").sort()).toEqual([".docx", ".pdf"]);
  });

  it("refuses a file type the assignment doesn't accept before uploading", async () => {
    const { input } = renderModal();
    fireEvent.change(input, { target: { files: [new File(["x"], "photo.png", { type: "image/png" })] } });
    expect(await screen.findByText(/photo\.png/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Assignment" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("refuses a file over 10 MB before uploading", async () => {
    const { input } = renderModal();
    fireEvent.change(input, { target: { files: [pdf("huge.pdf", 10 * 1024 * 1024 + 1)] } });
    expect(await screen.findByText(/huge\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Assignment" })).toBeDisabled();
  });

  it("uploads the file as multipart, without a 30 s cap, and notifies on success", async () => {
    post.mockResolvedValue({ data: { success: true } });
    const { input, onSuccess, onClose } = renderModal();
    fireEvent.change(input, { target: { files: [pdf()] } });
    fireEvent.click(await screen.findByRole("button", { name: "Submit Assignment" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe("/assignments/41/submit");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file_submission")).toBeInstanceOf(File);
    expect(((body as FormData).get("file_submission") as File).name).toBe("report.pdf");
    // a hand-set multipart Content-Type has no boundary
    expect(config.headers?.["Content-Type"]).toBeUndefined();
    expect(config.timeout).toBe(0);
    expect(typeof config.onUploadProgress).toBe("function");

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Assignment submitted successfully!"));
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the server's reason instead of a generic error", async () => {
    post.mockRejectedValue({
      response: { status: 400, data: { message: '"report.pdf" can\'t be submitted: this assignment accepts .docx files only.' } },
    });
    const { input } = renderModal({ allowed_file_types: ["pdf", "docx"] });
    fireEvent.change(input, { target: { files: [pdf()] } });
    fireEvent.click(await screen.findByRole("button", { name: "Submit Assignment" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('"report.pdf" can\'t be submitted: this assignment accepts .docx files only.'),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("replaces the file on an existing submission through PUT", async () => {
    put.mockResolvedValue({ data: { success: true } });
    const { input } = renderModal({}, { existingSubmission: { id: 7, text_submission: "" } });
    fireEvent.change(input, { target: { files: [pdf("v2.pdf")] } });
    fireEvent.click(await screen.findByRole("button", { name: "Update Submission" }));
    await waitFor(() => expect(put).toHaveBeenCalledWith("/submissions/7", expect.any(FormData), expect.objectContaining({ timeout: 0 })));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Submission updated successfully!"));
  });
});
