const fs = require("node:fs");
const path = require("node:path");

const distContentDir = path.join(__dirname, "..", "dist", "content");

fs.rmSync(distContentDir, { recursive: true, force: true });

const files = [
  ["src/content/appOptions.json", "dist/content/appOptions.json"],
  ["src/content/cvGuidance.json", "dist/content/cvGuidance.json"],
  ["src/content/messages.json", "dist/content/messages.json"],
  ["src/content/sensitivePersonalData.json", "dist/content/sensitivePersonalData.json"],
];

for (const [source, target] of files) {
  const sourcePath = path.join(__dirname, "..", source);
  const targetPath = path.join(__dirname, "..", target);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}
