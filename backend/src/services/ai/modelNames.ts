// Default model names and fallback ordering.
// UI selections should map to the same strings where possible; environment
// variables only act as defaults when a request does not send a model.
export function openAiModel(model?: string) {
  return model || process.env.OPENAI_MODEL || "gpt-5.5";
}

export function geminiModel(model?: string) {
  return model || process.env.GEMINI_MODEL || "models/gemini-3.5-flash";
}

export function mistralModel(model?: string) {
  return model || process.env.MISTRAL_MODEL || "mistral-medium-latest";
}

export function ollamaModel(model?: string) {
  const selected = model || process.env.OLLAMA_MODEL || "gemma4";
  return selected === "local-mix" ? "gemma4" : selected;
}

export function ollamaModelCandidates(model?: string) {
  const rawSelected = (model || process.env.OLLAMA_MODEL || "gemma4").trim();
  const builtIns = ["gemma4", "qwen3.6"];

  if (rawSelected === "local-mix") {
    return builtIns;
  }

  const selected = ollamaModel(rawSelected).trim();

  if (!builtIns.includes(selected)) {
    return [selected];
  }

  return [selected, ...builtIns.filter((candidate) => candidate !== selected)];
}
