import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import type { AiProviderKind, Provider } from "./types.js";

function normalizeOllamaBaseUrl(baseUrl?: string) {
  return (baseUrl?.trim() || process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434").replace(/\/+$/, "");
}

export function createModelProvider(providerKind: AiProviderKind = "gemini", apiKey?: string, ollamaBaseUrl?: string): Provider {
  if (providerKind === "openai") {
    const openAiKey = apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();

    if (openAiKey) {
      return { kind: "openai", client: new OpenAI({ apiKey: openAiKey }) };
    }

    throw new Error("An OpenAI API key is required. Paste an OpenAI key or configure OPENAI_API_KEY in the backend .env file.");
  }

  if (providerKind === "mistral") {
    const mistralKey = apiKey?.trim() || process.env.MISTRAL_API_KEY?.trim();

    if (mistralKey) {
      return { kind: "mistral", apiKey: mistralKey };
    }

    throw new Error("A Mistral API key is required. Paste a Mistral key or configure MISTRAL_API_KEY in the backend .env file.");
  }

  if (providerKind === "ollama") {
    return { kind: "ollama", baseUrl: normalizeOllamaBaseUrl(ollamaBaseUrl) };
  }

  const geminiKey = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();

  if (geminiKey) {
    return { kind: "gemini", client: new GoogleGenAI({ apiKey: geminiKey }) };
  }

  throw new Error("A Gemini API key is required. Paste a Gemini key or configure GEMINI_API_KEY in the backend .env file.");
}
