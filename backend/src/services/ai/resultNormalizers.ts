import { educationPrivacy, recommendationForScore } from "../../rules/cvRules.js";
import type { AnalysisResult, PrecheckResult } from "../../schemas/aiSchemas.js";

export function normalizePrecheckResult(precheck: PrecheckResult): PrecheckResult {
  const rawScore = precheck.cvEvidenceScore;
  const normalizedScore = rawScore > 0 && rawScore <= 10 ? rawScore * 10 : rawScore;
  const cvEvidenceScore = Math.max(0, Math.min(100, Math.round(normalizedScore)));

  return {
    ...precheck,
    cvEvidenceScore,
    proceedRecommendation: recommendationForScore(cvEvidenceScore)
  };
}

export function normalizeAnalysisResult(analysis: AnalysisResult): AnalysisResult {
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
