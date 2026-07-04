import { GoogleGenAI } from "@google/genai";
import type { Interactions } from "@google/genai";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { reconstructionPrompt, precheckPrompt } from "../prompts/cvPrompts.js";
import { defaultMetricRecoveryQuestions, detectSensitivePersonalDataWarnings, educationPrivacy, recommendationForScore } from "../rules/cvRules.js";
import { analysisSchema, precheckSchema, type AnalysisResult, type PrecheckResult } from "../schemas/aiSchemas.js";

type Provider =
  | { kind: "openai"; client: OpenAI }
  | { kind: "gemini"; client: GoogleGenAI }
  | { kind: "mistral"; apiKey: string }
  | { kind: "ollama"; baseUrl: string };

type AiProviderKind = Provider["kind"];

const fitAssessmentSchema = analysisSchema.shape.jobFitAssessment;
const rewrittenBulletSchema = analysisSchema.shape.rewrittenCvBullets.element;
const integrityAuditItemSchema = analysisSchema.shape.integrityAudit.element;

const ollamaPositioningSectionSchema = z.object({
  roleDiagnosis: z.string().catch("Local model did not provide a role diagnosis."),
  companySignalInterpretation: z.string().catch("Local model did not provide company signal interpretation."),
  candidatePositioning: z.string().catch("Local model did not provide candidate positioning."),
  recruiterInterpretation: z.string().catch("Local model did not provide recruiter interpretation."),
  suggestedProfessionalSummary: z.string().catch(""),
  precheckWarningSummary: z.string().catch("")
});

const ollamaEvidenceSectionSchema = z.object({
  jobFitAssessment: fitAssessmentSchema.catch({
    score: 0,
    verdict: "Weak match",
    explanation: "Local model did not provide a valid profile match assessment.",
    strongestReasons: [],
    mainRisks: [],
    companyDecisionWarning: "The final hiring decision belongs to the company and can depend on factors outside this analysis."
  }),
  strongestMatchingEvidence: z.array(z.string()).catch([]),
  weakOrMissingSignals: z.array(z.string()).catch([]),
  keywordsToInclude: z.array(z.string()).catch([]),
  keywordsToAvoid: z.array(z.string()).catch([]),
  atsFriendlySkillsSection: z.array(z.string()).catch([])
});

const ollamaPlanSectionSchema = z.object({
  rewrittenCvBullets: z.array(rewrittenBulletSchema).catch([]),
  suggestedCvStructure: z.array(z.string()).catch([]),
  finalReconstructionPlan: z.array(z.string()).catch([]),
  integrityAudit: z.array(integrityAuditItemSchema).catch([])
});

const ollamaPrecheckScoreSectionSchema = z.object({
  cvEvidenceScore: z.number().min(0).max(100).catch(0),
  scoreBreakdown: precheckSchema.shape.scoreBreakdown.catch({
    quantifiedResults: 0,
    accomplishmentClarity: 0,
    scopeAndScale: 0,
    responsibilityVersusOutcomeRatio: 0,
    interviewDefensibility: 0
  }),
  hasQuantifiedResults: z.boolean().catch(false),
  hasAccomplishments: z.boolean().catch(false),
  mostlyJobDescriptions: z.boolean().catch(true),
  impactClarityScore: z.number().min(0).max(100).catch(0),
  quantifiedEvidenceCount: z.number().min(0).catch(0),
  strongBulletCount: z.number().min(0).catch(0),
  weakBulletCount: z.number().min(0).catch(0),
  proceedRecommendation: precheckSchema.shape.proceedRecommendation.catch("Improve CV first"),
  mainProblem: z.string().catch("Local model did not provide a main problem."),
  nextStep: z.string().catch("Review the CV evidence and add stronger measurable outcomes.")
});

const ollamaPrecheckWarningsSectionSchema = z.object({
  specificWarnings: z.array(z.string()).catch([]),
  missingEvidenceTypes: z.array(z.string()).catch([]),
  examplesOfWeakBullets: z.array(z.string()).catch([])
});

const ollamaPrecheckQuestionsSectionSchema = z.object({
  questionsToRecoverMetrics: z.array(z.string()).catch([]),
  interviewRiskQuestions: z.array(z.string()).catch([])
});

const ollamaPrecheckAdviceSectionSchema = ollamaPrecheckWarningsSectionSchema.merge(ollamaPrecheckQuestionsSectionSchema);
type OllamaPrecheckAdviceSection = {
  specificWarnings: string[];
  missingEvidenceTypes: string[];
  examplesOfWeakBullets: string[];
  questionsToRecoverMetrics: string[];
  interviewRiskQuestions: string[];
};
type OllamaPrecheckWarningsSection = {
  specificWarnings: string[];
  missingEvidenceTypes: string[];
  examplesOfWeakBullets: string[];
};
type OllamaPrecheckQuestionsSection = {
  questionsToRecoverMetrics: string[];
  interviewRiskQuestions: string[];
};
type OllamaPositioningSection = {
  roleDiagnosis: string;
  companySignalInterpretation: string;
  candidatePositioning: string;
  recruiterInterpretation: string;
  suggestedProfessionalSummary: string;
  precheckWarningSummary: string;
};
type OllamaEvidenceSection = {
  jobFitAssessment: AnalysisResult["jobFitAssessment"];
  strongestMatchingEvidence: string[];
  weakOrMissingSignals: string[];
  keywordsToInclude: string[];
  keywordsToAvoid: string[];
  atsFriendlySkillsSection: string[];
};
type OllamaPlanSection = {
  rewrittenCvBullets: AnalysisResult["rewrittenCvBullets"];
  suggestedCvStructure: string[];
  finalReconstructionPlan: string[];
  integrityAudit: AnalysisResult["integrityAudit"];
};

function normalizePrecheckResult(precheck: PrecheckResult): PrecheckResult {
  const rawScore = precheck.cvEvidenceScore;
  const normalizedScore = rawScore > 0 && rawScore <= 10 ? rawScore * 10 : rawScore;
  const cvEvidenceScore = Math.max(0, Math.min(100, Math.round(normalizedScore)));

  return {
    ...precheck,
    cvEvidenceScore,
    proceedRecommendation: recommendationForScore(cvEvidenceScore)
  };
}

function normalizeAnalysisResult(analysis: AnalysisResult): AnalysisResult {
  const suggestedCvStructure = analysis.suggestedCvStructure.map((item) => {
    const trimmed = item.trim();
    if (/^education$/i.test(trimmed) || /^studies$/i.test(trimmed)) {
      return educationPrivacy.privacySafeStructure;
    }

    if (/^education\s*(?:&|and)\s*(certifications|awards)/i.test(trimmed)) {
      return `${trimmed} (${educationPrivacy.combinedCredentialNote})`;
    }

    return item;
  });

  return {
    ...analysis,
    suggestedCvStructure,
    downloadableText: analysis.downloadableText
      .replace(/^Education$/gim, educationPrivacy.privacySafeStructure)
      .replace(/^Studies$/gim, educationPrivacy.privacySafeStructure)
  };
}

function normalizeOllamaBaseUrl(baseUrl?: string) {
  return (baseUrl?.trim() || process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434").replace(/\/+$/, "");
}

export function createModelProvider(providerKind: AiProviderKind = "gemini", apiKey?: string, ollamaBaseUrl?: string): Provider {
  if (providerKind === "openai") {
    const openAiKey = apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();

    if (openAiKey) {
      return { kind: "openai", client: new OpenAI({ apiKey: openAiKey }) };
    }

    throw new Error("An OpenAI API key is required. Paste an OpenAI key or configure OPENAI_API_KEY in the backend .env file.");
  }

  if (providerKind === "mistral") {
    const mistralKey = apiKey?.trim() || process.env.MISTRAL_API_KEY?.trim();

    if (mistralKey) {
      return { kind: "mistral", apiKey: mistralKey };
    }

    throw new Error("A Mistral API key is required. Paste a Mistral key or configure MISTRAL_API_KEY in the backend .env file.");
  }

  if (providerKind === "ollama") {
    return { kind: "ollama", baseUrl: normalizeOllamaBaseUrl(ollamaBaseUrl) };
  }

  const geminiKey = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();

  if (geminiKey) {
    return { kind: "gemini", client: new GoogleGenAI({ apiKey: geminiKey }) };
  }

  throw new Error("A Gemini API key is required. Paste a Gemini key or configure GEMINI_API_KEY in the backend .env file.");
}

function openAiModel(model?: string) {
  return model || process.env.OPENAI_MODEL || "gpt-5.5";
}

function geminiModel(model?: string) {
  return model || process.env.GEMINI_MODEL || "models/gemini-3.5-flash";
}

function mistralModel(model?: string) {
  return model || process.env.MISTRAL_MODEL || "mistral-medium-latest";
}

function ollamaModel(model?: string) {
  const selected = model || process.env.OLLAMA_MODEL || "gemma4";
  return selected === "local-mix" ? "gemma4" : selected;
}

function ollamaModelCandidates(model?: string) {
  const rawSelected = (model || process.env.OLLAMA_MODEL || "gemma4").trim();
  const builtIns = ["gemma4", "qwen3.6"];

  if (rawSelected === "local-mix") {
    return builtIns;
  }

  const selected = ollamaModel(rawSelected).trim();

  if (!builtIns.includes(selected)) {
    return [selected];
  }

  return [selected, ...builtIns.filter((candidate) => candidate !== selected)];
}

function compactForLocalModel(text: string, maxChars = 12000) {
  if (text.length <= maxChars) {
    return text;
  }

  const headLength = Math.round(maxChars * 0.7);
  const tailLength = maxChars - headLength;
  return `${text.slice(0, headLength)}

[...content shortened for local Ollama processing...]

${text.slice(-tailLength)}`;
}

function clampScore(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function weakActivityPattern(flags = "i") {
  return new RegExp("\\b(?:responsible for|participated in|worked on|helped with|assisted (?:with|in)|involved in|handled|tasked with)\\b", flags);
}

function candidateBulletLines(cvText: string) {
  return cvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line) || /^[A-Z][^.!?]{25,220}[.!?]?$/.test(line))
    .slice(0, 80);
}

function uniqueStrings(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function hasPattern(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function buildLocalPrecheckBaseline(input: {
  cvText: string;
  yearsOfExperience: number;
  hasDegree?: boolean;
  degreeYear?: number;
}): PrecheckResult {
  const cvText = input.cvText;
  const lower = cvText.toLowerCase();
  const bullets = candidateBulletLines(cvText);
  const quantifiedEvidenceCount = countMatches(
    cvText,
    /\b(?:\d+(?:[.,]\d+)?\s?(?:%|k|m|million|billion|users|clients|people|teams|countries|systems|applications|apps|projects|months|weeks|days|years|hours)|[$€£]\s?\d+)/gi
  );
  const resultVerbCount = countMatches(
    lower,
    /\b(?:reduced|increased|improved|delivered|launched|implemented|migrated|optimized|automated|saved|created|built|led|owned|designed|enabled|accelerated|standardized|modernized|decreased|lowered)\b/g
  );
  const weakActivityCount = countMatches(
    lower,
    weakActivityPattern("g")
  );
  const strongBulletCount = bullets.filter(
    (line) =>
      /\b(?:reduced|increased|improved|delivered|launched|implemented|migrated|optimized|automated|saved|created|built|led|owned|designed|enabled|accelerated|standardized|modernized)\b/i.test(line) &&
      /\b\d+(?:[.,]\d+)?|%|[$€£]\b/.test(line)
  ).length;
  const weakBulletCount = bullets.filter((line) => weakActivityPattern().test(line)).length;
  const hasQuantifiedResults = quantifiedEvidenceCount >= 3;
  const hasAccomplishments = resultVerbCount >= 8 || strongBulletCount >= 2;
  const mostlyJobDescriptions = weakActivityCount > resultVerbCount && strongBulletCount < 2;
  const scoreBreakdown = {
    quantifiedResults: clampScore(quantifiedEvidenceCount * 4, 30),
    accomplishmentClarity: clampScore(resultVerbCount * 1.5 + strongBulletCount * 3 - weakActivityCount, 25),
    scopeAndScale: clampScore(countMatches(lower, /\b(?:enterprise|regional|global|multi[-\s]?country|stakeholders|users|clients|teams|systems|platform|portfolio|budget|cost|revenue)\b/g) * 2, 20),
    responsibilityVersusOutcomeRatio: clampScore(15 - Math.max(0, weakActivityCount - strongBulletCount) * 2 + Math.min(strongBulletCount, 4), 15),
    interviewDefensibility: clampScore(quantifiedEvidenceCount + resultVerbCount / 4 + strongBulletCount * 2, 10)
  };
  const cvEvidenceScore = Math.min(90, clampScore(Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0), 100));
  const sensitiveWarnings = detectSensitivePersonalDataWarnings(cvText).map((item) => item.warning);
  const specificWarnings = [
    ...sensitiveWarnings,
    ...(mostlyJobDescriptions ? ["Several statements may read like responsibilities rather than outcomes. Add clearer results, scale, and consequences where true."] : []),
    ...(input.hasDegree && input.degreeYear && input.yearsOfExperience >= 5
      ? ["Study completion years can reveal age-related information. Keep role-relevant studies, but consider removing unnecessary dates."]
      : [])
  ];

  return {
    cvEvidenceScore,
    scoreBreakdown,
    hasQuantifiedResults,
    hasAccomplishments,
    mostlyJobDescriptions,
    impactClarityScore: clampScore(scoreBreakdown.accomplishmentClarity * 4, 100),
    quantifiedEvidenceCount,
    strongBulletCount,
    weakBulletCount,
    proceedRecommendation: recommendationForScore(cvEvidenceScore),
    mainProblem: mostlyJobDescriptions
      ? "The CV appears to include more activity or responsibility language than defensible outcome evidence."
      : "The CV has usable evidence, but the strongest claims still need clear scope, result, and interview-defensible context.",
    specificWarnings,
    missingEvidenceTypes: [
      ...(hasQuantifiedResults ? [] : ["More quantified outcomes, such as cost, time, risk, adoption, reliability, or scale."]),
      ...(hasAccomplishments ? [] : ["Clearer accomplishment bullets showing what changed because of the work."])
    ],
    examplesOfWeakBullets: bullets.filter((line) => weakActivityPattern().test(line)).slice(0, 3),
    questionsToRecoverMetrics: defaultMetricRecoveryQuestions.slice(0, 5),
    interviewRiskQuestions: ["Which claims would be hardest to defend with evidence in an interview?"],
    nextStep: hasAccomplishments
      ? "Use the strongest evidence for tailoring, but clarify any vague scale, baseline, or ownership before sending."
      : "Improve the CV evidence first by adding truthful outcomes, scale, and before/after context."
  };
}

function buildLocalPrecheckFallbackSections(
  input: {
    cvText: string;
    yearsOfExperience: number;
    hasDegree?: boolean;
    degreeYear?: number;
  },
  baseline: PrecheckResult
): OllamaPrecheckAdviceSection {
  const cvText = input.cvText;
  const lower = cvText.toLowerCase();
  const bullets = candidateBulletLines(cvText);
  const wordCount = cvText.split(/\s+/).filter(Boolean).length;
  const hasCloudSignals = hasPattern(lower, /\b(?:cloud|aws|azure|gcp|finops|migration|microservices|kubernetes|docker)\b/i);
  const hasStrategySignals = hasPattern(lower, /\b(?:strategy|roadmap|governance|architecture|operating model|transformation)\b/i);
  const hasAiSignals = hasPattern(lower, /\b(?:ai|automation|analytics|machine learning|genai|generative)\b/i);
  const unsupportedNarrative = hasPattern(
    lower,
    /\b(?:highly motivated|efficient|proactive|strategic thinker|team player|fast learner|reliable|excellent communicator|strong communicator)\b/i
  );
  const possibleTenseIssue = bullets.some((line) => /^(?:design|lead|manage|support|implement|develop|coordinate|participate|help)\b/i.test(line));
  const hasCostClaims = hasPattern(lower, /\b(?:cost|saving|saved|reduced|optimized|optimised|budget|eur|euro|€|\$)\b/i);
  const hasScaleClaims = hasPattern(lower, /\b(?:users|clients|stakeholders|teams|countries|systems|applications|apps|platforms)\b/i);

  const specificWarnings = uniqueStrings([
    ...baseline.specificWarnings,
    "Local Ollama did not complete the richer reviewer pass quickly, so these warnings are generated from deterministic CV evidence rules.",
    ...(baseline.cvEvidenceScore >= 85
      ? ["The CV has strong evidence density, but do not treat the score as approval to send it unchanged; check that the biggest numbers have baselines, scope, and ownership that can survive an interview."]
      : []),
    ...(baseline.quantifiedEvidenceCount > 0 && baseline.strongBulletCount < Math.min(3, baseline.quantifiedEvidenceCount)
      ? ["Some numbers appear in the CV, but not all of them are attached to clear outcome bullets. Make sure each important metric explains what changed, where, and because of whom."]
      : []),
    ...(hasCostClaims
      ? ["Cost, saving, or optimization claims should include a defensible baseline, time window, calculation logic, and whether the impact was owned, influenced, or estimated."]
      : []),
    ...(hasScaleClaims
      ? ["Scale signals are present. Make sure the CV consistently states who or what was affected, such as users, systems, teams, countries, budgets, risks, or processes."]
      : []),
    ...(possibleTenseIssue
      ? ["Some bullet wording may read like infinitive or present-tense activity language. Completed achievements should usually use completed-action wording, even inside a current role."]
      : []),
    ...(unsupportedNarrative
      ? ["The CV appears to use personal narrative or self-assessment language. Keep those claims only where nearby bullets prove them through outcomes, scale, decisions, or measurable impact."]
      : []),
    ...(input.yearsOfExperience >= 7 && wordCount < 700
      ? ["For this level of experience, the CV may be too compressed. Make sure it does not hide progression, leadership scope, delivery context, or the strongest evidence."]
      : []),
    ...(input.yearsOfExperience < 5 && wordCount > 1200
      ? ["For an early-career profile, the CV may be too long. Compress repeated or older details so the strongest evidence is easier to scan."]
      : []),
    ...(input.yearsOfExperience >= 7 && hasPattern(lower, /\b(?:present|current)\b/i) && !hasPattern(lower, /\b(?:promoted|promotion|senior|lead|manager|head|principal)\b/i)
      ? ["If several years were spent in one organization, make internal progression visible when true. A single final title can make growth look flat."]
      : []),
    ...(hasCloudSignals && hasStrategySignals
      ? ["The CV mixes strategy, architecture, delivery, and technical cloud signals. Clarify which responsibilities belonged to which role so the reader does not confuse project, product, architecture, and strategy scope."]
      : []),
    ...(hasAiSignals
      ? ["AI or automation claims should specify the use case, users, business process, result, and whether the work was production, prototype, governance, or enablement."]
      : [])
  ]);

  const missingEvidenceTypes = uniqueStrings([
    ...baseline.missingEvidenceTypes,
    ...(baseline.quantifiedEvidenceCount > 0 ? ["Baseline and measurement window for the strongest quantified claims."] : []),
    ...(hasCloudSignals ? ["Cloud/technology impact evidence such as migration scope, cost, reliability, security, adoption, or operating-model change."] : []),
    ...(hasStrategySignals ? ["Strategy evidence such as decision influenced, roadmap adopted, governance improved, or stakeholder group affected."] : []),
    ...(hasAiSignals ? ["AI/automation evidence such as use case, adoption, risk control, productivity gain, or business outcome."] : []),
    "Interview defensibility details for the highest-impact claims: exact ownership, baseline, source of metric, and what can be safely discussed."
  ]);

  const questionsToRecoverMetrics = uniqueStrings([
    ...(hasCostClaims
      ? [
          "For each cost or saving claim, what was the baseline, final value, time window, and calculation method?",
          "Was the cost impact directly delivered by you, influenced by you, or estimated as avoided cost?"
        ]
      : []),
    ...(hasCloudSignals
      ? [
          "How many applications, environments, accounts, workloads, users, or teams were affected by the cloud work?",
          "What changed after the cloud, migration, architecture, or FinOps work: cost, reliability, speed, governance, security, or adoption?"
        ]
      : []),
    ...(hasStrategySignals
      ? [
          "Which roadmap, governance decision, architecture recommendation, or strategic plan was accepted or used by stakeholders?",
          "Who consumed the strategy work: leadership, engineering teams, clients, suppliers, boards, or business units?"
        ]
      : []),
    ...(hasAiSignals
      ? [
          "For each AI or automation item, was it a prototype, production solution, governance artifact, or enablement activity?",
          "What measurable result came from the AI or automation work: time saved, errors reduced, adoption, decisions supported, or cost avoided?"
        ]
      : []),
    ...baseline.questionsToRecoverMetrics.slice(0, 4)
  ]);

  const interviewRiskQuestions = uniqueStrings([
    "Which three claims would be hardest to defend if an interviewer asked for the baseline, source, and your exact contribution?",
    "Are any metrics estimates, shared team outcomes, or avoided-cost calculations that need softer wording?",
    "Do any role titles hide responsibilities from another discipline, such as project management, product management, architecture, strategy, or operations?",
    ...(possibleTenseIssue ? ["Which achievements are completed and should be rewritten in past tense?"] : []),
    ...(input.hasDegree && input.degreeYear && input.yearsOfExperience >= 5
      ? ["Does the study completion year help this target role, or does it mainly reveal age-related information?"]
      : [])
  ]);

  return {
    specificWarnings,
    missingEvidenceTypes,
    examplesOfWeakBullets: baseline.examplesOfWeakBullets,
    questionsToRecoverMetrics,
    interviewRiskQuestions
  };
}

async function createOpenAiJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  const response = await client.responses.parse({
    model: openAiModel(model),
    input,
    text: {
      format: zodTextFormat(schema, name)
    }
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return valid structured output.");
  }

  return response.output_parsed;
}

const geminiTools: Interactions.Tool[] = [
  {
    type: "google_search"
  }
];

const geminiGenerationConfig: Interactions.GenerationConfig = {
  temperature: 1,
  max_output_tokens: 65536,
  top_p: 0.95,
  thinking_level: "high"
};

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return trimmed;
}

function parseJsonWithSchema<T>(schema: z.ZodType<T>, outputText: string, name: string, providerName: string) {
  const parsed = JSON.parse(extractJson(outputText)) as unknown;
  const candidates = [
    parsed,
    typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>)[name] : undefined,
    typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>).result : undefined,
    typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>).data : undefined
  ].filter((candidate) => candidate !== undefined);

  for (const candidate of candidates) {
    const result = schema.safeParse(candidate);

    if (result.success) {
      return result.data;
    }
  }

  throw new Error(`${providerName} returned JSON, but it did not match the required ${name} structure. Try a stronger local model or a cloud provider for this CV.`);
}

function ollamaJsonFormat(name: string) {
  if (name === "cv_quality_precheck") {
    return {
      type: "object",
      additionalProperties: false,
      required: [
        "cvEvidenceScore",
        "scoreBreakdown",
        "hasQuantifiedResults",
        "hasAccomplishments",
        "mostlyJobDescriptions",
        "impactClarityScore",
        "quantifiedEvidenceCount",
        "strongBulletCount",
        "weakBulletCount",
        "proceedRecommendation",
        "mainProblem",
        "specificWarnings",
        "missingEvidenceTypes",
        "examplesOfWeakBullets",
        "questionsToRecoverMetrics",
        "interviewRiskQuestions",
        "nextStep"
      ],
      properties: {
        cvEvidenceScore: { type: "number", minimum: 0, maximum: 100 },
        scoreBreakdown: {
          type: "object",
          additionalProperties: false,
          required: ["quantifiedResults", "accomplishmentClarity", "scopeAndScale", "responsibilityVersusOutcomeRatio", "interviewDefensibility"],
          properties: {
            quantifiedResults: { type: "number" },
            accomplishmentClarity: { type: "number" },
            scopeAndScale: { type: "number" },
            responsibilityVersusOutcomeRatio: { type: "number" },
            interviewDefensibility: { type: "number" }
          }
        },
        hasQuantifiedResults: { type: "boolean" },
        hasAccomplishments: { type: "boolean" },
        mostlyJobDescriptions: { type: "boolean" },
        impactClarityScore: { type: "number", minimum: 0, maximum: 100 },
        quantifiedEvidenceCount: { type: "number", minimum: 0 },
        strongBulletCount: { type: "number", minimum: 0 },
        weakBulletCount: { type: "number", minimum: 0 },
        proceedRecommendation: { type: "string", enum: ["Proceed", "Improve CV first", "Proceed with caution"] },
        mainProblem: { type: "string" },
        specificWarnings: { type: "array", items: { type: "string" } },
        missingEvidenceTypes: { type: "array", items: { type: "string" } },
        examplesOfWeakBullets: { type: "array", items: { type: "string" } },
        questionsToRecoverMetrics: { type: "array", items: { type: "string" } },
        interviewRiskQuestions: { type: "array", items: { type: "string" } },
        nextStep: { type: "string" }
      }
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "roleDiagnosis",
      "companySignalInterpretation",
      "candidatePositioning",
      "jobFitAssessment",
      "strongestMatchingEvidence",
      "weakOrMissingSignals",
      "keywordsToInclude",
      "keywordsToAvoid",
      "suggestedProfessionalSummary",
      "rewrittenCvBullets",
      "suggestedCvStructure",
      "atsFriendlySkillsSection",
      "recruiterInterpretation",
      "finalReconstructionPlan",
      "integrityAudit",
      "precheckWarningSummary",
      "downloadableText"
    ],
    properties: {
      roleDiagnosis: { type: "string" },
      companySignalInterpretation: { type: "string" },
      candidatePositioning: { type: "string" },
      jobFitAssessment: {
        type: "object",
        additionalProperties: false,
        required: ["score", "verdict", "explanation", "strongestReasons", "mainRisks", "companyDecisionWarning"],
        properties: {
          score: { type: "number", minimum: 0, maximum: 100 },
          verdict: { type: "string", enum: ["Strong match", "Good match", "Partial match", "Weak match"] },
          explanation: { type: "string" },
          strongestReasons: { type: "array", items: { type: "string" } },
          mainRisks: { type: "array", items: { type: "string" } },
          companyDecisionWarning: { type: "string" }
        }
      },
      strongestMatchingEvidence: { type: "array", items: { type: "string" } },
      weakOrMissingSignals: { type: "array", items: { type: "string" } },
      keywordsToInclude: { type: "array", items: { type: "string" } },
      keywordsToAvoid: { type: "array", items: { type: "string" } },
      suggestedProfessionalSummary: { type: "string" },
      rewrittenCvBullets: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["original", "rewritten", "reason", "integrityClassification"],
          properties: {
            original: { type: "string" },
            rewritten: { type: "string" },
            reason: { type: "string" },
            integrityClassification: {
              type: "string",
              enum: ["Directly supported by CV", "Reasonable reframing", "Needs user confirmation", "Not supported and should not be used"]
            }
          }
        }
      },
      suggestedCvStructure: { type: "array", items: { type: "string" } },
      atsFriendlySkillsSection: { type: "array", items: { type: "string" } },
      recruiterInterpretation: { type: "string" },
      finalReconstructionPlan: { type: "array", items: { type: "string" } },
      integrityAudit: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["recommendation", "classification", "explanation"],
          properties: {
            recommendation: { type: "string" },
            classification: {
              type: "string",
              enum: ["Directly supported by CV", "Reasonable reframing", "Needs user confirmation", "Not supported and should not be used"]
            },
            explanation: { type: "string" }
          }
        }
      },
      precheckWarningSummary: { type: "string" },
      downloadableText: { type: "string" }
    }
  };
}

function ollamaJsonContract(name: string) {
  if (name === "cv_quality_precheck") {
    return `Required JSON shape:
{
  "cvEvidenceScore": 0,
  "scoreBreakdown": {
    "quantifiedResults": 0,
    "accomplishmentClarity": 0,
    "scopeAndScale": 0,
    "responsibilityVersusOutcomeRatio": 0,
    "interviewDefensibility": 0
  },
  "hasQuantifiedResults": false,
  "hasAccomplishments": false,
  "mostlyJobDescriptions": false,
  "impactClarityScore": 0,
  "quantifiedEvidenceCount": 0,
  "strongBulletCount": 0,
  "weakBulletCount": 0,
  "proceedRecommendation": "Improve CV first",
  "mainProblem": "",
  "specificWarnings": [],
  "missingEvidenceTypes": [],
  "examplesOfWeakBullets": [],
  "questionsToRecoverMetrics": [],
  "interviewRiskQuestions": [],
  "nextStep": ""
}

Do not wrap this inside another property. Do not return a JSON schema. Return the evaluated object with real values.`;
  }

  return `Required JSON shape:
{
  "roleDiagnosis": "",
  "companySignalInterpretation": "",
  "candidatePositioning": "",
  "jobFitAssessment": {
    "score": 0,
    "verdict": "Weak match",
    "explanation": "",
    "strongestReasons": [],
    "mainRisks": [],
    "companyDecisionWarning": ""
  },
  "strongestMatchingEvidence": [],
  "weakOrMissingSignals": [],
  "keywordsToInclude": [],
  "keywordsToAvoid": [],
  "suggestedProfessionalSummary": "",
  "rewrittenCvBullets": [],
  "suggestedCvStructure": [],
  "atsFriendlySkillsSection": [],
  "recruiterInterpretation": "",
  "finalReconstructionPlan": [],
  "integrityAudit": [],
  "precheckWarningSummary": "",
  "downloadableText": ""
}

Do not wrap this inside another property. Do not return a JSON schema. Return the evaluated object with real values.`;
}

async function createGeminiJsonResponse<T>(client: GoogleGenAI, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  const interaction = await client.interactions.create({
    model: geminiModel(model),
    input: `${input}

Return only valid JSON for the ${name} object. Do not wrap the JSON in Markdown.`,
    tools: geminiTools,
    generation_config: geminiGenerationConfig
  });

  const outputText = interaction.output_text || "";

  if (!outputText.trim()) {
    throw new Error("Gemini did not return text output.");
  }

  return schema.parse(JSON.parse(extractJson(outputText)));
}

async function createMistralJsonResponse<T>(apiKey: string, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: mistralModel(model),
      messages: [
        {
          role: "user",
          content: `${input}

Return only valid JSON for the ${name} object. Do not wrap the JSON in Markdown.`
        }
      ],
      response_format: {
        type: "json_object"
      },
      temperature: 1,
      max_tokens: 65536
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  const outputText = Array.isArray(content)
    ? content
        .map((part) => part.text || "")
        .join("")
        .trim()
    : content || "";

  if (!outputText.trim()) {
    throw new Error("Mistral did not return text output.");
  }

  return schema.parse(JSON.parse(extractJson(outputText)));
}

async function createOllamaJsonResponse<T>(baseUrl: string, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  let response: Response;
  const contract = ollamaJsonContract(name);

  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: ollamaModel(model),
        messages: [
          {
            role: "user",
            content: `${input}

Return only valid JSON for the ${name} object. Do not wrap the JSON in Markdown. Do not include commentary before or after the JSON.

${contract}`
        }
      ],
        format: name === "cv_quality_precheck" ? ollamaJsonFormat(name) : "json",
      stream: false,
      think: false,
      options: {
        temperature: 0.6,
        num_predict: name === "cv_quality_precheck" ? 2200 : 1400
        }
      })
    });
  } catch {
    throw new Error(`Could not reach Ollama at ${baseUrl}. Install Ollama, run the selected model, and confirm the Ollama URL.`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    message?: {
      content?: string;
    };
    response?: string;
  };

  const outputText = data.message?.content || data.response || "";

  if (!outputText.trim()) {
    throw new Error("Ollama did not return text output.");
  }

  try {
    return parseJsonWithSchema(schema, outputText, name, "Ollama");
  } catch {
    return repairOllamaJsonResponse(baseUrl, name, schema, outputText, model);
  }
}

async function repairOllamaJsonResponse<T>(baseUrl: string, name: string, schema: z.ZodType<T>, previousOutput: string, model?: string) {
  const contract = ollamaJsonContract(name);
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: ollamaModel(model),
      messages: [
        {
          role: "user",
          content: `The previous JSON did not match the required ${name} object.

Convert it into exactly this required JSON shape. Preserve the meaning where possible. Fill missing arrays with [] and missing strings with concise text. Fill missing numbers with 0 only when the previous JSON does not provide enough information. Return only valid JSON.

${contract}

Previous JSON:
${previousOutput}`
        }
      ],
      format: name === "cv_quality_precheck" ? ollamaJsonFormat(name) : "json",
      stream: false,
      think: false,
      options: {
        temperature: 0,
        num_predict: name === "cv_quality_precheck" ? 2200 : 1400
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama repair request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    message?: {
      content?: string;
    };
    response?: string;
  };

  const outputText = data.message?.content || data.response || "";

  if (!outputText.trim()) {
    throw new Error("Ollama did not return text output after retrying the JSON structure.");
  }

  return parseJsonWithSchema(schema, outputText, name, "Ollama");
}

async function createOllamaSectionJsonResponse<T>(
  baseUrl: string,
  name: string,
  schema: z.ZodType<T>,
  input: string,
  model?: string,
  numPredict = 600,
  numCtx = 4096,
  allowFallback = true,
  timeoutMs = 45000
) {
  let lastError: unknown;

  const candidates = allowFallback ? ollamaModelCandidates(model) : [ollamaModelCandidates(model)[0]];

  for (const candidateModel of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: candidateModel,
          messages: [
            {
              role: "user",
              content: `${input}

Return only one valid JSON object for ${name}. Do not use Markdown. Do not add commentary.`
            }
          ],
          format: "json",
          stream: false,
          think: false,
          options: {
            temperature: 0.4,
            num_predict: numPredict,
            num_ctx: numCtx
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama ${name} request failed with ${candidateModel} (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        message?: {
          content?: string;
        };
        response?: string;
      };
      const outputText = data.message?.content || data.response || "";

      if (!outputText.trim()) {
        throw new Error(`Ollama did not return text output for ${name} with ${candidateModel}.`);
      }

      return parseJsonWithSchema(schema, outputText, name, "Ollama");
    } catch (error) {
      lastError =
        error instanceof Error && error.name === "AbortError"
          ? new Error(`Ollama took too long to complete ${name} with ${candidateModel}. Try again, choose a smaller local model, or use Gemini, OpenAI, or Mistral for this reconstruction plan.`)
          : error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Ollama could not complete ${name}. Try a stronger local model or a cloud provider for this CV.`);
}

async function createJsonResponse<T>(provider: Provider, name: string, schema: z.ZodType<T>, input: string, model?: string) {
  if (provider.kind === "openai") {
    return createOpenAiJsonResponse(provider.client, name, schema, input, model);
  }

  if (provider.kind === "mistral") {
    return createMistralJsonResponse(provider.apiKey, name, schema, input, model);
  }

  if (provider.kind === "ollama") {
    return createOllamaJsonResponse(provider.baseUrl, name, schema, input, model);
  }

  return createGeminiJsonResponse(provider.client, name, schema, input, model);
}

function ollamaAnalysisContext(input: {
  cvText: string;
  precheckResult: Record<string, unknown>;
  companyName: string;
  companyDescription?: string;
  targetStyle: string;
  experienceSelectionMode: "lastFive" | "all";
  jobDescription: string;
}) {
  return `Use only the evidence below. Do not invent employers, dates, tools, certifications, metrics, responsibilities, or achievements.

Target company: ${input.companyName}
Optional company description: ${input.companyDescription?.trim() || "not provided"}
Target style: ${input.targetStyle}
Experience selection mode: ${input.experienceSelectionMode}

Job description:
${compactForLocalModel(input.jobDescription, 1800)}

Precheck result:
${JSON.stringify(input.precheckResult)}

CV excerpt:
${compactForLocalModel(input.cvText, 3200)}`;
}

function ollamaPrecheckContext(input: {
  cvText: string;
  yearsOfExperience: number;
  hasDegree?: boolean;
  degreeYear?: number;
  experienceSelectionMode: "lastFive" | "all";
}) {
  return `Analyze only this CV evidence. Do not rewrite the CV and do not invent facts.

Years of experience: ${input.yearsOfExperience}
Studies listed: ${input.hasDegree ?? "not provided"}
Study completion year: ${input.degreeYear ?? "not provided"}
Experience selection mode: ${input.experienceSelectionMode}

CV excerpt:
${compactForLocalModel(input.cvText, 4200)}`;
}

async function runOllamaSectionedPrecheck(
  provider: Extract<Provider, { kind: "ollama" }>,
  input: {
    aiModel?: string;
    cvText: string;
    yearsOfExperience: number;
    hasDegree?: boolean;
    degreeYear?: number;
    experienceSelectionMode: "lastFive" | "all";
  }
) {
  const context = ollamaPrecheckContext(input);
  const baseline = buildLocalPrecheckBaseline(input);
  const localFallback = buildLocalPrecheckFallbackSections(input, baseline);
  let warnings: OllamaPrecheckWarningsSection = {
    specificWarnings: [] as string[],
    missingEvidenceTypes: [] as string[],
    examplesOfWeakBullets: [] as string[]
  };
  let questions: OllamaPrecheckQuestionsSection = {
    questionsToRecoverMetrics: [] as string[],
    interviewRiskQuestions: [] as string[]
  };

  try {
    warnings = (await createOllamaSectionJsonResponse(
      provider.baseUrl,
      "ollama_precheck_warnings_section",
      ollamaPrecheckWarningsSectionSchema,
      `${context}

Baseline signal counts:
${JSON.stringify({
  cvEvidenceScore: baseline.cvEvidenceScore,
  quantifiedEvidenceCount: baseline.quantifiedEvidenceCount,
  strongBulletCount: baseline.strongBulletCount,
  weakBulletCount: baseline.weakBulletCount,
  mostlyJobDescriptions: baseline.mostlyJobDescriptions
})}

Focus only on reviewer-quality warnings, missing evidence, and weak bullet examples. Do not rescore the CV.
Return this exact JSON shape:
{
  "specificWarnings": [],
  "missingEvidenceTypes": [],
  "examplesOfWeakBullets": []
}

Use 3 to 6 concrete items per array when useful. Prefer specific observations tied to the CV text over generic advice. Include warnings about unsupported claims, tense, hidden progression, confusing title/responsibility alignment, unnecessary study dates, and sensitive personal data only if relevant. Only list a weak bullet example when the wording is actually activity-based, generic, or hard to defend.`,
      input.aiModel,
      900,
      8192,
      true,
      75000
    )) as OllamaPrecheckWarningsSection;
  } catch {
    warnings = {
      specificWarnings: localFallback.specificWarnings,
      missingEvidenceTypes: localFallback.missingEvidenceTypes,
      examplesOfWeakBullets: localFallback.examplesOfWeakBullets
    };
  }

  try {
    questions = (await createOllamaSectionJsonResponse(
      provider.baseUrl,
      "ollama_precheck_questions_section",
      ollamaPrecheckQuestionsSectionSchema,
      `${context}

Baseline signal counts:
${JSON.stringify({
  cvEvidenceScore: baseline.cvEvidenceScore,
  quantifiedEvidenceCount: baseline.quantifiedEvidenceCount,
  strongBulletCount: baseline.strongBulletCount,
  weakBulletCount: baseline.weakBulletCount,
  mostlyJobDescriptions: baseline.mostlyJobDescriptions
})}

Focus only on practical questions the user can answer to recover metrics and defend claims in interviews.
Return this exact JSON shape:
{
  "questionsToRecoverMetrics": [],
  "interviewRiskQuestions": []
}

Use 4 to 7 specific questions tied to the CV evidence. Avoid generic questions unless the CV has no usable signal.`,
      input.aiModel,
      700,
      8192,
      true,
      60000
    )) as OllamaPrecheckQuestionsSection;
  } catch {
    questions = {
      questionsToRecoverMetrics: localFallback.questionsToRecoverMetrics,
      interviewRiskQuestions: localFallback.interviewRiskQuestions
    };
  }

  return normalizePrecheckResult(
    precheckSchema.parse({
      ...baseline,
      specificWarnings: [...baseline.specificWarnings, ...warnings.specificWarnings],
      missingEvidenceTypes: [...baseline.missingEvidenceTypes, ...warnings.missingEvidenceTypes],
      examplesOfWeakBullets: warnings.examplesOfWeakBullets.length > 0 ? warnings.examplesOfWeakBullets : baseline.examplesOfWeakBullets,
      questionsToRecoverMetrics:
        questions.questionsToRecoverMetrics.length > 0 ? questions.questionsToRecoverMetrics : baseline.questionsToRecoverMetrics,
      interviewRiskQuestions: questions.interviewRiskQuestions.length > 0 ? questions.interviewRiskQuestions : baseline.interviewRiskQuestions
    })
  );
}

function fallbackOllamaPositioning(input: {
  companyName: string;
  targetStyle: string;
  jobDescription: string;
  precheckResult: Record<string, unknown>;
  failureReason: string;
}): OllamaPositioningSection {
  const score = typeof input.precheckResult.cvEvidenceScore === "number" ? input.precheckResult.cvEvidenceScore : undefined;
  const jobSignals = compactForLocalModel(input.jobDescription.replace(/\s+/g, " "), 260);

  return {
    roleDiagnosis: `Partial local result: ${input.companyName} appears to target ${input.targetStyle} work. The local model did not complete the positioning section, so this diagnosis is based on the job description excerpt only: ${jobSignals}`,
    companySignalInterpretation:
      "Partial local result: review the job description manually for the strongest company signals before using this plan.",
    candidatePositioning:
      score !== undefined
        ? `Use the CV evidence precheck score (${score}/100) as the first signal, then verify fit against the completed evidence sections below.`
        : "Use the completed evidence sections below to decide how to position the candidate.",
    recruiterInterpretation:
      "Partial local result: recruiter interpretation could not be completed by the local model.",
    suggestedProfessionalSummary: "",
    precheckWarningSummary: `Partial local result. The local model did not complete ollama_positioning_section. ${input.failureReason}`
  };
}

function fallbackOllamaEvidence(input: {
  companyName: string;
  targetStyle: string;
  precheckResult: Record<string, unknown>;
  failureReason: string;
}): OllamaEvidenceSection {
  const score = typeof input.precheckResult.cvEvidenceScore === "number" ? Math.min(84, Math.max(50, Math.round(input.precheckResult.cvEvidenceScore))) : 50;
  const verdict = score >= 70 ? "Good match" : "Partial match";

  return {
    jobFitAssessment: {
      score,
      verdict,
      explanation:
        "Partial local result: the local model did not complete the evidence section, so this match estimate is based mainly on the CV evidence precheck score and must be reviewed manually.",
      strongestReasons: [],
      mainRisks: ["The local model did not complete the detailed evidence comparison for this target role."],
      companyDecisionWarning:
        `The final hiring decision belongs to ${input.companyName} and can depend on interview performance, internal needs, role level, timing, and factors outside this CV-based analysis.`
    },
    strongestMatchingEvidence: [],
    weakOrMissingSignals: [
      `Partial local result: evidence extraction for ${input.targetStyle} did not complete. Review the CV and job description manually before using this plan. ${input.failureReason}`
    ],
    keywordsToInclude: [],
    keywordsToAvoid: [],
    atsFriendlySkillsSection: []
  };
}

function analysisToDownloadableText(analysis: AnalysisResult) {
  return [
    "CV Reconstruction Plan",
    "",
    "Role diagnosis",
    analysis.roleDiagnosis,
    "",
    "Candidate positioning",
    analysis.candidatePositioning,
    "",
    "Profile match assessment",
    `${analysis.jobFitAssessment.score}/100 - ${analysis.jobFitAssessment.verdict}`,
    analysis.jobFitAssessment.explanation,
    "",
    "Strongest matching evidence",
    ...analysis.strongestMatchingEvidence.map((item) => `- ${item}`),
    "",
    "Weak or missing signals",
    ...analysis.weakOrMissingSignals.map((item) => `- ${item}`),
    "",
    "Suggested summary",
    analysis.suggestedProfessionalSummary,
    "",
    "Rewritten bullets",
    ...analysis.rewrittenCvBullets.map((item) => `- ${item.rewritten} (${item.integrityClassification})`),
    "",
    "Final reconstruction plan",
    ...analysis.finalReconstructionPlan.map((item) => `- ${item}`),
    "",
    "Integrity audit",
    ...analysis.integrityAudit.map((item) => `- ${item.recommendation}: ${item.classification}. ${item.explanation}`)
  ].join("\n");
}

async function runOllamaSectionedAnalysis(
  provider: Extract<Provider, { kind: "ollama" }>,
  input: {
    aiModel?: string;
    cvText: string;
    precheckResult: Record<string, unknown>;
    companyName: string;
    companyDescription?: string;
    targetStyle: string;
    experienceSelectionMode: "lastFive" | "all";
    jobDescription: string;
  }
) {
  const context = ollamaAnalysisContext(input);
  const partialWarnings: string[] = [];
  let positioning: OllamaPositioningSection;

  try {
    positioning = (await createOllamaSectionJsonResponse(
      provider.baseUrl,
      "ollama_positioning_section",
      ollamaPositioningSectionSchema,
      `${context}

Return this exact JSON shape:
{
  "roleDiagnosis": "",
  "companySignalInterpretation": "",
  "candidatePositioning": "",
  "recruiterInterpretation": "",
  "suggestedProfessionalSummary": "",
  "precheckWarningSummary": ""
}

Keep each field concise.`,
      input.aiModel,
      360,
      4096,
      false,
      45000
    )) as OllamaPositioningSection;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local model could not complete the positioning section.";
    partialWarnings.push(message);
    positioning = fallbackOllamaPositioning({
      companyName: input.companyName,
      targetStyle: input.targetStyle,
      jobDescription: input.jobDescription,
      precheckResult: input.precheckResult,
      failureReason: message
    });
  }

  let evidence: OllamaEvidenceSection;

  try {
    evidence = (await createOllamaSectionJsonResponse(
      provider.baseUrl,
      "ollama_evidence_section",
      ollamaEvidenceSectionSchema,
      `${context}

Return this exact JSON shape:
{
  "jobFitAssessment": {
    "score": 0,
    "verdict": "Weak match",
    "explanation": "",
    "strongestReasons": [],
    "mainRisks": [],
    "companyDecisionWarning": ""
  },
  "strongestMatchingEvidence": [],
  "weakOrMissingSignals": [],
  "keywordsToInclude": [],
  "keywordsToAvoid": [],
  "atsFriendlySkillsSection": []
}

Use 1 to 3 items per array. The final hiring decision belongs to the company.`,
      input.aiModel,
      560,
      4096,
      true,
      90000
    )) as OllamaEvidenceSection;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local model could not complete the evidence section.";
    partialWarnings.push(message);
    evidence = fallbackOllamaEvidence({
      companyName: input.companyName,
      targetStyle: input.targetStyle,
      precheckResult: input.precheckResult,
      failureReason: message
    });
  }

  let plan: OllamaPlanSection = {
    rewrittenCvBullets: [] as AnalysisResult["rewrittenCvBullets"],
    suggestedCvStructure: [] as string[],
    finalReconstructionPlan: [] as string[],
    integrityAudit: [] as AnalysisResult["integrityAudit"]
  };

  try {
    plan = (await createOllamaSectionJsonResponse(
      provider.baseUrl,
      "ollama_plan_section",
      ollamaPlanSectionSchema,
      `${context}

Return this exact JSON shape:
{
  "rewrittenCvBullets": [
    {
      "original": "",
      "rewritten": "",
      "reason": "",
      "integrityClassification": "Directly supported by CV"
    }
  ],
  "suggestedCvStructure": [],
  "finalReconstructionPlan": [],
  "integrityAudit": [
    {
      "recommendation": "",
      "classification": "Needs user confirmation",
      "explanation": ""
    }
  ]
}

Use 1 to 2 items per array. Never invent evidence.`,
      input.aiModel,
      600,
      4096,
      true,
      90000
    )) as OllamaPlanSection;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local model could not complete the final plan section.";
    partialWarnings.push(message);
    plan = {
      rewrittenCvBullets: [],
      suggestedCvStructure: [
        "Partial local result: review the completed match/evidence sections, then retry reconstruction with a cloud provider or smaller local model for a full CV structure."
      ],
      finalReconstructionPlan: [
        "Partial local result: the local model completed the earlier analysis sections but did not complete the final reconstruction plan section."
      ],
      integrityAudit: [
        {
          recommendation: "Do not use this as a complete CV reconstruction plan yet.",
          classification: "Needs user confirmation",
          explanation: message
        }
      ]
    };
  }

  const analysis = analysisSchema.parse({
    ...positioning,
    ...evidence,
    ...plan,
    precheckWarningSummary: [positioning.precheckWarningSummary, ...partialWarnings].filter(Boolean).join(" "),
    downloadableText: ""
  });

  return {
    ...analysis,
    downloadableText: analysisToDownloadableText(analysis)
  };
}

export async function runPrecheck(input: {
  aiProvider?: AiProviderKind;
  aiModel?: string;
  apiKey?: string;
  ollamaBaseUrl?: string;
  cvText: string;
  yearsOfExperience: number;
  hasDegree?: boolean;
  degreeYear?: number;
  experienceSelectionMode: "lastFive" | "all";
}) {
  const provider = createModelProvider(input.aiProvider, input.apiKey, input.ollamaBaseUrl);
  if (provider.kind === "ollama") {
    const parsed = await runOllamaSectionedPrecheck(provider, input);

    if (parsed.questionsToRecoverMetrics.length === 0) {
      parsed.questionsToRecoverMetrics = defaultMetricRecoveryQuestions;
    }

    return parsed;
  }

  const parsed = await createJsonResponse(
    provider,
    "cv_quality_precheck",
    precheckSchema,
    precheckPrompt(input),
    input.aiModel
  );

  if (parsed.questionsToRecoverMetrics.length === 0) {
    parsed.questionsToRecoverMetrics = defaultMetricRecoveryQuestions;
  }

  return normalizePrecheckResult(parsed);
}

export async function runAnalysis(input: {
  aiProvider?: AiProviderKind;
  aiModel?: string;
  apiKey?: string;
  ollamaBaseUrl?: string;
  cvText: string;
  precheckResult: Record<string, unknown>;
  companyName: string;
  companyDescription?: string;
  targetStyle: string;
  experienceSelectionMode: "lastFive" | "all";
  jobDescription: string;
}) {
  const provider = createModelProvider(input.aiProvider, input.apiKey, input.ollamaBaseUrl);
  if (provider.kind === "ollama") {
    return normalizeAnalysisResult(await runOllamaSectionedAnalysis(provider, input));
  }

  const analysis = await createJsonResponse(
    provider,
    "cv_reconstruction_plan",
    analysisSchema,
    reconstructionPrompt(input),
    input.aiModel
  );

  return normalizeAnalysisResult(analysis);
}
