import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { errorMessage } from "../../../utils/messages.js";
import { openAiModel } from "../modelNames.js";
import type { OutputLanguage } from "../types.js";

export async function createOpenAiJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
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
