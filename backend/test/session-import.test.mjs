import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = async (path) => readFile(new URL(path, import.meta.url), "utf8");
const catalog = JSON.parse(await read("../src/content/config/models.json"));
const baseConfig = JSON.parse(await read("../../frontend/src/content/app.en.json"));
const sessionSource = await read("../../frontend/src/app/03-session-io.js");
const controlsSource = await read("../../frontend/src/app/05-form-controls.js");
const renderingSource = await read("../../frontend/src/app/02-ui-rendering.js");
const utilsSource = await read("../../frontend/src/app/01-utils.js");

function browser() {
  class Field {
    _value = ""; options = []; checked = false;
    classList = { contains: () => false };
    get value() { return this._value; }
    set value(value) { this._value = String(value ?? ""); }
  }
  class Select extends Field {
    get value() { return this._value; }
    set value(value) { const text = String(value ?? ""); this._value = this.options.some(option => option.value === text) ? text : ""; }
    set innerHTML(json) {
      if (!json) return;
      this.options = JSON.parse(json).map(([value, label]) => ({ value, label }));
      this._value = this.options[0]?.value || "";
    }
  }
  const elements = { aiProvider: new Select(), aiModel: new Select(), outputLanguage: new Select() };
  const els = new Proxy(elements, { get(target, key) { return target[key] ||= new Field(); } });
  const state = { customAiModels: {}, backendModelCatalog: null, precheckInFlight: false, analysisInFlight: false };
  const sandbox = {
    state, els, baseConfig, config: baseConfig,
    window: { CareerSignalRules: { getModelCatalog: () => catalog } },
    optionList: JSON.stringify,
    normalizeLanguage: value => ["en", "es", "fr", "de"].includes(value) ? value : "en",
    persistLanguage: () => {}, setActiveLanguage: () => {}, applyConfiguredText: () => {},
    populateStaticSelects: () => {
      els.aiProvider.innerHTML = JSON.stringify(Object.keys(catalog.providers).map(id => [id, id]));
      els.outputLanguage.innerHTML = JSON.stringify(["en", "es", "fr", "de"].map(id => [id, id]));
    },
    populateTargetStyles: () => {}, updateMetadataVisibility: () => {}, updateApiKeyCopy: () => {},
    restoreCustomModel: () => { els.ollamaCustomModel.value = state.customAiModels[els.aiProvider.value] || ""; },
    isCustomModelSelected: () => els.aiModel.value === "__custom__",
    selectedAiModel: () => els.aiModel.value === "__custom__" ? els.ollamaCustomModel.value.trim() : els.aiModel.value,
    currentPrecheckSignature: () => "test-signature", show: () => {},
    renderPrecheck: () => {}, renderAnalysis: () => {}, renderCurrentOutputs: () => {},
    setTailoringAccess: () => {}, refreshTailoringLockCopy: () => {},
    setTailoringFeedback: () => {}, setFeedback: () => {}, setStatus: () => {}, setBusy: () => {},
    buildEvidenceRecoveryExamples: () => ({}), fetch: () => { throw Error("Session import must not call a provider"); }
  };
  vm.createContext(sandbox);
  vm.runInContext(renderingSource.slice(renderingSource.indexOf("function setSelectValue(")), sandbox);
  vm.runInContext(controlsSource.slice(controlsSource.indexOf("function populateAiModels()"), controlsSource.indexOf("function isCustomModelSelected()")), sandbox);
  vm.runInContext(utilsSource.slice(utilsSource.indexOf("function refreshLanguage()"), utilsSource.indexOf("function refreshTailoringLockCopy()")), sandbox);
  vm.runInContext(sessionSource, sandbox);
  sandbox.populateStaticSelects(); sandbox.populateAiModels();
  return sandbox;
}

test("each bundled demo restores its saved model as custom and round-trips the exact provider/ID", async () => {
  for (const language of ["en", "es", "fr", "de"]) {
    const suffix = language === "en" ? "" : `-${language}`;
    const bundle = JSON.parse(await read(`../../sample/bain-company-career-signal-session-20260712T082827Z${suffix}.json`));
    const ui = browser();
    ui.applyImportedSession(bundle);
    assert.equal(ui.els.aiProvider.value, bundle.inputs.aiSettings.provider);
    assert.equal(ui.els.aiModel.value, "__custom__");
    assert.equal(ui.els.ollamaCustomModel.value, bundle.inputs.aiSettings.model);
    assert.equal(ui.selectedAiModel(), "gpt-5.4-mini");
    assert.equal(ui.state.aiModelSelectionTouched, true);
    ui.refreshAvailableModels();
    assert.equal(ui.selectedAiModel(), bundle.inputs.aiSettings.model);
    ui.refreshLanguage();
    assert.equal(ui.els.aiModel.value, "__custom__");
    assert.equal(ui.selectedAiModel(), bundle.inputs.aiSettings.model);
    const exported = ui.buildExportBundle();
    assert.equal(exported.inputs.aiSettings.provider, bundle.inputs.aiSettings.provider);
    assert.equal(exported.inputs.aiSettings.model, bundle.inputs.aiSettings.model);
    assert.equal(exported.inputs.aiSettings.selectedModelOption, "__custom__");
    assert.equal(exported.inputs.cvText, bundle.inputs.cvText);
  }
});

test("the saved actual model ID takes precedence over a stale dropdown marker", () => {
  const ui = browser();
  ui.applyImportedSession({ inputs: { aiSettings: {
    provider: "openai", model: "saved-model-no-longer-listed", selectedModelOption: catalog.providers.openai.defaultModel
  } } });
  assert.equal(ui.els.aiModel.value, "__custom__");
  assert.equal(ui.selectedAiModel(), "saved-model-no-longer-listed");
});

test("listed selections remain presets while explicit custom selections stay custom", () => {
  const current = catalog.providers.openai.defaultModel;
  const listed = browser();
  listed.applyImportedSession({ inputs: { aiSettings: { provider: "openai", model: current, selectedModelOption: current } } });
  assert.equal(listed.els.aiModel.value, current);
  const custom = browser();
  custom.applyImportedSession({ inputs: { aiSettings: { provider: "openai", model: current, selectedModelOption: "__custom__" } } });
  assert.equal(custom.els.aiModel.value, "__custom__");
  assert.equal(custom.selectedAiModel(), current);
});

test("legacy and custom-map-only sessions restore their saved model IDs", () => {
  const legacy = browser();
  legacy.applyImportedSession({ inputs: { aiProvider: "deepseek", aiModel: "deepseek-v4-flash" } });
  assert.equal(legacy.els.aiProvider.value, "deepseek");
  assert.equal(legacy.els.aiModel.value, "__custom__");
  assert.equal(legacy.selectedAiModel(), "deepseek-v4-flash");
  const custom = browser();
  custom.applyImportedSession({ inputs: { aiSettings: { provider: "ollama", selectedModelOption: "__custom__", customModels: { ollama: "qwen3:14b" } } } });
  assert.equal(custom.els.aiModel.value, "__custom__");
  assert.equal(custom.selectedAiModel(), "qwen3:14b");
});
