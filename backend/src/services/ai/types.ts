// Shared provider and request types for the AI service layer.
// Keep these shapes aligned with frontend provider options and route payloads.
import type { GoogleGenAI } from "@google/genai";
import type OpenAI from "openai";
import type { AnalysisResult } from "../../schemas/aiSchemas.js";

export type Provider =
  | { kind: "openai"; client: OpenAI }
  | { kind: "gemini"; client: GoogleGenAI }
  | { kind: "mistral"; apiKey: string }
  | { kind: "ollama"; baseUrl: string };

export type AiProviderKind = Provider["kind"];

export type PrecheckInput = {
  aiProvider?: AiProviderKind;
  aiModel?: string;
  apiKey?: string;
  ollamaBaseUrl?: string;
  cvText: string;
  yearsOfExperience: number;
  hasDegree?: boolean;
  degreeYear?: number;
  experienceSelectionMode: "lastFive" | "all";
};

export type AnalysisInput = {
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
};

export type OllamaPrecheckAdviceSection = {
  specificWarnings: string[];
  missingEvidenceTypes: string[];
  examplesOfWeakBullets: string[];
  questionsToRecoverMetrics: string[];
  interviewRiskQuestions: string[];
};

export type OllamaPrecheckWarningsSection = {
  specificWarnings: string[];
  missingEvidenceTypes: string[];
  examplesOfWeakBullets: string[];
};

export type OllamaPrecheckQuestionsSection = {
  questionsToRecoverMetrics: string[];
  interviewRiskQuestions: string[];
};

export type OllamaPositioningSection = {
  roleDiagnosis: string;
  companySignalInterpretation: string;
  candidatePositioning: string;
  recruiterInterpretation: string;
  suggestedProfessionalSummary: string;
  precheckWarningSummary: string;
};

export type OllamaEvidenceSection = {
  jobFitAssessment: AnalysisResult["jobFitAssessment"];
  strongestMatchingEvidence: string[];
  weakOrMissingSignals: string[];
  keywordsToInclude: string[];
  keywordsToAvoid: string[];
  atsFriendlySkillsSection: string[];
};

export type OllamaPlanSection = {
  rewrittenCvBullets: AnalysisResult["rewrittenCvBullets"];
  suggestedCvStructure: string[];
  finalReconstructionPlan: string[];
  integrityAudit: AnalysisResult["integrityAudit"];
};
