// OpenRouter free-model adapter.
// Free routed models are more likely to hit rate limits or drift from a large
// strict schema, so this mirrors the Ollama strategy with smaller JSON sections.
import type OpenAI from "openai";
import { z } from "zod";
import { integrityClassifications, jobFitVerdicts, outputLanguageNames } from "../../rules/cvRules.js";
import { analysisSchema, precheckSchema, type AnalysisResult } from "../../schemas/aiSchemas.js";
import { parseJsonWithSchema } from "./jsonUtils.js";
import { buildLocalPrecheckBaseline, buildLocalPrecheckFallbackSections, compactForLocalModel } from "./localCvEvidence.js";
import { openRouterModel } from "./modelNames.js";
import { normalizePrecheckResult } from "./resultNormalizers.js";
import type { AnalysisInput, PrecheckInput, Provider } from "./types.js";

const fitAssessmentSchema = analysisSchema.shape.jobFitAssessment;
const rewrittenBulletSchema = analysisSchema.shape.rewrittenCvBullets.element;
const integrityAuditItemSchema = analysisSchema.shape.integrityAudit.element;

const openRouterPositioningSectionSchema = z.object({
  roleDiagnosis: z.string().catch("OpenRouter did not provide a role diagnosis."),
  companySignalInterpretation: z.string().catch("OpenRouter did not provide company signal interpretation."),
  candidatePositioning: z.string().catch("OpenRouter did not provide candidate positioning."),
  recruiterInterpretation: z.string().catch("OpenRouter did not provide recruiter interpretation."),
  suggestedProfessionalSummary: z.string().catch(""),
  precheckWarningSummary: z.string().catch("")
});

const openRouterEvidenceSectionSchema = z.object({
  jobFitAssessment: fitAssessmentSchema.catch({
    score: 0,
    verdict: jobFitVerdicts[3],
    explanation: "OpenRouter did not provide a valid profile match assessment.",
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

const openRouterPlanSectionSchema = z.object({
  rewrittenCvBullets: z.array(rewrittenBulletSchema).catch([]),
  suggestedCvStructure: z.array(z.string()).catch([]),
  finalReconstructionPlan: z.array(z.string()).catch([]),
  integrityAudit: z.array(integrityAuditItemSchema).catch([])
});

const openRouterPrecheckWarningsSectionSchema = z.object({
  specificWarnings: z.array(z.string()).catch([]),
  missingEvidenceTypes: z.array(z.string()).catch([]),
  examplesOfWeakBullets: z.array(z.string()).catch([])
});

const openRouterPrecheckQuestionsSectionSchema = z.object({
  questionsToRecoverMetrics: z.array(z.string()).catch([]),
  interviewRiskQuestions: z.array(z.string()).catch([])
});

type OutputLanguage = keyof typeof outputLanguageNames;

type OpenRouterPositioningSection = z.infer<typeof openRouterPositioningSectionSchema>;
type OpenRouterEvidenceSection = z.infer<typeof openRouterEvidenceSectionSchema>;
type OpenRouterPlanSection = z.infer<typeof openRouterPlanSectionSchema>;
type OpenRouterPrecheckWarningsSection = z.infer<typeof openRouterPrecheckWarningsSectionSchema>;
type OpenRouterPrecheckQuestionsSection = z.infer<typeof openRouterPrecheckQuestionsSectionSchema>;

function outputLanguageInstruction(outputLanguage: OutputLanguage = "en") {
  const languageName = outputLanguageNames[outputLanguage] || outputLanguageNames.en;
  return `Write human-facing explanations, warnings, questions, bullets, summaries, and plan items in ${languageName}. Keep JSON keys and fixed enum values in English.`;
}

function openRouterErrorMessage(error: unknown, sectionName: string) {
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: unknown }).status) : 0;

  if (status === 429) {
    return `OpenRouter's upstream provider is rate-limited or temporarily overloaded for ${sectionName}.`;
  }

  return error instanceof Error ? error.message : `OpenRouter could not complete ${sectionName}.`;
}

async function createOpenRouterSectionJsonResponse<T>(
  client: OpenAI,
  name: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  input: string,
  model?: string,
  maxTokens = 700
) {
  try {
    const response = await client.chat.completions.create({
      model: openRouterModel(model),
      messages: [
        {
          role: "user",
          content: `${input}

Return only one valid JSON object for ${name}. Do not use Markdown. Do not add commentary.`
        }
      ],
      response_format: {
        type: "json_object"
      },
      temperature: 0.4,
      max_tokens: maxTokens
    });

    const outputText = response.choices[0]?.message?.content || "";

    if (!outputText.trim()) {
      throw new Error(`OpenRouter did not return text output for ${name}.`);
    }

    return parseJsonWithSchema(schema, outputText, name, "OpenRouter") as T;
  } catch (error) {
    throw new Error(openRouterErrorMessage(error, name));
  }
}

function openRouterAnalysisContext(input: AnalysisInput) {
  return `Use only the evidence below. Do not invent employers, dates, tools, certifications, metrics, responsibilities, or achievements.

${outputLanguageInstruction(input.outputLanguage)}

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

function openRouterPrecheckContext(input: PrecheckInput) {
  return `Analyze only this CV evidence. Do not rewrite the CV and do not invent facts.

${outputLanguageInstruction(input.outputLanguage)}

Years of experience: ${input.yearsOfExperience}
Studies listed: ${input.hasDegree ?? "not provided"}
Study completion year: ${input.degreeYear ?? "not provided"}
Experience selection mode: ${input.experienceSelectionMode}

CV excerpt:
${compactForLocalModel(input.cvText, 4200)}`;
}

export async function runOpenRouterSectionedPrecheck(provider: Extract<Provider, { kind: "openrouter" }>, input: PrecheckInput) {
  const context = openRouterPrecheckContext(input);
  const baseline = buildLocalPrecheckBaseline(input);
  const fallback = buildLocalPrecheckFallbackSections(input, baseline);
  let warnings: OpenRouterPrecheckWarningsSection = {
    specificWarnings: [],
    missingEvidenceTypes: [],
    examplesOfWeakBullets: []
  };
  let questions: OpenRouterPrecheckQuestionsSection = {
    questionsToRecoverMetrics: [],
    interviewRiskQuestions: []
  };

  try {
    warnings = await createOpenRouterSectionJsonResponse<OpenRouterPrecheckWarningsSection>(
      provider.client,
      "openrouter_precheck_warnings_section",
      openRouterPrecheckWarningsSectionSchema,
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

Use 3 to 6 concrete items per array when useful. Prefer specific observations tied to the CV text over generic advice.`,
      input.aiModel,
      900
    );
  } catch {
    warnings = {
      specificWarnings: fallback.specificWarnings,
      missingEvidenceTypes: fallback.missingEvidenceTypes,
      examplesOfWeakBullets: fallback.examplesOfWeakBullets
    };
  }

  try {
    questions = await createOpenRouterSectionJsonResponse<OpenRouterPrecheckQuestionsSection>(
      provider.client,
      "openrouter_precheck_questions_section",
      openRouterPrecheckQuestionsSectionSchema,
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
      700
    );
  } catch {
    questions = {
      questionsToRecoverMetrics: fallback.questionsToRecoverMetrics,
      interviewRiskQuestions: fallback.interviewRiskQuestions
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

function fallbackOpenRouterPositioning(input: {
  companyName: string;
  targetStyle: string;
  jobDescription: string;
  precheckResult: Record<string, unknown>;
  failureReason: string;
}): OpenRouterPositioningSection {
  const score = typeof input.precheckResult.cvEvidenceScore === "number" ? input.precheckResult.cvEvidenceScore : undefined;
  const jobSignals = compactForLocalModel(input.jobDescription.replace(/\s+/g, " "), 260);

  return {
    roleDiagnosis: `Partial OpenRouter result: ${input.companyName} appears to target ${input.targetStyle} work. The positioning section did not complete, so this diagnosis is based on the job description excerpt only: ${jobSignals}`,
    companySignalInterpretation:
      "Partial OpenRouter result: review the job description manually for the strongest company signals before using this plan.",
    candidatePositioning:
      score !== undefined
        ? `Use the CV evidence precheck score (${score}/100) as the first signal, then verify fit against the completed evidence sections below.`
        : "Use the completed evidence sections below to decide how to position the candidate.",
    recruiterInterpretation: "Partial OpenRouter result: recruiter interpretation could not be completed by the free model.",
    suggestedProfessionalSummary: "",
    precheckWarningSummary: `Partial OpenRouter result. The model did not complete openrouter_positioning_section. ${input.failureReason}`
  };
}

function fallbackOpenRouterEvidence(input: {
  companyName: string;
  targetStyle: string;
  precheckResult: Record<string, unknown>;
  failureReason: string;
}): OpenRouterEvidenceSection {
  const score = typeof input.precheckResult.cvEvidenceScore === "number" ? Math.min(84, Math.max(50, Math.round(input.precheckResult.cvEvidenceScore))) : 50;
  const verdict = score >= 70 ? jobFitVerdicts[1] : jobFitVerdicts[2];

  return {
    jobFitAssessment: {
      score,
      verdict,
      explanation:
        "Partial OpenRouter result: the evidence section did not complete, so this match estimate is based mainly on the CV evidence precheck score and must be reviewed manually.",
      strongestReasons: [],
      mainRisks: ["The free model did not complete the detailed evidence comparison for this target role."],
      companyDecisionWarning:
        `The final hiring decision belongs to ${input.companyName} and can depend on interview performance, internal needs, role level, timing, and factors outside this CV-based analysis.`
    },
    strongestMatchingEvidence: [],
    weakOrMissingSignals: [
      `Partial OpenRouter result: evidence extraction for ${input.targetStyle} did not complete. Review the CV and job description manually before using this plan. ${input.failureReason}`
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

export async function runOpenRouterSectionedAnalysis(provider: Extract<Provider, { kind: "openrouter" }>, input: AnalysisInput) {
  const context = openRouterAnalysisContext(input);
  const partialWarnings: string[] = [];
  let positioning: OpenRouterPositioningSection;

  try {
    positioning = await createOpenRouterSectionJsonResponse<OpenRouterPositioningSection>(
      provider.client,
      "openrouter_positioning_section",
      openRouterPositioningSectionSchema,
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
      600
    );
  } catch (error) {
    const message = openRouterErrorMessage(error, "openrouter_positioning_section");
    partialWarnings.push(message);
    positioning = fallbackOpenRouterPositioning({
      companyName: input.companyName,
      targetStyle: input.targetStyle,
      jobDescription: input.jobDescription,
      precheckResult: input.precheckResult,
      failureReason: message
    });
  }

  let evidence: OpenRouterEvidenceSection;

  try {
    evidence = await createOpenRouterSectionJsonResponse<OpenRouterEvidenceSection>(
      provider.client,
      "openrouter_evidence_section",
      openRouterEvidenceSectionSchema,
      `${context}

Return this exact JSON shape:
{
  "jobFitAssessment": {
    "score": 0,
    "verdict": "${jobFitVerdicts[3]}",
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
      900
    );
  } catch (error) {
    const message = openRouterErrorMessage(error, "openrouter_evidence_section");
    partialWarnings.push(message);
    evidence = fallbackOpenRouterEvidence({
      companyName: input.companyName,
      targetStyle: input.targetStyle,
      precheckResult: input.precheckResult,
      failureReason: message
    });
  }

  let plan: OpenRouterPlanSection = {
    rewrittenCvBullets: [],
    suggestedCvStructure: [],
    finalReconstructionPlan: [],
    integrityAudit: []
  };

  try {
    plan = await createOpenRouterSectionJsonResponse<OpenRouterPlanSection>(
      provider.client,
      "openrouter_plan_section",
      openRouterPlanSectionSchema,
      `${context}

Return this exact JSON shape:
{
  "rewrittenCvBullets": [
    {
      "original": "",
      "rewritten": "",
      "reason": "",
      "integrityClassification": "${integrityClassifications[0]}"
    }
  ],
  "suggestedCvStructure": [],
  "finalReconstructionPlan": [],
  "integrityAudit": [
    {
      "recommendation": "",
      "classification": "${integrityClassifications[2]}",
      "explanation": ""
    }
  ]
}

Use 1 to 2 items per array. Never invent evidence.`,
      input.aiModel,
      900
    );
  } catch (error) {
    const message = openRouterErrorMessage(error, "openrouter_plan_section");
    partialWarnings.push(message);
    plan = {
      rewrittenCvBullets: [],
      suggestedCvStructure: [
        "Partial OpenRouter result: review the completed match/evidence sections, then retry reconstruction with another model for a full CV structure."
      ],
      finalReconstructionPlan: [
        "Partial OpenRouter result: the free model completed the earlier analysis sections but did not complete the final reconstruction plan section."
      ],
      integrityAudit: [
        {
          recommendation: "Do not use this as a complete CV reconstruction plan yet.",
          classification: integrityClassifications[2],
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
