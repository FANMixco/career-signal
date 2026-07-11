import type { GoogleGenAI, Interactions } from "@google/genai";
import { z } from "zod";
import { extractJson } from "../jsonUtils.js";
import { geminiModel } from "../modelNames.js";
import type { OutputLanguage } from "../types.js";
import { cloudModelMaxTokens, emptyTextOutputError, jsonInstruction } from "./cloudProviderUtils.js";

const geminiTools: Interactions.Tool[] = [
  {
    type: "google_search"
  }
];

export async function createGeminiJsonResponse<T>(client: GoogleGenAI, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
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
