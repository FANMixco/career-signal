// Publish the exact bundled JSON through the repository's existing Pages root.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const files = {
  "evaluation.json": "rules/evaluation.json",
  "cvGuidance.json": "guidance/cvGuidance.json",
  "sensitivePersonalData.json": "guidance/sensitivePersonalData.json"
};
const output = path.join(root, "frontend/rules");
fs.mkdirSync(output, { recursive: true });
const hashes = {};
for (const [name, source] of Object.entries(files)) {
  const data = JSON.parse(fs.readFileSync(path.join(root, "backend/src/content", source), "utf8"));
  const raw = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(path.join(output, name), raw);
  hashes[name] = createHash("sha256").update(raw).digest("hex");
}
// A content change requires a new monotonic revision. Keep it explicit/reviewable.
const release = require("../backend/src/rules/release.json");
fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify({ ...release, files: hashes }, null, 2) + "\n");

function shape(value, trail = "") {
  if (typeof value === "string") return trail.endsWith(".severity") ? { enum: ["info", "warning", "error"] } : trail.endsWith(".recommendation") ? { enum: ["compression", "recent", "independent", "concurrent"] } : { type: "string", minLength: 1, maxLength: 12000, pattern: "\\S" };
  if (typeof value === "number") {
    if (trail.includes(".thresholds.")) return { type: trail.endsWith("olderDetailRatio") ? "number" : "integer", minimum: 1, maximum: 1000 };
    if (trail.includes(".scoreBands.")) return { type: "integer", minimum: 0, maximum: 99 };
    return { type: "number", minimum: 0, maximum: 100000 };
  }
  if (typeof value === "boolean") return { type: "boolean" };
  if (Array.isArray(value)) return { type: "array", minItems: 1, maxItems: 100, items: shape(value[0], trail) };
  return { type: "object", additionalProperties: false, required: Object.keys(value), properties: Object.fromEntries(Object.entries(value).map(([key, val]) => [key, shape(val, trail + "." + key)])) };
}
const definitions = Object.fromEntries(Object.keys(files).map((name) => [name, shape(JSON.parse(fs.readFileSync(path.join(output, name), "utf8")), name)]));
definitions.manifest = { type: "object", additionalProperties: false, required: ["schemaVersion", "engineMin", "engineMax", "revision", "files"], properties: { schemaVersion: { const: 1 }, engineMin: { type: "integer", minimum: 1 }, engineMax: { type: "integer", minimum: 1 }, revision: { type: "integer", minimum: 1 }, files: { type: "object", additionalProperties: false, required: Object.keys(files), properties: Object.fromEntries(Object.keys(files).map((name) => [name, { type: "string", pattern: "^[a-f0-9]{64}$" }])) } } };
fs.writeFileSync(path.join(root, "docs/rules.schema.json"), JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", $defs: definitions }, null, 2) + "\n");
