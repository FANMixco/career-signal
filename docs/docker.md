# Docker

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

Or run it with a Mistral key:

```bash
docker run --rm -p 3001:3001 -e MISTRAL_API_KEY=your_mistral_key_here fanmixco/career-signal:latest
```

Or run it with an Anthropic key for Claude (experimental):

```bash
docker run --rm -p 3001:3001 -e ANTHROPIC_API_KEY=your_anthropic_key_here fanmixco/career-signal:latest
```

Or run it with a DeepSeek key:

```bash
docker run --rm -p 3001:3001 -e DEEPSEEK_API_KEY=your_deepseek_key_here fanmixco/career-signal:latest
```

Or run it with Ollama on your host computer:

```bash
docker run --rm -p 3001:3001 -e OLLAMA_BASE_URL=http://host.docker.internal:11434 fanmixco/career-signal:latest
```

If you use Podman Desktop, the command is almost the same:

```bash
podman run --rm -p 3001:3001 -e GEMINI_API_KEY=your_gemini_key_here fanmixco/career-signal:latest
```

Then open:

```text
http://localhost:3001
```

The image does not include your `.env` file. API keys and the optional Ollama URL are passed at runtime with `-e` or typed into the app.

### Use The GitHub Pages Frontend With Your Own Backend

The GitHub Pages URL is a frontend preview:

[https://fanmixco.github.io/career-signal/frontend](https://fanmixco.github.io/career-signal/frontend)

It does not include a running backend. To run CV checks from that page, start or deploy your own Career Signal backend and configure its URL from the settings button in the app.

Only use a backend you control or trust. CV text, job descriptions, and pasted API keys are sent to the configured backend.

If the frontend is loaded over HTTPS, the backend should normally also use HTTPS. Local development URLs such as `http://localhost:3001` are still useful when testing on your own computer.

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

### Optional: Build A Backend-Only Image

If you only need the API backend and plan to host the frontend separately, use the backend-only Dockerfile:

```bash
docker build -f Dockerfile.backend -t career-signal-backend .
```

Run it:

```bash
docker run --rm -p 3001:3001 --env-file backend/.env career-signal-backend
```

Then point the frontend settings to:

```text
http://localhost:3001
```

This image does not include the frontend files. It only serves the API routes such as `/api/health`, `/api/precheck-cv`, and `/api/analyze-cv`.

### Publish The Docker Image From GitHub

The project includes a GitHub Actions workflow that can build and publish the Docker image for you. This avoids building and pushing the image from your own PC.

You need to configure two GitHub repository secrets once:

1. Create a Docker Hub access token:
   - Open Docker Hub.
   - Go to your account settings.
   - Open Security.
   - Create a personal access token with read/write access.
   - Copy the token.

2. Add the token to GitHub:
   - Open the GitHub repository.
   - Go to Settings.
   - Open Secrets and variables.
   - Open Actions.
   - Add `DOCKERHUB_USERNAME` with your Docker Hub username.
   - Add `DOCKERHUB_TOKEN` with the Docker Hub access token.

After that, every pushed version tag such as `v1.0.5` publishes:

```text
fanmixco/career-signal:v1.0.5
fanmixco/career-signal:latest
```

You can also publish manually from GitHub:

1. Open the Actions tab.
2. Select `Publish Docker Image`.
3. Click `Run workflow`.
4. Enter the image tag, for example `1.0.5`.
5. Keep `Also update the latest tag` enabled if this should become the default Docker image.

Do not add Docker Hub passwords or tokens to the code, README, or `.env` file.
