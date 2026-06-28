import { z } from "zod";
import { proceedRecommendations, scoreBreakdownMaximums } from "../rules/cvRules.js";

export const precheckSchema = z.object({
  cvEvidenceScore: z.number().min(0).max(100),
  scoreBreakdown: z.object({
    quantifiedResults: z.number().min(0).max(scoreBreakdownMaximums.quantifiedResults),
    accomplishmentClarity: z.number().min(0).max(scoreBreakdownMaximums.accomplishmentClarity),
    scopeAndScale: z.number().min(0).max(scoreBreakdownMaximums.scopeAndScale),
    responsibilityVersusOutcomeRatio: z.number().min(0).max(scoreBreakdownMaximums.responsibilityVersusOutcomeRatio),
    interviewDefensibility: z.number().min(0).max(scoreBreakdownMaximums.interviewDefensibility)
  }),
  hasQuantifiedResults: z.boolean(),
  hasAccomplishments: z.boolean(),
  mostlyJobDescriptions: z.boolean(),
  impactClarityScore: z.number().min(0).max(100),
  quantifiedEvidenceCount: z.number().min(0),
  strongBulletCount: z.number().min(0),
  weakBulletCount: z.number().min(0),
  proceedRecommendation: z.enum(proceedRecommendations),
  mainProblem: z.string(),
  specificWarnings: z.array(z.string()),
  missingEvidenceTypes: z.array(z.string()),
  examplesOfWeakBullets: z.array(z.string()),
  questionsToRecoverMetrics: z.array(z.string()),
  interviewRiskQuestions: z.array(z.string()),
  nextStep: z.string()
});

const integrityClassifications = [
  "Directly supported by CV",
  "Reasonable reframing",
  "Needs user confirmation",
  "Not supported and should not be used"
] as const;

export const analysisSchema = z.object({
  roleDiagnosis: z.string(),
  companySignalInterpretation: z.string(),
  candidatePositioning: z.string(),
  jobFitAssessment: z.object({
    score: z.number().min(0).max(100),
    verdict: z.enum(["Strong match", "Good match", "Partial match", "Weak match"]),
    explanation: z.string(),
    strongestReasons: z.array(z.string()),
    mainRisks: z.array(z.string()),
    companyDecisionWarning: z.string()
  }),
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
      integrityClassification: z.enum(integrityClassifications)
    })
  ),
  suggestedCvStructure: z.array(z.string()),
  atsFriendlySkillsSection: z.array(z.string()),
  recruiterInterpretation: z.string(),
  finalReconstructionPlan: z.array(z.string()),
  integrityAudit: z.array(
    z.object({
      recommendation: z.string(),
      classification: z.enum(integrityClassifications),
      explanation: z.string()
    })
  ),
  precheckWarningSummary: z.string(),
  downloadableText: z.string()
});

export type PrecheckResult = z.infer<typeof precheckSchema>;
export type AnalysisResult = z.infer<typeof analysisSchema>;
