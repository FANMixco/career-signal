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
  experienceSelectionModes: string[];
  aiProviders: string[];
  outputLanguages: string[];
  openAiModels: string[];
  openRouterModels: string[];
  geminiModels: string[];
  mistralModels: string[];
  ollamaModels: string[];
  defaultAiProvider: string;
  defaultOutputLanguage: string;
  defaultOpenAiModel: string;
  defaultOpenRouterModel: string;
  defaultGeminiModel: string;
  defaultMistralModel: string;
  defaultOllamaModel: string;
  ollamaMixModel: string;
  ollamaFallbackModels: string[];
  proceedRecommendations: string[];
  jobFitVerdicts: string[];
  integrityClassifications: string[];
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

function asNonEmptyStringTuple(name: string, values: string[]) {
  if (values.length === 0) {
    throw new Error(`${name} must contain at least one value.`);
  }

  return values as [string, ...string[]];
}

const appOptions = readJson<AppOptionsContent>("../content/appOptions.json");
const cvGuidance = readJson<CvGuidanceContent>("../content/cvGuidance.json");
const personalDataCopy = readJson<SensitivePersonalDataContent>("../content/sensitivePersonalData.json");

export const targetStyles = asNonEmptyStringTuple("targetStyles", appOptions.targetStyles);
export const experienceSelectionModes = asNonEmptyStringTuple("experienceSelectionModes", appOptions.experienceSelectionModes);
export const aiProviders = asNonEmptyStringTuple("aiProviders", appOptions.aiProviders);
export const outputLanguages = asNonEmptyStringTuple("outputLanguages", appOptions.outputLanguages);
export const outputLanguageNames = appOptions.outputLanguageNames;
export const openAiModels = asNonEmptyStringTuple("openAiModels", appOptions.openAiModels);
export const openRouterModels = asNonEmptyStringTuple("openRouterModels", appOptions.openRouterModels);
export const geminiModels = asNonEmptyStringTuple("geminiModels", appOptions.geminiModels);
export const mistralModels = asNonEmptyStringTuple("mistralModels", appOptions.mistralModels);
export const ollamaModels = asNonEmptyStringTuple("ollamaModels", appOptions.ollamaModels);
export const aiModels = [...openAiModels, ...openRouterModels, ...geminiModels, ...mistralModels, ...ollamaModels] as const;
export const defaultAiProvider = appOptions.defaultAiProvider;
export const defaultOutputLanguage = appOptions.defaultOutputLanguage;
export const defaultOpenAiModel = appOptions.defaultOpenAiModel;
export const defaultOpenRouterModel = appOptions.defaultOpenRouterModel;
export const defaultGeminiModel = appOptions.defaultGeminiModel;
export const defaultMistralModel = appOptions.defaultMistralModel;
export const defaultOllamaModel = appOptions.defaultOllamaModel;
export const ollamaMixModel = appOptions.ollamaMixModel;
export const ollamaFallbackModels = asNonEmptyStringTuple("ollamaFallbackModels", appOptions.ollamaFallbackModels);

export const proceedRecommendations = asNonEmptyStringTuple("proceedRecommendations", appOptions.proceedRecommendations);
export const jobFitVerdicts = asNonEmptyStringTuple("jobFitVerdicts", appOptions.jobFitVerdicts);
export const integrityClassifications = asNonEmptyStringTuple("integrityClassifications", appOptions.integrityClassifications);
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
