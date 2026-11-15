import { getEvaluation } from "../../rules/rulesRuntime.js";
// Deterministic CV evidence checks used as the safety net for weaker models.
// These rules do not replace the LLM review; they make sure the app can still
// return a defensible score and practical warnings when a model is weak,
// too slow, or unable to produce the requested JSON shape.
import { defaultMetricRecoveryQuestions, detectSensitivePersonalDataWarnings, recommendationForScore } from "../../rules/cvRules.js";
import type { PrecheckResult } from "../../schemas/aiSchemas.js";
import type { OllamaPrecheckAdviceSection } from "./types.js";

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

export function compactForLocalModel(text: string, maxChars = 12000) {
  if (text.length <= maxChars) {
    return text;
  }

  const headLength = Math.round(maxChars * 0.7);
  const tailLength = maxChars - headLength;
  return `${text.slice(0, headLength)}

[...content shortened for local Ollama processing...]

${text.slice(-tailLength)}`;
}

// Produces the numeric precheck fields required by the shared schema. This is
// intentionally conservative and evidence-based, using visible text signals only.
export function buildLocalPrecheckBaseline(input: {
  cvText: string;
  yearsOfExperience: number;
  hasDegree?: boolean;
  degreeYear?: number;
}): PrecheckResult {
  const settings = getEvaluation().localEvidence;
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
  const weakActivityCount = countMatches(lower, weakActivityPattern("g"));
  const strongBulletCount = bullets.filter(
    (line) =>
      /\b(?:reduced|increased|improved|delivered|launched|implemented|migrated|optimized|automated|saved|created|built|led|owned|designed|enabled|accelerated|standardized|modernized)\b/i.test(line) &&
      /\b\d+(?:[.,]\d+)?|%|[$€£]\b/.test(line)
  ).length;
  const weakBulletCount = bullets.filter((line) => weakActivityPattern().test(line)).length;
  const hasQuantifiedResults = quantifiedEvidenceCount >= settings.quantifiedMinimum;
  const hasAccomplishments = resultVerbCount >= settings.resultVerbMinimum || strongBulletCount >= settings.strongBulletMinimum;
  const mostlyJobDescriptions = weakActivityCount > resultVerbCount && strongBulletCount < settings.strongBulletMinimum;
  const scoreBreakdown = {
    quantifiedResults: clampScore(quantifiedEvidenceCount * settings.quantifiedWeight, 30),
    accomplishmentClarity: clampScore(resultVerbCount * settings.resultVerbWeight + strongBulletCount * settings.strongBulletWeight - weakActivityCount, 25),
    scopeAndScale: clampScore(countMatches(lower, /\b(?:enterprise|regional|global|multi[-\s]?country|stakeholders|users|clients|teams|systems|platform|portfolio|budget|cost|revenue)\b/g) * settings.scopeWeight, 20),
    responsibilityVersusOutcomeRatio: clampScore(15 - Math.max(0, weakActivityCount - strongBulletCount) * settings.weakPenalty + Math.min(strongBulletCount, 4), 15),
    interviewDefensibility: clampScore(quantifiedEvidenceCount + resultVerbCount / 4 + strongBulletCount * 2, 10)
  };
  const cvEvidenceScore = Math.min(settings.scoreCap, clampScore(Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0), 100));
  const sensitiveWarnings = detectSensitivePersonalDataWarnings(cvText).map((item) => item.warning);
  const specificWarnings = [
    ...sensitiveWarnings,
    ...(mostlyJobDescriptions ? [getEvaluation().legacyText.responsibilityWarning] : []),
    ...(input.hasDegree && input.degreeYear && input.yearsOfExperience >= settings.educationYears
      ? [getEvaluation().legacyText.studyYearWarning]
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
      ? getEvaluation().legacyText.responsibilityProblem
      : getEvaluation().legacyText.usableEvidenceProblem,
    specificWarnings,
    missingEvidenceTypes: [
      ...(hasQuantifiedResults ? [] : [getEvaluation().legacyText.missingQuantifiedEvidence]),
      ...(hasAccomplishments ? [] : [getEvaluation().legacyText.missingAccomplishments])
    ],
    examplesOfWeakBullets: bullets.filter((line) => weakActivityPattern().test(line)).slice(0, 3),
    questionsToRecoverMetrics: defaultMetricRecoveryQuestions.slice(0, 5),
    interviewRiskQuestions: [getEvaluation().legacyText.interviewDefensibilityQuestion],
    nextStep: hasAccomplishments
      ? getEvaluation().legacyText.clarifyBeforeTailoring
      : getEvaluation().legacyText.recoverBeforeTailoring
  };
}

// Adds richer advice from fast text signals when the selected model cannot
// finish the reviewer pass. Keep these warnings specific to CV quality, not job tailoring.
export function buildLocalPrecheckFallbackSections(
  input: {
    cvText: string;
    yearsOfExperience: number;
    hasDegree?: boolean;
    degreeYear?: number;
  },
  baseline: PrecheckResult
): OllamaPrecheckAdviceSection {
  const settings = getEvaluation().localEvidence;
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
    getEvaluation().legacyText.deterministicFallbackNotice,
    ...(baseline.cvEvidenceScore >= 85
      ? [getEvaluation().legacyText.strongScoreWarning]
      : []),
    ...(baseline.quantifiedEvidenceCount > 0 && baseline.strongBulletCount < Math.min(3, baseline.quantifiedEvidenceCount)
      ? [getEvaluation().legacyText.detachedMetricsWarning]
      : []),
    ...(hasCostClaims
      ? [getEvaluation().legacyText.costClaimsWarning]
      : []),
    ...(hasScaleClaims
      ? [getEvaluation().legacyText.scaleClaimsWarning]
      : []),
    ...(possibleTenseIssue
      ? [getEvaluation().legacyText.tenseWarning]
      : []),
    ...(unsupportedNarrative
      ? [getEvaluation().legacyText.unsupportedNarrativeWarning]
      : []),
    ...(input.yearsOfExperience >= settings.seniorYears && wordCount < settings.compressedWords
      ? [getEvaluation().legacyText.compressedCvWarning]
      : []),
    ...(input.yearsOfExperience < settings.earlyCareerYears && wordCount > settings.longWords
      ? [getEvaluation().legacyText.longCvWarning]
      : []),
    ...(input.yearsOfExperience >= settings.seniorYears && hasPattern(lower, /\b(?:present|current)\b/i) && !hasPattern(lower, /\b(?:promoted|promotion|senior|lead|manager|head|principal)\b/i)
      ? [getEvaluation().legacyText.progressionWarning]
      : []),
    ...(hasCloudSignals && hasStrategySignals
      ? [getEvaluation().legacyText.hybridScopeWarning]
      : []),
    ...(hasAiSignals
      ? [getEvaluation().legacyText.aiClaimsWarning]
      : [])
  ]);

  const missingEvidenceTypes = uniqueStrings([
    ...baseline.missingEvidenceTypes,
    ...(baseline.quantifiedEvidenceCount > 0 ? [getEvaluation().legacyText.baselineEvidence] : []),
    ...(hasCloudSignals ? [getEvaluation().legacyText.cloudEvidence] : []),
    ...(hasStrategySignals ? [getEvaluation().legacyText.strategyEvidence] : []),
    ...(hasAiSignals ? [getEvaluation().legacyText.aiEvidence] : []),
    getEvaluation().legacyText.ownershipEvidence
  ]);

  const questionsToRecoverMetrics = uniqueStrings([
    ...(hasCostClaims
      ? [
          getEvaluation().legacyText.costBaselineQuestion,
          getEvaluation().legacyText.costAttributionQuestion
        ]
      : []),
    ...(hasCloudSignals
      ? [
          getEvaluation().legacyText.cloudScopeQuestion,
          getEvaluation().legacyText.cloudOutcomeQuestion
        ]
      : []),
    ...(hasStrategySignals
      ? [
          getEvaluation().legacyText.strategyAdoptionQuestion,
          getEvaluation().legacyText.strategyAudienceQuestion
        ]
      : []),
    ...(hasAiSignals
      ? [
          getEvaluation().legacyText.aiMaturityQuestion,
          getEvaluation().legacyText.aiOutcomeQuestion
        ]
      : []),
    ...baseline.questionsToRecoverMetrics.slice(0, 4)
  ]);

  const interviewRiskQuestions = uniqueStrings([
    getEvaluation().legacyText.hardestClaimsQuestion,
    getEvaluation().legacyText.sharedMetricsQuestion,
    getEvaluation().legacyText.roleScopeQuestion,
    ...(possibleTenseIssue ? [getEvaluation().legacyText.completedWorkQuestion] : []),
    ...(input.hasDegree && input.degreeYear && input.yearsOfExperience >= settings.educationYears
      ? [getEvaluation().legacyText.studyRelevanceQuestion]
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
