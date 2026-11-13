# Report format

Use readable prose and compact tables. Match the user's requested depth; these are coverage guides rather than mandatory headings for every reply. Keep warnings and questions specific to the source. Do not expose internal implementation details in candidate-facing reports.

## Evidence review

Include:

1. CV Evidence Score **N/100**, matching recommendation, and a brief main diagnosis. Describe it as an advisory evidence assessment.
2. Component table: quantified results /30, accomplishment clarity /25, scope and scale /20, responsibility versus outcome ratio /15, interview defensibility /10. Give a reason for each and check the sum.
3. Strong evidence and specific warnings, tied to identifiable roles or short source excerpts. Include privacy, progression, tense, education, contact, or length warnings only where relevant.
4. Missing evidence and selected weak original bullets. At this stage, do not rewrite them.
5. Prioritized metric-recovery and interview-risk questions, usually three to five useful questions rather than a generic questionnaire.
6. Next step. For scores below 75, explain the gaps and let the user choose recovery or proceeding with the warnings retained. When review alone was requested, do not force a tailoring decision.

If counts of strong bullets, weak bullets, or quantified evidence are requested, define the unit and count only material actually reviewed. Do not imply the app's regex detector was run. Dates and contact numbers are not outcome evidence. Omit counts when they add no value.

## Job-specific plan

Include:

1. Role diagnosis, supported company signals, and candidate positioning.
2. Profile Match Score **N/100**, matching verdict, reasons, risks, and the company-decision caveat. Distinguish it from the CV Evidence Score.
3. Coverage table: requirement, importance, coverage, source evidence, risk. Focus on the important screening requirements without dropping a material knockout risk merely to keep the table short.
4. Strong matches, missing signals, scanability/recent-evidence/over-positioning warnings where relevant, and one application strategy.
5. Supported summary, selected original/rewrite pairs with reasons and integrity labels, keywords to include/avoid, and an evidence-backed skills section.
6. Suggested CV structure and prioritized reconstruction actions. Carry forward unresolved precheck warnings and identify facts still needing confirmation.
7. Integrity audit of material changes, including any user-confirmed additions and unsupported suggestions excluded from usable copy.

When the user requests an export, provide a plain-text version or a file if the host supports file creation. Do not claim a downloadable attachment exists unless one was created. A concise plan export can usually stay under 700 words; do not drop material warnings to meet that preference. A requested full CV is a separate deliverable and may be longer.

## App compatibility boundary

This conversational format does not reproduce the app's strict JSON API contract. If the user needs an app-compatible result, use the current app schema and validator in the target environment. Do not promise schema validation when those tools are unavailable. Translate prose when requested; preserve exact English keys and enum labels only when producing machine-readable app data.
