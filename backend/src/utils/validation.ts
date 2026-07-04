// Request validation shared by the API routes.
// This layer protects the provider services from impossible combinations such
// as cloud models under the wrong provider or unsafe custom Ollama model names.
import { z } from "zod";
import {
  aiProviders,
  educationPrivacy,
  experienceSelectionModes,
  geminiModels,
  MIN_CV_LENGTH,
  MIN_JOB_DESCRIPTION_LENGTH,
  mistralModels,
  openAiModels,
  targetStyles
} from "../rules/cvRules.js";

export { MIN_CV_LENGTH, MIN_JOB_DESCRIPTION_LENGTH };

const cloudModelNames = new Set<string>([...geminiModels, ...openAiModels, ...mistralModels]);
const ollamaModelNameSchema = z
  .string()
  .trim()
  .min(1, "Ollama model name is required.")
  .max(120, "Ollama model name must be 120 characters or fewer.")
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/, "Ollama model name can only contain letters, numbers, dots, dashes, underscores, colons, and slashes.");

function validateAiModelForProvider(provider: (typeof aiProviders)[number] | undefined, model: string | undefined, context: z.RefinementCtx) {
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

  if (!cloudModelNames.has(model)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["aiModel"],
      message: "Selected AI model is not available for this provider."
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
    experienceSelectionMode: z.enum(experienceSelectionModes),
    aiProvider: z.enum(aiProviders).optional().default("gemini"),
    aiModel: z.string().trim().optional(),
    ollamaBaseUrl: z.string().url("Ollama URL must be a valid URL.").max(200).optional()
  })
  .superRefine((value, context) => {
    validateAiModelForProvider(value.aiProvider, value.aiModel, context);
  });

export const analyzeCvSchema = z
  .object({
    aiProvider: z.enum(aiProviders).optional().default("gemini"),
    aiModel: z.string().trim().optional(),
    aiApiKey: z.string().optional(),
    openaiApiKey: z.string().optional(),
    ollamaBaseUrl: z.string().url("Ollama URL must be a valid URL.").max(200).optional(),
    cvText: z.string().min(MIN_CV_LENGTH, "Please provide a complete CV or LinkedIn PDF export."),
    jobDescription: z.string().min(MIN_JOB_DESCRIPTION_LENGTH, "Please provide the full job description."),
    companyName: z.string().min(1, "Target company name is required."),
    companyDescription: z.string().max(2000, "Company description must be 2,000 characters or fewer.").optional().default(""),
    targetStyle: z.enum(targetStyles),
    experienceSelectionMode: z.enum(experienceSelectionModes),
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
