# Backend Content Files

This folder contains backend JSON content that should be easy to review, discuss, and improve without editing application logic.

The split is intentional:

- `cvGuidance.json` is the main open knowledge base for CV review. Edit this when improving evidence questions, education privacy guidance, career progression guidance, tense guidance, CV length guidance, title/responsibility alignment, evidence-backed language, or contact completeness guidance.
- `sensitivePersonalData.json` contains warning labels and user-facing warning copy for personal details that may create privacy or bias risk. The detection patterns stay in `../rules/cvRules.ts` because they are application logic.
- `appOptions.json` contains backend option values that are part of the app contract, such as target styles, experience selection modes, provider names, model names, recommendation values, and output language names. Change this only when the app should accept or emit different option values.
- `messages.json` contains backend error messages returned by API routes and services.

## Editing Rules

- Prefer small pull requests that change one kind of content at a time.
- Keep CV guidance practical, evidence-based, and safe for people trying to get a job.
- Do not add advice that asks users to invent achievements, dates, metrics, credentials, employers, responsibilities, or tools.
- Keep wording clear for non-technical contributors and users.
- Keep JSON valid: double quotes, no comments, no trailing commas.
- Put detection logic, score thresholds, validation rules, and schemas in TypeScript, not JSON.

## Build Note

The backend build copies these JSON files into `backend/dist/content` through `backend/scripts/copy-content.cjs`. If you add a new JSON file here, also update that script and the TypeScript loader that reads it.
