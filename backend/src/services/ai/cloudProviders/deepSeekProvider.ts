import type OpenAI from "openai";
import { z } from "zod";
import { parseJsonWithSchema } from "../jsonUtils.js";
import { deepSeekModel } from "../modelNames.js";
import type { OutputLanguage } from "../types.js";
import { cloudModelMaxTokens, emptyTextOutputError, jsonInstruction } from "./cloudProviderUtils.js";

export async function createDeepSeekJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
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
