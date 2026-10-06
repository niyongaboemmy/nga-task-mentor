import fileServer from "../fileServer";

/**
 * The file-server's disk storage reads `path` when the file part begins, so
 * the multipart body must carry "path" first (see nga_central_mis
 * file-server/src/routes/files.ts). Every Task Mentor upload failed in
 * production with 400 "Invalid or unsafe path: " while it was sent second.
 */
describe("fileServer.uploadFile", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("sends the path field before the file", async () => {
    let body: FormData | undefined;
    global.fetch = jest.fn(async (_url: any, init: any) => {
      body = init.body;
      return new Response(JSON.stringify({ success: true }), { status: 201 });
    }) as any;

    await fileServer.uploadFile(Buffer.from("x"), "editor-images/img-1.png");

    const keys = [...body!.keys()];
    expect(keys).toEqual(["path", "file"]);
    expect(body!.get("path")).toBe("nga-task-mentor/editor-images/img-1.png");
  });
});
