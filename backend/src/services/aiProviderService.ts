import { reconstructionPrompt, precheckPrompt } from "../prompts/cvPrompts.js";
import { defaultMetricRecoveryQuestions } from "../rules/cvRules.js";
import { analysisSchema, precheckSchema } from "../schemas/aiSchemas.js";
import { createCloudJsonResponse } from "./ai/cloudModelService.js";
import { runOllamaSectionedAnalysis, runOllamaSectionedPrecheck } from "./ai/ollamaService.js";
import { createModelProvider } from "./ai/providerFactory.js";
import { normalizeAnalysisResult, normalizePrecheckResult } from "./ai/resultNormalizers.js";
import type { AnalysisInput, PrecheckInput } from "./ai/types.js";

export async function runPrecheck(input: PrecheckInput) {
  const provider = createModelProvider(input.aiProvider, input.apiKey, input.ollamaBaseUrl);

  if (provider.kind === "ollama") {
    const parsed = await runOllamaSectionedPrecheck(provider, input);

    if (parsed.questionsToRecoverMetrics.length === 0) {
      parsed.questionsToRecoverMetrics = defaultMetricRecoveryQuestions;
    }

    return parsed;
  }

  const parsed = await createCloudJsonResponse(
    provider,
    "cv_quality_precheck",
    precheckSchema,
    precheckPrompt(input),
    input.aiModel
  );

  if (parsed.questionsToRecoverMetrics.length === 0) {
    parsed.questionsToRecoverMetrics = defaultMetricRecoveryQuestions;
  }

  return normalizePrecheckResult(parsed);
}

export async function runAnalysis(input: AnalysisInput) {
  const provider = createModelProvider(input.aiProvider, input.apiKey, input.ollamaBaseUrl);

  if (provider.kind === "ollama") {
    return normalizeAnalysisResult(await runOllamaSectionedAnalysis(provider, input));
  }

  const analysis = await createCloudJsonResponse(
    provider,
    "cv_reconstruction_plan",
    analysisSchema,
    reconstructionPrompt(input),
    input.aiModel
  );

  return normalizeAnalysisResult(analysis);
}
