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
const ionCreditCandidates = [
  "Widgets/Images/ion-credit.png",
  "Assets/Images/ion-credit.png",
];

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

const vercelBuild = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const vercelStaticRoot = path.join(root, ".vercel", "output", "static");
const candidates = vercelBuild
  ? [
      // A Vercel build must validate the directory Vercel actually publishes.
      vercelStaticRoot,
    ]
  : [
      // Local/Lovable Nitro output.
      path.join(root, ".output", "public"),
      // Vercel output is also checked during local integration runs.
      vercelStaticRoot,
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
  const expected = vercelBuild
    ? ".vercel/output/static (Vercel Nitro preset)"
    : "a generated public output directory";
  console.error(
    `Could not locate ${expected}. Build root entries: ` + entries.join(", "),
  );
  process.exit(1);
}

if (!(await exists(sourceRoot))) {
  console.error("public/cesium is missing; run scripts/copy-cesium-assets.mjs first.");
  process.exit(1);
}

for (const outputRoot of existingRoots) {
  const targetRoot = path.join(outputRoot, "cesium");
  const missingDirectories = [];
  for (const directory of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
    if (!(await exists(path.join(targetRoot, directory)))) missingDirectories.push(directory);
  }
  let hasRequiredFiles = true;
  for (const relativePath of requiredFiles) {
    if (!(await exists(path.join(targetRoot, relativePath)))) hasRequiredFiles = false;
  }

  if (missingDirectories.length || !hasRequiredFiles) {
    await mkdir(targetRoot, { recursive: true });
    for (const directory of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
      await cp(path.join(sourceRoot, directory), path.join(targetRoot, directory), {
        recursive: true,
        force: true,
      });
    }
  }

  const directoriesStillMissing = [];
  for (const directory of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
    if (!(await exists(path.join(targetRoot, directory)))) directoriesStillMissing.push(directory);
  }
  if (directoriesStillMissing.length) {
    console.error(`Cesium runtime directories are missing in ${outputRoot}: ${directoriesStillMissing.join(", ")}`);
    process.exit(1);
  }

  const missing = [];
  for (const relativePath of requiredFiles) {
    if (!(await exists(path.join(targetRoot, relativePath)))) missing.push(relativePath);
  }
  if (missing.length) {
    console.error(`Cesium files are still missing in ${outputRoot}: ${missing.join(", ")}`);
    process.exit(1);
  }
  const hasIonCredit = await Promise.all(
    ionCreditCandidates.map((relativePath) => exists(path.join(targetRoot, relativePath))),
  );
  if (!hasIonCredit.some(Boolean)) {
    console.error(`Cesium ion-credit.png is missing from ${path.relative(root, targetRoot)}.`);
    process.exit(1);
  }
  const creditPath = ionCreditCandidates[hasIonCredit.findIndex(Boolean)];
  console.log(
    `Verified Cesium runtime assets at ${path.relative(root, targetRoot)} including ${creditPath}`,
  );
}
