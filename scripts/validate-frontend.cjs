const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
let failed = false;
for (const name of ["app.min.js", "rules.min.js", "service-worker.js"]) {
  const filename = path.join("frontend", name);
  try {
    new vm.Script(fs.readFileSync(path.join(root, filename), "utf8"), { filename });
  } catch (error) {
    console.error(`${filename}: ${error.message}`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
else console.log("Generated frontend JavaScript syntax passed.");
