// Default model names and fallback ordering.
// UI selections should map to the same strings where possible; environment
// variables only act as defaults when a request does not send a model.
import {
  defaultDeepSeekModel,
  defaultGeminiModel,
  defaultMistralModel,
  defaultOllamaModel,
  defaultOpenAiModel,
  defaultOpenRouterModel,
  ollamaFallbackModels,
  ollamaMixModel
} from "../../rules/cvRules.js";

export function openAiModel(model?: string) {
  return model || process.env.OPENAI_MODEL || defaultOpenAiModel;
}

export function openRouterModel(model?: string) {
  return model || process.env.OPENROUTER_MODEL || defaultOpenRouterModel;
}

export function geminiModel(model?: string) {
  return model || process.env.GEMINI_MODEL || defaultGeminiModel;
}

export function deepSeekModel(model?: string) {
  return model || process.env.DEEPSEEK_MODEL || defaultDeepSeekModel;
}

export function mistralModel(model?: string) {
  return model || process.env.MISTRAL_MODEL || defaultMistralModel;
}

export function ollamaModel(model?: string) {
  const selected = model || process.env.OLLAMA_MODEL || defaultOllamaModel;
  return selected === ollamaMixModel ? defaultOllamaModel : selected;
}

export function ollamaModelCandidates(model?: string) {
  const rawSelected = (model || process.env.OLLAMA_MODEL || defaultOllamaModel).trim();
  const builtIns = [...ollamaFallbackModels];

  if (rawSelected === ollamaMixModel) {
    return builtIns;
  }

  const selected = ollamaModel(rawSelected).trim();

  if (!builtIns.includes(selected)) {
    return [selected];
  }

  return [selected, ...builtIns.filter((candidate) => candidate !== selected)];
}
