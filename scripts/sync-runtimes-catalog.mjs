#!/usr/bin/env node
/**
 * Copy the Runtime Catalog (languages, project types, starters) built by
 * nga-tmcode's @nga/runtimes package into Task Mentor (CODE_RUNNER_PLAN.md
 * §11.4). Task Mentor serves these files at /api/code/catalog and
 * /api/code/starters.
 *
 *   node scripts/sync-runtimes-catalog.mjs [path/to/nga-tmcode/packages/runtimes/dist]
 *
 * Default source: ../nga-tmcode/packages/runtimes/dist (run `npm run build
 * -w @nga/runtimes` there first).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const from = path.resolve(process.argv[2] ?? path.join(root, "..", "nga-tmcode", "packages", "runtimes", "dist"));
const to = path.join(root, "server", "src", "catalog");

for (const name of ["catalog.json", "starters.json"]) {
  const src = path.join(from, name);
  if (!fs.existsSync(src)) {
    console.error(`Missing ${src}. Build @nga/runtimes first (npm run build -w @nga/runtimes in nga-tmcode).`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(src, "utf8"));
  fs.mkdirSync(to, { recursive: true });
  fs.writeFileSync(path.join(to, name), JSON.stringify(data) + "\n");
  const count = name === "catalog.json" ? `${data.languages.length} languages, ${data.kinds.length} kinds` : `${data.starters.length} starters`;
  console.log(`${name}: version ${data.version} — ${count}`);
}
