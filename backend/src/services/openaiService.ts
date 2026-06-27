import { GoogleGenAI } from "@google/genai";
import type { Interactions } from "@google/genai";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { reconstructionPrompt, precheckPrompt } from "../prompts/cvPrompts.js";
import { defaultMetricRecoveryQuestions, educationPrivacy, recommendationForScore } from "../rules/cvRules.js";
import { analysisSchema, precheckSchema, type AnalysisResult, type PrecheckResult } from "../schemas/aiSchemas.js";

type Provider =
  | { kind: "openai"; client: OpenAI }
  | { kind: "gemini"; client: GoogleGenAI };

function normalizePrecheckResult(precheck: PrecheckResult): PrecheckResult {
  const rawScore = precheck.cvEvidenceScore;
  const normalizedScore = rawScore > 0 && rawScore <= 10 ? rawScore * 10 : rawScore;
  const cvEvidenceScore = Math.max(0, Math.min(100, Math.round(normalizedScore)));

  return {
    ...precheck,
    cvEvidenceScore,
    proceedRecommendation: recommendationForScore(cvEvidenceScore)
  };
}

function normalizeAnalysisResult(analysis: AnalysisResult): AnalysisResult {
  const suggestedCvStructure = analysis.suggestedCvStructure.map((item) => {
    const trimmed = item.trim();
    if (/^education$/i.test(trimmed) || /^studies$/i.test(trimmed)) {
      return educationPrivacy.privacySafeStructure;
    }

    if (/^education\s*(?:&|and)\s*(certifications|awards)/i.test(trimmed)) {
      return `${trimmed} (${educationPrivacy.combinedCredentialNote})`;
    }

    return item;
  });

  return {
    ...analysis,
    suggestedCvStructure,
    downloadableText: analysis.downloadableText
      .replace(/^Education$/gim, educationPrivacy.privacySafeStructure)
      .replace(/^Studies$/gim, educationPrivacy.privacySafeStructure)
  };
}

export function createModelProvider(apiKey?: string): Provider {
  const openAiKey = apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (openAiKey) {
    return { kind: "openai", client: new OpenAI({ apiKey: openAiKey }) };
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (geminiKey) {
    return { kind: "gemini", client: new GoogleGenAI({ apiKey: geminiKey }) };
  }

  throw new Error(
    "An AI API key is required. Paste an OpenAI key, configure OPENAI_API_KEY, or configure GEMINI_API_KEY in the backend .env file."
  );
}

function openAiModel() {
  return process.env.OPENAI_MODEL || "gpt-5.2";
}

function geminiModel() {
  return process.env.GEMINI_MODEL || "models/gemini-3-flash-preview";
}

async function createOpenAiJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string) {
  const response = await client.responses.parse({
    model: openAiModel(),
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

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return trimmed;
}

async function createGeminiJsonResponse<T>(client: GoogleGenAI, name: string, schema: z.ZodType<T>, input: string) {
  const interaction = await client.interactions.create({
    model: geminiModel(),
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

async function createJsonResponse<T>(provider: Provider, name: string, schema: z.ZodType<T>, input: string) {
  if (provider.kind === "openai") {
    return createOpenAiJsonResponse(provider.client, name, schema, input);
  }

  return createGeminiJsonResponse(provider.client, name, schema, input);
}

export async function runPrecheck(input: {
  apiKey?: string;
  cvText: string;
  yearsOfExperience: number;
  hasDegree?: boolean;
  degreeYear?: number;
  experienceSelectionMode: "lastFive" | "all";
}) {
  const provider = createModelProvider(input.apiKey);
  const parsed = await createJsonResponse(
    provider,
    "cv_quality_precheck",
    precheckSchema,
    precheckPrompt(input)
  );

  if (parsed.questionsToRecoverMetrics.length === 0) {
    parsed.questionsToRecoverMetrics = defaultMetricRecoveryQuestions;
  }

  return normalizePrecheckResult(parsed);
}

export async function runAnalysis(input: {
  apiKey?: string;
  cvText: string;
  precheckResult: Record<string, unknown>;
  companyName: string;
  targetStyle: string;
  experienceSelectionMode: "lastFive" | "all";
  jobDescription: string;
}) {
  const provider = createModelProvider(input.apiKey);
  const analysis = await createJsonResponse(
    provider,
    "cv_reconstruction_plan",
    analysisSchema,
    reconstructionPrompt(input)
  );

  return normalizeAnalysisResult(analysis);
}
