import {
  accomplishmentTenseGuidance,
  careerProgressionVisibility,
  contactCompleteness,
  cvLengthGuidance,
  educationPrivacy,
  evidenceBackedLanguage,
  titleResponsibilityAlignment
} from "../rules/cvRules.js";

export function planToText(analysis: Record<string, unknown>) {
  const reminders = [
    educationPrivacy.textReminder,
    careerProgressionVisibility.textReminder,
    accomplishmentTenseGuidance.textReminder,
    cvLengthGuidance.textReminder,
    titleResponsibilityAlignment.textReminder,
    evidenceBackedLanguage.textReminder,
    contactCompleteness.textReminder
  ].join("\n\n");

  if (typeof analysis.downloadableText === "string" && analysis.downloadableText.trim()) {
    const text = analysis.downloadableText.trim();
    const lowerText = text.toLowerCase();
    const withEducationReminder = lowerText.includes("education and studies privacy reminder") ? text : `${educationPrivacy.textReminder}\n\n${text}`;
    const withProgressionReminder = lowerText.includes("career progression visibility reminder")
      ? withEducationReminder
      : `${careerProgressionVisibility.textReminder}\n\n${withEducationReminder}`;
    const withTenseReminder = lowerText.includes("achievement tense reminder")
      ? withProgressionReminder
      : `${accomplishmentTenseGuidance.textReminder}\n\n${withProgressionReminder}`;
    const withLengthReminder = lowerText.includes("cv length and seniority reminder")
      ? withTenseReminder
      : `${cvLengthGuidance.textReminder}\n\n${withTenseReminder}`;
    const withTitleAlignmentReminder = lowerText.includes("title and responsibility alignment reminder")
      ? withLengthReminder
      : `${titleResponsibilityAlignment.textReminder}\n\n${withLengthReminder}`;
    const withEvidenceLanguageReminder = lowerText.includes("evidence-backed language reminder")
      ? withTitleAlignmentReminder
      : `${evidenceBackedLanguage.textReminder}\n\n${withTitleAlignmentReminder}`;
    return lowerText.includes("contact completeness reminder")
      ? withEvidenceLanguageReminder
      : `${contactCompleteness.textReminder}\n\n${withEvidenceLanguageReminder}`;
  }

  return `${reminders}\n\n${Object.entries(analysis)
    .filter(([key]) => key !== "downloadableText")
    .map(([key, value]) => {
      const heading = key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
      const body = formatTextValue(value);
      return `${heading}\n${body}`;
    })
    .join("\n\n")}`;
}

function formatTextValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? `- ${item}` : `- ${JSON.stringify(item)}`)).join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => {
        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
        return `${label}: ${Array.isArray(nestedValue) ? nestedValue.join("; ") : String(nestedValue ?? "")}`;
      })
      .join("\n");
  }

  return String(value ?? "");
}
