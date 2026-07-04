// Deterministic CV evidence checks used as the safety net for local Ollama.
// These rules do not replace the LLM review; they make sure the app can still
// return a defensible score and practical warnings when a local model is weak,
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

// Adds richer advice from fast text signals when Ollama cannot finish the
// reviewer pass. Keep these warnings specific to CV quality, not job tailoring.
export function buildLocalPrecheckFallbackSections(
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
