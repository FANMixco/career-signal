import { getEvaluation, getGuidance, getPersonalCopy } from "./rulesRuntime.js";
import appOptionsContent from "../content/config/appOptions.json" with { type: "json" };

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
  defaultAiProvider: string;
  defaultOutputLanguage: string;
  proceedRecommendations: string[];
  jobFitVerdicts: string[];
  integrityClassifications: string[];
  requirementImportances: string[];
  requirementCoverageLevels: string[];
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

function asNonEmptyStringTuple(name: string, values: string[]) {
  if (values.length === 0) {
    throw new Error(`${name} must contain at least one value.`);
  }

  return values as [string, ...string[]];
}

const appOptions: AppOptionsContent = appOptionsContent;
const cvGuidance = new Proxy({} as CvGuidanceContent, { get: (_, key) => getGuidance()[key as keyof CvGuidanceContent] });
const personalDataCopy = new Proxy({} as SensitivePersonalDataContent, { get: (_, key) => getPersonalCopy()[key as keyof ReturnType<typeof getPersonalCopy>] });

export const targetStyles = asNonEmptyStringTuple("targetStyles", appOptions.targetStyles);
export const experienceSelectionModes = asNonEmptyStringTuple("experienceSelectionModes", appOptions.experienceSelectionModes);
export const aiProviders = asNonEmptyStringTuple("aiProviders", appOptions.aiProviders);
export const outputLanguages = asNonEmptyStringTuple("outputLanguages", appOptions.outputLanguages);
export const outputLanguageNames = appOptions.outputLanguageNames;
export const defaultAiProvider = appOptions.defaultAiProvider;
export const defaultOutputLanguage = appOptions.defaultOutputLanguage;
export const ollamaMixModel = "local-mix";

export const proceedRecommendations = asNonEmptyStringTuple("proceedRecommendations", appOptions.proceedRecommendations);
export const jobFitVerdicts = asNonEmptyStringTuple("jobFitVerdicts", appOptions.jobFitVerdicts);
export const integrityClassifications = asNonEmptyStringTuple("integrityClassifications", appOptions.integrityClassifications);
export const requirementImportances = asNonEmptyStringTuple("requirementImportances", appOptions.requirementImportances);
export const requirementCoverageLevels = asNonEmptyStringTuple("requirementCoverageLevels", appOptions.requirementCoverageLevels);
export const proceedRecommendationValues = {
  proceed: proceedRecommendations[0],
  improve: proceedRecommendations[1],
  caution: proceedRecommendations[2]
} as const;

export const scoreBands = new Proxy({} as { improveFirstMax: number; cautionMax: number }, { get: (_, key) => getEvaluation().scoreBands[key as "improveFirstMax" | "cautionMax"] });

export const scoreBreakdownMaximums = {
  quantifiedResults: 30,
  accomplishmentClarity: 25,
  scopeAndScale: 20,
  responsibilityVersusOutcomeRatio: 15,
  interviewDefensibility: 10
} as const;

export const defaultMetricRecoveryQuestions = new Proxy([] as string[], { get: (_, key) => {
  const questions = getGuidance().defaultMetricRecoveryQuestions;
  const value = Reflect.get(questions, key);
  return typeof value === "function" ? value.bind(questions) : value;
} });
export const educationPrivacy = new Proxy({} as CvGuidanceContent["educationPrivacy"], { get: (_, key) => Reflect.get(getGuidance().educationPrivacy, key) });
export const careerProgressionVisibility = new Proxy({} as CvGuidanceContent["careerProgressionVisibility"], { get: (_, key) => Reflect.get(getGuidance().careerProgressionVisibility, key) });
export const accomplishmentTenseGuidance = new Proxy({} as CvGuidanceContent["accomplishmentTenseGuidance"], { get: (_, key) => Reflect.get(getGuidance().accomplishmentTenseGuidance, key) });
export const cvLengthGuidance = new Proxy({} as CvGuidanceContent["cvLengthGuidance"], { get: (_, key) => Reflect.get(getGuidance().cvLengthGuidance, key) });
export const titleResponsibilityAlignment = new Proxy({} as CvGuidanceContent["titleResponsibilityAlignment"], { get: (_, key) => Reflect.get(getGuidance().titleResponsibilityAlignment, key) });
export const evidenceBackedLanguage = new Proxy({} as CvGuidanceContent["evidenceBackedLanguage"], { get: (_, key) => Reflect.get(getGuidance().evidenceBackedLanguage, key) });
export const contactCompleteness = new Proxy({} as CvGuidanceContent["contactCompleteness"], { get: (_, key) => Reflect.get(getGuidance().contactCompleteness, key) });

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
      label: personalDataCopy[rule.id].label,
      warning: personalDataCopy[rule.id].warning
    }));
}
