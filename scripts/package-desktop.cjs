// Keep each build's Electron extraction separate from locked editor/stale files.
// Copy final artifacts to release/ for the existing release workflows.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const { pipeline } = require("node:stream/promises");

const root = path.resolve(__dirname, "..");
const release = path.join(root, "release");
const args = process.argv.slice(2);
const explicitOutput = args.some(arg => /^--config\.directories\.output(?:=|$)/.test(arg) || /^-c\.directories\.output(?:=|$)/.test(arg));
let output;
if (!explicitOutput) {
  fs.mkdirSync(release, { recursive: true });
  output = fs.mkdtempSync(path.join(release, "desktop-"));
  args.push(`--config.directories.output=${output}`);
}
async function main() {
  if (process.platform === "win32" && args.includes("--win") && !args.some(arg => /^--config\.electronDist(?:=|$)/.test(arg))) {
    const builderRequire = createRequire(require.resolve("app-builder-lib"));
    const { downloadArtifact } = builderRequire("@electron/get");
    const unzipper = builderRequire("unzipper");
    const version = require("electron/package.json").version;
    const arch = args.includes("--arm64") ? "arm64" : args.includes("--ia32") ? "ia32" : args.includes("--x64") ? "x64" : process.arch;
    fs.mkdirSync(release, { recursive: true });
    const runtime = fs.mkdtempSync(path.join(release, `electron-${version}-${arch}-`));
    console.log(`Preparing Electron ${version} (${arch}) without its unused default-app archive.`);
    const zip = await downloadArtifact({ version, artifactName: "electron", platform: "win32", arch });
    const archive = await unzipper.Open.file(zip);
    for (const entry of archive.files) {
      const relative = entry.path.replaceAll("\\", "/");
      if (relative === "resources/default_app.asar" || relative.startsWith("resources/default_app.asar/")) continue;
      const destination = path.resolve(runtime, relative);
      if (!destination.startsWith(runtime + path.sep)) throw Error("Unsafe Electron archive path");
      if (entry.type === "Directory") fs.mkdirSync(destination, { recursive: true });
      else {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        await pipeline(entry.stream(), fs.createWriteStream(destination));
      }
    }
    args.push(`--config.electronDist=${runtime}`, `--config.electronVersion=${version}`);
  }
  const result = spawnSync(process.execPath, [require.resolve("electron-builder/cli.js"), ...args], { cwd: root, stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    process.exitCode = 1;
  } else if (result.status !== 0) {
    process.exitCode = result.status || 1;
  } else if (output) {
    let copied = 0;
    for (const entry of fs.readdirSync(output, { withFileTypes: true })) {
      if (entry.isFile() && /\.(exe|blockmap|yml|dmg|zip|appx)$/.test(entry.name)) {
        fs.copyFileSync(path.join(output, entry.name), path.join(release, entry.name));
        copied++;
      }
    }
    console.log(`Build output: ${output}`);
    if (copied) console.log("Completed release artifacts are also copied to release/.");
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
