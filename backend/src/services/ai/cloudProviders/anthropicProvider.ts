import { z } from "zod";
import { errorMessage } from "../../../utils/messages.js";
import { parseJsonWithSchema } from "../jsonUtils.js";
import { anthropicModel } from "../modelNames.js";
import type { OutputLanguage } from "../types.js";
import { cloudModelMaxTokens, emptyTextOutputError, jsonInstruction, schemaInstruction } from "./cloudProviderUtils.js";

export async function createAnthropicJsonResponse<T>(apiKey: string, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: anthropicModel(model),
      messages: [
        {
          role: "user",
          content: `${input}

${schemaInstruction(name)}

${jsonInstruction("default", name)}`
        }
      ],
      temperature: 1,
      max_tokens: cloudModelMaxTokens(name)
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorMessage("requestFailed", outputLanguage, { provider: "Anthropic", status: response.status, details: errorText }));
  }

  const data = (await response.json()) as {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };
  const outputText =
    data.content
      ?.filter((part) => part.type === "text" || part.text)
      .map((part) => part.text || "")
      .join("")
      .trim() || "";

  if (!outputText.trim()) {
    throw emptyTextOutputError("Anthropic", outputLanguage);
  }

  return parseJsonWithSchema(schema, outputText, name, "Anthropic");
}
