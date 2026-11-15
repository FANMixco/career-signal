import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { baseline, activate, getCvBasics, careerRecommendation, validateCvBasicsView, validateData, RulesManager, bundledSnapshot, sha256 } from "../dist/rules/rulesRuntime.js";

afterEach(() => activate(baseline));

test("CV basics includes CV01–CV04 in all languages with shared analysis recommendations", () => {
  for (const language of ["en", "es", "fr", "de"]) {
    const content = getCvBasics(language);
    validateCvBasicsView(content);
    assert.equal(content.blocks.filter(block => block.ruleId).length, 4);
    assert.ok(content.blocks.length > 4, "Existing teaching sections must be retained");
    for (const id of ["CV01", "CV02", "CV03", "CV04"]) {
      const block = content.blocks.find(block => block.ruleId === id);
      assert.equal(block.items[0], careerRecommendation(id, language));
      assert.ok(!/\{\w+\}/.test(block.text || ""));
    }
  }
});

test("rule thresholds, recommendation text, enabled flags and JSON-only teaching edits update the same view", () => {
  const changed = structuredClone(baseline);
  changed["evaluation.json"].rules.CV01.thresholds.minimumPositions = 6;
  changed["evaluation.json"].rules.CV02.thresholds.recentYears = 9;
  changed["evaluation.json"].recommendations.compression.en = "Shared updated compression advice.";
  changed["evaluation.json"].rules.CV04.enabled = false;
  changed["cvBasics.json"].locales.en.blocks[0].title = "Updated educational heading";
  activate(changed);
  const view = getCvBasics("en");
  assert.equal(view.blocks[0].title, "Updated educational heading");
  assert.ok(view.blocks.find(block => block.ruleId === "CV01").text.includes("6"));
  assert.deepEqual(view.blocks.find(block => block.ruleId === "CV01").items, ["Shared updated compression advice."]);
  assert.ok(view.blocks.find(block => block.ruleId === "CV02").text.includes("9"));
  assert.ok(view.blocks.find(block => block.ruleId === "CV02").items[0].includes("9"));
  assert.equal(view.blocks.some(block => block.ruleId === "CV04"), false);
});

test("CV basics rejects unsafe links, executable fields, incomplete locales and broken references", () => {
  for (const change of [
    d => { d["cvBasics.json"].locales.en.playlistUrl = "javascript:alert(1)"; },
    d => { d["cvBasics.json"].locales.en.blocks[0].script = "alert(1)"; },
    d => { delete d["cvBasics.json"].locales.fr; },
    d => { d["cvBasics.json"].locales.en.blocks = d["cvBasics.json"].locales.en.blocks.filter(block => block.ruleId !== "CV04"); },
    d => { d["cvBasics.json"].locales.en.blocks.find(block => block.ruleId === "CV01").text = "Unknown {threshold}"; },
    d => { d["cvBasics.json"].locales.en.blocks.find(block => block.ruleId === "CV01").items = ["A second copy of the recommendation"]; }
  ]) {
    const invalid = structuredClone(baseline); change(invalid);
    assert.throws(() => validateData(invalid));
  }
});

test("teaching-only updates download one JSON file, survive an offline reload and roll back", async () => {
  const snapshot = await bundledSnapshot(); snapshot.manifest.revision++;
  const content = structuredClone(baseline["cvBasics.json"]);
  content.locales.en.blocks[0].title = "Synced teaching section";
  snapshot.files["cvBasics.json"] = JSON.stringify(content);
  snapshot.manifest.files["cvBasics.json"] = await sha256(snapshot.files["cvBasics.json"]);
  let saved;
  const storage = { read: async () => saved, write: async state => { saved = structuredClone(state); } };
  const downloads = [];
  const manager = new RulesManager(storage, undefined, 1, async url => {
    const name = new URL(url).pathname.split("/").pop(); downloads.push(name);
    return new Response(name === "manifest.json" ? JSON.stringify(snapshot.manifest) : snapshot.files[name]);
  });
  await manager.load(); assert.equal(await manager.refresh(), true);
  assert.deepEqual(downloads, ["manifest.json", "cvBasics.json"]);
  assert.equal(getCvBasics().blocks[0].title, "Synced teaching section");
  activate(baseline);
  const offline = new RulesManager(storage, "", 1, async () => { throw Error("Offline"); });
  await offline.load(); assert.equal(getCvBasics().blocks[0].title, "Synced teaching section");
  assert.equal(await offline.rollback(), true);
  assert.equal(getCvBasics().blocks[0].title, baseline["cvBasics.json"].locales.en.blocks[0].title);
});

test("the modal renders synchronized sections safely and follows the current language/backend", async () => {
  const source = await readFile(new URL("../../frontend/src/app/02-ui-rendering.js", import.meta.url), "utf8");
  const els = { outputLanguage: { value: "en" }, cvBasicsBody: {}, cvBasicsTitle: {}, cvBasicsSubtitle: {} };
  const state = { backendCvBasics: null };
  const sandbox = { els, state, window: { CareerSignalRules: { getCvBasics, validateCvBasicsView } }, apiUrl: path => path, AbortSignal,
    escapeHtml: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;") };
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  sandbox.renderCvBasics();
  for (const block of getCvBasics().blocks.filter(block => block.ruleId)) assert.ok(els.cvBasicsBody.innerHTML.includes(block.title));
  const backend = getCvBasics(); backend.title = "Backend basics";
  backend.blocks[0] = { title: "<script>test</script>", text: "Plain text" };
  sandbox.fetch = async () => new Response(JSON.stringify(backend));
  await sandbox.refreshBackendCvBasics();
  assert.equal(els.cvBasicsTitle.textContent, "Backend basics");
  assert.ok(els.cvBasicsBody.innerHTML.includes("&lt;script&gt;test&lt;/script&gt;"));
  assert.ok(!els.cvBasicsBody.innerHTML.includes("<script>"));
  els.outputLanguage.value = "es"; sandbox.renderCvBasics();
  assert.equal(els.cvBasicsTitle.textContent, getCvBasics("es").title);
  sandbox.fetch = async () => new Response('{"playlistUrl":"javascript:alert(1)"}');
  await sandbox.refreshBackendCvBasics();
  assert.equal(state.backendCvBasics, null);
});
