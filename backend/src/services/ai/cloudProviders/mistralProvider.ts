import { z } from "zod";
import { errorMessage } from "../../../utils/messages.js";
import { parseJsonWithSchema } from "../jsonUtils.js";
import { mistralModel } from "../modelNames.js";
import type { OutputLanguage } from "../types.js";
import { cloudModelMaxTokens, emptyTextOutputError, jsonInstruction, schemaInstruction } from "./cloudProviderUtils.js";

export async function createMistralJsonResponse<T>(apiKey: string, name: string, schema: z.ZodType<T>, input: string, model?: string, outputLanguage?: OutputLanguage) {
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

${schemaInstruction(name)}

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

  return parseJsonWithSchema(schema, outputText, name, "Mistral");
}
