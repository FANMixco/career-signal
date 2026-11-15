// Build in temporary directories, publishing only completed artifacts to release/.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const { pipeline } = require("node:stream/promises");
const root = path.resolve(__dirname, "..");
const release = path.join(root, "release");

function planBuilds(input, hostArch = process.arch) {
  const args = [...input];
  let output;
  for (let i = 0; i < args.length; i++) {
    if (/^(--config|-c)\.directories\.output(?:=|$)/.test(args[i])) {
      const option = args.splice(i, 1)[0];
      output = option.includes("=") ? option.slice(option.indexOf("=") + 1) : args.splice(i, 1)[0];
      if (!output) throw Error("Missing output directory");
      i--;
    }
  }
  const windows = args.includes("--win");
  const architectures = windows ? ["x64", "arm64", "ia32"].filter(arch => args.includes(`--${arch}`)) : [];
  return (architectures.length ? architectures : [hostArch]).map(arch => ({
    arch,
    output: path.resolve(root, output || "release"),
    args: windows ? [...args.filter(arg => !["--x64", "--arm64", "--ia32"].includes(arg)), `--${arch}`] : args,
    windows
  }));
}

async function main(input = process.argv.slice(2)) {
  for (const build of planBuilds(input)) {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "career-signal-build-"));
    const output = path.join(scratch, "output");
    const args = [...build.args, `--config.directories.output=${output}`];
    try {
      if (process.platform === "win32" && build.windows && !args.some(arg => /^(--config|-c)\.electronDist(?:=|$)/.test(arg))) {
        const builderRequire = createRequire(require.resolve("app-builder-lib"));
        const { downloadArtifact } = builderRequire("@electron/get");
        const unzipper = builderRequire("unzipper");
        const version = require("electron/package.json").version;
        const runtime = path.join(scratch, "electron");
        console.log(`Preparing Electron ${version} (${build.arch}) without its unused default-app archive.`);
        const zip = await downloadArtifact({ version, artifactName: "electron", platform: "win32", arch: build.arch });
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
      if (result.error) throw result.error;
      if (result.status !== 0) throw Error(`Packaging ${build.arch} failed (${result.status ?? result.signal})`);
      if (args.includes("--dir")) {
        const target = path.join(build.output, "unpacked", require("../package.json").version, build.arch);
        fs.mkdirSync(target, { recursive: true });
        fs.cpSync(output, target, { recursive: true });
        console.log(`Unpacked application: ${target}`);
      } else {
        fs.mkdirSync(build.output, { recursive: true });
        for (const entry of fs.readdirSync(output, { withFileTypes: true })) {
          if (entry.isFile() && /\.(exe|blockmap|yml|dmg|zip|appx)$/.test(entry.name) && !entry.name.startsWith("builder-")) {
            const target = path.join(build.output, entry.name);
            const pending = `${target}.pending`;
            fs.copyFileSync(path.join(output, entry.name), pending);
            fs.renameSync(pending, target);
            console.log(`Release artifact: ${target}`);
          }
        }
      }
    } finally {
      // Delete only the directory created by this invocation, inside OS temporary storage.
      const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(scratch));
      if (relative.startsWith("career-signal-build-") && !relative.includes(path.sep)) {
        try {
          console.log(`Cleaning temporary ${build.arch} build files.`);
          fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 3 });
        }
        catch (error) { console.warn(`Temporary build files remain at ${scratch}: ${error.message}`); }
      }
    }
  }
}
module.exports = { planBuilds };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
