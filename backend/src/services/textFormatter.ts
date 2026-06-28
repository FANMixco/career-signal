import { educationPrivacy } from "../rules/cvRules.js";

export function planToText(analysis: Record<string, unknown>) {
  const educationReminder = educationPrivacy.textReminder;

  if (typeof analysis.downloadableText === "string" && analysis.downloadableText.trim()) {
    const text = analysis.downloadableText.trim();
    return text.toLowerCase().includes("education and studies privacy reminder") ? text : `${educationReminder}\n\n${text}`;
  }

  return `${educationReminder}\n\n${Object.entries(analysis)
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
