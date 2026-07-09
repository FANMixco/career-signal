// Public AI facade used by the route handlers.
// It hides provider-specific details so routes can ask for a precheck or
// reconstruction plan without knowing whether the request goes to a cloud model
// or to local Ollama.
import { reconstructionPrompt, precheckPrompt } from "../prompts/cvPrompts.js";
import { defaultMetricRecoveryQuestions } from "../rules/cvRules.js";
import { analysisSchema, precheckSchema } from "../schemas/aiSchemas.js";
import { createCloudJsonResponse } from "./ai/cloudModelService.js";
import { runOllamaSectionedAnalysis, runOllamaSectionedPrecheck } from "./ai/ollamaService.js";
import { runOpenRouterSectionedAnalysis, runOpenRouterSectionedPrecheck } from "./ai/openRouterSectionedService.js";
import { createModelProvider } from "./ai/providerFactory.js";
import { normalizeAnalysisResult, normalizePrecheckResult } from "./ai/resultNormalizers.js";
import type { AnalysisInput, PrecheckInput } from "./ai/types.js";

export async function runPrecheck(input: PrecheckInput) {
  const provider = createModelProvider(input.aiProvider, input.apiKey, input.ollamaBaseUrl, input.outputLanguage);

  // Local models are handled section by section because they are more likely to
  // time out or drift from the full schema when asked for the whole object.
  if (provider.kind === "ollama") {
    const parsed = await runOllamaSectionedPrecheck(provider, input);

    if (parsed.questionsToRecoverMetrics.length === 0) {
      parsed.questionsToRecoverMetrics = defaultMetricRecoveryQuestions;
    }

    return parsed;
  }

  // OpenRouter free models are handled section by section to reduce output
  // pressure and survive rate limits or JSON drift in individual sections.
  if (provider.kind === "openrouter") {
    const parsed = await runOpenRouterSectionedPrecheck(provider, input);

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
    input.aiModel,
    input.outputLanguage
  );

  if (parsed.questionsToRecoverMetrics.length === 0) {
    parsed.questionsToRecoverMetrics = defaultMetricRecoveryQuestions;
  }

  return normalizePrecheckResult(parsed);
}

export async function runAnalysis(input: AnalysisInput) {
  const provider = createModelProvider(input.aiProvider, input.apiKey, input.ollamaBaseUrl, input.outputLanguage);

  // Stronger cloud providers are expected to support one structured response.
  // Ollama and OpenRouter free models use the sectioned path so partial useful
  // output can survive a slow or unreliable section.
  if (provider.kind === "ollama") {
    return normalizeAnalysisResult(await runOllamaSectionedAnalysis(provider, input));
  }

  if (provider.kind === "openrouter") {
    return normalizeAnalysisResult(await runOpenRouterSectionedAnalysis(provider, input));
  }

  const analysis = await createCloudJsonResponse(
    provider,
    "cv_reconstruction_plan",
    analysisSchema,
    reconstructionPrompt(input),
    input.aiModel,
    input.outputLanguage
  );

  return normalizeAnalysisResult(analysis);
}
