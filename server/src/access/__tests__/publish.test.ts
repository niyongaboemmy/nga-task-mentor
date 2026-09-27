import axios from "axios";
import { TM_MANIFEST } from "../manifest";
import { buildManifestPublishRequest, publishManifest } from "../misClient";

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, put: jest.fn() } };
});
const mockedPut = axios.put as jest.Mock;

const env = {
  NGA_MIS_BASE_URL: "https://api.example.test/",
  SSO_CLIENT_ID: "taskmentor_app",
  SSO_CLIENT_SECRET: "s3cret",
} as unknown as NodeJS.ProcessEnv;

describe("npm run access:publish", () => {
  it("PUTs the tm manifest with HTTP Basic client credentials", () => {
    const r = buildManifestPublishRequest(TM_MANIFEST, env);
    expect(r.ready).toBe(true);
    expect(r.method).toBe("PUT");
    expect(r.url).toBe("https://api.example.test/access/manifests/tm");
    expect(r.headers.Authorization).toBe(
      `Basic ${Buffer.from("taskmentor_app:s3cret").toString("base64")}`,
    );
    expect(r.headers["Content-Type"]).toBe("application/json");
    expect(r.body.app).toBe("tm");
    expect(Object.keys(r.body.capabilities)).toHaveLength(Object.keys(TM_MANIFEST.capabilities).length);
    expect(r.body.capabilities.REPORT_CARDS_PUBLISH).toMatchObject({ kind: "WRITE" });
    expect(r.body.capabilities.REPORT_CARDS_VIEW_ALL.depths).toEqual(["summary", "detail"]);
    expect(JSON.parse(JSON.stringify(r.body))).toEqual(r.body);
  });

  it("is not ready without credentials and refuses to send", async () => {
    const r = buildManifestPublishRequest(TM_MANIFEST, { NGA_MIS_BASE_URL: "https://x" } as any);
    expect(r.ready).toBe(false);
    expect(r.headers).not.toHaveProperty("Authorization");
    await expect(publishManifest(TM_MANIFEST, { NGA_MIS_BASE_URL: "https://x" } as any)).rejects.toThrow(
      /SSO_CLIENT_SECRET/,
    );
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it("sends exactly the built request", async () => {
    mockedPut.mockResolvedValue({ data: { success: true, data: { unchanged: true } } });
    const out = await publishManifest(TM_MANIFEST, env);
    expect(out.data.unchanged).toBe(true);
    const [url, body, cfg] = mockedPut.mock.calls[0];
    expect(url).toBe("https://api.example.test/access/manifests/tm");
    expect(body.version).toBe(TM_MANIFEST.version);
    expect(cfg.headers.Authorization).toMatch(/^Basic /);
  });
});
