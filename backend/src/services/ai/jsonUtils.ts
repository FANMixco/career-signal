// Helpers for providers that return JSON as ordinary text.
// Some models wrap JSON in Markdown or inside a named property, so parsing tries
// the small set of shapes we intentionally support before failing clearly.
import { z } from "zod";

export function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return trimmed;
}

export function parseJsonWithSchema<T>(schema: z.ZodType<T>, outputText: string, name: string, providerName: string) {
  const parsed = JSON.parse(extractJson(outputText)) as unknown;
  const candidates = [
    parsed,
    typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>)[name] : undefined,
    typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>).result : undefined,
    typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>).data : undefined
  ].filter((candidate) => candidate !== undefined);

  for (const candidate of candidates) {
    const result = schema.safeParse(candidate);

    if (result.success) {
      return result.data;
    }
  }

  throw new Error(`${providerName} returned JSON, but it did not match the required ${name} structure. Try a stronger local model or a cloud provider for this CV.`);
}
