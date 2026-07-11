// Public dispatcher for cloud model adapters.
// Provider-specific request details live in cloudProviders/* so adding a model
// does not keep stretching this facade.
import { z } from "zod";
import { createAnthropicJsonResponse } from "./cloudProviders/anthropicProvider.js";
import { createDeepSeekJsonResponse } from "./cloudProviders/deepSeekProvider.js";
import { createGeminiJsonResponse } from "./cloudProviders/geminiProvider.js";
import { createMistralJsonResponse } from "./cloudProviders/mistralProvider.js";
import { createOpenAiJsonResponse } from "./cloudProviders/openAiProvider.js";
import { createOpenRouterJsonResponse } from "./cloudProviders/openRouterProvider.js";
import type { OutputLanguage, Provider } from "./types.js";

export async function createCloudJsonResponse<T>(provider: Exclude<Provider, { kind: "ollama" }>, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
  if (provider.kind === "openai") {
    return createOpenAiJsonResponse(provider.client, name, schema, input, model, outputLanguage);
  }

  if (provider.kind === "openrouter") {
    return createOpenRouterJsonResponse(provider.client, name, schema, input, model, outputLanguage);
  }

  if (provider.kind === "deepseek") {
    return createDeepSeekJsonResponse(provider.client, name, schema, input, model, outputLanguage);
  }

  if (provider.kind === "mistral") {
    return createMistralJsonResponse(provider.apiKey, name, schema, input, model, outputLanguage);
  }

  if (provider.kind === "anthropic") {
    return createAnthropicJsonResponse(provider.apiKey, name, schema, input, model, outputLanguage);
  }

  return createGeminiJsonResponse(provider.client, name, schema, input, model, outputLanguage);
}
