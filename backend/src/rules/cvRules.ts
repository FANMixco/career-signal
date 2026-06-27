export const MIN_CV_LENGTH = 300;
export const MIN_JOB_DESCRIPTION_LENGTH = 120;

export const targetStyles = ["Consulting", "Strategy", "Product", "Cloud", "Engineering", "Procurement", "Sales", "Leadership", "Training", "Management", "General"] as const;
export const experienceSelectionModes = ["lastFive", "all"] as const;

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

export function recommendationForScore(score: number) {
  if (score > scoreBands.cautionMax) return "Proceed";
  if (score > scoreBands.improveFirstMax) return "Proceed with caution";
  return "Improve CV first";
}
