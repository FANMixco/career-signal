// Structured-output adapter for cloud providers.
// OpenAI uses the SDK parser, while Gemini and Mistral are asked for JSON and
// then validated with the same Zod schemas used by the rest of the backend.
import type { GoogleGenAI, Interactions } from "@google/genai";
import { readFileSync } from "node:fs";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { errorMessage } from "../../utils/messages.js";
import { extractJson, parseJsonWithSchema } from "./jsonUtils.js";
import { deepSeekModel, geminiModel, mistralModel, openAiModel, openRouterModel } from "./modelNames.js";
import type { OutputLanguage, Provider } from "./types.js";

type CloudModelServiceContent = {
  maxTokens: Record<string, number>;
  jsonInstructions: {
    default: string;
    strictTopLevel: string;
  };
  schemaInstructions: Record<string, string[]>;
};

const cloudModelServiceContent = JSON.parse(
  readFileSync(new URL("../../content/ai/cloudModelService.json", import.meta.url), "utf8")
) as CloudModelServiceContent;

function formatContent(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}

function jsonInstruction(type: keyof CloudModelServiceContent["jsonInstructions"], name: string) {
  return formatContent(cloudModelServiceContent.jsonInstructions[type], { name });
}

function schemaInstruction(name: string) {
  return (cloudModelServiceContent.schemaInstructions[name] || []).join("\n");
}

function emptyTextOutputError(provider: string, outputLanguage?: OutputLanguage) {
  return new Error(errorMessage("emptyTextOutput", outputLanguage, { provider }));
}

async function createOpenAiJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
  const response = await client.responses.parse({
    model: openAiModel(model),
    input,
    text: {
      format: zodTextFormat(schema, name)
    }
  });

  if (!response.output_parsed) {
    throw new Error(errorMessage("structuredOutputMissing", outputLanguage));
  }

  return response.output_parsed;
}

function defaultMaxTokens(name: string) {
  return cloudModelServiceContent.maxTokens[name] || cloudModelServiceContent.maxTokens.cv_reconstruction_plan;
}

function boundedMaxTokens(name: string, configuredValue?: string) {
  const maximum = defaultMaxTokens(name);
  const configured = Number(configuredValue || 0);

  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(Math.floor(configured), maximum);
  }

  return maximum;
}

function openRouterMaxTokens(name: string) {
  return boundedMaxTokens(name, process.env.OPENROUTER_MAX_TOKENS || process.env.CLOUD_MODEL_MAX_TOKENS);
}

function cloudModelMaxTokens(name: string) {
  return boundedMaxTokens(name, process.env.CLOUD_MODEL_MAX_TOKENS);
}

async function createOpenRouterJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
  let response: OpenAI.Chat.Completions.ChatCompletion;

  try {
    response = await client.chat.completions.create({
      model: openRouterModel(model),
      messages: [
        {
          role: "user",
          content: `${input}

${schemaInstruction(name)}

${jsonInstruction("strictTopLevel", name)}`
        }
      ],
      response_format: {
        type: "json_object"
      },
      temperature: 1,
      max_tokens: openRouterMaxTokens(name)
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: unknown }).status) : 0;

    if (status === 429) {
      throw new Error(errorMessage("openRouterRateLimited", outputLanguage));
    }

    throw error;
  }

  const content = response.choices[0]?.message?.content || "";

  if (!content.trim()) {
    throw emptyTextOutputError("OpenRouter", outputLanguage);
  }

  return parseJsonWithSchema(schema, content, name, "OpenRouter");
}

async function createDeepSeekJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
  const response = await client.chat.completions.create({
    model: deepSeekModel(model),
    messages: [
      {
        role: "user",
        content: `${input}

${jsonInstruction("default", name)}`
      }
    ],
    response_format: {
      type: "json_object"
    },
    temperature: 1,
    max_tokens: cloudModelMaxTokens(name)
  });

  const content = response.choices[0]?.message?.content || "";

  if (!content.trim()) {
    throw emptyTextOutputError("DeepSeek", outputLanguage);
  }

  return parseJsonWithSchema(schema, content, name, "DeepSeek");
}

const geminiTools: Interactions.Tool[] = [
  {
    type: "google_search"
  }
];

async function createGeminiJsonResponse<T>(client: GoogleGenAI, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
  const interaction = await client.interactions.create({
    model: geminiModel(model),
    input: `${input}

${jsonInstruction("default", name)}`,
    tools: geminiTools,
    generation_config: {
      temperature: 1,
      max_output_tokens: cloudModelMaxTokens(name),
      top_p: 0.95,
      thinking_level: "high"
    }
  });

  const outputText = interaction.output_text || "";

  if (!outputText.trim()) {
    throw emptyTextOutputError("Gemini", outputLanguage);
  }

  return schema.parse(JSON.parse(extractJson(outputText)));
}

async function createMistralJsonResponse<T>(apiKey: string, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: mistralModel(model),
      messages: [
        {
          role: "user",
          content: `${input}

${jsonInstruction("default", name)}`
        }
      ],
      response_format: {
        type: "json_object"
      },
      temperature: 1,
      max_tokens: cloudModelMaxTokens(name)
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorMessage("requestFailed", outputLanguage, { provider: "Mistral", status: response.status, details: errorText }));
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  const outputText = Array.isArray(content)
    ? content
        .map((part) => part.text || "")
        .join("")
        .trim()
    : content || "";

  if (!outputText.trim()) {
    throw emptyTextOutputError("Mistral", outputLanguage);
  }

  return schema.parse(JSON.parse(extractJson(outputText)));
}

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

  return createGeminiJsonResponse(provider.client, name, schema, input, model, outputLanguage);
}
