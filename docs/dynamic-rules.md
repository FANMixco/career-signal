# Dynamic evaluation rules

## Audit and organization

The application has an Express/TypeScript backend, an Electron wrapper that starts
that same backend, a combined Docker image, a backend-only Docker image, and a
static GitHub Pages frontend. The frontend previously required a backend for every
precheck; it had a web manifest but no offline service worker. Browser localStorage
held backend URL, theme and language preferences, not evaluation rules. Session
exports are user-managed JSON downloads. Electron had no rules data directory;
Docker had no persistent rules directory.

The evaluation paths found during the audit are:

| Source | Existing rules and thresholds | Treatment |
| --- | --- | --- |
| `backend/src/rules/cvRules.ts` | CV/job minimum lengths 300/120; recommendation bands 0–49, 50–74, 75–100; score breakdown maxima 30/25/20/15/10; six personal-data detectors | Recommendation bands moved into evaluation JSON. Detector code, input contracts and breakdown maxima stay in the engine. Personal-data copy remains in its existing JSON. |
| `backend/src/services/ai/localCvEvidence.ts` | Quantified evidence >=3; accomplishment verbs >=8 or strong bullets >=2; score capped at 90; component weights; responsibility/outcome balance; study-date warning from 5 years; senior compression <700 words from 7 years; early-career length >1200 words below 5 years | Numerical settings and all 39 existing explanatory messages/questions moved to evaluation JSON without changing baseline values or wording. Pattern matching, component formulas, bullet candidate selection (maximum 80), result/weak-verb vocabularies and fixed component maxima remain engine behavior. |
| same local evidence fallback | Cost attribution, baseline/window, scale, tense, unsupported self-assessment, hidden progression, hybrid role scope, AI maturity, cloud and strategy evidence, interview defensibility | Existing detection and fallback behavior preserved. Related text grouped in `legacyText` with descriptive keys. |
| `backend/src/content/guidance/cvGuidance.json` | Metric recovery; education privacy; progression (around 7 years); tense; seniority/length (junior 1 page, mid 1–2, senior around 2, exceptions for relevant detail); title/responsibility alignment; evidence-backed language; contact completeness | Reuse existing file, now dynamically validated and loaded. These are qualitative model instructions, not guaranteed deterministic detectors. |
| `backend/src/content/guidance/sensitivePersonalData.json` | Date of birth/age, gender, citizenship/nationality, marital/family status, photo, full address | Reuse existing file for labels and recommendations. Six fixed regular expressions stay compiled into the application. |
| `backend/src/prompts/cvPrompts.ts` | Evidence integrity/no invention, scoring bands, privacy, older experience selection, requirement screening, scanability, recent evidence, over-positioning, application strategy; job-fit bands 85/70/50 | Guidance fields and CV score bands now read the active rules. Remaining prompt logic and job-fit bands stay application-owned. |
| `ollamaService.ts` and `openRouterSectionedService.ts` | Duplicate sectioned provider flows, conservative fallback job-fit score clamped to 50–84 and verdict boundary 70; compact context limits and model timeouts | Kept provider-specific behavior intact; they share the local evidence evaluator. Provider token/time limits are operational settings, not CV evaluation rules. |
| `resultNormalizers.ts`, `aiSchemas.ts`, `validation.ts`, `textFormatter.ts` | Score normalization (0–10 converted to 0–100), enum/schema contracts, education/privacy safeguards, request limits and mandatory download reminders | Preserved engine contracts. Existing guidance references are dynamic. |
| frontend content and rendering | Score color thresholds 75/50, localized labels, evidence-recovery examples, decision gates | Precheck colors accept the backend/browser rules bands. General job-fit styling remains unchanged. UI copy stays in existing locale files. |

There is existing conceptual duplication between prompt instructions, deterministic
fallbacks and TXT reminders. This change reuses the existing guidance rather than
creating JSON per rule or per provider. Provider model IDs, display names, defaults and local fallback ordering now live in one shared model catalog. The new compression warning supersedes
the old generic compression fallback when both trigger. Stable CV01–CV04 IDs and
exact-message deduplication prevent repeated engine warnings when results are
merged or reused. Free-form model advice may still overlap conceptually; the
engine does not discard unrelated model advice based on speculative similarity.

Localization has two existing layers: frontend `app.en/es/fr/de.json` files, and
backend `messages.en/es/fr/de.json` error catalogs. AI prompts request the chosen
language but keep schema enums in English. Existing guidance/fallback prose is
English and remains so to preserve behavior. New CV01–CV04 recommendations contain
all four supported languages in the single evaluation file; missing locales fail
validation. Offline button and completion copy use existing frontend catalogs.

## Schema and source files

Authoritative content (edit these):

```text
backend/src/content/
  rules/evaluation.json
  guidance/cvGuidance.json
  guidance/sensitivePersonalData.json
  config/models.json              # provider IDs, labels, defaults, local fallbacks
backend/src/rules/release.json       # schema/engine compatibility, revision
docs/rules.schema.json              # generated JSON Schema, $defs per document
```

Generated Pages distribution:

```text
frontend/rules/
  manifest.json
  evaluation.json
  cvGuidance.json
  sensitivePersonalData.json
  models.json
frontend/rules.min.js               # bundled engine plus baseline, application code
```

`evaluation.json` contains `scoreBands`, `localEvidence`, `legacyText`, `rules`
(exactly CV01–CV04), and `recommendations`. Each new rule has `enabled`, `severity`
(`info`, `warning`, `error`), a `recommendation` reference to a known recommendation
group, and detector-specific `thresholds`. Each recommendation has en/es/fr/de text.
CV02 messages interpolate `{recentYears}` from the configured threshold.

The manifest is:

```json
{
  "schemaVersion": 2,
  "engineMin": 2,
  "engineMax": 2,
  "revision": 2,
  "files": {
    "evaluation.json": "<64 lowercase hex SHA-256 characters>",
    "cvGuidance.json": "<64 lowercase hex SHA-256 characters>",
    "sensitivePersonalData.json": "<64 lowercase hex SHA-256 characters>",
    "models.json": "<64 lowercase hex SHA-256 characters>"
  }
}
```

`rulesRuntime.ts` enforces complete fixed shapes, bounded nonempty strings and
arrays, finite bounded numbers, valid severity/references, ordered score bands,
threshold bounds, compatibility and exact hashes. Unknown keys are rejected.
`docs/rules.schema.json` describes each document under `$defs`; use for example
`#/$defs/evaluation.json` as a validator reference. Runtime validation additionally
enforces cross-field ordering, supported engine compatibility and integrity.

## Storage and activation

| Distribution | Durable rules location |
| --- | --- |
| Web / installed PWA | IndexedDB database `career-signal-rules`, object store `rules`, key `state`. One transaction stores current/previous snapshots and last check time. |
| Electron installed / portable | `<app.getPath("userData")>/rules/rules-state.json`; portable intentionally uses the existing Electron user-data convention, outside the installation. |
| Docker, both images | `/data/career-signal/rules/rules-state.json` by default; override `CAREER_SIGNAL_RULES_DIR`. |
| Standalone Node backend | `~/.career-signal/rules/rules-state.json`; same override. |

Every distribution includes the baseline. Backend builds copy its JSON into dist;
Electron packages backend dist and frontend; both Docker images copy backend dist.
The browser engine embeds the baseline. Web app shell caching is separate from
rules persistence: the service worker caches only fixed shell assets, never CVs,
API responses, or remote rule downloads. IndexedDB is not a browser HTTP cache.
Browser storage may still be cleared/evicted by the user or browser; the bundled
baseline remains the recovery path. An installed PWA must have loaded successfully
online once before its shell can reopen offline.

The backend reads the local snapshot before listening. Browser checks wait for
local IndexedDB loading only. Both then launch remote refresh in the background.
Checks never await remote synchronization. Backend requests capture their rules
generation with AsyncLocalStorage, so an in-flight provider request does not mix
old and new guidance if synchronization finishes during the request.

## Synchronization and rollback

Default source: `https://fanmixco.github.io/career-signal/frontend/rules/`.
The repository's existing Pages frontend directory is the publication target;
this work prepares files there and does not deploy them to GitHub.

1. Load and revalidate the persisted current snapshot (including hashes).
2. If invalid, try previous; if neither works, use the embedded baseline.
3. Check `manifest.json` in the background when the refresh interval expires.
4. Require schema version 2 and an engine range containing engine version 2.
5. Require all four known files. Reuse files whose hashes already match the
   current snapshot; download only changed files. The first check also compares
   against the bundled baseline, avoiding redundant downloads.
6. Validate the complete staged snapshot, including all references/locales/hashes.
7. Persist one envelope containing the new snapshot and prior current snapshot.
   Filesystem writes use a temporary sibling followed by rename; IndexedDB uses
   one readwrite transaction.
8. Only after successful persistence, switch the in-memory rules reference.

Unchanged filesets preserve the rollback generation. Network errors, unsupported
schemas, incomplete/invalid JSON, redirects, stale/reused revisions, bad hashes,
size limits, quota/disk failures and offline operation leave current rules active.
Failed checks are throttled by the same refresh interval. A minute timer checks
whether refresh is due; browser `online` events also check, without bypassing it.

The shared manager exposes `await manager.rollback()` to validate and persist a
swap with the previous generation. It is available as
`window.CareerSignalRules.manager.rollback()` for a browser administrator. Recovery
from corrupt current storage happens automatically at the next startup. To ship
a product rollback remotely, publish the restored content with a **higher**
revision. Lower revisions and changed content reusing a revision are rejected.
A manual local rollback can receive the newer remote revision on a later check;
disable synchronization or publish a higher rollback revision to keep it pinned.

Backend configuration:

```text
CAREER_SIGNAL_RULES_DIR=/data/career-signal/rules
CAREER_SIGNAL_RULES_SOURCE=https://fanmixco.github.io/career-signal/frontend/rules/
CAREER_SIGNAL_RULES_REFRESH_HOURS=24
```

Set source to an empty string to disable synchronization. Browser deployments can
set `window.CAREER_SIGNAL_RULES_OPTIONS = { source: "...", refreshHours: 24 }`
before `rules.min.js`; an empty source also disables it. Positive refresh intervals
are supported; invalid intervals default to 24 hours.

Only fixed filenames beneath the configured HTTPS directory are requested.
Requests omit credentials and referrers; they contain no CV, job description, API
key or analysis result. Redirects are refused; each file has an eight-second
timeout and a streamed one-megabyte limit. The manifest is trusted through HTTPS
and control of the configured publisher. SHA-256 verifies integrity/completeness,
not an independent publisher signature. No remote JavaScript, regex, executable
expression, dynamic import, template evaluator or detector is accepted.

## Four added checks

| Rule | Baseline behavior | Configurable settings |
| --- | --- | --- |
| CV01 | At least 4 dated professional positions, at least 2 with fewer than 2 substantive achievements. Outcome + scope evidence is required; metrics are not mandatory. | Position/weak-position/achievement minimums; enabled, severity, recommendation reference and localized copy. |
| CV02 | Positions ending before the last 7 years contain at least 100 words and over 1.5 times the detail of recent experience. Advice prioritizes recent work, preserves relevant older evidence, and describes possible age information exposure without alleging discrimination. | Recency years, old-detail minimum and ratio, enabled, severity, reference/copy. |
| CV03 | Independent activity signals with unclear role classification, such as author/blog/newsletter content under an unexplained title. Clearly classified freelance/business/content/publication roles are not warned merely for being independent. | Enabled, severity, reference/copy. Vocabulary and classification logic stay in the engine. |
| CV04 | At least 2 months of definite overlap between dated positions, without explicit freelance/consulting/part-time/transition classification in role headers. | Overlap months; enabled, severity, reference/copy. |

Dates support year ranges, localized month names, numeric month/year and ISO
year-month, plus ongoing-role markers. Professional section boundaries exclude
education, skills, publications and projects from position counts. Year-only
ranges use conservative bounds for overlap; a shared transition year alone is
not sufficient. Unparseable/ambiguous text is left for the existing AI review.
These are heuristic warnings, not proof of an employment arrangement or complete
semantic relevance analysis. They do not infer discrimination or employment
misconduct. All four are advisory; severity changes never alter a score.

Backend prechecks attach `careerWarnings` with ID/severity/reference/message and
merge one visible message per ID into `specificWarnings`. The existing tailoring
path receives those warnings through its precheck result. Browser offline checks
use the identical detector and local evidence evaluator.

Use **Offline evidence check** for pasted CV text without a backend or AI service.
For PDF extraction, run the local Docker/desktop/backend and use the same button;
`POST /api/precheck-cv` with multipart `offlineOnly=true` performs extraction and
deterministic checking without an AI key or model. Full job-specific AI tailoring
still requires the existing configured provider (a locally available Ollama model
can run without internet). The browser-only offline evaluator accepts text.

## Publishing and future changes

Edit authoritative content, increment `backend/src/rules/release.json` revision,
and run:

```bash
npm run rules:build
npm run test:rules
```

Publish the generated `frontend/rules/` files with the existing Pages site. Upload
content files before the manifest where the host does not deploy atomically.
Clients reject mismatches and continue locally until a later check. Preserve LF
bytes (`.gitattributes` fixes line endings) because hashes cover exact UTF-8 bytes.
`frontend:build` also generates these files and the bundled browser evaluator.
`rules:build` alone suffices for publishing JSON-only updates to existing engines;
application JS does not need to be rebuilt for those clients to receive them.

JSON-only updates can change existing guidance, fallback messages/questions,
personal-data labels/warnings, score recommendation bands, exposed local evidence
thresholds/weights, four-rule enabled/severity flags, numeric thresholds, known
recommendation references and their localized text. Model IDs, labels, provider defaults and valid Ollama fallback lists can also change through `models.json`. They cannot add detector
algorithms, arbitrary patterns or new rule IDs. Engine/schema updates are needed
for new providers, API request parameters, fields, locales, recommendation groups, parsers/vocabulary, scoring
formulas/component maxima, input contracts, provider behavior or UI features.

Tests cover bundled/served hash equality, all four detectors, boundaries and
explained arrangements, localization, configuration and score neutrality,
duplicate merging, strict validation, unchanged-file reuse, throttling, atomic
activation, rollback/corruption recovery, bad/partial/oversized/incompatible
updates, disk failure, filesystem restart, per-request generation consistency,
generated browser execution without Node/network, and the real offline HTTP API.
Run the HTTP test where loopback connections are permitted.


## Persistent model catalog (engine 2)

`backend/src/content/config/models.json` is the single editable source for all
seven providers. Its own schema version is 1, nested in the version-2 four-file
manifest. Model lists are no longer duplicated in `appOptions.json` or frontend
locale files. Locales translate the free/experimental suffixes; model names remain
shared. The frontend bundle embeds a baseline catalog and reads validated stored
updates through the same IndexedDB state as the rules. Desktop and Docker backend
snapshots include it in the same user-data/volume envelope.

The catalog contains `providers.<provider>.defaultModel`, a `models` list of
`{id, label}` entries, and `ollamaFallbackModels`. Provider names are engine-owned.
Validation rejects duplicate IDs, unknown fields/providers, invalid defaults,
unsafe IDs, invalid fallback references and non-free OpenRouter built-in routes.
It cannot supply endpoints, API keys, parameters, scripts or executable patterns.

Backend model resolvers read the active catalog at request time; environment
values and explicitly selected/custom IDs retain their existing precedence. The
read-only `/api/model-catalog` endpoint supplies the connected backend's current
catalog to its UI. The browser prefers that validated response; if no backend is
available it uses its own persisted/bundled catalog. UI checks poll the backend
once a minute and never send CV text or keys. Browser synchronization events also
refresh choices. Explicit user choices, imported settings and custom model text
are preserved. If a preset disappears, an explicit choice becomes a custom
selection so an update cannot silently switch the user's model or spending tier.

To publish a catalog change, edit the single JSON file, increase the shared release
revision and run `npm run rules:build`; deploy `frontend/rules/` through Pages.
Compatible clients download only `models.json` when the other hashes match,
validate the complete snapshot, persist, and activate atomically. The prior
catalog is retained with the previous rules snapshot for rollback. No app rebuild
is needed for compatible catalog-only changes after this engine update is installed.

Engine-1 clients safely reject the version-2 manifest and continue with their own
valid local/bundled rules. Upgrading to engine 2 seeds the new four-file baseline
if the old three-file snapshot is incompatible. Serving both old and new update
streams long-term requires separate source directories. Catalog changes do not
install local Ollama models; the user still downloads them explicitly.
