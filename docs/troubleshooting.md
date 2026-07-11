# Troubleshooting

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
- Change `PORT=3001` in `.env` to another port, such as `PORT=3002`.

If you change the port, open the matching address in the browser.

### The app says an API key is required

The selected provider does not have a key.

Fix:

- If `OpenAI` is selected, paste an OpenAI key or set `OPENAI_API_KEY` in `.env`.
- If `Gemini` is selected, paste a Gemini key or set `GEMINI_API_KEY` in `.env`.
- If `Mistral` is selected, paste a Mistral key or set `MISTRAL_API_KEY` in `.env`.
- If `Claude (experimental)` is selected, paste an Anthropic key or set `ANTHROPIC_API_KEY` in `.env`.
- If `DeepSeek` is selected, paste a DeepSeek key or set `DEEPSEEK_API_KEY` in `.env`.

### Claude says the response is invalid or incomplete

Claude support is experimental. The backend validates Claude's answer as JSON before showing it in the app.

Fix:

1. Retry the same request once.
2. Try another Claude model.
3. If the same CV keeps failing, use Gemini, OpenAI, Mistral, DeepSeek, or OpenRouter for that run.

### Ollama says the model is missing or cannot be reached

Ollama must be installed, running, and have the selected model downloaded.

Fix:

1. Install Ollama from [https://ollama.com/download](https://ollama.com/download).
2. Open a terminal.
3. Run `ollama run gemma4` or `ollama run qwen3.6`.
4. In the app, select `Ollama (offline, experimental)`.
5. Keep the Ollama URL as `http://localhost:11434` unless your setup uses a different address.

If you run Career Signal inside Docker and Ollama on your host computer, try `http://host.docker.internal:11434` as the Ollama URL.

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
