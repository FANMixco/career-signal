import { readFileSync } from "node:fs";
import { errorMessage } from "../../../utils/messages.js";
import type { OutputLanguage } from "../types.js";

type CloudModelServiceContent = {
  maxTokens: Record<string, number>;
  jsonInstructions: {
    default: string;
    strictTopLevel: string;
  };
  schemaInstructions: Record<string, string[]>;
};

const cloudModelServiceContent = JSON.parse(
  readFileSync(new URL("../../../content/ai/cloudModelService.json", import.meta.url), "utf8")
) as CloudModelServiceContent;

function formatContent(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}

export function jsonInstruction(type: keyof CloudModelServiceContent["jsonInstructions"], name: string) {
  return formatContent(cloudModelServiceContent.jsonInstructions[type], { name });
}

export function schemaInstruction(name: string) {
  return (cloudModelServiceContent.schemaInstructions[name] || []).join("\n");
}

export function emptyTextOutputError(provider: string, outputLanguage?: OutputLanguage) {
  return new Error(errorMessage("emptyTextOutput", outputLanguage, { provider }));
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

export function openRouterMaxTokens(name: string) {
  return boundedMaxTokens(name, process.env.OPENROUTER_MAX_TOKENS || process.env.CLOUD_MODEL_MAX_TOKENS);
}

export function cloudModelMaxTokens(name: string) {
  return boundedMaxTokens(name, process.env.CLOUD_MODEL_MAX_TOKENS);
}
