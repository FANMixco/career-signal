import { z } from "zod";
import { analysisSchema, precheckSchema, type AnalysisResult } from "../../schemas/aiSchemas.js";
import { parseJsonWithSchema } from "./jsonUtils.js";
import { buildLocalPrecheckBaseline, buildLocalPrecheckFallbackSections, compactForLocalModel } from "./localCvEvidence.js";
import { ollamaModelCandidates } from "./modelNames.js";
import { normalizePrecheckResult } from "./resultNormalizers.js";
import type {
  AnalysisInput,
  OllamaEvidenceSection,
  OllamaPlanSection,
  OllamaPositioningSection,
  OllamaPrecheckQuestionsSection,
  OllamaPrecheckWarningsSection,
  PrecheckInput,
  Provider
} from "./types.js";

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

const ollamaPrecheckWarningsSectionSchema = z.object({
  specificWarnings: z.array(z.string()).catch([]),
  missingEvidenceTypes: z.array(z.string()).catch([]),
  examplesOfWeakBullets: z.array(z.string()).catch([])
});

const ollamaPrecheckQuestionsSectionSchema = z.object({
  questionsToRecoverMetrics: z.array(z.string()).catch([]),
  interviewRiskQuestions: z.array(z.string()).catch([])
});

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

function ollamaAnalysisContext(input: AnalysisInput) {
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

function ollamaPrecheckContext(input: PrecheckInput) {
  return `Analyze only this CV evidence. Do not rewrite the CV and do not invent facts.

Years of experience: ${input.yearsOfExperience}
Studies listed: ${input.hasDegree ?? "not provided"}
Study completion year: ${input.degreeYear ?? "not provided"}
Experience selection mode: ${input.experienceSelectionMode}

CV excerpt:
${compactForLocalModel(input.cvText, 4200)}`;
}

export async function runOllamaSectionedPrecheck(
  provider: Extract<Provider, { kind: "ollama" }>,
  input: PrecheckInput
) {
  const context = ollamaPrecheckContext(input);
  const baseline = buildLocalPrecheckBaseline(input);
  const localFallback = buildLocalPrecheckFallbackSections(input, baseline);
  let warnings: OllamaPrecheckWarningsSection = {
    specificWarnings: [],
    missingEvidenceTypes: [],
    examplesOfWeakBullets: []
  };
  let questions: OllamaPrecheckQuestionsSection = {
    questionsToRecoverMetrics: [],
    interviewRiskQuestions: []
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

export async function runOllamaSectionedAnalysis(
  provider: Extract<Provider, { kind: "ollama" }>,
  input: AnalysisInput
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
    rewrittenCvBullets: [],
    suggestedCvStructure: [],
    finalReconstructionPlan: [],
    integrityAudit: []
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
