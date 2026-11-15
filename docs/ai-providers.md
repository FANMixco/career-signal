# AI Providers

## Step 5: Choose Your AI Option

You can use a cloud AI provider with an API key, or Ollama locally without an API key.

## Current model catalog

Model IDs were checked against official provider documentation and OpenRouter's
public catalog on 15 November 2026:

| Provider | Presets | Default |
| --- | --- | --- |
| OpenAI | GPT-6 Luna, GPT-6.1 Sol, GPT-6.1 Terra, GPT-6 Astra | GPT-6 Luna |
| OpenRouter | Gemma 4 31B, Gemma 4 26B A4B, NVIDIA Nemotron 3.5 Super VL, all using `:free` routes | Gemma 4 31B |
| Gemini | Gemini 3.8 Flash, Gemini 3.5 Flash-Lite, Gemini 2.5 Pro | Gemini 3.8 Flash |
| Claude | Sonnet 5.5, Haiku 5.5, Opus 5.5 | Sonnet 5.5 |
| DeepSeek | V4.1 Flash (`deepseek-flash`), V4 Pro | V4.1 Flash |
| Mistral | Small 4 (`mistral-small-2603`), Large 4 (`mistral-large-4`) | Small 4 |
| Ollama | Mixed local strategy, Gemma 4, Qwen 3.8, Qwen 3.6 | Mixed local strategy |

Sources: [OpenAI models](https://developers.openai.com/api/docs/models),
[Gemini models](https://aistudio.google.com/docs/models),
[Claude models](https://platform.claude.com/docs/en/models/overview),
[DeepSeek models](https://api-docs.deepseek.com/quick_start/pricing/),
[Mistral Small 4](https://docs.mistral.ai/models/mistral-small-4-0-26-03),
[Mistral Large 4](https://docs.mistral.ai/models/mistral-large-4-0),
[OpenRouter catalog](https://openrouter.ai/api/v1/models),
and [Qwen 3.8 on Ollama](https://ollama.com/library/qwen3.8).

The previous four OpenRouter free IDs were absent from the catalog at verification
time and were removed from presets. Older imported sessions keep their model ID
as a custom selection. Free routes can change availability and rate limits.
Availability for paid models also depends on the user's account and region.

GPT-6 Luna retains a budget-oriented OpenAI default; larger models remain explicit
choices. Claude 5.5 requests omit sampling parameters because they are unsupported;
the adapter selects text blocks after any thinking blocks. Live paid inference
was not run during this refresh; request contracts and response parsing are tested
with synthetic inputs and mocked providers.

Gemini 4 is available, but is not a preset in this update. Its migration guidance
calls for different output/thinking-budget handling and structured-output setup.
The existing bounded reviewer requests use the current stable Flash 3.8 instead.
See [Gemini 4 migration guidance](https://aistudio.google.com/docs/whats-new-gemini-4-hydrogen#migration-guide).
Those adapter/budget changes need separate validation before adding Gemini 4 as a
supported preset. Qwen 3.8 is opt-in and does not replace the already-installed
Gemma 4/Qwen 3.6 fallback; its default Ollama download is approximately 18 GB.

The shared catalog is `backend/src/content/config/models.json`. It is bundled,
persisted locally and synchronized through the validated rules manifest. After
this engine version is installed, compatible catalog-only updates do not require
rebuilding the application. See [persistent model catalog](dynamic-rules.md#persistent-model-catalog-engine-2)
for storage, validation, publishing and rollback.

### Saved profiles and removed presets

Importing a saved session or loading a demo restores its original provider and
actual model ID. If that ID is missing from the current presets, the selector
uses **Custom model** and fills in the saved ID. For example, the bundled demos
restore OpenAI with `gpt-5.4-mini` as custom. Language changes, catalog refreshes
and exporting the session again preserve that choice. A saved explicit custom
choice also stays custom if its ID later becomes a preset.

Restoring an ID does not make a retired provider model available again. If a
provider rejects it, select an available model before running a new analysis.
Previously saved analysis output can still be reviewed without making an AI call.

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
OPENAI_MODEL=gpt-6-luna
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-small-2603
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5-5
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=local-mix
PORT=3001
```

Example:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-6-luna
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-3.8-flash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-small-2603
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5-5
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=local-mix
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
6. Choose `Gemma 4`, `Qwen 3.8`, `Qwen 3.6`, or `Custom Ollama model`. Install Qwen 3.8 separately with `ollama run qwen3.8` if you select it. The existing mixed fallback continues to use Gemma 4 and Qwen 3.6.
7. Keep the Ollama URL as `http://localhost:11434` unless you changed it.

If you choose `Custom Ollama model`, type the exact model name you installed in Ollama, for example:

```text
llama3.2:3b
qwen3:14b
mistral-small
```

Local models may be slower or less consistent than cloud models. Always review titles, dates, employers, metrics, tools, and claims before using the output.
