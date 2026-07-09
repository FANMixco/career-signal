// Converts the UI/provider selection into a concrete model client.
// API keys can be pasted per request or loaded from backend/.env; Ollama only
// needs a local base URL because the model runs on the user's computer.
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { defaultAiProvider } from "../../rules/cvRules.js";
import { errorMessage } from "../../utils/messages.js";
import type { AiProviderKind, OutputLanguage, Provider } from "./types.js";

function normalizeOllamaBaseUrl(baseUrl?: string) {
  return (baseUrl?.trim() || process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434").replace(/\/+$/, "");
}

export function createModelProvider(providerKind: AiProviderKind = defaultAiProvider as AiProviderKind, apiKey?: string, ollamaBaseUrl?: string, outputLanguage?: OutputLanguage): Provider {
  if (providerKind === "openrouter") {
    const openRouterKey = apiKey?.trim() || process.env.OPENROUTER_API_KEY?.trim();

    if (openRouterKey) {
      return {
        kind: "openrouter",
        client: new OpenAI({
          apiKey: openRouterKey,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://github.com/FANMixco/career-signal",
            "X-OpenRouter-Title": process.env.OPENROUTER_APP_TITLE || "Career Signal Engine"
          }
        })
      };
    }

    throw new Error(errorMessage("openRouterApiKeyRequired", outputLanguage));
  }

  if (providerKind === "openai") {
    const openAiKey = apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();

    if (openAiKey) {
      return { kind: "openai", client: new OpenAI({ apiKey: openAiKey }) };
    }

    throw new Error(errorMessage("openAiApiKeyRequired", outputLanguage));
  }

  if (providerKind === "deepseek") {
    const deepSeekKey = apiKey?.trim() || process.env.DEEPSEEK_API_KEY?.trim();

    if (deepSeekKey) {
      return {
        kind: "deepseek",
        client: new OpenAI({
          apiKey: deepSeekKey,
          baseURL: "https://api.deepseek.com"
        })
      };
    }

    throw new Error(errorMessage("deepSeekApiKeyRequired", outputLanguage));
  }

  if (providerKind === "mistral") {
    const mistralKey = apiKey?.trim() || process.env.MISTRAL_API_KEY?.trim();

    if (mistralKey) {
      return { kind: "mistral", apiKey: mistralKey };
    }

    throw new Error(errorMessage("mistralApiKeyRequired", outputLanguage));
  }

  if (providerKind === "ollama") {
    return { kind: "ollama", baseUrl: normalizeOllamaBaseUrl(ollamaBaseUrl) };
  }

  const geminiKey = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();

  if (geminiKey) {
    return { kind: "gemini", client: new GoogleGenAI({ apiKey: geminiKey }) };
  }

  throw new Error(errorMessage("geminiApiKeyRequired", outputLanguage));
}
