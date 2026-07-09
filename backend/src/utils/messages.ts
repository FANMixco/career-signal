import { readFileSync } from "node:fs";
import { defaultOutputLanguage, outputLanguages } from "../rules/cvRules.js";

type BackendMessages = {
  errors: Record<string, string>;
};

const messagesByLanguage = Object.fromEntries(
  outputLanguages.map((language) => [
    language,
    JSON.parse(readFileSync(new URL(`../content/messages/messages.${language}.json`, import.meta.url), "utf8")) as BackendMessages
  ])
) as Record<string, BackendMessages>;

export const messages = messagesByLanguage[defaultOutputLanguage] || messagesByLanguage.en;

type TemplateValues = Record<string, string | number>;

function formatMessage(message: string, values?: TemplateValues) {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}

export function normalizeOutputLanguage(outputLanguage?: unknown) {
  const language = Array.isArray(outputLanguage) ? outputLanguage[0] : outputLanguage;

  if (typeof language === "string" && (outputLanguages as readonly string[]).includes(language)) {
    return language;
  }

  return defaultOutputLanguage;
}

export function errorMessage(key: string, outputLanguage?: unknown, values?: TemplateValues) {
  const language = normalizeOutputLanguage(outputLanguage);
  const message = messagesByLanguage[language]?.errors[key] || messages.errors[key] || key;
  return formatMessage(message, values);
}

export function localizeErrorText(message: string, outputLanguage?: unknown) {
  const matchingKey = Object.entries(messages.errors).find(([, value]) => value === message)?.[0];
  return matchingKey ? errorMessage(matchingKey, outputLanguage) : message;
}
