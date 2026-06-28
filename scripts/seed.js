import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSourceStudioEngine } from "../server/sourcestudio/engine.js";

const __filename = fileURLToPath(import.meta.url);
const root = resolve(dirname(__filename), "..");

for (const path of [
  join(root, ".env.local"),
  join(root, ".env"),
]) {
  if (existsSync(path)) dotenv.config({ path, override: false, quiet: true });
}

const engine = await createSourceStudioEngine({ root });
const notebook = await engine.seedDemo({ resetFirst: process.argv.includes("--reset") });

console.log(
  JSON.stringify(
    {
      notebook: {
        id: notebook.id,
        title: notebook.title,
        sources: notebook.source_count,
        active_sources: notebook.active_source_count,
        artifacts: notebook.artifacts.length,
      },
      storage: engine.providerStatus().storage_dir,
    },
    null,
    2,
  ),
);
