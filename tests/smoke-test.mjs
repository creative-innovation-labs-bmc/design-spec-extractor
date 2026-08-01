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

const requiredFiles = [
  "index.html",
  "styles.css",
  "js/app.js",
  "service-worker.js",
  "manifest.webmanifest",
  "robots.txt",
  ".nojekyll",
  "assets/icon.svg",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`Missing ${file}`);
}

const html = read("index.html");
const app = read("js/app.js");
const styles = read("styles.css");
const serviceWorker = read("service-worker.js");
const workflow = read(".github/workflows/deploy-pages.yml");

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) fail(`Duplicate HTML IDs: ${[...new Set(duplicateIds)].join(", ")}`);

const referencedIds = [...app.matchAll(/\$\("#([A-Za-z0-9_-]+)"\)/g)].map((match) => match[1]);
const missingIds = [...new Set(referencedIds)].filter((id) => !ids.includes(id));
if (missingIds.length) fail(`JavaScript references missing HTML IDs: ${missingIds.join(", ")}`);

if (!html.includes('meta name="robots" content="noindex,nofollow,noarchive"')) {
  fail("Missing noindex robots metadata");
}
if (!app.includes("pdfjs-dist@6.2.108")) fail("PDF.js version is not pinned");
if (!app.includes("jszip@3.10.1")) fail("JSZip version is not pinned");
if (html.includes("vendor/")) fail("HTML contains stale vendor paths");
if (serviceWorker.includes("vendor/")) fail("Service worker contains stale vendor paths");
if (app.includes("—") || html.includes("—") || styles.includes("—")) fail("Em dash found");
if (!app.includes("cssWidth") || !app.includes("cssScale") || !app.includes("CSS-normalised")) {
  fail("CSS-pixel normalisation is missing");
}
if (!app.includes("20_000_000")) fail("Large-image pixel-difference guard is missing");
for (const action of ["actions/checkout@v6", "actions/configure-pages@v5", "actions/upload-pages-artifact@v4", "actions/deploy-pages@v4"]) {
  if (!workflow.includes(action)) fail(`Workflow is missing ${action}`);
}

for (const file of ["js/app.js", "service-worker.js"]) {
  const check = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
  if (check.status !== 0) fail(`${file} has a syntax error:\n${check.stderr}`);
}

if (!process.exitCode) console.log("PASS: static smoke tests completed successfully.");
