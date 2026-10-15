import { cp, mkdir, access, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cesiumRoot = path.join(root, "node_modules", "cesium", "Build", "Cesium");
const publicRoot = path.join(root, "public", "cesium");

const requiredDirectories = ["Workers", "ThirdParty", "Assets", "Widgets"];
const requiredFiles = [
  "Assets/approximateTerrainHeights.json",
  "Assets/IAU2006_XYS/IAU2006_XYS_18.json",
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(path.join(cesiumRoot, "Assets")))) {
  console.error(
    "Cesium runtime assets are missing from node_modules. Run bun install and retry the build.",
  );
  process.exit(1);
}

await mkdir(publicRoot, { recursive: true });

for (const directory of requiredDirectories) {
  const source = path.join(cesiumRoot, directory);
  const destination = path.join(publicRoot, directory);
  if (!(await exists(source))) {
    console.error(`Required Cesium asset directory is missing: ${source}`);
    process.exit(1);
  }
  await cp(source, destination, { recursive: true, force: true });
}

const missing = [];
for (const relativePath of requiredFiles) {
  const target = path.join(publicRoot, relativePath);
  if (!(await exists(target))) missing.push(relativePath);
}

// The ion credit badge is optional when no ion services are enabled, but if the
// installed Cesium build provides it, it must be copied into public Widgets/Assets.
const creditCandidates = [
  "Widgets/Images/ion-credit.png",
  "Assets/Images/ion-credit.png",
];
const creditPresent = await Promise.all(
  creditCandidates.map((relativePath) => exists(path.join(publicRoot, relativePath))),
);

if (missing.length) {
  console.error(`Cesium asset copy incomplete. Missing: ${missing.join(", ")}`);
  process.exit(1);
}

const workerCount = (await stat(path.join(publicRoot, "Workers"))).isDirectory();
console.log(
  `Copied Cesium runtime assets to public/cesium (Workers: ${workerCount ? "ready" : "missing"}; ` +
    `ion credit image: ${creditPresent.some(Boolean) ? "ready" : "not supplied by this Cesium package"}).`,
);
