import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};

const required = ["styles-v3.css", "js/spec-workbench.js"];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) fail(`Missing ${file}`);
}

const html = read("index.html");
const app = read("js/app.js");
const workbench = read("js/spec-workbench.js");
const serviceWorker = read("service-worker.js");
const packageJson = JSON.parse(read("package.json"));

for (const marker of [
  'href="styles-v3.css"',
  'src="js/spec-workbench.js"',
]) {
  if (!html.includes(marker)) fail(`index.html is missing ${marker}`);
}

for (const marker of [
  "window.DesignSpecApp",
  "designspec:ready",
  "analysePdfPage",
  "generateAdditionalFiles",
  "augmentPrompt",
  "runAudit",
  "comparisonScore",
  "detectedTypography",
]) {
  if (!app.includes(marker)) fail(`Core app is missing ${marker}`);
}

for (const marker of [
  "DEVICE_PRESETS",
  "desktop-large",
  "tablet-portrait",
  "mobile-standard",
  "analysePdfPage",
  "checkGoogleFont",
  "analyseLayout",
  "generateResponsiveCss",
  "generateFontsCss",
  "ASSET_MANIFEST.md",
  "ACCESSIBILITY_NOTES.md",
  "BUILD_REQUIREMENTS.md",
  "AUDIT_REPORT.md",
  "runAudit",
]) {
  if (!workbench.includes(marker)) fail(`Workbench is missing ${marker}`);
}

for (const width of ["1800", "1440", "1280", "1024", "834", "768", "430", "390", "375", "360"]) {
  if (!workbench.includes(`width: ${width}`)) fail(`Device guidance is missing ${width}px`);
}

if (!serviceWorker.includes('design-spec-extractor-v3')) fail("Service worker cache was not upgraded to v3");
for (const asset of ["styles-v3.css", "js/spec-workbench.js", "js/quick-scale.js"]) {
  if (!serviceWorker.includes(asset)) fail(`Service worker is missing ${asset}`);
}
if (packageJson.version !== "3.0.0") fail("Package version is not 3.0.0");
if (!packageJson.scripts.test.includes("v3-test.mjs")) fail("npm test does not include the v3 test");

for (const file of ["js/app.js", "js/spec-workbench.js", "service-worker.js"]) {
  const check = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
  if (check.status !== 0) fail(`${file} has a syntax error:\n${check.stderr}`);
}

if (workbench.includes("—")) fail("Workbench contains an em dash");
if (!process.exitCode) console.log("PASS: version 3 workbench checks completed successfully.");
