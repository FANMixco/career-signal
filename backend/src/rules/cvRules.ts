import { readFileSync } from "node:fs";

// Product rules and evaluator constants.
// Keep behavior here, but keep reviewable CV-quality text in content JSON files.
export const MIN_CV_LENGTH = 300;
export const MIN_JOB_DESCRIPTION_LENGTH = 120;

type GuidanceBlock = {
  textReminder: string;
  precheckInstruction: string;
  reconstructionInstruction: string;
};

type AppOptionsContent = {
  targetStyles: string[];
  proceedRecommendations: string[];
  outputLanguageNames: Record<"en" | "es" | "fr" | "de", string>;
};

type CvGuidanceContent = {
  defaultMetricRecoveryQuestions: string[];
  educationPrivacy: {
    ageWarning: string;
    privacySafeStructure: string;
    combinedCredentialNote: string;
    textReminder: string;
  };
  careerProgressionVisibility: GuidanceBlock;
  accomplishmentTenseGuidance: GuidanceBlock;
  cvLengthGuidance: GuidanceBlock;
  titleResponsibilityAlignment: GuidanceBlock;
  evidenceBackedLanguage: GuidanceBlock;
  contactCompleteness: GuidanceBlock;
};

type SensitivePersonalDataContent = Record<string, { label: string; warning: string }>;

function readJson<T>(path: string) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
}

const appOptions = readJson<AppOptionsContent>("../content/appOptions.json");
const cvGuidance = readJson<CvGuidanceContent>("../content/cvGuidance.json");
const personalDataCopy = readJson<SensitivePersonalDataContent>("../content/sensitivePersonalData.json");

export const targetStyles = appOptions.targetStyles as [
  "Consulting",
  "Strategy",
  "Product",
  "Cloud",
  "Engineering",
  "Procurement",
  "Sales",
  "Leadership",
  "Training",
  "Management",
  "General"
];
export const experienceSelectionModes = ["lastFive", "all"] as const;
export const aiProviders = ["gemini", "openai", "mistral", "ollama"] as const;
export const outputLanguages = ["en", "es", "fr", "de"] as const;
export const outputLanguageNames = appOptions.outputLanguageNames;
export const openAiModels = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"] as const;
export const geminiModels = ["models/gemini-3.5-flash", "models/gemini-3.1-flash-lite", "models/gemini-2.5-pro"] as const;
export const mistralModels = ["mistral-medium-latest", "mistral-large-latest", "mistral-small-latest"] as const;
export const ollamaModels = ["local-mix", "gemma4", "qwen3.6"] as const;
export const aiModels = [...openAiModels, ...geminiModels, ...mistralModels, ...ollamaModels] as const;

export const proceedRecommendations = appOptions.proceedRecommendations as ["Proceed", "Improve CV first", "Proceed with caution"];
export const proceedRecommendationValues = {
  proceed: proceedRecommendations[0],
  improve: proceedRecommendations[1],
  caution: proceedRecommendations[2]
} as const;

export const scoreBands = {
  improveFirstMax: 49,
  cautionMax: 74
} as const;

export const scoreBreakdownMaximums = {
  quantifiedResults: 30,
  accomplishmentClarity: 25,
  scopeAndScale: 20,
  responsibilityVersusOutcomeRatio: 15,
  interviewDefensibility: 10
} as const;

export const defaultMetricRecoveryQuestions = cvGuidance.defaultMetricRecoveryQuestions;
export const educationPrivacy = cvGuidance.educationPrivacy;
export const careerProgressionVisibility = cvGuidance.careerProgressionVisibility;
export const accomplishmentTenseGuidance = cvGuidance.accomplishmentTenseGuidance;
export const cvLengthGuidance = cvGuidance.cvLengthGuidance;
export const titleResponsibilityAlignment = cvGuidance.titleResponsibilityAlignment;
export const evidenceBackedLanguage = cvGuidance.evidenceBackedLanguage;
export const contactCompleteness = cvGuidance.contactCompleteness;

export const sensitivePersonalDataRules = [
  {
    id: "dateOfBirth",
    label: personalDataCopy.dateOfBirth.label,
    pattern: /\b(?:date of birth|dob|birth date|born on|age)\b\s*[:\-]?\s*(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{2,4}|\d{1,2}\b)/i,
    warning: personalDataCopy.dateOfBirth.warning
  },
  {
    id: "gender",
    label: personalDataCopy.gender.label,
    pattern: /\b(?:gender|sex)\b\s*[:\-]?\s*(?:male|female|man|woman|non[-\s]?binary|other)\b/i,
    warning: personalDataCopy.gender.warning
  },
  {
    id: "citizenship",
    label: personalDataCopy.citizenship.label,
    pattern: /\b(?:citizenship|nationality)\b\s*[:\-]?\s*[a-z][a-z\s-]{2,}/i,
    warning: personalDataCopy.citizenship.warning
  },
  {
    id: "maritalStatus",
    label: personalDataCopy.maritalStatus.label,
    pattern: /\b(?:marital status|civil status|family status)\b\s*[:\-]?\s*(?:single|married|divorced|widowed|partnered|parent|children)\b/i,
    warning: personalDataCopy.maritalStatus.warning
  },
  {
    id: "photo",
    label: personalDataCopy.photo.label,
    pattern: /\b(?:profile photo|passport photo|headshot|photo included|photograph)\b/i,
    warning: personalDataCopy.photo.warning
  },
  {
    id: "fullAddress",
    label: personalDataCopy.fullAddress.label,
    pattern: /\b(?:address|home address)\b\s*[:\-]?\s*\d{1,5}\s+[a-z0-9\s.'-]+(?:street|st\.|avenue|ave\.|road|rd\.|boulevard|blvd\.|lane|ln\.|drive|dr\.)\b/i,
    warning: personalDataCopy.fullAddress.warning
  }
] as const;

export function recommendationForScore(score: number) {
  if (score > scoreBands.cautionMax) return proceedRecommendationValues.proceed;
  if (score > scoreBands.improveFirstMax) return proceedRecommendationValues.caution;
  return proceedRecommendationValues.improve;
}

export function detectSensitivePersonalDataWarnings(cvText: string) {
  return sensitivePersonalDataRules
    .filter((rule) => rule.pattern.test(cvText))
    .map((rule) => ({
      id: rule.id,
      label: rule.label,
      warning: rule.warning
    }));
}
