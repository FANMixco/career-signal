window.CAREER_SIGNAL_CONFIG = {
  apiBaseUrl: window.location.port === "3001" ? "" : "http://localhost:3001",
  pdfMaxBytes: 5 * 1024 * 1024,
  targetStyles: [
    "Consulting",
    "Strategy",
    "Product",
    "Cloud",
    "Engineering",
    "Procurement",
    "Sales",
    "Leadership",
    "Training",
    "Management",
    "General"
  ],
  recommendations: {
    proceed: "Proceed",
    caution: "Proceed with caution",
    improve: "Improve CV first"
  },
  buttons: {
    precheckIdle: "Run CV Evidence Precheck",
    precheckLoading: "Running precheck...",
    analyzeIdle: "Generate CV Reconstruction Plan",
    analyzeLoading: "Generating plan...",
    continueAnyway: "Continue anyway",
    continueToTailoring: "Continue to Job Tailoring"
  },
  fallbackText: {
    emptyList: "None noted.",
    noMainProblem: "No central problem reported."
  },
  feedback: {
    initial: "Add your CV, then run the evidence precheck before generating a job-specific plan.",
    missingYears: "Enter your years of professional experience before running the precheck.",
    missingStudies: "Select whether you list studies or education on your CV before running the precheck.",
    missingStudyYear: "Enter the study completion year, or select No if you do not list studies or education.",
    missingCv: "Add a LinkedIn PDF or paste complete CV text before running the precheck.",
    invalidPdf: "Only PDF uploads are supported. Choose a LinkedIn PDF export or paste CV text instead.",
    pdfTooLarge: "The PDF is larger than 5MB. Paste the CV text manually or upload a smaller PDF.",
    acknowledgeStudyWarning: "Acknowledge the study-year privacy warning before continuing.",
    runPrecheckFirst: "Run the CV Evidence Precheck before generating the reconstruction plan.",
    precheckComplete: "Precheck complete. Review the score and choose the next action below.",
    precheckLoading(apiBaseUrl) {
      return `Running CV Evidence Precheck against ${apiBaseUrl || "this server"}. This can take a little while while the model reviews the CV evidence.`;
    }
  },
  tailoring: {
    guidanceLocked:
      "You can add the target company and job description now. Generation unlocks after the CV evidence precheck, or after you explicitly choose to continue despite a weak precheck.",
    guidanceUnlocked:
      "Use the target company and job description to generate a reconstruction plan grounded in the CV evidence already checked above.",
    initialLock: "Run the CV Evidence Precheck first. This keeps the tailoring step from polishing weak or unsupported claims.",
    weakLock: "The precheck recommends improving the CV first. Choose Continue anyway below to unlock generation.",
    reviewLock: "Review the precheck result, then choose Continue to Job Tailoring below to unlock generation.",
    weakUnlock: "Unlocked because you chose to continue despite the weak CV warning."
  },
  weakCvWarning:
    "This CV appears to contain mostly descriptions of responsibilities rather than measurable results. Tailoring it to a job description now may produce a better looking document, but it will not solve the core problem. Add concrete outcomes and numerical evidence first.",
  precheckSections: [
    ["Recommendation", "proceedRecommendation"],
    ["Main problem", "mainProblem", "mainProblem"],
    ["Specific warnings", "specificWarnings", "list"],
    ["Missing evidence types", "missingEvidenceTypes", "list"],
    ["Weak bullet examples", "examplesOfWeakBullets", "list"],
    ["Questions to recover metrics", "questionsToRecoverMetrics", "list"]
  ],
  analysisSections: [
    ["Role diagnosis", "roleDiagnosis"],
    ["Company signal interpretation", "companySignalInterpretation"],
    ["Candidate positioning", "candidatePositioning"],
    ["Strongest matching evidence", "strongestMatchingEvidence", "list"],
    ["Weak or missing signals", "weakOrMissingSignals", "list"],
    ["Keywords to include", "keywordsToInclude", "list"],
    ["Keywords to avoid", "keywordsToAvoid", "list"],
    ["Suggested professional summary", "suggestedProfessionalSummary"],
    ["Rewritten CV bullets", "rewrittenCvBullets", "rewrittenBullets"],
    ["Suggested CV structure", "suggestedCvStructure", "list"],
    ["ATS friendly skills section", "atsFriendlySkillsSection", "list"],
    ["Recruiter interpretation", "recruiterInterpretation"],
    ["Final reconstruction plan", "finalReconstructionPlan", "list"],
    ["Integrity audit", "integrityAudit", "integrityAudit"],
    ["Precheck warning summary", "precheckWarningSummary"]
  ]
};
