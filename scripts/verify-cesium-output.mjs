import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "public", "cesium");
const distRoot = path.join(root, "dist");
const outputRoot = path.join(distRoot, "cesium");
const requiredFiles = [
  "Assets/approximateTerrainHeights.json",
  "Assets/IAU2006_XYS/IAU2006_XYS_18.json",
];
async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

if (!(await exists(distRoot))) {
  console.error("The configured Vercel output directory dist/ was not created by the build.");
  process.exit(1);
}

const missingInOutput = [];
for (const relativePath of requiredFiles) {
  if (!(await exists(path.join(outputRoot, relativePath)))) missingInOutput.push(relativePath);
}

if (missingInOutput.length) {
  // Vercel's project output directory is "dist". Place runtime files at its root-level
  // /cesium URL path as well as in public/ so framework-specific client output layouts
  // cannot silently leave the public Cesium URLs missing.
  if (!(await exists(sourceRoot))) {
    console.error("public/cesium is missing; run scripts/copy-cesium-assets.mjs first.");
    process.exit(1);
  }
  await mkdir(outputRoot, { recursive: true });
  for (const directory of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
    await cp(path.join(sourceRoot, directory), path.join(outputRoot, directory), {
      recursive: true,
      force: true,
    });
  }
}

const stillMissing = [];
for (const relativePath of requiredFiles) {
  if (!(await exists(path.join(outputRoot, relativePath)))) stillMissing.push(relativePath);
}
if (stillMissing.length) {
  console.error(`Cesium runtime files are missing from dist/cesium: ${stillMissing.join(", ")}`);
  process.exit(1);
}
console.log("Verified Cesium runtime assets in dist/cesium, matching the configured Vercel output root.");
