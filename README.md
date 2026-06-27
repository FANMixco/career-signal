# Career Signal Engine

Career Signal Engine is a local proof of concept that checks whether a CV has enough evidence before generating a job-specific reconstruction plan.

The app is intentionally simple: it helps a user decide whether the CV has enough concrete outcomes, metrics, scope, and defensible claims to tailor for a target role. It does not invent achievements and it does not apply to jobs automatically.

## Features

- Upload a LinkedIn PDF export or paste CV text manually.
- Enter basic profile metadata and experience scope.
- Receive a CV Evidence Score from 0 to 100.
- See warnings for weak evidence, unsupported claims, and study-year privacy risk.
- Gate job tailoring when the CV needs improvement.
- Paste a target company and job description for a reconstruction plan.
- Download the final plan as a TXT file.
- Use OpenAI with a request key or `.env`, with Gemini fallback from `.env`.

## How The Flow Works

```text
CV PDF or pasted CV
-> profile metadata
-> evidence precheck
-> warnings and score
-> decision gate
-> target company and job description
-> reconstruction plan
-> TXT download
```

Job-specific tailoring is visible from the start, but generation unlocks only after the evidence precheck gate. If the CV is weak, the user can improve the CV first or explicitly continue anyway.

## Tech Stack

- Backend: Node.js, Express, TypeScript
- Frontend: static HTML, CSS, JavaScript
- AI providers: OpenAI first, Gemini fallback
- PDF extraction: `pdf-parse`
- Validation: Zod

No database, authentication, accounts, payments, LinkedIn API integration, browser automation, or applicant-bot behavior is included.

## Setup

```bash
cd backend
npm install
copy .env.example .env
```

Configure either OpenAI or Gemini in `backend/.env`:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2
GEMINI_API_KEY=
GEMINI_MODEL=models/gemini-3-flash-preview
PORT=3001
```

The OpenAI API key can also be pasted into the app while the page is open. Keys are sent only to the backend for the current request and are not stored.

## Run Locally

```bash
cd backend
npm run dev
```

Open:

```text
http://localhost:3001
```

If the frontend is served separately, for example from `127.0.0.1:5500`, it will still call the backend at `http://localhost:3001`.

## API Endpoints

- `GET /api/health`
- `POST /api/precheck-cv`
- `POST /api/analyze-cv`

## Security Notes

- `.env` files are ignored and must not be committed.
- Uploaded CVs are processed in memory and are not stored.
- API keys are not logged or stored.
- AI calls happen only from the backend.
