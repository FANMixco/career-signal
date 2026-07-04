import type { GoogleGenAI, Interactions } from "@google/genai";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { extractJson } from "./jsonUtils.js";
import { geminiModel, mistralModel, openAiModel } from "./modelNames.js";
import type { Provider } from "./types.js";

async function createOpenAiJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  const response = await client.responses.parse({
    model: openAiModel(model),
    input,
    text: {
      format: zodTextFormat(schema, name)
    }
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return valid structured output.");
  }

  return response.output_parsed;
}

const geminiTools: Interactions.Tool[] = [
  {
    type: "google_search"
  }
];

const geminiGenerationConfig: Interactions.GenerationConfig = {
  temperature: 1,
  max_output_tokens: 65536,
  top_p: 0.95,
  thinking_level: "high"
};

async function createGeminiJsonResponse<T>(client: GoogleGenAI, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  const interaction = await client.interactions.create({
    model: geminiModel(model),
    input: `${input}

Return only valid JSON for the ${name} object. Do not wrap the JSON in Markdown.`,
    tools: geminiTools,
    generation_config: geminiGenerationConfig
  });

  const outputText = interaction.output_text || "";

  if (!outputText.trim()) {
    throw new Error("Gemini did not return text output.");
  }

  return schema.parse(JSON.parse(extractJson(outputText)));
}

async function createMistralJsonResponse<T>(apiKey: string, name: string, schema: z.ZodType<T>, input: string, model?: string) {
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

Return only valid JSON for the ${name} object. Do not wrap the JSON in Markdown.`
        }
      ],
      response_format: {
        type: "json_object"
      },
      temperature: 1,
      max_tokens: 65536
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral request failed (${response.status}): ${errorText}`);
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
    throw new Error("Mistral did not return text output.");
  }

  return schema.parse(JSON.parse(extractJson(outputText)));
}

export async function createCloudJsonResponse<T>(provider: Exclude<Provider, { kind: "ollama" }>, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  if (provider.kind === "openai") {
    return createOpenAiJsonResponse(provider.client, name, schema, input, model);
  }

  if (provider.kind === "mistral") {
    return createMistralJsonResponse(provider.apiKey, name, schema, input, model);
  }

  return createGeminiJsonResponse(provider.client, name, schema, input, model);
}
