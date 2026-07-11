import type OpenAI from "openai";
import { z } from "zod";
import { errorMessage } from "../../../utils/messages.js";
import { parseJsonWithSchema } from "../jsonUtils.js";
import { openRouterModel } from "../modelNames.js";
import type { OutputLanguage } from "../types.js";
import { emptyTextOutputError, jsonInstruction, openRouterMaxTokens, schemaInstruction } from "./cloudProviderUtils.js";

export async function createOpenRouterJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
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
