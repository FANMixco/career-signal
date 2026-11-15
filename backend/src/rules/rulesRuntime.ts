import release from "./release.json" with { type: "json" };
import evaluation from "../content/rules/evaluation.json" with { type: "json" };
import guidance from "../content/guidance/cvGuidance.json" with { type: "json" };
import personal from "../content/guidance/sensitivePersonalData.json" with { type: "json" };
import models from "../content/config/models.json" with { type: "json" };
import cvBasics from "../content/guidance/cvBasics.json" with { type: "json" };

export const ENGINE_VERSION = 3;
export const FILES = ["evaluation.json", "cvGuidance.json", "sensitivePersonalData.json", "models.json", "cvBasics.json"] as const;
export type RuleFile = typeof FILES[number];
export const baseline = { "evaluation.json": evaluation, "cvGuidance.json": guidance, "sensitivePersonalData.json": personal, "models.json": models, "cvBasics.json": cvBasics };
export type ModelCatalog = typeof models;
export type ModelProvider = keyof ModelCatalog["providers"];
export type RuleData = typeof baseline;
export type Manifest = { schemaVersion: number; engineMin: number; engineMax: number; revision: number; files: Record<RuleFile, string> };
export type Snapshot = { manifest: Manifest; files: Record<RuleFile, string> };
export type StoredRules = { current?: Snapshot; previous?: Snapshot; checkedAt: number };
let active = baseline;
let resolveContext: (() => RuleData | undefined) | undefined;
export function setRulesContext(resolver: () => RuleData | undefined) { resolveContext = resolver; }
export function currentRules() { return resolveContext?.() || active; }
export function getEvaluation() { return currentRules()["evaluation.json"]; }
export function getGuidance() { return currentRules()["cvGuidance.json"]; }
export function getPersonalCopy() { return currentRules()["sensitivePersonalData.json"]; }
export function getModelCatalog() { return currentRules()["models.json"]; }
export type BasicsBlock = { title: string; text?: string; items?: string[]; examples?: string[][]; ruleId?: string };
export type CvBasicsView = { title: string; subtitle: string; playlistText: string; playlistUrl: string; blocks: BasicsBlock[] };
type CvBasicsContent = { schemaVersion: number; locales: Record<string, CvBasicsView> };
type CareerRuleId = keyof typeof evaluation.rules;

export function careerRecommendation(id: CareerRuleId, language = "en") {
  const e = getEvaluation();
  const copy = e.recommendations[e.rules[id].recommendation as keyof typeof e.recommendations];
  return (copy[language as keyof typeof copy] || copy.en).replace(/\{recentYears\}/g, String(e.rules.CV02.thresholds.recentYears));
}

export function validateCvBasicsView(input: unknown): CvBasicsView {
  const view = input as CvBasicsView;
  const text = (value: unknown, max = 12000) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
  if (!view || Object.keys(view).sort().join() !== "blocks,playlistText,playlistUrl,subtitle,title" || ![view.title, view.subtitle, view.playlistText, view.playlistUrl].every(value => text(value))) throw Error("Invalid CV basics");
  const url = new URL(view.playlistUrl);
  if (url.protocol !== "https:" || url.username || url.password) throw Error("Invalid CV basics link");
  if (!Array.isArray(view.blocks) || view.blocks.length < 1 || view.blocks.length > 80) throw Error("Invalid CV basics blocks");
  const seen = new Set<string>();
  for (const block of view.blocks) {
    if (!block || typeof block !== "object" || Object.keys(block).some(key => !["title", "text", "items", "examples", "ruleId"].includes(key)) || !text(block.title, 200)) throw Error("Invalid CV basics block");
    if (block.text !== undefined && !text(block.text)) throw Error("Invalid CV basics text");
    if (block.items !== undefined && (!Array.isArray(block.items) || block.items.length < 1 || block.items.length > 40 || !block.items.every(item => text(item)))) throw Error("Invalid CV basics items");
    if (block.examples !== undefined && (!Array.isArray(block.examples) || block.examples.length > 10 || block.examples.some(example => !Array.isArray(example) || example.length !== 2 || !["example", "example strong"].includes(example[0]) || !text(example[1])))) throw Error("Invalid CV basics examples");
    if (block.ruleId !== undefined) {
      if (!Object.hasOwn(evaluation.rules, block.ruleId) || seen.has(block.ruleId)) throw Error("Invalid CV basics rule reference");
      seen.add(block.ruleId);
    }
  }
  return view;
}

function validateCvBasicsContent(input: unknown, e: typeof evaluation) {
  const content = input as CvBasicsContent;
  if (!content || Object.keys(content).sort().join() !== "locales,schemaVersion" || content.schemaVersion !== 1 || !content.locales || Object.keys(content.locales).sort().join() !== "de,en,es,fr") throw Error("Incomplete CV basics locales");
  for (const view of Object.values(content.locales)) {
    validateCvBasicsView(view);
    const ids = view.blocks.filter(block => block.ruleId).map(block => block.ruleId).sort();
    if (ids.join() !== Object.keys(e.rules).sort().join()) throw Error("Incomplete CV basics rule references");
    for (const block of view.blocks) {
      if (!block.ruleId) continue;
      if (block.items || block.examples) throw Error("Rule recommendations must be shared by reference");
      for (const match of (block.text || "").matchAll(/\{(\w+)\}/g)) {
        if (!Object.hasOwn(e.rules[block.ruleId as CareerRuleId].thresholds, match[1])) throw Error("Unknown CV basics threshold");
      }
    }
  }
}

export function getCvBasics(language = "en"): CvBasicsView {
  const content = currentRules()["cvBasics.json"] as CvBasicsContent;
  const source = content.locales[language] || content.locales.en;
  const e = getEvaluation();
  const blocks = source.blocks.flatMap(block => {
    if (!block.ruleId) return [block];
    const id = block.ruleId as CareerRuleId, rule = e.rules[id];
    if (!rule.enabled) return [];
    const values = rule.thresholds as Record<string, number>;
    return [{ ...block, text: block.text?.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key])), items: [careerRecommendation(id, language)] }];
  });
  return { ...source, blocks };
}
const listeners = new Set<() => void>();
export function subscribeRules(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function evaluationInstructions(stage: "precheckInstruction" | "reconstructionInstruction") {
  return Object.values(getGuidance()).filter((value): value is typeof guidance.careerProgressionVisibility => Boolean(value && typeof value === "object" && stage in value)).map((value) => value[stage]).join("\n");
}

// The engine owns the shape and the detectors. Data cannot supply code, regular
// expressions, URLs, or new detector names. Limits also bound processing costs.
function validateShape(value: unknown, template: unknown, path = "root"): void {
  if (typeof template === "string") {
    if (typeof value !== "string" || !value.trim() || value.length > 12000) throw Error(`Invalid text: ${path}`);
  } else if (typeof template === "number") {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100000) throw Error(`Invalid number: ${path}`);
  } else if (typeof template === "boolean") {
    if (typeof value !== "boolean") throw Error(`Invalid flag: ${path}`);
  } else if (Array.isArray(template)) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw Error(`Invalid array: ${path}`);
    value.forEach((item) => validateShape(item, template[0], path));
  } else {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error(`Invalid object: ${path}`);
    const obj = value as Record<string, unknown>, expected = template as Record<string, unknown>;
    if (Object.keys(obj).sort().join("|") !== Object.keys(expected).sort().join("|")) throw Error(`Incomplete or unknown keys: ${path}`);
    for (const key of Object.keys(expected)) validateShape(obj[key], expected[key], `${path}.${key}`);
  }
}

export function validateData(data: unknown): RuleData {
  if (!data || typeof data !== "object" || Object.keys(data).sort().join() !== [...FILES].sort().join()) throw Error("Incomplete ruleset");
  for (const name of FILES) {
    if (name !== "cvBasics.json") validateShape((data as Record<string, unknown>)[name], baseline[name], name);
  }
  const parsed = data as RuleData;
  const e = parsed["evaluation.json"];
  if (!Number.isInteger(e.scoreBands.improveFirstMax) || !Number.isInteger(e.scoreBands.cautionMax) || e.scoreBands.improveFirstMax >= e.scoreBands.cautionMax || e.scoreBands.cautionMax > 99) throw Error("Invalid score bands");
  for (const rule of Object.values(e.rules)) {
    if (!["info", "warning", "error"].includes(rule.severity) || !Object.hasOwn(e.recommendations, rule.recommendation)) throw Error("Invalid recommendation or severity");
    for (const [key, n] of Object.entries(rule.thresholds)) if ((key !== "olderDetailRatio" && !Number.isInteger(n)) || n < 1 || n > 1000) throw Error("Invalid threshold");
  }
  if (e.localEvidence.scoreCap > 100 || e.localEvidence.strongBulletMinimum < 1 || e.localEvidence.quantifiedMinimum < 1 || e.localEvidence.resultVerbMinimum < 1) throw Error("Invalid evidence thresholds");
  validateModelCatalog(parsed["models.json"]);
  validateCvBasicsContent(parsed["cvBasics.json"], e);
  return parsed;
}
export function validateModelCatalog(input: unknown): ModelCatalog {
  validateShape(input, models, "models");
  const catalog = input as ModelCatalog;
  if (catalog.schemaVersion !== 1) throw Error("Incompatible model catalog");
  for (const [provider, entry] of Object.entries(catalog.providers)) {
    const ids = entry.models.map((model) => model.id);
    if (entry.models.length > 60 || new Set(ids).size !== ids.length || !ids.includes(entry.defaultModel)) throw Error("Invalid model defaults or duplicates");
    for (const model of entry.models) {
      if (model.id.length > 160 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(model.id) || model.label.length > 120) throw Error("Invalid model ID or label");
      if (provider === "openrouter" && !model.id.endsWith(":free") && model.id !== "openrouter/free") throw Error("Built-in OpenRouter models must use free routes");
      if (provider !== "ollama" && model.id === "local-mix") throw Error("Local mix is only supported for Ollama");
    }
  }
  const localIds = catalog.providers.ollama.models.map((model) => model.id);
  if (catalog.ollamaFallbackModels.some((id) => id === "local-mix" || !localIds.includes(id)) || new Set(catalog.ollamaFallbackModels).size !== catalog.ollamaFallbackModels.length) throw Error("Invalid local fallback models");
  return catalog;
}
export function activate(data: RuleData) {
  active = validateData(data);
  for (const listener of listeners) { try { listener(); } catch { /* A UI listener cannot invalidate an activated snapshot. */ } }
}

export function validateManifest(input: unknown): Manifest {
  const m = input as Manifest;
  if (!m || Object.keys(m).sort().join() !== "engineMax,engineMin,files,revision,schemaVersion" || m.schemaVersion !== 3 || !Number.isInteger(m.engineMin) || !Number.isInteger(m.engineMax) || m.engineMin > ENGINE_VERSION || m.engineMax < ENGINE_VERSION || m.engineMin < 1 || !Number.isSafeInteger(m.revision) || m.revision < 1) throw Error("Incompatible manifest");
  if (!m.files || Object.keys(m.files).sort().join() !== [...FILES].sort().join() || FILES.some((name) => !/^[a-f0-9]{64}$/.test(m.files[name]))) throw Error("Incomplete manifest");
  return m;
}
export async function sha256(text: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function validateSnapshot(snapshot: Snapshot): Promise<RuleData> {
  validateManifest(snapshot.manifest);
  const data: Record<string, unknown> = {};
  for (const name of FILES) {
    const raw = snapshot.files[name];
    if (typeof raw !== "string" || raw.length > 1000000 || await sha256(raw) !== snapshot.manifest.files[name]) throw Error(`Integrity failure: ${name}`);
    data[name] = JSON.parse(raw);
  }
  return validateData(data);
}

export async function bundledSnapshot(): Promise<Snapshot> {
  const files = {} as Snapshot["files"], hashes = {} as Manifest["files"];
  for (const name of FILES) { files[name] = JSON.stringify(baseline[name], null, 2) + "\n"; hashes[name] = await sha256(files[name]); }
  return { manifest: { ...release, files: hashes }, files };
}

export const DEFAULT_SOURCE = "https://fanmixco.github.io/career-signal/frontend/rules/";
export interface RulesStorage { read(): Promise<StoredRules | undefined>; write(state: StoredRules): Promise<void> }
export class RulesManager {
  state: StoredRules = { checkedAt: 0 };
  private busy = false;
  constructor(private storage: RulesStorage, public source = DEFAULT_SOURCE, public interval = 86400000, private request: typeof fetch = fetch) {}
  async load() {
    const bundled = await bundledSnapshot();
    try {
      const saved = await this.storage.read();
      if (saved && typeof saved === "object" && !Array.isArray(saved)) this.state = saved;
    } catch { /* Bundled baseline remains available. */ }
    if (!Number.isFinite(this.state.checkedAt) || this.state.checkedAt < 0 || this.state.checkedAt > Date.now()) this.state.checkedAt = 0;
    for (const snapshot of [this.state.current, this.state.previous]) {
      if (!snapshot) continue;
      try {
        const data = await validateSnapshot(snapshot);
        if (snapshot === this.state.previous) this.state = { current: snapshot, checkedAt: 0 };
        activate(data); return;
      } catch { /* Try rollback. */ }
    }
    this.state = { current: bundled, checkedAt: 0 };
    activate(baseline);
  }
  async rollback() {
    if (!this.state.previous) return false;
    const data = await validateSnapshot(this.state.previous);
    const next = { current: this.state.previous, previous: this.state.current, checkedAt: Date.now() };
    await this.storage.write(next);
    this.state = next;
    activate(data);
    return true;
  }
  async refresh(now = Date.now()) {
    if (this.busy || !this.source || now - this.state.checkedAt < this.interval) return false;
    this.busy = true;
    try {
      const base = new URL(this.source.endsWith("/") ? this.source : this.source + "/");
      if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw Error("Rules require an HTTPS directory");
      const get = async (name: string) => {
        const response = await this.request(new URL(name, base), { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw Error("Rules download failed");
        if (Number(response.headers.get("content-length")) > 1000000) throw Error("Rules too large");
        // Read with a limit, even when Content-Length is absent or incorrect.
        const reader = response.body?.getReader();
        if (!reader) throw Error("Empty response");
        const chunks: Uint8Array[] = []; let size = 0;
        try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 1000000) throw Error("Rules too large"); chunks.push(part.value); } }
        finally { await reader.cancel(); }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      };
      const manifest = validateManifest(JSON.parse(await get("manifest.json")));
      if (this.state.current && manifest.revision < this.state.current.manifest.revision) throw Error("Stale revision");
      if (this.state.current && manifest.revision === this.state.current.manifest.revision && FILES.some((name) => manifest.files[name] !== this.state.current!.manifest.files[name])) throw Error("Revision reused");
      const files = {} as Snapshot["files"];
      for (const name of FILES) {
        const current = this.state.current;
        files[name] = current?.manifest.files[name] === manifest.files[name] ? current.files[name] : await get(name);
      }
      const next = { manifest, files };
      const data = await validateSnapshot(next);
      const changed = !this.state.current || FILES.some((name) => this.state.current!.manifest.files[name] !== manifest.files[name]);
      const state = { current: next, previous: changed ? this.state.current : this.state.previous, checkedAt: now };
      await this.storage.write(state); // Durability succeeds before the single activation.
      this.state = state;
      activate(data);
      return changed;
    } catch {
      this.state.checkedAt = now;
      try { await this.storage.write(this.state); } catch { /* Read-only/quota failure: keep local rules. */ }
      return false;
    } finally { this.busy = false; }
  }
}
