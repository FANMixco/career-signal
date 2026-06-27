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
      const body = Array.isArray(value)
        ? value.map((item) => (typeof item === "string" ? `- ${item}` : `- ${JSON.stringify(item)}`)).join("\n")
        : String(value ?? "");
      return `${heading}\n${body}`;
    })
    .join("\n\n")}`;
}
