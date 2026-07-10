# Windows Desktop App

## Optional: Build A Windows Desktop App

The project also includes an Electron wrapper for Windows. It starts the same local backend internally and opens the app in a desktop window.

Install the desktop packaging dependencies from the project root:

```bash
npm install
```

Run the desktop app in development mode:

```bash
npm run desktop:dev
```

Create an unpacked Windows build for quick testing:

```bash
npm run desktop:pack
```

Create a Windows installer and portable executable:

```bash
npm run desktop:dist
```

Create a Windows ARM64 installer and portable executable:

```bash
npm run desktop:dist:arm64
```

The generated files are written to the `release` folder. API keys are not bundled into the desktop app. Users can paste cloud-provider keys in the app, provide runtime environment variables while testing, or use Ollama locally without a key.
