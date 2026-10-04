# Workday CV and Candidate Profile Autofill Workflow for Codex

## Goal

Automate the repetitive cleanup required by Workday job applications while keeping the candidate in control of authentication, application specific questions, and final submission.

The user provides a Workday job or application URL. Codex opens that URL in the browser. The user performs login manually. After authentication, Codex continues in the same browser session, uploads `cv.pdf` when appropriate, waits for Workday to finish parsing it, and reconciles both the persistent Workday candidate profile and the current application against `cv_as_excel.xlsx`.

The workbook is authoritative. Workday profile data, application data, and resume parser output are targets to inspect and correct, not sources of truth.

```text
USER
  provides Workday URL
  logs in manually
  completes MFA / SSO / CAPTCHA if required
  answers application specific questions when needed

CODEX
  opens supplied URL
  waits while user authenticates
  resumes in same authenticated session
  reads cv_as_excel.xlsx locally
  uploads cv.pdf when requested or useful
  waits for Workday parsing to finish
  reconciles candidate profile against Excel
  reconciles current application against Excel
  verifies supported structured CV fields
  stops before final submission unless explicitly instructed otherwise
```

---

## Required local files

```text
cv.pdf
cv_as_excel.xlsx
WORKDAY_AUTOFILL.md
```

### `cv.pdf`

Purpose: resume attachment and Workday import mechanism only.

Workday may use the PDF to create or update structured candidate profile records. Parser output is untrusted temporary data and must be reconciled against Excel.

Do not use the PDF as the authoritative source for structured fields.

### `cv_as_excel.xlsx`

Purpose: authoritative structured CV database.

This workbook is the only source of truth for CV backed fields managed by this workflow.

### Workday URL

The user supplies the URL at runtime. Open exactly that URL.

---

# Non negotiable rules

1. Open exactly the Workday URL supplied by the user.
2. Never ask for, read, store, or manage the user's password.
3. The user performs authentication manually.
4. Leave SSO, MFA, CAPTCHA, passkeys, security keys, QR approvals, and consent screens to the user.
5. Continue only after an authenticated Workday session is available.
6. Preserve the same browser session after authentication.
7. Treat `cv_as_excel.xlsx` as authoritative for structured CV data.
8. Treat existing Workday candidate profile data as untrusted until reconciled with Excel.
9. Treat resume parser output as untrusted until reconciled with Excel.
10. Never keep a Workday value merely because it looks plausible when Excel contains a different value.
11. Never reconstruct missing structured data from `cv.pdf` when it is absent from Excel.
12. Never invent information absent from Excel or separately supplied by the user.
13. Modify only fields that can be supported by Excel or explicit user input.
14. Do not infer answers to salary, notice period, work authorization, relocation, sponsorship, referrals, legal declarations, diversity questions, demographic questions, or employer specific questionnaires.
15. Do not silently reuse answers from a previous Workday application for application specific questions unless the user explicitly established those answers as reusable.
16. Do not submit the final application unless the user explicitly instructs Codex to submit it.

---

# Source hierarchy

For CV backed information:

```text
1. cv_as_excel.xlsx             AUTHORITATIVE
2. Workday candidate profile   TARGET TO RECONCILE
3. Current Workday application TARGET TO RECONCILE
4. cv.pdf parser output         TEMPORARY / UNTRUSTED
```

Therefore:

```text
Excel says A, Workday says B       -> use A
Excel says A, parser says B        -> use A
Excel has a record, Workday lacks it -> add it when supported
Workday has stale record absent from Excel -> remove when safe
Excel field is blank -> do not invent a value
Workday requires unsupported information -> leave unresolved and report it
```

---

# Workday specific model

Workday differs from the SuccessFactors workflow because structured career data may persist in the candidate's Workday profile and be reused across applications.

The objective is therefore not simply to repair one parser run.

Codex must reconcile two layers when they exist:

```text
PERSISTENT LAYER
  Candidate Profile
  Work Experience
  Education
  Skills
  Languages
  Certifications
  other reusable CV sections

APPLICATION LAYER
  Resume attachment
  imported structured CV fields
  application specific experience/education sections
  employer specific questions
  voluntary disclosures
  review page
```

Changes to persistent profile information may affect later applications. Make such changes only when they represent the Excel source of truth.

Application specific answers must not be treated as persistent CV facts.

---

# Execution flow

## Phase 1: Open URL and hand off authentication

1. Open the supplied Workday URL.
2. Wait for the page to load.
3. If authentication is required, leave the browser ready for the user.
4. Stop interaction while the user authenticates.
5. Resume only after the authenticated session is available.

Possible authentication screens include username/password, SSO, Microsoft or Google identity providers, MFA, CAPTCHA, passkeys, security keys, and consent screens.

Never attempt to bypass or automate authentication challenges.

---

## Phase 2: Determine the Workday state

After login, inspect the current state before changing anything.

Possible states include:

```text
job description page
Apply button
Start Your Application
My Applications
Candidate Home
My Account
Candidate Profile
autofill/import resume step
previous application continuation
current application form
review page
```

Determine whether the current application is new, partially completed, or already populated from the candidate profile.

Do not assume a new application starts with empty structured sections.

---

## Phase 3: Load Excel before destructive changes

Read `cv_as_excel.xlsx` before deleting or replacing any Workday records.

Build an in memory representation of every managed sheet and normalize dates only for comparison and target controls.

Never delete existing Workday data before the corresponding Excel data has been successfully loaded.

---

## Phase 4: Resume upload and parser handling

If Workday requests or offers a resume upload, upload:

```text
cv.pdf
```

Possible controls include:

```text
Upload Resume
Select files
Attach Resume/CV
Autofill with Resume
Use My Last Application
Apply Manually
```

When resume parsing or autofill is used:

1. Upload the PDF.
2. Wait until parsing and background updates finish.
3. Do not trust the generated structured data.
4. Reconcile generated records against Excel.

If Workday offers a choice between using an existing profile and importing a resume, avoid destructive reimport when the existing profile can be safely reconciled directly.

Do not repeatedly upload the PDF if doing so would duplicate experience or education records.

---

# Workbook contract

Use the same workbook structure as the SuccessFactors workflow.

## 1. Experience

Columns:

```text
Employer
Title
Internship
Start
End
Location
Description / achievements
```

Record identity:

```text
Employer + Title + Start
```

Possible Workday labels:

```text
Work Experience
Experience
Professional Experience
Job History
Employment History
```

Field aliases:

```text
Employer                   -> Company | Employer | Organization | Company Name
Title                      -> Job Title | Title | Position | Role
Start                      -> From | Start Date | Start Month/Year
End                        -> To | End Date | End Month/Year
Location                   -> Location | City/Country
Description / achievements -> Role Description | Description | Responsibilities | Achievements
```

`Internship=No` must never be converted into an employment type unless Workday explicitly exposes an internship yes/no field.

### Experience reconciliation

For each Workday experience record:

1. Match conservatively using Employer + Title + Start.
2. If matched, overwrite supported fields with Excel values.
3. Add Excel experiences absent from Workday.
4. Remove stale Workday experiences absent from Excel when the record is clearly editable candidate profile data.
5. Verify dates, employer, title, location, and description after saving.

Prefer updating a valid matching persistent record over deleting and recreating it.

---

## 2. Education

Columns:

```text
Institution
Degree
Field
Location
Start
End
Grade
Description
```

Record identity:

```text
Institution + Degree + Start
```

Possible Workday labels include Education, Education History, Academic Background, and School History.

Map fields only when equivalent controls exist. Convert Excel date serials through the workbook date system.

Do not guess degree categories when Workday forces an employer specific controlled vocabulary.

---

## 3. Volunteering

Columns:

```text
Role
Organization
Start
End
Cause
Description
Location
```

Record identity:

```text
Organization + Role + Start
```

Workday tenants may not expose a volunteering section. If absent, report UNSUPPORTED. Do not move volunteering into Work Experience unless Excel itself classifies it there.

---

## 4. Honors & Awards

Columns:

```text
Honor / Award
Issuer
Issued
Associated with
Description
```

Record identity:

```text
Honor / Award + Issuer + Issued
```

Populate only when Workday exposes an appropriate section.

---

## 5. Courses

Columns:

```text
Course
Year
Associated with
```

Record identity:

```text
Course + Year
```

Skip if the tenant has no suitable training or course section.

---

## 6. Certifications

Columns:

```text
Certification
Issuer
Issued
Skills
```

Record identity:

```text
Certification + Issuer + Issued
```

Possible Workday labels include Certifications, Certifications and Licenses, Credentials, and Professional Certifications.

Never invent credential IDs, credential URLs, expiration dates, or license numbers.

### Certification reconciliation

Workday certification fields may look like free text while actually being backed by a controlled tenant list. Before adding any certification from Excel, type or search for the certification name and verify that Workday returns a matching selectable certification value.

Add a certification only when the exact certificate, or an unambiguously equivalent credential name, can be selected from Workday's list. Do not preserve a value merely because it can be typed into the input.

If Excel contains a certification that Workday does not expose as a selectable value:

1. Do not add it as free text.
2. Do not substitute a related provider, skill, school, or generic credential.
3. Remove any unmatched certification row created during probing or resume parsing.
4. Report the certification as BLOCKED or UNSUPPORTED for that tenant.

If Workday requires a full issued date but Excel only has month and year, do not invent a day. Leave the Workday date blank unless the user explicitly supplies a full date or the control can safely represent month and year.

---

## 7. Publications

Columns:

```text
Publication
Publisher
Date
Description
```

Record identity:

```text
Publication + Publisher + Date
```

Populate only when the tenant exposes a publication section.

---

## 8. Languages

Columns:

```text
Language
Proficiency
```

Record identity:

```text
Language
```

If Workday uses CEFR values and the Excel value exists directly, use it.

If Workday uses qualitative values such as Native, Fluent, Advanced, Intermediate, or Basic, do not manufacture a CEFR mapping. Map only when equivalence is explicitly defined or unambiguous.

---

## 9. Skills

Columns:

```text
Skill
```

Record identity:

```text
normalized Skill
```

Possible Workday controls include Skills, Skills Cloud, Professional Skills, Competencies, and Expertise.

Add workbook skills in workbook order.

If Workday requires selection from a controlled skills taxonomy, select only clear matches. Report Excel skills that cannot be represented safely.

Do not replace a specific Excel skill with a vaguely related Workday skill merely to populate the field.

---

## 10. Projects

Columns:

```text
Project
Start
End
Associated with
Contributors
Skills
Description
Links
```

Record identity:

```text
Project + Start
```

Workday frequently lacks a dedicated projects section. If absent, report UNSUPPORTED and do not force project data into Work Experience.

---

# Candidate profile reconciliation algorithm

## Preferred strategy: conservative in place reconciliation

Unlike the SuccessFactors parser cleanup strategy, do not automatically delete every existing Workday record.

For each supported persistent section:

1. Read all Excel records.
2. Read all existing Workday records.
3. Match records using the defined identity.
4. Update matched records from Excel.
5. Add missing Excel records.
6. Identify Workday records absent from Excel.
7. Delete stale records only when they are clearly user editable profile records and deletion will not remove unrelated application data.
8. Save normally.
9. Reopen or reread the section.
10. Compare against Excel.

Never fuzzy merge genuinely different jobs, degrees, certifications, or other records.

### Duplicate handling

Resume imports can create duplicate Workday records.

A record may be treated as a duplicate only when the identifying fields clearly refer to the same Excel record.

When two Workday records both map to one Excel record:

1. Keep the record that can be cleanly reconciled.
2. Update it from Excel.
3. Delete the duplicate when safe.
4. Verify only one record remains.

Do not delete records merely because employer names are similar.

---

# Current application reconciliation

After the persistent profile is reconciled, inspect the current application.

Workday may copy profile data into application specific sections. Do not assume profile corrections automatically propagate into an application already in progress.

For every CV backed application section:

1. Compare displayed application data with Excel.
2. Correct supported mismatches.
3. Add missing Excel records when controls permit.
4. Remove parser generated or stale records when safe.
5. Save.
6. Reread and verify.

If Workday asks whether to use the candidate profile or previous application data, prefer the option that preserves the reconciled Excel backed information and introduces the least stale data.

---

# Application specific questions

The following are outside the CV reconciliation contract unless separately supplied by the user:

```text
salary expectations
current salary
notice period
availability/start date
work authorization
visa or sponsorship requirements
willingness to relocate
willingness to travel
preferred office/location
referral source
how did you hear about us
cover letter questions
motivation questions
employer specific screening questions
conflict of interest declarations
legal declarations
criminal history questions
diversity information
gender
race/ethnicity
disability information
veteran status
nationality/citizenship when application specific
consent choices
```

If one of these blocks progress, stop on the field and ask the user for the answer or leave the browser ready for the user to complete it.

Never derive an answer from the CV unless the user explicitly instructed that the relevant Excel field is authoritative for that question.

---

# Date handling

Preserve actual dates from Excel.

Examples:

```text
2024-06     -> June 2024
Jun 2026    -> June 2026
May 1 2026  -> May 1, 2026
Present     -> Current / I currently work here when available
```

Rules:

1. Preserve month and year.
2. Omit a day only when the target control cannot represent it.
3. For ongoing roles, use Workday's current position control when available.
4. Never invent an end date.
5. Convert Excel serial dates through the workbook date system.

---

# Location handling

If Workday exposes free text, copy the Excel location exactly.

If Workday separates City, State/Region, and Country, split only values that can be interpreted confidently.

Do not guess ambiguous locations.

If Workday uses a location search or controlled geography list, choose only an unambiguous equivalent.

---

# Controlled vocabularies

Workday tenants may use controlled lists for:

```text
degree
degree field
country
region
language proficiency
skills
certification type
employment type
job family
```

Rules:

1. Prefer exact matches.
2. Use clearly equivalent values only when equivalence is unambiguous.
3. Do not manufacture mappings to satisfy required controls.
4. If a safe mapping does not exist, leave the field unresolved and report BLOCKED.
5. Treat typed values that do not become selected pills/options as unmatched, even if the input visually retains the text.
6. When probing controlled fields, clear failed probes and delete any empty rows created only for testing.

---

# Interaction strategy

Workday implementations and tenant configurations differ.

Do not depend on fixed DOM paths.

Prefer interaction targets in this order:

1. accessible role and name
2. visible section heading
3. associated field label
4. `aria-label`
5. stable input name or ID
6. nearby text

Avoid generated CSS classes, nth child selectors, random IDs, and absolute coordinates when semantic controls are available.

Common actions may include:

```text
Apply
Apply Now
Start Your Application
Autofill with Resume
Apply Manually
Use My Last Application
Add
Edit
Delete
Save
Save and Continue
Next
Back
Review
Submit
```

Never interpret Review as Submit without checking the actual control semantics.

---

# Saving strategy

Workday may save at record, section, page, or navigation level.

After changing structured data:

1. trigger the normal save action
2. wait for any spinner or background save
3. reread the saved data
4. compare it with Excel

Do not assume a modal closing means the save succeeded.

When possible, verify persistent profile changes again after navigating away and returning.

---

# Verification pass

For every Excel backed section exposed by the Workday tenant, assign one status:

```text
MATCHED
PARTIAL
BLOCKED
UNSUPPORTED
```

Definitions:

```text
MATCHED     Workday matches Excel for all supported fields
PARTIAL     Workday cannot represent one or more Excel fields
BLOCKED     required Workday control cannot be mapped safely
UNSUPPORTED Workday exposes no appropriate section
```

Perform verification separately for:

```text
Candidate Profile
Current Application
```

A section can therefore be MATCHED in the profile but PARTIAL or BLOCKED in the current application.

Acceptable differences include target controls with lower date precision, unsupported Excel fields, a section absent from the tenant, and controlled values that cannot safely represent Excel.

Unacceptable differences include incorrect employer/title/dates, omitted Excel experiences when Workday permits adding them, stale duplicate records, parser generated values contradicting Excel, or invented mappings.

---

# Final review and stopping point

Once all available CV backed sections have been reconciled:

1. Save all editable sections.
2. Navigate to the review page when doing so does not submit the application.
3. Verify the resume attachment.
4. Verify Work Experience.
5. Verify Education.
6. Verify every other supported workbook section.
7. Report application specific questions still requiring user input.
8. Report PARTIAL, BLOCKED, and UNSUPPORTED sections.
9. Stop before the irreversible submission action.

Only activate `Submit`, `Submit Application`, or an equivalent irreversible control when the user explicitly instructs Codex to submit the application.

---

# Required runtime behavior summary

```text
USER provides Workday URL
        ↓
CODEX opens URL
        ↓
USER authenticates manually
        ↓
CODEX resumes same session
        ↓
CODEX reads cv_as_excel.xlsx
        ↓
CODEX inspects candidate profile and application state
        ↓
CODEX uploads cv.pdf when required/appropriate
        ↓
WORKDAY may parse/import resume
        ↓
CODEX waits for parser completion
        ↓
CODEX treats Excel as source of truth
        ↓
CODEX reconciles persistent candidate profile
        ↓
CODEX reconciles current application
        ↓
USER handles unsupported application specific questions
        ↓
CODEX verifies profile and application against Excel
        ↓
CODEX reaches review stage
        ↓
CODEX stops before final submission
```

The PDF is the attachment and optional import mechanism.

The Excel workbook determines what the structured career data should say.

The Workday candidate profile is persistent state that must be reconciled carefully rather than blindly trusted or blindly rebuilt.
