import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { buildLocalPrecheckFallbackSections } from "../dist/services/ai/localCvEvidence.js";
import * as cvRules from "../dist/rules/cvRules.js";
import { baseline, activate, bundledSnapshot, getEvaluation, RulesManager, sha256, validateData, validateManifest, validateSnapshot } from "../dist/rules/rulesRuntime.js";
import { evaluateCareerChecks, extractPositions, mergeCareerWarnings } from "../dist/rules/careerChecks.js";
import { buildLocalPrecheckBaseline } from "../dist/services/ai/localCvEvidence.js";
import { fileRulesStorage, withRules } from "../dist/rules/nodeRules.js";
import { createApp } from "../dist/index.js";

afterEach(() => activate(baseline));
const now = new Date("2026-11-15T12:00:00Z");
const ids = (text, language) => evaluateCareerChecks(text, language, now).map((w) => w.id);
const job = (title, dates, text = "Responsible for routine work.") => `${title} | ${dates}\n${text}\n`;
const weakFour = () => "Professional experience\n" + [job("Engineer A", "2023–Present"), job("Engineer B", "2020–2022"), job("Engineer C", "2017–2019"), job("Engineer D", "2014–2016")].join("\n");
const storage = () => ({ value: undefined, writes: 0, async read() { return this.value; }, async write(value) { this.writes++; this.value = structuredClone(value); } });
async function update(revision = 3, change = (d) => { d["evaluation.json"].rules.CV01.enabled = false; }) {
  const data = structuredClone(baseline); change(data);
  const snapshot = await bundledSnapshot(); snapshot.manifest.revision = revision;
  for (const name of Object.keys(snapshot.files)) { snapshot.files[name] = JSON.stringify(data[name], null, 2) + "\n"; snapshot.manifest.files[name] = await sha256(snapshot.files[name]); }
  return snapshot;
}
function remote(snapshot, options = {}) {
  const calls = [];
  const request = async (url, init) => {
    const name = new URL(url).pathname.split("/").pop(); calls.push({ url: String(url), name, init });
    if (name === options.fail) throw Error("Offline");
    return new Response(name === "manifest.json" ? JSON.stringify(snapshot.manifest) : snapshot.files[name], { status: 200 });
  };
  return { request, calls };
}

test("bundled data and published manifest have matching integrity", async () => {
  validateData(baseline);
  const snapshot = await bundledSnapshot();
  await validateSnapshot(snapshot);
  const published = JSON.parse(await readFile(new URL("../../frontend/rules/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(published, snapshot.manifest);
});

test("externalizing existing thresholds and text preserves baseline evaluator output", async () => {
  // Golden digests captured from the pre-externalization evaluator. These cover
  // numeric scores, all warning/question text and the fallback sections.
  const expected = [
    "5c8e8ec437194de4576682b4250dad01c64b42123464ba7ecf15bcebeb47557e",
    "03f13a4bc4819bc554f153a96e6bab03a97395cd3bc54c8bb60de8268a38b04c",
    "99bdca9763a7cf40bfcd7480323958b485e088af74d755d3e3aa6f439dd7f6e1"
  ];
  let index = 0;
  for (const input of [
    { cvText: weakFour(), yearsOfExperience: 12, hasDegree: true, degreeYear: 2008 },
    { cvText: "- Reduced cost by 25% for 200 users across 4 teams.\n".repeat(20), yearsOfExperience: 3 },
    { cvText: "Strategic thinker. Responsible for cloud governance and AI automation.\n".repeat(200), yearsOfExperience: 18 }
  ]) {
    const after = buildLocalPrecheckBaseline(input);
    assert.equal(await sha256(JSON.stringify([after, buildLocalPrecheckFallbackSections(input, after)])), expected[index++]);
  }
});

test("new rule thresholds and live recommendation bands apply without engine changes", () => {
  const changed = structuredClone(baseline);
  changed["evaluation.json"].rules.CV01.thresholds.minimumPositions = 10;
  changed["evaluation.json"].rules.CV04.thresholds.minimumOverlapMonths = 60;
  changed["evaluation.json"].rules.CV02.thresholds.recentYears = 3;
  changed["evaluation.json"].scoreBands = { improveFirstMax: 10, cautionMax: 20 };
  changed["cvGuidance.json"].defaultMetricRecoveryQuestions = ["Updated recovery question?"];
  activate(changed);
  assert.ok(!ids(weakFour()).includes("CV01"));
  assert.ok(!ids(job("Engineer A", "2020–2024") + job("Engineer B", "2022–Present")).includes("CV04"));
  assert.equal(cvRules.recommendationForScore(21), "Proceed");
  assert.equal(cvRules.educationPrivacy.ageWarning, baseline["cvGuidance.json"].educationPrivacy.ageWarning);
  assert.deepEqual(buildLocalPrecheckBaseline({ cvText: weakFour(), yearsOfExperience: 10 }).questionsToRecoverMetrics, ["Updated recovery question?"]);
  const older = "Built systems for global users. ".repeat(30);
  const warnings = evaluateCareerChecks(job("Engineer", "2024–Present") + job("Engineer", "2014–2020", older), "en", now);
  assert.ok(warnings.find(w => w.id === "CV02").message.includes("recent 3 years"));
});

test("CV01 needs four positions and multiple weak roles; rich evidence does not trigger", () => {
  assert.ok(ids(weakFour()).includes("CV01"));
  assert.ok(!ids(job("Engineer", "2020–Present")).includes("CV01"));
  const rich = "Built systems for 200 users.\nReduced incident risk for global teams.";
  assert.ok(!ids(weakFour().replaceAll("Responsible for routine work.", rich)).includes("CV01"));
});

test("CV02 prioritizes recent detail but preserves relevant older experience", () => {
  const older = "Built reliable systems for global users. ".repeat(20);
  assert.ok(ids(job("Engineer", "2020–Present") + job("Architect", "2008–2014", older)).includes("CV02"));
  assert.ok(!ids(job("Engineer", "2020–Present", older) + job("Architect", "2008–2014")).includes("CV02"));
  assert.ok(!ids(job("Architect", "2008–2014", older)).includes("CV02"));
});

test("CV03 warns on ambiguous independent activities, not clearly classified freelance work", () => {
  assert.ok(ids(job("Technical author", "2020–Present", "Published a newsletter and blog for users.")).includes("CV03"));
  assert.ok(!ids(job("Freelance content creator", "2020–Present", "Published a newsletter for users.")).includes("CV03"));
  assert.ok(ids("Personal blog, 40 articles").includes("CV03"));
});

test("CV04 detects definite overlap, ignores transitions and explained arrangements", () => {
  assert.ok(ids(job("Engineer A", "Jan 2020–Dec 2024") + job("Engineer B", "2022-01–2026-01")).includes("CV04"));
  assert.ok(!ids(job("Engineer A", "2018–2020") + job("Engineer B", "2020–Present")).includes("CV04"));
  assert.ok(!ids(job("Part-time Engineer A", "2020–2024") + job("Engineer B", "2022–Present")).includes("CV04"));
  assert.ok(!ids("Education\nBachelor | 2020–2024\nMaster | 2022–2026").includes("CV04"));
  assert.equal(extractPositions(job("Engineer", "2025–2020"), now).length, 0);
  assert.equal(extractPositions(job("Engineer", "13/2020–14/2024"), now).length, 0);
  assert.equal(extractPositions(job("Engineer", "2026–Present"), now).length, 1);
  assert.equal(extractPositions(job("Engineer", "2020–2020"), now).length, 1);
  assert.equal(extractPositions("Formation\nMaster | 2018–2020\nExpérience professionnelle\n" + job("Ingénieur", "juin 2021–juillet 2024"), now).length, 1);
});

test("all four languages, configurable enabled/severity/reference, no score penalties or duplicates", () => {
  const text = weakFour(), before = buildLocalPrecheckBaseline({ cvText: text, yearsOfExperience: 10 });
  for (const language of ["en", "es", "fr", "de"]) {
    const warnings = evaluateCareerChecks(text, language, now);
    assert.ok(warnings[0].message);
    assert.deepEqual(mergeCareerWarnings(mergeCareerWarnings([], warnings), warnings), mergeCareerWarnings([], warnings));
  }
  const changed = structuredClone(baseline);
  changed["evaluation.json"].rules.CV01.severity = "error";
  changed["evaluation.json"].rules.CV01.recommendation = "independent";
  activate(changed);
  assert.equal(evaluateCareerChecks(text, "fr", now)[0].severity, "error");
  assert.equal(buildLocalPrecheckBaseline({ cvText: text, yearsOfExperience: 10 }).cvEvidenceScore, before.cvEvidenceScore);
  changed["evaluation.json"].rules.CV01.enabled = false; activate(changed);
  assert.ok(!ids(text).includes("CV01"));
});

test("reject missing keys, unknown code fields, invalid references, ranges and compatibility", async () => {
  for (const change of [d => delete d["evaluation.json"].rules.CV04, d => d["evaluation.json"].rules.CV01.script = "alert(1)", d => d["evaluation.json"].rules.CV01.recommendation = "missing", d => d["evaluation.json"].rules.CV01.thresholds.minimumPositions = -1, d => d["evaluation.json"].scoreBands.cautionMax = 101, d => delete d["evaluation.json"].recommendations.compression.fr]) {
    const data = structuredClone(baseline); change(data); assert.throws(() => validateData(data));
  }
  const snap = await bundledSnapshot();
  assert.throws(() => validateManifest({ ...snap.manifest, schemaVersion: 3 }));
  assert.throws(() => validateManifest({ ...snap.manifest, engineMin: 3 }));
  snap.files["evaluation.json"] += " "; await assert.rejects(validateSnapshot(snap));
});

test("load and analyze offline, download only changed files, atomically activate and rollback", async () => {
  const local = storage(), next = await update(), net = remote(next);
  const manager = new RulesManager(local, undefined, 1000, net.request);
  await manager.load(); assert.equal(net.calls.length, 0);
  assert.ok(ids(weakFour()).includes("CV01"));
  assert.equal(await manager.refresh(), true);
  assert.deepEqual(net.calls.map(c => c.name), ["manifest.json", "evaluation.json"]);
  assert.equal(getEvaluation().rules.CV01.enabled, false);
  assert.ok(manager.state.previous);
  assert.equal(await manager.refresh(), false); assert.equal(net.calls.length, 2);
  assert.equal(await manager.rollback(), true); assert.equal(getEvaluation().rules.CV01.enabled, true);
  for (const call of net.calls) { assert.equal(call.init.credentials, "omit"); assert.equal(call.init.body, undefined); assert.equal(call.init.referrerPolicy, "no-referrer"); }
});

test("partial downloads, bad hashes, incompatible updates and storage failures keep previous rules", async () => {
  for (const mode of ["partial", "hash", "compatibility", "disk"]) {
    const next = await update();
    if (mode === "hash") next.files["evaluation.json"] += "tampered";
    if (mode === "compatibility") next.manifest.engineMin = 3;
    const local = storage(); if (mode === "disk") local.write = async () => { throw Error("Disk full"); };
    const net = remote(next, { fail: mode === "partial" ? "evaluation.json" : undefined });
    const manager = new RulesManager(local, undefined, 1, net.request); await manager.load();
    assert.equal(await manager.refresh(), false, mode);
    assert.equal(getEvaluation().rules.CV01.enabled, true, mode);
    assert.equal(manager.state.current.manifest.revision, 2);
  }
});

test("reload validates current, recovers previous, and handles corrupt local storage", async () => {
  const previous = await bundledSnapshot(), current = await update(); current.files["evaluation.json"] = "broken";
  const local = storage(); local.value = { current, previous, checkedAt: 0 };
  const manager = new RulesManager(local); await manager.load(); assert.equal(getEvaluation().rules.CV01.enabled, true);
  local.value = { current, checkedAt: 0 }; await manager.load(); assert.equal(manager.state.current.manifest.revision, 2);
  local.read = async () => { throw Error("Denied"); }; await new RulesManager(local).load(); assert.equal(getEvaluation().rules.CV01.enabled, true);
});

test("stale revisions, revision reuse, unsafe URLs and oversized streams are rejected", async () => {
  const local = storage(), newer = await update(3); local.value = { current: newer, checkedAt: 0 };
  for (const revision of [1, 3]) {
    const next = await update(revision, d => { d["evaluation.json"].rules.CV01.severity = "error"; });
    const manager = new RulesManager(local, undefined, 1, remote(next).request); await manager.load(); assert.equal(await manager.refresh(), false);
  }
  const net = remote(await update()); const manager = new RulesManager(storage(), "http://evil.invalid/", 1, net.request); await manager.load(); assert.equal(await manager.refresh(), false); assert.equal(net.calls.length, 0);
  const big = new RulesManager(storage(), undefined, 1, async () => new Response("x".repeat(1000001))); await big.load(); assert.equal(await big.refresh(), false);
});

test("filesystem persistence replaces one complete envelope and survives restart", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "career-rules-"));
  try {
    const store = fileRulesStorage(directory), next = await update();
    const manager = new RulesManager(store, undefined, 1, remote(next).request); await manager.load(); await manager.refresh();
    const reloaded = new RulesManager(fileRulesStorage(directory)); await reloaded.load(); assert.equal(getEvaluation().rules.CV01.enabled, false);
    const state = JSON.parse(await readFile(path.join(directory, "rules-state.json"), "utf8")); state.current.files["evaluation.json"] = "broken";
    await writeFile(path.join(directory, "rules-state.json"), JSON.stringify(state));
    await reloaded.load(); assert.equal(getEvaluation().rules.CV01.enabled, true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("in-flight requests keep the rules generation they started with", async () => {
  const changed = structuredClone(baseline); changed["evaluation.json"].rules.CV01.enabled = false;
  await withRules(async () => { activate(changed); await Promise.resolve(); assert.equal(getEvaluation().rules.CV01.enabled, true); });
  assert.equal(getEvaluation().rules.CV01.enabled, false);
});

test("generated browser bundle runs offline without Node or network", async () => {
  const sandbox = { crypto, TextEncoder, TextDecoder, AbortSignal, URL, console, setInterval: () => 1, fetch: async () => { throw Error("Offline"); } };
  vm.createContext(sandbox); vm.runInContext(await readFile(new URL("../../frontend/rules.min.js", import.meta.url), "utf8"), sandbox);
  const result = await sandbox.CareerSignalRules.precheck({ cvText: weakFour().repeat(2), yearsOfExperience: 12, outputLanguage: "de" });
  assert.ok(result.precheck.specificWarnings.some(s => s.startsWith("[CV01]")));
  assert.ok(result.precheck.cvEvidenceScore >= 0);
  assert.equal(result.precheck.questionsToRecoverMetrics.length, 5);
  assert.equal(typeof result.precheck.questionsToRecoverMetrics[0], "string");
});

test("HTTP offline precheck works without API keys, AI service, or remote rules", async () => {
  const server = createApp().listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  try {
    const form = new FormData();
    for (const [key, value] of Object.entries({ cvText: weakFour().repeat(2), yearsOfExperience: "12", hasDegree: "false", experienceSelectionMode: "all", outputLanguage: "fr", offlineOnly: "true" })) form.set(key, value);
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/precheck-cv`, { method: "POST", body: form });
    const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result));
    assert.ok(result.careerWarnings.some(w => w.id === "CV01")); assert.ok(result.precheck.specificWarnings.some(s => s.includes("Plusieurs postes")));
    const catalogResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/model-catalog`);
    assert.equal(catalogResponse.headers.get("cache-control"), "no-store");
    assert.deepEqual(await catalogResponse.json(), baseline["models.json"]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
