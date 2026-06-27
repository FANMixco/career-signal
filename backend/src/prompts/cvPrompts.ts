import { educationPrivacy } from "../rules/cvRules.js";

export function precheckPrompt(input: {
  cvText: string;
  yearsOfExperience: number;
  hasDegree?: boolean;
  degreeYear?: number;
  experienceSelectionMode: "lastFive" | "all";
}) {
  return `System:
You are an honest senior CV reviewer. Inspect the candidate CV before any job specific tailoring. Do not rewrite the CV. Do not analyze a job description. Do not invent achievements or numbers. Only determine whether the CV contains enough accomplishments, quantified results, scale, scope, consequence, and impact evidence to be worth tailoring. Return only valid JSON.

Scoring rules:
- cvEvidenceScore must be an integer from 0 to 100, not a decimal score out of 10.
- If you think the CV is 8.6 out of 10, return 86.
- Recommendation must match the score band: 0-49 Improve CV first, 50-74 Proceed with caution, 75-100 Proceed.

Candidate metadata:

Years of professional experience:
${input.yearsOfExperience}

Lists studies or education on CV:
${input.hasDegree ?? "not provided"}

Study completion year:
${input.degreeYear ?? "not provided"}

Experience selection mode:
${input.experienceSelectionMode}

Candidate CV text:
${input.cvText}

Inspect this CV and return the required JSON structure. Include practical questions to recover metrics.`;
}

export function reconstructionPrompt(input: {
  cvText: string;
  precheckResult: Record<string, unknown>;
  companyName: string;
  targetStyle: string;
  experienceSelectionMode: "lastFive" | "all";
  jobDescription: string;
}) {
  return `System:
You are a senior career strategist, executive recruiter, ATS optimization specialist, and honest CV editor. Create a CV reconstruction plan for the target role. Never invent experience, employers, dates, studies, certifications, metrics, tools, or achievements. Reframe only existing experience, identify missing signals, and classify each important recommendation by integrity level. Return only valid JSON.

Education and studies guidance:
- Preserve any precheck privacy warning about study years, graduation years, older education details, or age inference in the final plan.
- If studies are relevant, recommend keeping the study credential or education item but removing unnecessary completion years when the candidate has several years of experience.
- If a study, course, old education item, or education date is not relevant to the target role, suggest de-emphasizing or removing it from the CV.
- Do not include a bare "Education" section as a default. If education/studies should appear, make it conditional and privacy-safe, for example: "${educationPrivacy.privacySafeStructure}."
- Do not remove legally or professionally required credentials. Classify any education change by integrity level and explain the reason.

Candidate CV text:
${input.cvText}

CV precheck result:
${JSON.stringify(input.precheckResult)}

Target company:
${input.companyName}

Target role style:
${input.targetStyle}

Experience selection mode:
${input.experienceSelectionMode}

Job description:
${input.jobDescription}

Create a complete CV reconstruction plan using the required JSON structure.`;
}
