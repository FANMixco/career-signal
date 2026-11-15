// Default model names and fallback ordering.
// UI selections should map to the same strings where possible; environment
// variables only act as defaults when a request does not send a model.
import { getModelCatalog } from "../../rules/rulesRuntime.js";
import { ollamaMixModel } from "../../rules/cvRules.js";

export function openAiModel(model?: string) {
  return model || process.env.OPENAI_MODEL || getModelCatalog().providers.openai.defaultModel;
}

export function openRouterModel(model?: string) {
  return model || process.env.OPENROUTER_MODEL || getModelCatalog().providers.openrouter.defaultModel;
}

export function geminiModel(model?: string) {
  return model || process.env.GEMINI_MODEL || getModelCatalog().providers.gemini.defaultModel;
}

export function deepSeekModel(model?: string) {
  return model || process.env.DEEPSEEK_MODEL || getModelCatalog().providers.deepseek.defaultModel;
}

export function mistralModel(model?: string) {
  return model || process.env.MISTRAL_MODEL || getModelCatalog().providers.mistral.defaultModel;
}

export function anthropicModel(model?: string) {
  return model || process.env.ANTHROPIC_MODEL || getModelCatalog().providers.anthropic.defaultModel;
}

export function ollamaModel(model?: string) {
  const selected = model || process.env.OLLAMA_MODEL || getModelCatalog().providers.ollama.defaultModel;
  return selected === ollamaMixModel ? getModelCatalog().ollamaFallbackModels[0] : selected;
}

export function ollamaModelCandidates(model?: string) {
  const rawSelected = (model || process.env.OLLAMA_MODEL || getModelCatalog().providers.ollama.defaultModel).trim();
  const builtIns = [...getModelCatalog().ollamaFallbackModels];

  if (rawSelected === ollamaMixModel) {
    return builtIns;
  }

  const selected = ollamaModel(rawSelected).trim();

  if (!builtIns.includes(selected)) {
    return [selected];
  }

  return [selected, ...builtIns.filter((candidate) => candidate !== selected)];
}
