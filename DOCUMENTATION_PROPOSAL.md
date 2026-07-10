# Documentation Restructure Proposal

## Recommendation

Do not create a wiki yet. Split the current long README and related Markdown files into a versioned documentation set in the repository.

The repository should have one short public README for first-time users, plus focused documents for setup, Docker, desktop packaging, API behavior, product rules, and internal implementation notes. A wiki can be added later if the project needs a polished public knowledge base maintained outside normal code review.

## Why Not A Wiki Yet

A wiki is useful for broad, frequently edited end-user documentation, but it can drift away from the code because changes are not naturally reviewed with implementation changes.

For this project, the existing Markdown files describe behavior that is tightly coupled to the application:

- CV scoring and review rules
- AI prompt behavior
- API request and response shapes
- setup and runtime options
- Docker and desktop packaging
- contribution and content editing rules

These should stay in git so documentation changes can be reviewed beside code changes.

## Current Problems

The current README is doing too many jobs:

- product overview
- non-technical setup guide
- provider/API-key setup
- local run guide
- Docker guide
- GitHub Pages/backend guide
- Windows desktop app build guide
- Android emulator notes
- troubleshooting
- privacy and safety notes
- developer notes
- API endpoint notes

There was also a structural ambiguity:

- `README.md`, `CONTRIBUTING.md`, and `docs/cv-rules.md` are tracked in git.
- `docs/` and the numbered planning files were ignored by `.gitignore`.
- The working tree contained a `docs/` directory with copied planning docs, but those files were ignored and would not have been included in normal commits.

Those private and duplicated files have been consolidated under `private_specs/`, which is ignored by git.

## Proposed Structure

Use this structure if the documentation is intended to be public and versioned:

```text
README.md
CONTRIBUTING.md
docs/
  README.md
  getting-started.md
  ai-providers.md
  docker.md
  desktop-app.md
  github-pages-backend.md
  android-emulator.md
  troubleshooting.md
  privacy-and-safety.md
  developer-notes.md
  api-contract.md
  cv-rules.md
  product-vision.md
  build-brief.md
  functional-requirements.md
  ai-prompts.md
backend/src/content/README.md
private_specs/
  README.md
  01_PRODUCT_VISION.md
  02_CODEX_BUILD_BRIEF.md
  03_FUNCTIONAL_REQUIREMENTS.md
  04_AI_PROMPTS.md
  05_API_CONTRACT.md
  microsoft-store-packaging-private.md
```

Keep `backend/src/content/README.md` where it is because it documents files in that directory.

Keep `private_specs/` ignored if the files are internal planning material rather than public project documentation.

## README Scope

The root README should become a short front door:

- project name and status
- badges
- one-paragraph description
- preview image
- what the app does
- what the app does not do
- quick start
- AI provider summary
- links to full docs
- privacy summary
- contribution link

The README should not contain the full Docker, desktop packaging, troubleshooting, API contract, or long developer reference sections.

## Docs Index

`docs/README.md` should become the documentation index:

```text
Start Here
- Getting Started
- AI Providers
- Troubleshooting

Deployment And Packaging
- Docker
- Desktop App
- GitHub Pages With Custom Backend

Reference
- API Contract
- CV Rules
- Privacy And Safety
- Developer Notes

Project Planning
- Product Vision
- Build Brief
- Functional Requirements
- AI Prompts
```

## Migration Plan

1. Keep `private_specs/` ignored for internal planning material.
2. Create a public `docs/` directory only for documentation that should ship with the repository.
3. Keep `docs/cv-rules.md` public because those rules explain user-facing scoring behavior.
4. Split the long README sections into focused public docs.
5. Replace the root README with a shorter landing page and links.
6. Update links in `CONTRIBUTING.md`, `docs/README.md`, and any package or release notes.
7. Check for stale links with a Markdown link checker or a simple repository search.

## Implemented First Pass

The first documentation cleanup pass does this:

- adds `DOCUMENTATION_PROPOSAL.md`
- consolidates internal planning docs into ignored `private_specs/`
- creates public docs in `docs/`
- moves CV evaluation rules to `docs/cv-rules.md`
- replaces the long root README with a short landing page

Further refinements can happen in smaller follow-up PRs.

## When A Wiki Makes Sense Later

Create a wiki later if the project needs:

- screenshot-heavy user guides
- release-by-release usage notes
- non-code maintainers editing documentation often
- public FAQ pages that change independently of code
- documentation that should not be part of npm, app, or source distributions

Even then, keep API contracts, prompt behavior, CV rules, and developer docs in the repository as the source of truth.

## Decision

Recommended decision:

```text
Use repository docs now.
Do not create a wiki yet.
Make README short.
Use docs/ as the canonical public documentation home when public docs are split out.
Keep private_specs/ ignored for internal planning docs that should not ship with the repository.
```
