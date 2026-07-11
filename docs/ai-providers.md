# AI Providers

## Step 5: Choose Your AI Option

You can use a cloud AI provider with an API key, or Ollama locally without an API key.

### Option A: Use Gemini, OpenAI, Mistral, Claude, DeepSeek, Or OpenRouter

Get a key from the provider you want to use:

- Gemini: [Google AI Studio API keys](https://aistudio.google.com/app/apikey)
- OpenAI: [OpenAI Platform API keys](https://platform.openai.com/api-keys)
- Mistral: [Mistral AI Console API keys](https://console.mistral.ai/api-keys/)
- Claude (experimental): [Anthropic Console API keys](https://console.anthropic.com/settings/keys)
- DeepSeek: [DeepSeek Platform API keys](https://platform.deepseek.com/api_keys)
- OpenRouter: [OpenRouter API keys](https://openrouter.ai/settings/keys)
 
You may need to sign in, create a project, add billing, or accept the provider's terms before a key works. Keep the key private. Anyone with the key may be able to use your account quota or billing.

#### Paste The Key In The App

This is the simplest option for testing.

1. Start the app.
2. Open it in your browser.
3. Choose `Gemini`, `OpenAI`, `Mistral`, `Claude (experimental)`, `DeepSeek`, or `OpenRouter`.
4. Choose one of the visible models for that provider.
5. Use the key link beside the field if you do not have a key yet.
6. Paste the matching API key in the API key field.

The key is sent only to the local backend for that request. The app does not store it.

#### Save The Key In `.env`

This is more convenient if you use the app often.

On Windows, while you are inside the `backend` folder, run:

```bash
copy .env.example .env
```

On macOS or Linux, run:

```bash
cp .env.example .env
```

Open the new `.env` file and add the key for the provider you want to use:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
GEMINI_API_KEY=
GEMINI_MODEL=models/gemini-3.5-flash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-medium-latest
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4
PORT=3001
```

Example:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=models/gemini-3.5-flash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-medium-latest
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4
PORT=3001
```

The app also shows model choices directly in the UI. The `.env` model values are only defaults for requests that do not send a selected model.

Claude support is marked experimental. The backend asks Claude for JSON and then validates the response against the same schemas used by other providers. If Claude returns malformed JSON, an incomplete response, or an unexpected provider error, retry once, try another Claude model, or switch to another cloud provider for that CV.

Important: never share or commit the `.env` file. It contains private keys. The project is configured to ignore `.env`, but you should still treat it as secret.

### Option B: Use Ollama Offline (experimental)

Ollama lets the AI model run on your computer. This is useful if you do not want CV text sent to a cloud AI provider.

1. Download and install [Ollama](https://ollama.com/download).
2. Open a terminal.
3. Download and start one model:

```bash
ollama run gemma4
```

Or:

```bash
ollama run qwen3.6
```

4. Keep Ollama running.
5. In Career Signal, choose `Ollama (offline, experimental)`.
6. Choose `Gemma 4`, `Qwen 3.6`, or `Custom Ollama model`.
7. Keep the Ollama URL as `http://localhost:11434` unless you changed it.

If you choose `Custom Ollama model`, type the exact model name you installed in Ollama, for example:

```text
llama3.2:3b
qwen3:14b
mistral-small
```

Local models may be slower or less consistent than cloud models. Always review titles, dates, employers, metrics, tools, and claims before using the output.
