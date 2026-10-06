import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

/** Pasting images into the shared rich-text editor uploads them. */

const uploadLocal = vi.fn();
const importRemote = vi.fn();
vi.mock("../utils/editorImages", async (orig) => ({
  ...(await orig<typeof import("../utils/editorImages")>()),
  uploadLocalImageSrc: (src: string) => uploadLocal(src),
  importEditorImage: (src: string) => importRemote(src),
}));
const toastWarn = vi.fn();
const toastError = vi.fn();
vi.mock("react-toastify", () => ({ toast: { warn: (m: string, o?: unknown) => toastWarn(m, o), error: (m: string, o?: unknown) => toastError(m, o) } }));

import RichTextEditor from "../components/Common/RichTextEditor";

const SERVER = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5001").replace(/\/api\/?$/, "");

function clipboard({ files = [] as File[], html = "", text = "" }) {
  return {
    files,
    types: [...(html ? ["text/html"] : []), ...(text ? ["text/plain"] : []), ...(files.length ? ["Files"] : [])],
    items: [],
    getData: (t: string) => (t === "text/html" ? html : t === "text/plain" ? text : ""),
  };
}

function setup() {
  const onChange = vi.fn();
  const onUploading = vi.fn();
  const utils = render(<RichTextEditor content="<p>Task</p>" onChange={onChange} onUploadingChange={onUploading} />);
  const pm = utils.container.querySelector(".ProseMirror") as HTMLElement;
  return { ...utils, pm, onChange, onUploading };
}

const lastHtml = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]?.[0] as string;

beforeEach(() => {
  uploadLocal.mockReset();
  importRemote.mockReset();
  toastWarn.mockReset();
  toastError.mockReset();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:http://localhost/${++n}`);
  URL.revokeObjectURL = vi.fn();
});

describe("RichTextEditor image paste", () => {
  it("uploads a pasted screenshot and swaps in the server URL", async () => {
    let resolve: (v: string) => void = () => {};
    uploadLocal.mockImplementation(() => new Promise((r) => (resolve = r)));
    const { pm, onChange, onUploading, findByRole } = setup();

    const png = new File([new Uint8Array(10)], "Screenshot.png", { type: "image/png" });
    fireEvent.paste(pm, { clipboardData: clipboard({ files: [png] }) });

    // shown at once from a blob: URL while it uploads
    await waitFor(() => expect(lastHtml(onChange)).toContain('src="blob:http://localhost/1"'));
    expect(await findByRole("status")).toHaveTextContent("Uploading 1 image");
    expect(onUploading).toHaveBeenLastCalledWith(true);
    expect(uploadLocal).toHaveBeenCalledWith("blob:http://localhost/1");

    resolve(`${SERVER}/uploads/editor-images/img-1.png`);
    await waitFor(() => expect(lastHtml(onChange)).toContain(`${SERVER}/uploads/editor-images/img-1.png`));
    expect(lastHtml(onChange)).not.toContain("blob:");
    await waitFor(() => expect(onUploading).toHaveBeenLastCalledWith(false));
  });

  it("re-hosts images inside pasted web content (data: and other sites)", async () => {
    uploadLocal.mockResolvedValue(`${SERVER}/uploads/editor-images/from-data.png`);
    importRemote.mockResolvedValue(`${SERVER}/uploads/editor-images/from-web.png`);
    const { pm, onChange } = setup();

    fireEvent.paste(pm, {
      clipboardData: clipboard({
        html: '<p>Design A</p><img src="data:image/png;base64,iVBORw0KGgo="><p>Design B</p><img src="https://cdn.example.com/b.png">',
        text: "Design A Design B",
      }),
    });

    await waitFor(() => {
      const html = lastHtml(onChange);
      expect(html).toContain("from-data.png");
      expect(html).toContain("from-web.png");
    });
    expect(importRemote).toHaveBeenCalledWith("https://cdn.example.com/b.png");
  });

  it("keeps a web image linked when it can't be copied, and drops a failed upload", async () => {
    importRemote.mockRejectedValue(new Error("HTTP 403"));
    uploadLocal.mockRejectedValue(new Error("Image is too large."));
    const { pm, onChange } = setup();

    fireEvent.paste(pm, {
      clipboardData: clipboard({ html: '<p>x</p><img src="https://cdn.example.com/c.png">', text: "x" }),
    });
    await waitFor(() => expect(toastWarn).toHaveBeenCalled());
    expect(lastHtml(onChange)).toContain("https://cdn.example.com/c.png");

    fireEvent.paste(pm, { clipboardData: clipboard({ files: [new File(["x"], "big.png", { type: "image/png" })] }) });
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Image is too large.", { toastId: "editor-image-upload" }));
    expect(lastHtml(onChange)).not.toContain("blob:");
  });

  it("warns about images that point at files on the computer (Word)", async () => {
    const { pm, onChange } = setup();
    fireEvent.paste(pm, {
      clipboardData: clipboard({ html: '<p>From Word</p><img src="file:///C:/Users/t/AppData/image001.png">', text: "From Word" }),
    });
    await waitFor(() => expect(toastWarn).toHaveBeenCalledWith(expect.stringMatching(/files on your computer/), undefined));
    expect(lastHtml(onChange)).not.toContain("file:///");
  });
});
