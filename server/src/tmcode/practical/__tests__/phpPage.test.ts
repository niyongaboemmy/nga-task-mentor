import crypto from "crypto";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { phpSiteEntry, runPage } from "../../../controllers/tmcodePracticals.controller";
import * as access from "../../projects/access";
import * as storage from "../../projects/storage";
import * as coderunner from "../../../services/coderunner";
import { ProjectRevision } from "../../../models";
import { PHP_ROUTER, PHP_ROUTER_PATH } from "../../../vendor/nga-webrun";

/**
 * A PHP website in the grading Preview: which projects are one, and a page
 * run on the code runner the way the MIS Code Playground runs it (nga-webrun's
 * router as the entry of a php/single run, the request on stdin).
 */

const f = (p: string, content = "") => ({ path: p, content });

describe("a PHP website", () => {
  it("is index.php, or .php files that print HTML, or pages posting to .php", () => {
    expect(phpSiteEntry([f("index.php", "<?php echo 'hi';"), f("style.css")])).toBe("index.php");
    expect(phpSiteEntry([f("pages/home.php", "<html><h1>Hello</h1></html>"), f("lib/db.php", "<?php function db() {}")])).toBe("pages/home.php");
    expect(phpSiteEntry([f("index.html", '<form action="save.php" method="post"></form>'), f("save.php", "<?php echo $_POST['a'];")])).toBe("index.html");
    expect(phpSiteEntry([f("index.php"), f("index.html")])).toBe("index.php");
  });

  it("is not a CLI script, a Composer or Laravel project, or a site without PHP", () => {
    expect(phpSiteEntry([f("main.php", "<?php $n = (int) fgets(STDIN); echo $n * 2;")])).toBeNull();
    expect(phpSiteEntry([f("composer.json", "{}"), f("public/index.php", "<html></html>")])).toBeNull();
    expect(phpSiteEntry([f("artisan"), f("index.php")])).toBeNull();
    expect(phpSiteEntry([f("index.html", "<h1>Hi</h1>")])).toBeNull();
    expect(phpSiteEntry([f("vendor/x/node_modules/a/index.php")])).toBeNull();
  });
});

describe("POST /projects/:id/page", () => {
  const files: Record<string, string> = {
    "index.php": "<html><h1>Hello</h1><form action='save.php' method='post'><input name='name'></form></html>",
    "save.php": "<?php echo 'Saved ' . htmlspecialchars($_POST['name']);",
    "css/site.css": "h1{color:red}",
    // A student's own file of the router's name never replaces it.
    [PHP_ROUTER_PATH]: "<?php echo 'not the router';",
  };
  const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
  const run = jest.fn();
  const engineFor = jest.fn(() => "tmjudge");

  beforeEach(() => {
    jest.spyOn(access, "resolveProjectAccess").mockResolvedValue({ project: { id: 5, head_revision_id: 9 } } as any);
    jest.spyOn(access, "canReadRevision").mockReturnValue(true);
    jest.spyOn(ProjectRevision, "findByPk").mockResolvedValue({ id: 9, project_id: 5, number: 3 } as any);
    jest.spyOn(storage, "readManifest").mockReturnValue(Object.entries(files).map(([p, c]) => ({ path: p, sha256: sha(c), size: c.length })) as any);
    jest.spyOn(storage, "readBlobGz").mockImplementation(async (h: string) => {
      const c = Object.values(files).find((x) => sha(x) === h);
      return c === undefined ? null : zlib.gzipSync(Buffer.from(c));
    });
    jest.spyOn(coderunner, "getCodeRunner").mockReturnValue({ engineFor, run } as any);
    run.mockReset().mockResolvedValue({
      engine: "tmjudge",
      compile: null,
      tests: [{ id: "page", verdict: "ok", passed: true, stdout: "Saved Ama", stderr: null, exit_code: 0, time_ms: 12, memory_kb: 900 }],
    });
    engineFor.mockReturnValue("tmjudge");
  });
  afterEach(() => jest.restoreAllMocks());

  const call = async (body: unknown) => {
    const res: any = { statusCode: 0, body: null };
    res.status = (c: number) => ((res.statusCode = c), res);
    res.json = (b: unknown) => ((res.body = b), res);
    await runPage({ params: { id: "5" }, body } as any, res);
    return res;
  };

  it("runs the page through the playground's router as a php/single script, the request on stdin", async () => {
    const res = await call({ script: "save.php", method: "POST", query: "from=home", fields: [["name", "Ama"], ["tags[]", "a"], ["tags[]", "b"]] });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ revision: { id: 9, number: 3 }, script: "save.php", verdict: "ok", stdout: "Saved Ama", stderr: null });
    const req = run.mock.calls[0][0];
    expect(req).toMatchObject({ language: "php", kind: "php/single", entry: PHP_ROUTER_PATH });
    expect(req.files.filter((x: any) => x.path === PHP_ROUTER_PATH)).toEqual([{ path: PHP_ROUTER_PATH, content: PHP_ROUTER }]);
    expect(req.files.map((x: any) => x.path).sort()).toEqual([PHP_ROUTER_PATH, "css/site.css", "index.php", "save.php"]);
    expect(JSON.parse(req.tests[0].input)).toEqual({ script: "save.php", method: "POST", get: { from: "home" }, post: { name: "Ama", tags: { 0: "a", 1: "b" } } });
  });

  it("shows PHP's errors, and refuses what isn't a page or can't run", async () => {
    run.mockResolvedValue({ engine: "tmjudge", compile: null, tests: [{ id: "page", verdict: "runtime-error", passed: false, stdout: "", stderr: "PHP Parse error: syntax error in index.php on line 2", exit_code: 255, time_ms: 5, memory_kb: 800 }] });
    const bad = await call({ script: "index.php" });
    expect(bad.body).toMatchObject({ verdict: "runtime-error", stderr: expect.stringContaining("Parse error") });
    expect(JSON.parse(run.mock.calls[0][0].tests[0].input)).toMatchObject({ method: "GET", get: {}, post: {} });

    expect((await call({ script: "css/site.css" })).body.error_code).toBe("PAGE_NOT_FOUND");
    expect((await call({ script: "missing.php" })).statusCode).toBe(404);
    expect((await call({})).statusCode).toBe(400);
    // Judge0 runs one file: no router, no page.
    run.mockClear();
    engineFor.mockReturnValue("judge0");
    expect((await call({ script: "index.php" })).statusCode).toBe(422);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("vendored nga-webrun", () => {
  it("matches its provenance hash (re-sync with nga_central_mis/packages/webrun/sync.mjs)", () => {
    const text = fs.readFileSync(path.resolve(__dirname, "../../../vendor/nga-webrun/index.ts"), "utf8");
    const [, , shaLine, ...rest] = text.split("\n");
    expect(shaLine).toBe(`// sha256:${crypto.createHash("sha256").update(rest.join("\n")).digest("hex")}`);
  });
});
