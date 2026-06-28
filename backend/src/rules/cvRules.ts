export const MIN_CV_LENGTH = 300;
export const MIN_JOB_DESCRIPTION_LENGTH = 120;

export const targetStyles = ["Consulting", "Strategy", "Product", "Cloud", "Engineering", "Procurement", "Sales", "Leadership", "Training", "Management", "General"] as const;
export const experienceSelectionModes = ["lastFive", "all"] as const;
export const aiProviders = ["gemini", "openai"] as const;

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

export const defaultMetricRecoveryQuestions = [
  "What changed because of your work?",
  "How many users, clients, systems, teams, or countries were affected?",
  "Did you reduce time, cost, risk, errors, delays, or manual work?",
  "Did you increase adoption, performance, revenue, visibility, reliability, or satisfaction?",
  "How many projects did you deliver?",
  "What was the before and after situation?",
  "Who used the thing you created?",
  "Would this claim survive an interview?"
];

export const educationPrivacy = {
  ageWarning:
    "Your study year may reveal more age related information than necessary. For many private sector CVs, especially after several years of experience, it may be better to keep relevant studies but remove completion years or older education details. This is only a warning. You can keep the year if you want.",
  privacySafeStructure:
    "Education / studies only if role-relevant or required; omit completion years and older details that add age/privacy risk",
  combinedCredentialNote:
    "keep credentials relevant to the target role; omit unnecessary study years and older education details",
  textReminder:
    "Education and studies privacy reminder\nReview study years, graduation years, older education details, and irrelevant courses. Keep required or role-relevant credentials, but remove or de-emphasize unnecessary study dates/details when they do not help the target role."
} as const;

export const sensitivePersonalDataRules = [
  {
    id: "dateOfBirth",
    label: "Date of birth or exact age",
    pattern: /\b(?:date of birth|dob|birth date|born on|age)\b\s*[:\-]?\s*(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{2,4}|\d{1,2}\b)/i,
    warning:
      "Date of birth or exact age can create age-bias risk. Keep it only when the target country, sector, or process explicitly requires it."
  },
  {
    id: "gender",
    label: "Gender",
    pattern: /\b(?:gender|sex)\b\s*[:\-]?\s*(?:male|female|man|woman|non[-\s]?binary|other)\b/i,
    warning:
      "Gender is usually not needed on a CV and may create bias risk. Remove it unless it is explicitly required for the application."
  },
  {
    id: "citizenship",
    label: "Citizenship or nationality",
    pattern: /\b(?:citizenship|nationality)\b\s*[:\-]?\s*[a-z][a-z\s-]{2,}/i,
    warning:
      "Citizenship or nationality can create bias or privacy risk. Prefer work authorization language only when it matters for the role."
  },
  {
    id: "maritalStatus",
    label: "Marital or family status",
    pattern: /\b(?:marital status|civil status|family status)\b\s*[:\-]?\s*(?:single|married|divorced|widowed|partnered|parent|children)\b/i,
    warning:
      "Marital or family status is normally irrelevant to hiring decisions and should usually be removed from the CV."
  },
  {
    id: "photo",
    label: "Photo reference",
    pattern: /\b(?:profile photo|passport photo|headshot|photo included|photograph)\b/i,
    warning:
      "A photo can create appearance, age, gender, or ethnicity bias risk. Use one only where it is normal and expected for the market."
  },
  {
    id: "fullAddress",
    label: "Full home address",
    pattern: /\b(?:address|home address)\b\s*[:\-]?\s*\d{1,5}\s+[a-z0-9\s.'-]+(?:street|st\.|avenue|ave\.|road|rd\.|boulevard|blvd\.|lane|ln\.|drive|dr\.)\b/i,
    warning:
      "A full home address is usually unnecessary. City or country is normally enough unless the employer explicitly asks for more."
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
