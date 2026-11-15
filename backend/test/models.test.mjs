import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { RulesManager, activate, baseline, bundledSnapshot, sha256, validateModelCatalog, getModelCatalog } from "../dist/rules/rulesRuntime.js";
import { fileRulesStorage } from "../dist/rules/nodeRules.js";
import { openAiModel } from "../dist/services/ai/modelNames.js";
import { z } from "zod";
import { createOpenAiJsonResponse } from "../dist/services/ai/cloudProviders/openAiProvider.js";
import { createGeminiJsonResponse } from "../dist/services/ai/cloudProviders/geminiProvider.js";
import { createAnthropicJsonResponse } from "../dist/services/ai/cloudProviders/anthropicProvider.js";
import { createDeepSeekJsonResponse } from "../dist/services/ai/cloudProviders/deepSeekProvider.js";
import { createMistralJsonResponse } from "../dist/services/ai/cloudProviders/mistralProvider.js";
import { ollamaModelCandidates } from "../dist/services/ai/modelNames.js";

const readJson = async (url) => JSON.parse(await readFile(url, "utf8"));
const config = await readJson(new URL("../src/content/config/appOptions.json", import.meta.url));
const catalog = await readJson(new URL("../src/content/config/models.json", import.meta.url));
const schema = z.object({ ok: z.boolean() });
afterEach(() => activate(baseline));

test("localized model lists and defaults match the backend catalog", async () => {
  for (const language of config.outputLanguages) {
    const content = await readJson(new URL(`../../frontend/src/content/app.${language}.json`, import.meta.url));
    assert.ok(content.options.modelLabels.free);
    assert.ok(content.options.modelLabels.experimental);
    assert.equal(content.options.aiModels, undefined, "UI model lists must come from the shared persisted catalog");
    for (const entry of Object.values(catalog.providers)) {
      const ids = entry.models.map(({id}) => id);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(ids.includes(entry.defaultModel));
    }
  }
});

test("environment examples use the same current defaults as the UI", async () => {
  const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  for (const [key, field] of Object.entries({ OPENAI: "OpenAi", GEMINI: "Gemini", DEEPSEEK: "DeepSeek", MISTRAL: "Mistral", ANTHROPIC: "Anthropic", OLLAMA: "Ollama" })) {
    assert.ok(env.includes(`${key}_MODEL=${catalog.providers[{ OpenAi: "openai", Gemini: "gemini", DeepSeek: "deepseek", Mistral: "mistral", Anthropic: "anthropic", Ollama: "ollama" }[field]].defaultModel}`));
  }
});

test("OpenAI presets retain the Responses API structured-output contract without sampling parameters", async () => {
  for (const model of catalog.providers.openai.models.map(model => model.id)) {
    const client = { responses: { parse: async (request) => {
      assert.equal(request.model, model);
      assert.equal(request.text.format.type, "json_schema");
      assert.equal(request.text.format.strict, true);
      for (const key of ["temperature", "top_p", "top_logprobs"]) assert.equal(Object.hasOwn(request, key), false);
      return { output_parsed: { ok: true } };
    } } };
    assert.deepEqual(await createOpenAiJsonResponse(client, "cv_quality_precheck", schema, "Synthetic test input", model), { ok: true });
  }
});

test("Gemini presets pass supported model IDs and extract validated text", async () => {
  for (const model of catalog.providers.gemini.models.map(model => model.id)) {
    const client = { interactions: { create: async (request) => {
      assert.equal(request.model, model);
      assert.equal(request.generation_config.thinking_level, "high");
      return { output_text: '{"ok":true}' };
    } } };
    assert.deepEqual(await createGeminiJsonResponse(client, "cv_quality_precheck", schema, "Synthetic test input", model), { ok: true });
  }
});

test("Claude 5.5 requests omit unsupported sampling parameters and ignore thinking blocks", async (t) => {
  for (const model of catalog.providers.anthropic.models.map(model => model.id)) {
    t.mock.method(globalThis, "fetch", async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.model, model);
      for (const key of ["temperature", "top_p", "top_k"]) assert.equal(Object.hasOwn(body, key), false);
      return new Response(JSON.stringify({ content: [{ type: "thinking", thinking: "", signature: "test-signature" }, { type: "text", text: '{"ok":true}' }] }));
    });
    assert.deepEqual(await createAnthropicJsonResponse("test-key", "cv_quality_precheck", schema, "Synthetic test input", model), { ok: true });
    t.mock.restoreAll();
  }
});

test("DeepSeek and Mistral presets preserve JSON response mode", async (t) => {
  for (const model of catalog.providers.deepseek.models.map(model => model.id)) {
    const client = { chat: { completions: { create: async (request) => {
      assert.equal(request.model, model);
      assert.equal(request.response_format.type, "json_object");
      return { choices: [{ message: { content: '{"ok":true}' } }] };
    } } } };
    assert.deepEqual(await createDeepSeekJsonResponse(client, "cv_quality_precheck", schema, "Synthetic test input", model), { ok: true });
  }
  for (const model of catalog.providers.mistral.models.map(model => model.id)) {
    t.mock.method(globalThis, "fetch", async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.model, model);
      assert.equal(body.response_format.type, "json_object");
      return new Response(JSON.stringify({ choices: [{ message: { content: [{ type: "text", text: '{"ok":true}' }] } }] }));
    });
    assert.deepEqual(await createMistralJsonResponse("test-key", "cv_quality_precheck", schema, "Synthetic test input", model), { ok: true });
    t.mock.restoreAll();
  }
});

test("new Ollama option does not force a model download or change the installed mixed fallback", () => {
  assert.ok(catalog.providers.ollama.models.some(model => model.id === "qwen3.8"));
  assert.deepEqual(ollamaModelCandidates("qwen3.8"), ["qwen3.8"]);
  assert.deepEqual(ollamaModelCandidates("local-mix"), ["gemma4", "qwen3.6"]);
});

test("model catalog rejects invalid defaults, duplicate IDs, unknown providers, executable fields and paid free-list routes", () => {
  for (const change of [
    c => { c.providers.openai.defaultModel = "missing-model"; },
    c => { c.providers.openai.models.push(c.providers.openai.models[0]); },
    c => { c.providers.untrusted = c.providers.openai; },
    c => { c.providers.openai.apiBaseUrl = "https://untrusted.invalid/"; },
    c => { c.providers.openrouter.models[0].id = "paid/model"; },
    c => { c.providers.openai.models[0].id = "javascript:alert(1)"; },
    c => { c.ollamaFallbackModels = ["local-mix"]; },
    c => { c.schemaVersion = 2; }
  ]) {
    const invalid = structuredClone(catalog); change(invalid);
    assert.throws(() => validateModelCatalog(invalid));
  }
});

test("model-only updates persist offline, change resolver defaults, download only models.json and roll back", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "career-signal-model-test-"));
  try {
    const snapshot = await bundledSnapshot();
    const changed = structuredClone(catalog);
    changed.providers.openai.models.push({ id: "future-compatible-model", label: "Future compatible model" });
    changed.providers.openai.defaultModel = "future-compatible-model";
    snapshot.manifest.revision++;
    snapshot.files["models.json"] = JSON.stringify(changed);
    snapshot.manifest.files["models.json"] = await sha256(snapshot.files["models.json"]);
    const downloads = [];
    const manager = new RulesManager(fileRulesStorage(directory), undefined, 1, async (url) => {
      const name = new URL(url).pathname.split("/").pop(); downloads.push(name);
      return new Response(name === "manifest.json" ? JSON.stringify(snapshot.manifest) : snapshot.files[name]);
    });
    await manager.load(); assert.equal(downloads.length, 0);
    assert.equal(await manager.refresh(), true);
    assert.deepEqual(downloads, ["manifest.json", "models.json"]);
    assert.equal(openAiModel(), process.env.OPENAI_MODEL || "future-compatible-model");
    assert.equal(getModelCatalog().providers.openai.defaultModel, "future-compatible-model");
    activate(baseline);
    const reloaded = new RulesManager(fileRulesStorage(directory), "", 1, async () => { throw Error("Offline"); });
    await reloaded.load();
    assert.equal(getModelCatalog().providers.openai.defaultModel, "future-compatible-model");
    assert.equal(await reloaded.rollback(), true);
    assert.equal(getModelCatalog().providers.openai.defaultModel, catalog.providers.openai.defaultModel);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("career-signal-model-test-"));
    await rm(directory, { recursive: true, force: true });
  }
});

test("live browser catalog updates preserve explicit selections and prefer validated backend catalogs", async () => {
  class Select {
    options = []; value = "";
    set innerHTML(json) { this.options = JSON.parse(json).map(([value, text]) => ({ value, text })); this.value = this.options[0]?.value || ""; }
  }
  const modelSelect = new Select();
  const state = { backendModelCatalog: null, aiModelSelectionTouched: false, customAiModels: {} };
  const provider = { value: "openai" }, custom = { value: "" };
  const sandbox = {
    state, els: { aiProvider: provider, aiModel: modelSelect },
    window: { CareerSignalRules: { getModelCatalog, validateModelCatalog } },
    config: { options: { customAiModelLabel: "Custom model", modelLabels: { free: "gratuit", experimental: "expérimental" } } },
    optionList: JSON.stringify, apiUrl: (path) => path, AbortSignal,
    selectedAiModel: () => modelSelect.value === "__custom__" ? custom.value : modelSelect.value,
    restoreCustomModel: () => { custom.value = state.customAiModels[provider.value] || ""; },
    updateApiKeyCopy: () => {}
  };
  vm.createContext(sandbox);
  const source = await readFile(new URL("../../frontend/src/app/05-form-controls.js", import.meta.url), "utf8");
  vm.runInContext(source.slice(source.indexOf("function populateAiModels()"), source.indexOf("function isCustomModelSelected()")), sandbox);
  sandbox.populateAiModels();
  assert.equal(modelSelect.value, catalog.providers.openai.defaultModel);
  const selected = catalog.providers.openai.models[1].id;
  modelSelect.value = selected; state.aiModelSelectionTouched = true;
  const changed = structuredClone(baseline);
  changed["models.json"].providers.openai.models = [{ id: "replacement-model", label: "Replacement" }];
  changed["models.json"].providers.openai.defaultModel = "replacement-model";
  activate(changed); sandbox.refreshAvailableModels();
  assert.equal(modelSelect.value, "__custom__"); assert.equal(custom.value, selected);
  state.aiModelSelectionTouched = false; sandbox.refreshAvailableModels();
  assert.equal(modelSelect.value, "replacement-model");
  sandbox.fetch = async (url, options) => {
    assert.equal(url, "/api/model-catalog"); assert.equal(options.body, undefined);
    return new Response(JSON.stringify(catalog));
  };
  await sandbox.refreshBackendModelCatalog();
  assert.equal(modelSelect.value, catalog.providers.openai.defaultModel);
  sandbox.fetch = async () => new Response('{"providers":{}}');
  await sandbox.refreshBackendModelCatalog();
  assert.equal(state.backendModelCatalog, null); assert.equal(modelSelect.value, "replacement-model");
  provider.value = "openrouter"; sandbox.populateAiModels();
  assert.ok(modelSelect.options[0].text.endsWith("(gratuit)"));
  let backendBase = "old-backend";
  sandbox.apiUrl = path => backendBase + path;
  let finishOldRequest;
  sandbox.fetch = () => new Promise(resolve => { finishOldRequest = resolve; });
  const pending = sandbox.refreshBackendModelCatalog();
  backendBase = "new-backend";
  finishOldRequest(new Response(JSON.stringify(catalog)));
  await pending;
  assert.equal(state.backendModelCatalog, null, "A stale backend response must not overwrite a newer connection");
});
