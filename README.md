# Career Signal Engine

Career Signal Engine is a local CV review app. It checks whether a CV has enough real evidence before helping the user create a job-specific reconstruction plan.

The app is designed to be used by non-technical people too. You do not need to create an account, connect to LinkedIn, install a browser extension, or give the app access to job boards.

![https://raw.githubusercontent.com/FANMixco/career-signal/refs/heads/main/frontend/img/preview.png](https://raw.githubusercontent.com/FANMixco/career-signal/refs/heads/main/frontend/img/preview.png)

## What It Does

- Reads a LinkedIn PDF export or pasted CV text.
- Checks whether the CV has enough concrete evidence: results, scope, numbers, responsibilities, and defensible claims.
- Gives a CV Evidence Score from 0 to 100.
- Warns about weak evidence, unsupported claims, tense problems, hidden career progression, unnecessary studies, age, gender, citizenship, and other personal details that may create risk or distraction.
- Lets the user continue only after the evidence precheck, or after explicitly choosing to continue despite a weak precheck.
- Uses the target company, optional company description, and job description to create a job-specific reconstruction plan.
- Lets the user test multiple target roles after a successful precheck without checking the same unchanged CV again.
- Gives a profile match score from 0 to 100 for the selected company and role.
- Lets the user download the final plan as a TXT file.
- Supports Gemini or OpenAI. The user can choose the provider in the app.

## What It Does Not Do

- It does not invent achievements.
- It does not apply to jobs automatically.
- It does not guarantee interviews or hiring outcomes.
- It does not replace the final judgment of a recruiter, hiring manager, or company.
- It does not store CVs in a database.
- It does not store API keys.

## What You Need Before Starting

You need:

- A computer with internet access.
- A modern browser such as Chrome, Edge, Firefox, or Safari.
- Node.js installed on your computer.
- One AI API key:
  - Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey), or
  - OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys).
- A CV, either as:
  - a LinkedIn PDF export, or
  - text copied from an existing CV.
- A job description if you want the job-specific reconstruction plan.
- An optional company description if the company is small, new, private, or not well-known.

If you only want to test the app, you can paste the API key directly into the app. If you want to use it regularly, you can save the key in a local `.env` file.

## Step 1: Install Node.js

Node.js is the program that lets this app run on your computer.

1. Open [https://nodejs.org](https://nodejs.org).
2. Download the LTS version.
3. Run the installer.
4. Accept the default installation options.
5. Close and reopen your terminal after installing.

To check that Node.js installed correctly, run:

```bash
node -v
```

Then run:

```bash
npm -v
```

If both commands show version numbers, Node.js is ready.

## Step 2: Get The Project

If you are not technical, the easiest option is:

1. Open the GitHub repository page.
2. Click `Code`.
3. Click `Download ZIP`.
4. Extract the ZIP file.
5. Open the extracted folder.

If you already use Git, you can clone the repository instead:

```bash
git clone https://github.com/FANMixco/career-signal.git
cd career-signal
```

## Step 3: Open A Terminal In The Project

On Windows:

1. Open the project folder in File Explorer.
2. Right-click inside the folder.
3. Choose `Open in Terminal`.

On macOS:

1. Open the project folder in Finder.
2. Open Terminal.
3. Type `cd ` with a space after it.
4. Drag the project folder into the Terminal window.
5. Press Enter.

On Linux:

1. Open the project folder in your file manager.
2. Right-click inside the folder.
3. Choose `Open in Terminal`.

## Step 4: Install The App Dependencies

The app backend lives inside the `backend` folder.

Run:

```bash
cd backend
npm install
```

This downloads the packages needed by the app. It may take a few minutes the first time.

## Step 5: Choose How To Provide Your AI Key

You have two options.

Get a key from the provider you want to use:

- Gemini: [Google AI Studio API keys](https://aistudio.google.com/app/apikey)
- OpenAI: [OpenAI Platform API keys](https://platform.openai.com/api-keys)

You may need to sign in, create a project, add billing, or accept the provider's terms before a key works. Keep the key private. Anyone with the key may be able to use your account quota or billing.

### Option A: Paste The Key In The App

This is the simplest option for testing.

1. Start the app.
2. Open it in your browser.
3. Choose `Gemini` or `OpenAI`.
4. Choose one of the visible models for that provider.
5. Paste the matching API key in the API key field.

The key is sent only to the local backend for that request. The app does not store it.

### Option B: Save The Key In `.env`

This is more convenient if you use the app often.

On Windows, while you are inside the `backend` folder, run:

```bash
copy .env.example .env
```

On macOS or Linux, run:

```bash
cp .env.example .env
```

Open the new `.env` file and add either your Gemini key or your OpenAI key:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
GEMINI_API_KEY=
GEMINI_MODEL=models/gemini-3.5-flash
PORT=3001
```

Example:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=models/gemini-3.5-flash
PORT=3001
```

The app also shows model choices directly in the UI. The `.env` model values are only defaults for requests that do not send a selected model.

Important: never share or commit the `.env` file. It contains private keys. The project is configured to ignore `.env`, but you should still treat it as secret.

## Step 6: Run The App

Make sure your terminal is inside the `backend` folder.

Run:

```bash
npm run dev
```

You should see a message like:

```text
Career Signal Engine running at http://localhost:3001
```

Now open this address in your browser:

```text
http://localhost:3001
```

Keep the terminal open while using the app. If you close the terminal, the app stops running.

To stop the app, click the terminal and press:

```text
Ctrl + C
```

## Optional: Run With Docker

Docker runs the backend and frontend in one container. This is often the easiest way to start if you do not want to install Node.js or clone the project internals.

You can use either Docker Desktop or Podman Desktop.

### Option A: Use The Published Image

Pull the image:

```bash
docker pull fanmixco/career-signal:latest
```

Run it with a Gemini key:

```bash
docker run --rm -p 3001:3001 -e GEMINI_API_KEY=your_gemini_key_here fanmixco/career-signal:latest
```

Or run it with an OpenAI key:

```bash
docker run --rm -p 3001:3001 -e OPENAI_API_KEY=your_openai_key_here fanmixco/career-signal:latest
```

If you use Podman Desktop, the command is almost the same:

```bash
podman run --rm -p 3001:3001 -e GEMINI_API_KEY=your_gemini_key_here fanmixco/career-signal:latest
```

Then open:

```text
http://localhost:3001
```

The image does not include your `.env` file. API keys are passed at runtime with `-e` or typed into the app.

### Option B: Build The Image Yourself

Build the image from the project root:

```bash
docker build -t career-signal-engine .
```

Run your local build:

```bash
docker run --rm -p 3001:3001 career-signal-engine
```

If you prefer using an env file, pass it at runtime:

```bash
docker run --rm -p 3001:3001 --env-file backend/.env career-signal-engine
```

## Step 7: Use The App

1. Fill in the profile details.
2. Upload a LinkedIn PDF export or paste CV text.
3. Choose Gemini or OpenAI.
4. Choose the model you want to use.
5. Paste an API key if you did not configure one in `.env`.
6. Click `Run CV Evidence Precheck`.
7. Wait for the result. The button shows that validation is running.
8. Review the CV Evidence Score, warnings, and suggested improvements.
9. If the CV has weak evidence, improve it first or explicitly choose to continue anyway.
10. Add the target company name.
11. Optionally add a short company description.
12. Paste the full job description.
13. Generate the reconstruction plan.
14. Review the profile match assessment and the recommended CV structure.
15. Download the TXT file if you want to keep the plan.

After the precheck has passed, you can change the target company, company description, role style, or job description and generate another plan. You do not need to run the CV Evidence Precheck again unless you change the CV text, uploaded PDF, years of experience, studies information, or experience selection mode.

## Understanding The Scores

The CV Evidence Score is from 0 to 100.

- `80-100`: strong evidence. The CV is likely ready for job-specific tailoring.
- `60-79`: usable, but some claims may need more evidence.
- `0-59`: risky. The CV may be too vague, unsupported, or activity-based.

The profile match score is also from 0 to 100.

This score estimates how well the provided CV evidence matches the company and job description. It is not a hiring decision. Final decisions always belong to the company and may depend on interviews, timing, internal candidates, compensation, location, sponsorship, language requirements, and other factors outside this CV-based review.

## Important CV Warnings

The app may highlight issues that do not mean the candidate is weak, but that can make the CV weaker than the real career.

Long tenure at one company is a good example. Staying at one company for many years can show trust, loyalty, and depth. However, if the CV only shows the latest title, the reader may miss years of internal promotions, role changes, expanded scope, team moves, or bigger responsibilities. When true, split the tenure into internal roles or add clear progression bullets. Do not invent titles, dates, or promotions.

Tense is another common issue. Previous roles and completed achievements should normally use past tense. Current roles can use present tense for responsibilities that are still active, but completed achievements inside a current role should still read as completed outcomes. Infinitive or present-tense wording can make strong accomplishments look unfinished, generic, or unclear.

The app may also warn when a role title and its responsibilities point in different directions. This does not mean hybrid roles are bad. It means the reader may be confused if, for example, a Project Manager role mainly describes product ownership, architecture, strategy, training, or operations. When true, clarify the scope with a subtitle, scope line, or bullet context. Do not invent a different official title.

Personal narrative claims are also checked lightly. Words like motivated, efficient, strategic, reliable, or strong communicator are not bad by themselves, but they become weak when the CV does not prove them with outcomes, examples, scale, decisions, delivery, adoption, or measurable results.

The app may also flag missing contact basics. Name, email, phone, and useful location should be easy to find near the top. LinkedIn or portfolio is optional but useful when it supports the profile.

## Using The Android Emulator

If you test the app in an Android emulator, `localhost` inside the emulator means the emulator itself, not your computer.

Use this address instead:

```text
http://10.0.2.2:3001
```

The backend must still be running on your computer.

If you serve the frontend separately, for example, from:

```text
http://10.0.2.2:5500
```

the frontend will call the backend at:

```text
http://10.0.2.2:3001
```

For a real phone, connect the phone and computer to the same Wi-Fi network and use the computer's local network IP address instead of `localhost`.

## Troubleshooting

### `npm is not recognized`

Node.js is not installed, or the terminal was opened before installing it.

Fix:

1. Install Node.js from [https://nodejs.org](https://nodejs.org).
2. Close the terminal.
3. Open a new terminal.
4. Try `node -v` and `npm -v` again.

### `Cannot find module` or dependency errors

The dependencies are probably not installed.

Fix:

```bash
cd backend
npm install
```

### The browser says the site cannot be reached

The backend may not be running.

Fix:

1. Open a terminal.
2. Go to the `backend` folder.
3. Run `npm run dev`.
4. Open `http://localhost:3001`.

### Port `3001` is already in use

Another app is already using port `3001`.

Fix:

- Close the other terminal or app that is using the port, or
- Change `PORT=3001` in `.env` to another port such as `PORT=3002`.

If you change the port, open the matching address in the browser.

### The app says an API key is required

The selected provider does not have a key.

Fix:

- If `Gemini` is selected, paste a Gemini key or set `GEMINI_API_KEY` in `.env`.
- If `OpenAI` is selected, paste an OpenAI key or set `OPENAI_API_KEY` in `.env`.

### The precheck button does nothing

Check that the backend is running at:

```text
http://localhost:3001
```

If the frontend is opened from another address, such as `127.0.0.1:5500`, the app still needs the backend running on port `3001`.

### Android emulator cannot reach the backend

Use:

```text
http://10.0.2.2:3001
```

Do not use `localhost` from inside the Android emulator.

### The job-specific plan is locked

Run the CV Evidence Precheck first. The app intentionally blocks job tailoring until the CV evidence has been checked.

If the precheck result is weak, improve the CV first or explicitly choose to continue despite the weak precheck.

## Privacy And Safety

- Uploaded CVs are processed in memory and are not stored by this app.
- API keys are not logged or stored by this app.
- AI calls happen only from the backend.
- CV text and job descriptions are sent to the selected AI provider when you run an analysis.
- `.env` files are ignored and must not be committed.
- Internal planning docs and local templates are ignored and should not be committed unless they are intentionally productized.
- The app provides CV guidance, not legal advice, career guarantees, or hiring guarantees.

## Developer Notes

### Tech Stack

- Backend: Node.js, Express, TypeScript
- Frontend: static HTML, CSS, JavaScript
- AI providers: Gemini or OpenAI
- PDF extraction: `pdf-parse`
- Validation: Zod

### Project Structure

- `backend/src/rules/cvRules.ts` contains scoring bands, allowed options, score breakdown limits, fallback questions, and education/study privacy guidance.
- `backend/src/prompts/cvPrompts.ts` contains the AI instructions for the precheck and reconstruction plan.
- `backend/src/schemas/aiSchemas.ts` contains the structured AI response schemas.
- `frontend/config.js` contains visible frontend copy, labels, warnings, target styles, API URL behavior, and result-section ordering.
- `frontend/index.html` keeps the static document structure, SEO metadata, favicons, manifest links, and document title.
- `frontend/app.js` should stay focused on browser state, validation flow, API calls, and rendering.

When changing product rules or user-facing copy, prefer editing the rule, config, prompt, or schema files above instead of burying new constants in service or UI control code.

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
