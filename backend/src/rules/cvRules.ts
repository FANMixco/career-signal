export const MIN_CV_LENGTH = 300;
export const MIN_JOB_DESCRIPTION_LENGTH = 120;

export const targetStyles = ["Consulting", "Strategy", "Product", "Cloud", "Engineering", "Procurement", "Sales", "Leadership", "Training", "Management", "General"] as const;
export const experienceSelectionModes = ["lastFive", "all"] as const;
export const aiProviders = ["gemini", "openai"] as const;
export const openAiModels = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"] as const;
export const geminiModels = ["models/gemini-3.5-flash", "models/gemini-3.1-flash-lite", "models/gemini-2.5-pro"] as const;
export const aiModels = [...openAiModels, ...geminiModels] as const;

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

export const careerProgressionVisibility = {
  textReminder:
    "Career progression visibility reminder\nLong tenure at the same company is not a weakness by itself. If the candidate held several internal roles, promotions, scope increases, team changes, or responsibility changes, show that progression clearly. A single title covering many years can make growth look flat or non-existent.",
  precheckInstruction:
    "If the CV shows long tenure at one employer, especially around 7 or more years, but only one visible role title or a final title, add a specific warning that internal progression may be hidden. Recommend splitting the tenure into internal roles, promotions, scope changes, or selected progression bullets when true and defensible.",
  reconstructionInstruction:
    "Preserve any precheck warning about hidden internal progression. If the candidate stayed at one company for a long period but appears to show only the latest role, recommend making promotions, internal moves, expanding scope, or role changes visible when they are true. Do not invent internal titles or dates."
} as const;

export const accomplishmentTenseGuidance = {
  textReminder:
    "Achievement tense reminder\nUse past tense for completed work, especially in previous roles. Current roles may use present tense for ongoing responsibilities, but completed achievements inside a current role should still read as completed outcomes. Avoid infinitive or generic activity language when a result has already happened.",
  precheckInstruction:
    "Check whether accomplishments are written with appropriate tense. Add a specific warning when previous roles use present tense or infinitive phrasing for completed work, or when current roles keep completed achievements in active/ongoing wording that makes the timing unclear.",
  reconstructionInstruction:
    "Preserve any precheck warning about tense. Recommend past tense for completed achievements, present tense only for genuinely ongoing responsibilities, and clear completed-outcome wording for achievements inside current roles."
} as const;

export const cvLengthGuidance = {
  textReminder:
    "CV length and seniority reminder\nEvaluate length by career stage and relevance. Junior profiles are usually strongest at 1 page, mid-career profiles usually 1 to 2 pages, senior specialists/managers/consultants usually around 2 pages, and executives/academics/researchers/public sector or highly credentialed profiles may need more when the extra detail is relevant. Length is not the problem by itself; hiding evidence or removing proof is the problem.",
  precheckInstruction:
    "Check whether the CV length appears appropriate for the candidate's seniority and evidence needs. Warn when the CV seems too long because old, repeated, or irrelevant details hide the strongest evidence. Also warn when the CV seems too short because it removes scale, results, role context, leadership scope, progression, or evidence needed for the target role.",
  reconstructionInstruction:
    "Preserve any precheck warning about CV length. Recommend compressing old or irrelevant experience when length hides evidence, but do not remove scale, results, role context, progression, or credentials needed to prove fit."
} as const;

export const titleResponsibilityAlignment = {
  textReminder:
    "Title and responsibility alignment reminder\nCheck whether the role title matches the responsibilities and accomplishments shown under it. If a title says project management but the bullets describe product management, strategy, operations, architecture, training, or another discipline, warn that the reader may misunderstand the candidate's real positioning. Recommend clarifying the scope in the role subtitle, summary, or bullets without inventing a new title.",
  precheckInstruction:
    "Check whether each visible role title aligns with the responsibilities and accomplishments listed under it. Add a specific warning when the CV mixes materially different disciplines under one title, such as project management bullets under a product management title, product ownership under a project manager title, architecture under a support title, or operational work under a strategy title. The risk is reader confusion and weak positioning, not multidisciplinary experience by itself.",
  reconstructionInstruction:
    "Preserve any precheck warning about role-title and responsibility mismatch. Recommend clarifying unusual scope with truthful wording, such as a role subtitle, selected scope line, or bullets that explain why the responsibilities belonged to the role. Do not invent a different official title. If the mismatch is useful for the target job, explain how to position it honestly."
} as const;

export const evidenceBackedLanguage = {
  textReminder:
    "Evidence-backed language reminder\nClaims such as efficient, motivated, strategic, proactive, reliable, fast learner, team player, or strong communicator are weak unless the CV shows evidence nearby. Keep the claim only when bullets prove it through outcomes, examples, scale, decisions, adoption, delivery, or measurable results.",
  precheckInstruction:
    "Check whether the CV uses unsupported personal narrative or self-assessment language, especially in the summary. Warn when claims such as efficient, highly motivated, strategic, proactive, reliable, fast learner, team player, or strong communicator are not backed by nearby evidence. The issue is not the adjective itself; the issue is missing proof or correlation with concrete accomplishments.",
  reconstructionInstruction:
    "Preserve any precheck warning about unsupported personal narrative claims. Replace or support self-assessment language with evidence-backed positioning. Do not simply polish adjectives; tie them to specific outcomes, scope, decisions, delivery, adoption, or measurable impact."
} as const;

export const contactCompleteness = {
  textReminder:
    "Contact completeness reminder\nA CV should make essential contact signals easy to find near the top: name, email, phone, location at a useful level, and usually LinkedIn or portfolio when relevant. Missing contact details are uncommon but costly because they create friction for recruiters.",
  precheckInstruction:
    "Check whether the CV includes essential contact details near the top: candidate name, email, phone, and location at a useful level such as city/country or region. LinkedIn or portfolio is optional but useful when relevant. Add a low-severity warning if email, phone, or location appears to be missing or hard to find.",
  reconstructionInstruction:
    "Preserve any precheck warning about missing contact details. Recommend placing name, email, phone, useful location, and relevant LinkedIn or portfolio near the top. Do not add contact details that are not present; ask the user to provide them."
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
