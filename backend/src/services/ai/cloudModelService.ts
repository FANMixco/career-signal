// Structured-output adapter for cloud providers.
// OpenAI uses the SDK parser, while Gemini and Mistral are asked for JSON and
// then validated with the same Zod schemas used by the rest of the backend.
import type { GoogleGenAI, Interactions } from "@google/genai";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { extractJson, parseJsonWithSchema } from "./jsonUtils.js";
import { geminiModel, mistralModel, openAiModel, openRouterModel } from "./modelNames.js";
import type { Provider } from "./types.js";

async function createOpenAiJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  const response = await client.responses.parse({
    model: openAiModel(model),
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

function openRouterSchemaInstruction(name: string) {
  if (name === "cv_quality_precheck") {
    return `Required JSON shape:
{
  "cvEvidenceScore": number,
  "scoreBreakdown": {
    "quantifiedResults": number,
    "accomplishmentClarity": number,
    "scopeAndScale": number,
    "responsibilityVersusOutcomeRatio": number,
    "interviewDefensibility": number
  },
  "hasQuantifiedResults": boolean,
  "hasAccomplishments": boolean,
  "mostlyJobDescriptions": boolean,
  "impactClarityScore": number,
  "quantifiedEvidenceCount": number,
  "strongBulletCount": number,
  "weakBulletCount": number,
  "proceedRecommendation": "Proceed" | "Improve CV first" | "Proceed with caution",
  "mainProblem": string,
  "specificWarnings": string[],
  "missingEvidenceTypes": string[],
  "examplesOfWeakBullets": string[],
  "questionsToRecoverMetrics": string[],
  "interviewRiskQuestions": string[],
  "nextStep": string
}

Score limits:
- cvEvidenceScore and impactClarityScore must be 0 to 100.
- scoreBreakdown maximums: quantifiedResults 30, accomplishmentClarity 25, scopeAndScale 20, responsibilityVersusOutcomeRatio 15, interviewDefensibility 10.
- Keep arrays concise, ideally 3 to 5 items.`;
  }

  if (name === "cv_reconstruction_plan") {
    return `Required JSON shape:
{
  "roleDiagnosis": string,
  "companySignalInterpretation": string,
  "candidatePositioning": string,
  "jobFitAssessment": {
    "score": number,
    "verdict": "Strong match" | "Good match" | "Partial match" | "Weak match",
    "explanation": string,
    "strongestReasons": string[],
    "mainRisks": string[],
    "companyDecisionWarning": string
  },
  "strongestMatchingEvidence": string[],
  "weakOrMissingSignals": string[],
  "keywordsToInclude": string[],
  "keywordsToAvoid": string[],
  "suggestedProfessionalSummary": string,
  "rewrittenCvBullets": [
    {
      "original": string,
      "rewritten": string,
      "reason": string,
      "integrityClassification": "Directly supported by CV" | "Reasonable reframing" | "Needs user confirmation" | "Not supported and should not be used"
    }
  ],
  "suggestedCvStructure": string[],
  "atsFriendlySkillsSection": string[],
  "recruiterInterpretation": string,
  "finalReconstructionPlan": string[],
  "integrityAudit": [
    {
      "recommendation": string,
      "classification": "Directly supported by CV" | "Reasonable reframing" | "Needs user confirmation" | "Not supported and should not be used",
      "explanation": string
    }
  ],
  "precheckWarningSummary": string,
  "downloadableText": string
}

Keep arrays concise, usually 3 to 6 items. Keep downloadableText under 700 words.`;
  }

  return "";
}

function defaultMaxTokens(name: string) {
  return name === "cv_quality_precheck" ? 4096 : 12000;
}

function boundedMaxTokens(name: string, configuredValue?: string) {
  const maximum = defaultMaxTokens(name);
  const configured = Number(configuredValue || 0);

  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(Math.floor(configured), maximum);
  }

  return maximum;
}

function openRouterMaxTokens(name: string) {
  return boundedMaxTokens(name, process.env.OPENROUTER_MAX_TOKENS || process.env.CLOUD_MODEL_MAX_TOKENS);
}

function cloudModelMaxTokens(name: string) {
  return boundedMaxTokens(name, process.env.CLOUD_MODEL_MAX_TOKENS);
}

async function createOpenRouterJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  let response: OpenAI.Chat.Completions.ChatCompletion;

  try {
    response = await client.chat.completions.create({
      model: openRouterModel(model),
      messages: [
        {
          role: "user",
          content: `${input}

${openRouterSchemaInstruction(name)}

Return only valid JSON for the ${name} object. Do not wrap the JSON in Markdown. Do not add extra top-level keys.`
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
      throw new Error("OpenRouter's upstream provider is rate-limited or temporarily overloaded for this model. Try another free model, wait a bit, or use a paid/cloud provider for this CV.");
    }

    throw error;
  }

  const content = response.choices[0]?.message?.content || "";

  if (!content.trim()) {
    throw new Error("OpenRouter did not return text output.");
  }

  return parseJsonWithSchema(schema, content, name, "OpenRouter");
}

const geminiTools: Interactions.Tool[] = [
  {
    type: "google_search"
  }
];

async function createGeminiJsonResponse<T>(client: GoogleGenAI, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  const interaction = await client.interactions.create({
    model: geminiModel(model),
    input: `${input}

Return only valid JSON for the ${name} object. Do not wrap the JSON in Markdown.`,
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
    throw new Error("Gemini did not return text output.");
  }

  return schema.parse(JSON.parse(extractJson(outputText)));
}

async function createMistralJsonResponse<T>(apiKey: string, name: string, schema: z.ZodType<T>, input: string, model?: string) {
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

Return only valid JSON for the ${name} object. Do not wrap the JSON in Markdown.`
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
    throw new Error(`Mistral request failed (${response.status}): ${errorText}`);
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
    throw new Error("Mistral did not return text output.");
  }

  return schema.parse(JSON.parse(extractJson(outputText)));
}

export async function createCloudJsonResponse<T>(provider: Exclude<Provider, { kind: "ollama" }>, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  if (provider.kind === "openai") {
    return createOpenAiJsonResponse(provider.client, name, schema, input, model);
  }

  if (provider.kind === "openrouter") {
    return createOpenRouterJsonResponse(provider.client, name, schema, input, model);
  }

  if (provider.kind === "mistral") {
    return createMistralJsonResponse(provider.apiKey, name, schema, input, model);
  }

  return createGeminiJsonResponse(provider.client, name, schema, input, model);
}
