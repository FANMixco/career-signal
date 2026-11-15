// Regression checks for the modern-minimatch override and SDK/schema upgrade.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");

async function main() {
  const builderRequire = createRequire(require.resolve("app-builder-lib"));
  const modern = builderRequire("minimatch");
  assert.equal(new modern.Minimatch("frontend/**/*", { dot: true }).match("frontend/rules/evaluation.json"), true);
  assert.equal(new modern.Minimatch("!**/*.md", { dot: true }).match("docs/rules.md"), false);
  const universalRequire = createRequire(builderRequire.resolve("@electron/universal"));
  assert.equal(universalRequire("minimatch").minimatch("Contents/Info.plist", "*.plist", { matchBase: true }), true);

  const asarRequire = createRequire(builderRequire.resolve("@electron/asar"));
  assert.equal(typeof asarRequire("minimatch"), "function", "Legacy callers must retain their callable minimatch API");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "career-signal-dependency-check-"));
  try {
    const source = path.join(directory, "source"), archive = path.join(directory, "test.asar");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "example.txt"), "packaging smoke test");
    await builderRequire("@electron/asar").createPackage(source, archive);
    assert.equal(builderRequire("@electron/asar").extractFile(archive, "example.txt").toString(), "packaging smoke test");
  } finally {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("career-signal-dependency-check-"));
    await fs.rm(resolved, { recursive: true, force: true });
  }

  const backendRequire = createRequire(path.join(__dirname, "../backend/package.json"));
  const { zodTextFormat } = backendRequire("openai/helpers/zod");
  const schemas = await import(pathToFileURL(path.join(__dirname, "../backend/dist/schemas/aiSchemas.js")).href);
  for (const [name, schema] of [["precheck", schemas.precheckSchema], ["analysis", schemas.analysisSchema]]) {
    const format = zodTextFormat(schema, name);
    assert.equal(format.type, "json_schema");
    assert.ok(Object.keys(format.schema.properties).length > 0);
  }
  console.log("Dependency compatibility checks passed (builder matching, universal matching, legacy ASAR packing, OpenAI/Zod schemas).");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
