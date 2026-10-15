import { access, cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "public", "cesium");
const requiredFiles = [
  "Assets/approximateTerrainHeights.json",
  "Assets/IAU2006_XYS/IAU2006_XYS_18.json",
];

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

const candidates = [
  // TanStack Start + Nitro (this repository's actual build preset).
  path.join(root, ".output", "public"),
  // Vercel Build Output API static directory, when present.
  path.join(root, ".vercel", "output", "static"),
  // Vite client output locations for alternative local previews.
  path.join(root, "dist", "client"),
  path.join(root, "dist"),
];

const existingRoots = [];
for (const candidate of candidates) {
  if (await exists(candidate)) existingRoots.push(candidate);
}

if (existingRoots.length === 0) {
  const entries = await readdir(root);
  console.error(
    "Could not locate a generated public output directory. Build root entries: " + entries.join(", "),
  );
  process.exit(1);
}

if (!(await exists(sourceRoot))) {
  console.error("public/cesium is missing; run scripts/copy-cesium-assets.mjs first.");
  process.exit(1);
}

for (const outputRoot of existingRoots) {
  const targetRoot = path.join(outputRoot, "cesium");
  let hasRequiredFiles = true;
  for (const relativePath of requiredFiles) {
    if (!(await exists(path.join(targetRoot, relativePath)))) hasRequiredFiles = false;
  }

  if (!hasRequiredFiles) {
    await mkdir(targetRoot, { recursive: true });
    for (const directory of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
      await cp(path.join(sourceRoot, directory), path.join(targetRoot, directory), {
        recursive: true,
        force: true,
      });
    }
  }

  const missing = [];
  for (const relativePath of requiredFiles) {
    if (!(await exists(path.join(targetRoot, relativePath)))) missing.push(relativePath);
  }
  if (missing.length) {
    console.error(`Cesium files are still missing in ${outputRoot}: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`Verified Cesium runtime assets at ${path.relative(root, targetRoot)}`);
}
