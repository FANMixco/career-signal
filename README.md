# Career Signal Engine

## Apps Status

| Windows | macOS |
|:-------:|:-----:|
| [![Build Windows Desktop Release](https://github.com/FANMixco/career-signal/actions/workflows/desktop-release.yml/badge.svg)](https://github.com/FANMixco/career-signal/actions/workflows/desktop-release.yml) | [![Build Experimental macOS Desktop App](https://github.com/FANMixco/career-signal/actions/workflows/macos-experimental.yml/badge.svg)](https://github.com/FANMixco/career-signal/actions/workflows/macos-experimental.yml) |

## Docker Images Status

| Docker | Docker Backend |
|:------:|:---------------:|
| [![Publish Docker Image](https://github.com/FANMixco/career-signal/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/FANMixco/career-signal/actions/workflows/docker-publish.yml) | [![Publish Docker Image Backend](https://github.com/FANMixco/career-signal/actions/workflows/docker-publish-be.yml/badge.svg)](https://github.com/FANMixco/career-signal/actions/workflows/docker-publish-be.yml) |


Career Signal Engine is a local CV review app. It checks whether a CV has enough real evidence before helping the user create a job-specific reconstruction plan.

The app is designed for non-technical people too. You do not need to create an account, connect to LinkedIn, install a browser extension, or give the app access to job boards.

![Career Signal Engine preview](https://raw.githubusercontent.com/FANMixco/career-signal/refs/heads/main/frontend/img/preview.png)

## What It Does

- Reads a CV PDF, LinkedIn PDF export, or pasted CV text.
- Checks whether the CV has enough concrete evidence: results, scope, numbers, responsibilities, and defensible claims.
- Gives a CV Evidence Score from **0 to 100**.
- Warns about weak evidence, unsupported claims, tense problems, hidden career progression, unnecessary studies, age, gender, citizenship, and other personal details that may create risk or distraction.
- Lets the user continue only after the evidence precheck, or after explicitly choosing to continue despite a weak precheck.
- Uses the target company, optional company description, and job description to create a job-specific reconstruction plan.
- Gives a profile match score from **0 to 100** for the selected company and role.
- Lets the user download the final plan as a TXT file.
- Supports Gemini, OpenAI, Mistral, DeepSeek, OpenRouter, or Ollama.

## What It Does Not Do

- It does not invent achievements.
- It does not apply to jobs automatically.
- It does not guarantee interviews or hiring outcomes.
- It does not replace the final judgment of a recruiter, hiring manager, or company.
- It does not store CVs in a database.
- It does not store API keys.

## Quick Start

```bash
cd backend
npm install
npm run dev
```

Open:

```text
http://localhost:3001
```

You can paste a supported AI provider API key into the app while the page is open, or configure a local `.env` file. See [AI Providers](docs/ai-providers.md) for provider-specific setup.

## Documentation

- [Getting Started](docs/getting-started.md)
- [AI Providers](docs/ai-providers.md)
- [Docker](docs/docker.md)
- [Windows Desktop App](docs/desktop-app.md)
- [Android Emulator](docs/android-emulator.md)
- [Scores And Warnings](docs/scores-and-warnings.md)
- [CV Evaluation Rules](docs/cv-rules.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Privacy And Safety](docs/privacy-and-safety.md)
- [Developer Notes](docs/developer-notes.md)
- [Documentation Index](docs/README.md)

## Support

If you believe the project is valuable for you, feel free to support it:

[![image](https://raw.githubusercontent.com/FANMixco/Xamarin-SearchBar/master/bmc-rezr5vpd.gif)](https://buymeacoffee.com/fanmixco)

[![Get it from Microsoft](https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Get_it_from_Microsoft_Badge.svg/330px-Get_it_from_Microsoft_Badge.svg.png)](https://apps.microsoft.com/detail/9p4nqtp3mj0r?hl=en-US&gl=LU)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
