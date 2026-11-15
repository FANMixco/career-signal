# Dependency maintenance

Checked on 15 November 2026 against the npm registry and npm security advisories.

Electron is updated to 45.3.2 (the npm `latest` release available during the check)
and electron-builder to 26.18.0. The Electron releases site listed 45.3.3, but npm
returned 404 for that version; no prerelease or unpublished version was selected.
Both root and backend lockfiles are refreshed.

Compatible backend releases were updated, including Google GenAI 2.32.0, OpenAI
7.57.0, Express 4.22.3, Multer 2.5.0, Zod 4.6.7, dotenv 16.6.1, pdf-parse 1.1.4,
TypeScript 5.9.3, tsx 4.23.15 and associated types. Node types use the latest 24.x
release (24.19.2) to match the Node 24 Docker/Electron runtime. The fresh install
also corrected previously installed versions that did not satisfy the manifests.
Zod 4 required its two-argument record schema and removal of the old ZodTypeDef
generic in the OpenRouter section parser.

## Minimatch security override

electron-builder 26.18.0 still requests minimatch 10.x through app-builder-lib and
9.x through @electron/universal. The override applies **only** to the affected
modern versions (`>=7 <11.0.1`), resolving them to 11.0.8. Older callers keep
minimatch 3.1.5 / 5.1.9; their callable CommonJS APIs are incompatible with a blanket
override to modern minimatch.

The older [nested-extglob advisory](https://github.com/advisories/GHSA-23c5-xmqv-rm74)
has separate patched versions for each major, including 3.1.4 and 4.2.5. Thus
3.1.5 is not vulnerable merely because it is numerically below 4.2.5. The newer
[globparts amplification advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)
affects versions 7 through 11.0.0; 10.2.6 does not fix it. Its first patched
version is 11.0.1. Remove the override once all build-tool parents request patched
versions directly, rerunning the checks below.

## Deliberately deferred major migrations

These newer major versions exist but were not forced into this maintenance update:
Google GenAI 3.3.0, dotenv 18.0.10, Express 5.3.0, pdf-parse 2.4.5 and TypeScript
7.0.2. They require separate API/toolchain migration and validation. Node 26 type
definitions are also available, but do not match this application's Node runtime.

## Verification

```bash
npm run frontend:build
npm --prefix backend run build
npm run test:dependencies
npm --prefix backend test
npm run frontend:i18n:check
npm run sample:check
npm audit
npm --prefix backend audit
```

The compatibility check exercises build matching, universal-Mac matching, legacy
ASAR archive creation/extraction and OpenAI JSON-schema generation with Zod 4.
The update was also checked with an unsigned Windows directory package using
Electron 45.3.2. macOS and signed installer production were not tested locally.
The packaged Electron runtime (Node 24.22.2) also passed backend startup, health
and offline-precheck HTTP smoke checks without opening a desktop window.
