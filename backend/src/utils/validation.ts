// Request validation shared by the API routes.
// This layer protects the provider services from impossible combinations such
// as cloud models under the wrong provider or unsafe custom Ollama model names.
import { z } from "zod";
import {
  aiProviders,
  deepSeekModels,
  defaultAiProvider,
  defaultOutputLanguage,
  educationPrivacy,
  experienceSelectionModes,
  geminiModels,
  MIN_CV_LENGTH,
  MIN_JOB_DESCRIPTION_LENGTH,
  mistralModels,
  openAiModels,
  openRouterModels,
  outputLanguages,
  targetStyles
} from "../rules/cvRules.js";
import type { AiProviderKind, ExperienceSelectionMode, OutputLanguage } from "../services/ai/types.js";
import { messages } from "./messages.js";

export { MIN_CV_LENGTH, MIN_JOB_DESCRIPTION_LENGTH };

const modelsByProvider = {
  gemini: new Set<string>(geminiModels),
  openai: new Set<string>(openAiModels),
  openrouter: new Set<string>(openRouterModels),
  deepseek: new Set<string>(deepSeekModels),
  mistral: new Set<string>(mistralModels)
} satisfies Partial<Record<AiProviderKind, Set<string>>>;
const aiProviderSchema = z.enum(aiProviders) as z.ZodType<AiProviderKind>;
const experienceSelectionModeSchema = z.enum(experienceSelectionModes) as z.ZodType<ExperienceSelectionMode>;
const outputLanguageSchema = z.enum(outputLanguages) as z.ZodType<OutputLanguage>;

const ollamaModelNameSchema = z
  .string()
  .trim()
  .min(1, messages.errors.ollamaModelNameRequired)
  .max(120, messages.errors.ollamaModelNameTooLong)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/, messages.errors.ollamaModelNameInvalid);

function validateAiModelForProvider(provider: AiProviderKind | undefined, model: string | undefined, context: z.RefinementCtx) {
  if (!model) return;

  if (provider === "ollama") {
    const result = ollamaModelNameSchema.safeParse(model);

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        context.addIssue({
          ...issue,
          path: ["aiModel"]
        });
      });
    }

    return;
  }

  if (provider && !modelsByProvider[provider]?.has(model)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["aiModel"],
      message: messages.errors.selectedAiModelUnavailable
    });
  }
}

export const metadataSchema = z
  .object({
    yearsOfExperience: z.coerce.number().min(0).max(80),
    hasDegree: z
      .union([z.literal("true"), z.literal("false"), z.boolean()])
      .optional()
      .transform((value) => value === true || value === "true"),
    degreeYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
    experienceSelectionMode: experienceSelectionModeSchema,
    outputLanguage: outputLanguageSchema.optional().default(defaultOutputLanguage as OutputLanguage),
    aiProvider: aiProviderSchema.optional().default(defaultAiProvider as AiProviderKind),
    aiModel: z.string().trim().optional(),
    ollamaBaseUrl: z.string().url(messages.errors.ollamaUrlInvalid).max(200).optional()
  })
  .superRefine((value, context) => {
    validateAiModelForProvider(value.aiProvider, value.aiModel, context);
  });

export const analyzeCvSchema = z
  .object({
    aiProvider: aiProviderSchema.optional().default(defaultAiProvider as AiProviderKind),
    aiModel: z.string().trim().optional(),
    aiApiKey: z.string().optional(),
    openaiApiKey: z.string().optional(),
    ollamaBaseUrl: z.string().url(messages.errors.ollamaUrlInvalid).max(200).optional(),
    cvText: z.string().min(MIN_CV_LENGTH, messages.errors.completeCvRequired),
    jobDescription: z.string().min(MIN_JOB_DESCRIPTION_LENGTH, messages.errors.jobDescriptionRequired),
    companyName: z.string().min(1, messages.errors.targetCompanyRequired),
    companyDescription: z.string().max(2000, messages.errors.companyDescriptionTooLong).optional().default(""),
    targetStyle: z.enum(targetStyles),
    experienceSelectionMode: experienceSelectionModeSchema,
    outputLanguage: outputLanguageSchema.optional().default(defaultOutputLanguage as OutputLanguage),
    precheckResult: z.record(z.unknown()),
    continueDespiteWeakPrecheck: z.boolean().optional().default(false)
  })
  .superRefine((value, context) => {
    validateAiModelForProvider(value.aiProvider, value.aiModel, context);
  });

export function agePrivacyWarning(degreeYear?: number) {
  const fiveYearsAgo = new Date().getFullYear() - 5;
  const show = Boolean(degreeYear && degreeYear < fiveYearsAgo);
  return {
    show,
    message: show ? educationPrivacy.ageWarning : ""
  };
}

export function parseFormValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}
