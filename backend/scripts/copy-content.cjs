const fs = require("node:fs");
const path = require("node:path");

const files = [
  ["src/content/cvRules.json", "dist/content/cvRules.json"],
  ["src/content/messages.json", "dist/content/messages.json"],
];

for (const [source, target] of files) {
  const sourcePath = path.join(__dirname, "..", source);
  const targetPath = path.join(__dirname, "..", target);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}
