import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));
test("frontend builds produce identical assets and cache hashes with LF and CRLF checkouts", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "career-frontend-build-"));
  try {
    for (const [name, eol] of [["linux", "\n"], ["windows", "\r\n"]]) {
      const mirror = path.join(temporary, name);
      async function copy(relative) {
        const source = path.join(root, relative), destination = path.join(mirror, relative);
        if ((await stat(source)).isDirectory()) {
          for (const entry of await readdir(source)) await copy(path.join(relative, entry));
        } else {
          await mkdir(path.dirname(destination), { recursive: true });
          const text = (await readFile(source, "utf8")).replace(/\r\n/g, "\n").replace(/\n/g, eol);
          await writeFile(destination, text);
        }
      }
      for (const source of ["backend/src", "backend/tsconfig.json", "backend/package.json", "frontend/src", "frontend/index.html", "frontend/site.webmanifest", "package.json", "scripts/build-frontend.cjs", "scripts/build-rules.cjs", "scripts/validate-frontend.cjs"]) await copy(source);
      await mkdir(path.join(mirror, "docs"), { recursive: true });
      execFileSync(process.execPath, ["scripts/build-frontend.cjs"], { cwd: mirror, env: { ...process.env, NODE_PATH: path.join(root, "backend/node_modules") }, stdio: "pipe" });
    }
    const first = path.join(temporary, "linux"), second = path.join(temporary, "windows");
    const artifacts = ["frontend/app.min.js", "frontend/rules.min.js", "frontend/styles.min.css", "frontend/service-worker.js", "docs/rules.schema.json"];
    for (const folder of ["frontend/content", "frontend/rules"]) {
      for (const entry of await readdir(path.join(first, folder))) artifacts.push(`${folder}/${entry}`);
    }
    for (const artifact of artifacts) assert.deepEqual(await readFile(path.join(first, artifact)), await readFile(path.join(second, artifact)), artifact);
    assert.match(await readFile(path.join(first, "frontend/service-worker.js"), "utf8"), /career-signal-[a-f0-9]{16}/);
  } finally {
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith("career-frontend-build-"));
    await rm(temporary, { recursive: true, force: true });
  }
});
