import { readFileSync } from "node:fs";

// Product rules and evaluator constants.
// Keep behavior here, but keep reviewable CV-quality text in cvRules.json.
export const MIN_CV_LENGTH = 300;
export const MIN_JOB_DESCRIPTION_LENGTH = 120;

type GuidanceBlock = {
  textReminder: string;
  precheckInstruction: string;
  reconstructionInstruction: string;
};

type CvRulesContent = {
  outputLanguageNames: Record<"en" | "es" | "fr" | "de", string>;
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
  sensitivePersonalDataRules: Record<string, { label: string; warning: string }>;
};

const cvRulesContent = JSON.parse(readFileSync(new URL("../content/cvRules.json", import.meta.url), "utf8")) as CvRulesContent;

export const targetStyles = ["Consulting", "Strategy", "Product", "Cloud", "Engineering", "Procurement", "Sales", "Leadership", "Training", "Management", "General"] as const;
export const experienceSelectionModes = ["lastFive", "all"] as const;
export const aiProviders = ["gemini", "openai", "mistral", "ollama"] as const;
export const outputLanguages = ["en", "es", "fr", "de"] as const;
export const outputLanguageNames = cvRulesContent.outputLanguageNames;
export const openAiModels = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"] as const;
export const geminiModels = ["models/gemini-3.5-flash", "models/gemini-3.1-flash-lite", "models/gemini-2.5-pro"] as const;
export const mistralModels = ["mistral-medium-latest", "mistral-large-latest", "mistral-small-latest"] as const;
export const ollamaModels = ["local-mix", "gemma4", "qwen3.6"] as const;
export const aiModels = [...openAiModels, ...geminiModels, ...mistralModels, ...ollamaModels] as const;

export const proceedRecommendations = ["Proceed", "Improve CV first", "Proceed with caution"] as const;

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

export const defaultMetricRecoveryQuestions = cvRulesContent.defaultMetricRecoveryQuestions;
export const educationPrivacy = cvRulesContent.educationPrivacy;
export const careerProgressionVisibility = cvRulesContent.careerProgressionVisibility;
export const accomplishmentTenseGuidance = cvRulesContent.accomplishmentTenseGuidance;
export const cvLengthGuidance = cvRulesContent.cvLengthGuidance;
export const titleResponsibilityAlignment = cvRulesContent.titleResponsibilityAlignment;
export const evidenceBackedLanguage = cvRulesContent.evidenceBackedLanguage;
export const contactCompleteness = cvRulesContent.contactCompleteness;

const personalDataCopy = cvRulesContent.sensitivePersonalDataRules;

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
  if (score > scoreBands.cautionMax) return "Proceed";
  if (score > scoreBands.improveFirstMax) return "Proceed with caution";
  return "Improve CV first";
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
