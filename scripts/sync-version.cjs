const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function writeJson(relativePath, data, { minify = false } = {}) {
  const serialized = minify
    ? JSON.stringify(data)
    : JSON.stringify(data, null, 2);

  fs.writeFileSync(
    path.join(repoRoot, relativePath),
    `${serialized}\n`,
    "utf8"
  );
}

function syncPackageVersion(relativePath, version) {
  const packageJson = readJson(relativePath);
  packageJson.version = version;
  writeJson(relativePath, packageJson);
}

function syncLockfileVersion(relativePath, version) {
  const lockfile = readJson(relativePath);
  lockfile.version = version;

  if (lockfile.packages?.[""]) {
    lockfile.packages[""].version = version;
  }

  writeJson(relativePath, lockfile);
}

function syncFrontendContentVersion(version) {
  const sourceContentDirectory = path.join(repoRoot, "frontend", "src", "content");
  const contentFiles = fs
    .readdirSync(sourceContentDirectory)
    .filter((fileName) => /^app\.[a-z]{2}\.json$/.test(fileName));

  for (const fileName of contentFiles) {
    const sourcePath = path.join("frontend", "src", "content", fileName);
    const generatedPath = path.join("frontend", "content", fileName);
    const content = readJson(sourcePath);
    content.footer = {
      ...content.footer,
      version
    };
    writeJson(sourcePath, content);

    if (fs.existsSync(path.join(repoRoot, generatedPath))) {
      writeJson(generatedPath, content, { minify: true });
    }
  }
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z-.]+)?$/.exec(version);

  if (!match) {
    throw new Error(`Unexpected package version format: ${version}`);
  }

  return match.slice(1, 4).map(Number);
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }

  return 0;
}

function newestVersion(versions) {
  return versions.reduce((newest, version) => (
    compareVersions(version, newest) > 0 ? version : newest
  ));
}

const rootPackage = readJson("package.json");
const backendPackage = readJson("backend/package.json");
const version = newestVersion([rootPackage.version, backendPackage.version]);

syncPackageVersion("package.json", version);
syncPackageVersion("backend/package.json", version);
syncLockfileVersion("package-lock.json", version);
syncLockfileVersion("backend/package-lock.json", version);
syncFrontendContentVersion(version);

console.log(`Synced project version to ${version}.`);
