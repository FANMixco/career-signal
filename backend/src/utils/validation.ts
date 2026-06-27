import { z } from "zod";

export const MIN_CV_LENGTH = 300;
export const MIN_JOB_DESCRIPTION_LENGTH = 120;

export const metadataSchema = z.object({
  yearsOfExperience: z.coerce.number().min(0).max(80),
  hasDegree: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  degreeYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
  experienceSelectionMode: z.enum(["lastFive", "all"])
});

export const analyzeCvSchema = z.object({
  openaiApiKey: z.string().optional(),
  cvText: z.string().min(MIN_CV_LENGTH, "Please provide a complete CV or LinkedIn PDF export."),
  jobDescription: z.string().min(MIN_JOB_DESCRIPTION_LENGTH, "Please provide the full job description."),
  companyName: z.string().min(1, "Target company name is required."),
  targetStyle: z.enum(["Consulting", "Strategy", "Product", "Cloud", "Engineering", "Management", "General"]),
  experienceSelectionMode: z.enum(["lastFive", "all"]),
  precheckResult: z.record(z.unknown()),
  continueDespiteWeakPrecheck: z.boolean().optional().default(false)
});

export function agePrivacyWarning(degreeYear?: number) {
  const fiveYearsAgo = new Date().getFullYear() - 5;
  const show = Boolean(degreeYear && degreeYear < fiveYearsAgo);
  return {
    show,
    message: show
      ? "Your study year may reveal more age related information than necessary. For many private sector CVs, especially after several years of experience, it may be better to keep relevant studies but remove completion years or older education details. This is only a warning. You can keep the year if you want."
      : ""
  };
}

export function parseFormValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}
