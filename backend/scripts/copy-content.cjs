const fs = require("node:fs");
const path = require("node:path");

const distContentDir = path.join(__dirname, "..", "dist", "content");

fs.rmSync(distContentDir, { recursive: true, force: true });

const files = [
  ["src/content/config/appOptions.json", "dist/content/config/appOptions.json"],
  ["src/content/ai/cloudModelService.json", "dist/content/ai/cloudModelService.json"],
  ["src/content/guidance/cvGuidance.json", "dist/content/guidance/cvGuidance.json"],
  ["src/content/guidance/sensitivePersonalData.json", "dist/content/guidance/sensitivePersonalData.json"],
  ["src/content/messages/messages.en.json", "dist/content/messages/messages.en.json"],
  ["src/content/messages/messages.es.json", "dist/content/messages/messages.es.json"],
  ["src/content/messages/messages.fr.json", "dist/content/messages/messages.fr.json"],
  ["src/content/messages/messages.de.json", "dist/content/messages/messages.de.json"],
];

for (const [source, target] of files) {
  const sourcePath = path.join(__dirname, "..", source);
  const targetPath = path.join(__dirname, "..", target);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}
