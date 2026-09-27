/**
 * `npm run access:publish` -- PUT the Task Mentor capability manifest to MIS
 * (PUT {NGA_MIS_BASE_URL}/access/manifests/tm, HTTP Basic with the SSO client
 * credentials). Idempotent: MIS answers `unchanged: true` for a manifest it
 * already has. Runs from the compiled build (dist/) so it works after the
 * deploy prunes dev dependencies. Exit code 1 on failure; the deploy workflow
 * treats that as a warning, never a failed deploy.
 */
import path from "path";
import dotenv from "dotenv";
import { validateManifest } from "../vendor/nga-access";
import { TM_MANIFEST } from "./manifest";
import { publishManifest } from "./misClient";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const errors = validateManifest(TM_MANIFEST);
  if (errors.length > 0) {
    console.error(`[access:publish] manifest is invalid:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  try {
    const result = await publishManifest(TM_MANIFEST);
    const d = result?.data ?? {};
    console.log(
      `[access:publish] ${TM_MANIFEST.app}@${TM_MANIFEST.version}: ${d.unchanged ? "unchanged" : "published"}` +
        ` (${Object.keys(TM_MANIFEST.capabilities).length} capabilities)`,
    );
  } catch (err: any) {
    const status = err?.response?.status;
    const body = err?.response?.data ? ` ${JSON.stringify(err.response.data).slice(0, 500)}` : "";
    console.error(`[access:publish] failed${status ? ` (HTTP ${status})` : ""}: ${err?.message ?? err}${body}`);
    process.exit(1);
  }
}

main();
