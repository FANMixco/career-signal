# Getting Started

## What You Need Before Starting

You need:

- A computer with internet access.
- A modern browser such as Chrome, Edge, Firefox, or Safari.
- Node.js installed on your computer.
- One AI option:
  - OpenRouter API key from [OpenRouter API keys](https://openrouter.ai/settings/keys),
  - OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys),
  - Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey),
  - Mistral API key from [Mistral AI Console](https://console.mistral.ai/api-keys/),
  - DeepSeek API key from [DeepSeek Platform API keys](https://platform.deepseek.com/api_keys),
  - Or [Ollama](https://ollama.com/download) installed locally with a supported model such as `gemma4` or `qwen3.6`.
- A CV, either as:
  - a CV PDF or LinkedIn PDF export, or
  - text copied from an existing CV.
- A job description if you want the job-specific reconstruction plan.
- An optional company description if the company is small, new, private, or not well-known.

If you only want to test the app with a cloud provider, you can paste the API key directly into the app. If you want to use it regularly, you can save the key in a local `.env` file. If you use Ollama, no API key is needed, but Ollama must be installed and running on your computer.

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

## Step 7: Use The App

1. Fill in the profile details.
2. Upload a CV PDF, LinkedIn PDF export, or paste CV text.
3. Choose Gemini, OpenAI, Mistral, or Ollama (offline, experimental).
4. Choose the model you want to use.
5. Paste an API key for cloud providers if you did not configure one in `.env`; for Ollama, confirm the local URL.
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
