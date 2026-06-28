import { z } from "zod";
import { aiProviders, educationPrivacy, experienceSelectionModes, MIN_CV_LENGTH, MIN_JOB_DESCRIPTION_LENGTH, targetStyles } from "../rules/cvRules.js";

export { MIN_CV_LENGTH, MIN_JOB_DESCRIPTION_LENGTH };

export const metadataSchema = z.object({
  yearsOfExperience: z.coerce.number().min(0).max(80),
  hasDegree: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  degreeYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
  experienceSelectionMode: z.enum(experienceSelectionModes),
  aiProvider: z.enum(aiProviders).optional().default("gemini")
});

export const analyzeCvSchema = z.object({
  aiProvider: z.enum(aiProviders).optional().default("gemini"),
  aiApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  cvText: z.string().min(MIN_CV_LENGTH, "Please provide a complete CV or LinkedIn PDF export."),
  jobDescription: z.string().min(MIN_JOB_DESCRIPTION_LENGTH, "Please provide the full job description."),
  companyName: z.string().min(1, "Target company name is required."),
  targetStyle: z.enum(targetStyles),
  experienceSelectionMode: z.enum(experienceSelectionModes),
  precheckResult: z.record(z.unknown()),
  continueDespiteWeakPrecheck: z.boolean().optional().default(false)
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
