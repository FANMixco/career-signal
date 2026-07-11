# Developer Notes

## Developer Notes

### Tech Stack

- Backend: Node.js, Express, TypeScript
- Frontend: static HTML, CSS, JavaScript
- AI providers: OpenRouter, OpenAI, Gemini, Mistral, Claude / Anthropic (experimental), DeepSeek, or Ollama
- PDF extraction: `pdf-parse`
- Validation: Zod

### Project Structure

- `backend/src/content/README.md` explains the backend JSON content split for contributors.
- `backend/src/rules/cvRules.ts` contains scoring bands, allowed options, score breakdown limits, detector patterns, and typed exports loaded from the content JSON files.
- `backend/src/prompts/cvPrompts.ts` contains the AI instructions for the precheck and reconstruction plan.
- `backend/src/schemas/aiSchemas.ts` contains the structured AI response schemas.
- `backend/src/services/ai/cloudModelService.ts` dispatches cloud AI requests to provider-specific adapters in `backend/src/services/ai/cloudProviders/`.
- `backend/src/services/ai/cloudProviders/cloudProviderUtils.ts` contains shared cloud-provider JSON instructions, schema instructions, token limits, and empty-output errors.
- `frontend/content/app.*.json` contains visible frontend copy, labels, warnings, language-specific translations, target styles, and result-section ordering.
- `frontend/config.js` loads frontend content and contains API URL behavior.
- `frontend/index.html` keeps the static document structure, SEO metadata, favicons, manifest links, and document title.
- `frontend/app.js` should stay focused on browser state, validation flow, API calls, and rendering.

When changing product rules or user-facing copy, prefer editing the rule, config, prompt, or schema files above instead of burying new constants in service or UI control code.

### Content Contribution Guide

The project keeps collaboration-oriented text in JSON files so contributors can improve the knowledge base without editing application logic. The backend content split is documented beside the files in `backend/src/content/README.md`.

- Translate or improve frontend labels and help text in `frontend/content/app.en.json`, `frontend/content/app.es.json`, `frontend/content/app.fr.json`, or `frontend/content/app.de.json`.
- Keep detection logic, score thresholds, schemas, and validation in TypeScript unless the change is only wording.

### Scripts

Run these from the `backend` folder:

```bash
npm run dev
```

Starts the local development server.

```bash
npm run typecheck
```

Checks the TypeScript code.

```bash
npm run build
```

Builds the backend into `backend/dist`.

```bash
npm start
```

Runs the built backend from `backend/dist`.

### API Endpoints

- `GET /api/health`
- `POST /api/precheck-cv`
- `POST /api/analyze-cv`
