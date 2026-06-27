import { GoogleGenAI } from "@google/genai";
import type { Interactions } from "@google/genai";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const defaultQuestions = [
  "What changed because of your work?",
  "How many users, clients, systems, teams, or countries were affected?",
  "Did you reduce time, cost, risk, errors, delays, or manual work?",
  "Did you increase adoption, performance, revenue, visibility, reliability, or satisfaction?",
  "How many projects did you deliver?",
  "What was the before and after situation?",
  "Who used the thing you created?",
  "Would this claim survive an interview?"
];

const precheckSchema = z.object({
  cvEvidenceScore: z.number().min(0).max(100),
  scoreBreakdown: z.object({
    quantifiedResults: z.number().min(0).max(30),
    accomplishmentClarity: z.number().min(0).max(25),
    scopeAndScale: z.number().min(0).max(20),
    responsibilityVersusOutcomeRatio: z.number().min(0).max(15),
    interviewDefensibility: z.number().min(0).max(10)
  }),
  hasQuantifiedResults: z.boolean(),
  hasAccomplishments: z.boolean(),
  mostlyJobDescriptions: z.boolean(),
  impactClarityScore: z.number().min(0).max(100),
  quantifiedEvidenceCount: z.number().min(0),
  strongBulletCount: z.number().min(0),
  weakBulletCount: z.number().min(0),
  proceedRecommendation: z.enum(["Proceed", "Improve CV first", "Proceed with caution"]),
  mainProblem: z.string(),
  specificWarnings: z.array(z.string()),
  missingEvidenceTypes: z.array(z.string()),
  examplesOfWeakBullets: z.array(z.string()),
  questionsToRecoverMetrics: z.array(z.string()),
  interviewRiskQuestions: z.array(z.string()),
  nextStep: z.string()
});

const analysisSchema = z.object({
  roleDiagnosis: z.string(),
  companySignalInterpretation: z.string(),
  candidatePositioning: z.string(),
  strongestMatchingEvidence: z.array(z.string()),
  weakOrMissingSignals: z.array(z.string()),
  keywordsToInclude: z.array(z.string()),
  keywordsToAvoid: z.array(z.string()),
  suggestedProfessionalSummary: z.string(),
  rewrittenCvBullets: z.array(
    z.object({
      original: z.string(),
      rewritten: z.string(),
      reason: z.string(),
      integrityClassification: z.enum([
        "Directly supported by CV",
        "Reasonable reframing",
        "Needs user confirmation",
        "Not supported and should not be used"
      ])
    })
  ),
  suggestedCvStructure: z.array(z.string()),
  atsFriendlySkillsSection: z.array(z.string()),
  recruiterInterpretation: z.string(),
  finalReconstructionPlan: z.array(z.string()),
  integrityAudit: z.array(
    z.object({
      recommendation: z.string(),
      classification: z.enum([
        "Directly supported by CV",
        "Reasonable reframing",
        "Needs user confirmation",
        "Not supported and should not be used"
      ]),
      explanation: z.string()
    })
  ),
  precheckWarningSummary: z.string(),
  downloadableText: z.string()
});

export type PrecheckResult = z.infer<typeof precheckSchema>;
export type AnalysisResult = z.infer<typeof analysisSchema>;

type Provider =
  | { kind: "openai"; client: OpenAI }
  | { kind: "gemini"; client: GoogleGenAI };

function recommendationForScore(score: number): PrecheckResult["proceedRecommendation"] {
  if (score >= 75) return "Proceed";
  if (score >= 50) return "Proceed with caution";
  return "Improve CV first";
}

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
  const privacySafeEducation =
    "Education / studies only if role-relevant or required; omit completion years and older details that add age/privacy risk";
  const suggestedCvStructure = analysis.suggestedCvStructure.map((item) => {
    const trimmed = item.trim();
    if (/^education$/i.test(trimmed) || /^studies$/i.test(trimmed)) {
      return privacySafeEducation;
    }

    if (/^education\s*(?:&|and)\s*(certifications|awards)/i.test(trimmed)) {
      return `${trimmed} (keep credentials relevant to the target role; omit unnecessary study years and older education details)`;
    }

    return item;
  });

  return {
    ...analysis,
    suggestedCvStructure,
    downloadableText: analysis.downloadableText
      .replace(/^Education$/gim, privacySafeEducation)
      .replace(/^Studies$/gim, privacySafeEducation)
  };
}

export function createModelProvider(apiKey?: string): Provider {
  const openAiKey = apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (openAiKey) {
    return { kind: "openai", client: new OpenAI({ apiKey: openAiKey }) };
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (geminiKey) {
    return { kind: "gemini", client: new GoogleGenAI({ apiKey: geminiKey }) };
  }

  throw new Error(
    "An AI API key is required. Paste an OpenAI key, configure OPENAI_API_KEY, or configure GEMINI_API_KEY in the backend .env file."
  );
}

function openAiModel() {
  return process.env.OPENAI_MODEL || "gpt-5.2";
}

function geminiModel() {
  return process.env.GEMINI_MODEL || "models/gemini-3-flash-preview";
}

async function createOpenAiJsonResponse<T>(client: OpenAI, name: string, schema: z.ZodType<T>, input: string) {
  const response = await client.responses.parse({
    model: openAiModel(),
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

async function createGeminiJsonResponse<T>(client: GoogleGenAI, name: string, schema: z.ZodType<T>, input: string) {
  const interaction = await client.interactions.create({
    model: geminiModel(),
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

async function createJsonResponse<T>(provider: Provider, name: string, schema: z.ZodType<T>, input: string) {
  if (provider.kind === "openai") {
    return createOpenAiJsonResponse(provider.client, name, schema, input);
  }

  return createGeminiJsonResponse(provider.client, name, schema, input);
}

export async function runPrecheck(input: {
  apiKey?: string;
  cvText: string;
  yearsOfExperience: number;
  hasDegree?: boolean;
  degreeYear?: number;
  experienceSelectionMode: "lastFive" | "all";
}) {
  const provider = createModelProvider(input.apiKey);
  const parsed = await createJsonResponse(
    provider,
    "cv_quality_precheck",
    precheckSchema,
    `System:
You are an honest senior CV reviewer. Inspect the candidate CV before any job specific tailoring. Do not rewrite the CV. Do not analyze a job description. Do not invent achievements or numbers. Only determine whether the CV contains enough accomplishments, quantified results, scale, scope, consequence, and impact evidence to be worth tailoring. Return only valid JSON.

Scoring rules:
- cvEvidenceScore must be an integer from 0 to 100, not a decimal score out of 10.
- If you think the CV is 8.6 out of 10, return 86.
- Recommendation must match the score band: 0-49 Improve CV first, 50-74 Proceed with caution, 75-100 Proceed.

Candidate metadata:

Years of professional experience:
${input.yearsOfExperience}

Lists studies or education on CV:
${input.hasDegree ?? "not provided"}

Study completion year:
${input.degreeYear ?? "not provided"}

Experience selection mode:
${input.experienceSelectionMode}

Candidate CV text:
${input.cvText}

Inspect this CV and return the required JSON structure. Include practical questions to recover metrics.`
  );

  if (parsed.questionsToRecoverMetrics.length === 0) {
    parsed.questionsToRecoverMetrics = defaultQuestions;
  }

  return normalizePrecheckResult(parsed);
}

export async function runAnalysis(input: {
  apiKey?: string;
  cvText: string;
  precheckResult: Record<string, unknown>;
  companyName: string;
  targetStyle: string;
  experienceSelectionMode: "lastFive" | "all";
  jobDescription: string;
}) {
  const provider = createModelProvider(input.apiKey);
  const analysis = await createJsonResponse(
    provider,
    "cv_reconstruction_plan",
    analysisSchema,
    `System:
You are a senior career strategist, executive recruiter, ATS optimization specialist, and honest CV editor. Create a CV reconstruction plan for the target role. Never invent experience, employers, dates, studies, certifications, metrics, tools, or achievements. Reframe only existing experience, identify missing signals, and classify each important recommendation by integrity level. Return only valid JSON.

Education and studies guidance:
- Preserve any precheck privacy warning about study years, graduation years, older education details, or age inference in the final plan.
- If studies are relevant, recommend keeping the study credential or education item but removing unnecessary completion years when the candidate has several years of experience.
- If a study, course, old education item, or education date is not relevant to the target role, suggest de-emphasizing or removing it from the CV.
- Do not include a bare "Education" section as a default. If education/studies should appear, make it conditional and privacy-safe, for example: "Education / studies only if role-relevant or required; omit completion years and older details."
- Do not remove legally or professionally required credentials. Classify any education change by integrity level and explain the reason.

Candidate CV text:
${input.cvText}

CV precheck result:
${JSON.stringify(input.precheckResult)}

Target company:
${input.companyName}

Target role style:
${input.targetStyle}

Experience selection mode:
${input.experienceSelectionMode}

Job description:
${input.jobDescription}

Create a complete CV reconstruction plan using the required JSON structure.`
  );

  return normalizeAnalysisResult(analysis);
}
