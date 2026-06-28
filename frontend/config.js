function resolveApiBaseUrl(location) {
  if (location.port === "3001") {
    return "";
  }

  const hostname = location.hostname;
  const isPrivateHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "10.0.2.2" ||
    hostname === "10.0.3.2" ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

  if (isPrivateHost) {
    const hostForUrl = hostname === "::1" ? "[::1]" : hostname;
    return `http://${hostForUrl}:3001`;
  }

  return "http://localhost:3001";
}

window.CAREER_SIGNAL_CONFIG = {
  apiBaseUrl: resolveApiBaseUrl(window.location),
  pdfMaxBytes: 5 * 1024 * 1024,
  site: {
    title: "Career Signal Engine",
    subtitle: "Evidence check first. Tailoring second."
  },
  sections: {
    profile: "1. Profile",
    cvInput: "2. CV Input",
    precheck: "3. CV Evidence Precheck",
    tailoring: "4. Job Tailoring",
    output: "5. Reconstruction Plan"
  },
  labels: {
    yearsOfExperience: "Years of professional experience",
    studiesListed: "Do you list studies or education on your CV?",
    degreeYear: "Year studies were completed",
    experienceSelectionMode: "Experience selection mode",
    cvPdf: "Upload LinkedIn PDF",
    cvText: "Paste CV text manually",
    openaiApiKey: "OpenAI API key",
    targetCompany: "Target company name",
    targetStyle: "Target role style",
    jobDescription: "Job description",
    ageWarningAcknowledgement: "I understand the warning and want to continue."
  },
  placeholders: {
    cvText: "Paste complete CV text here",
    openaiApiKey: "Optional if OPENAI_API_KEY or GEMINI_API_KEY is configured",
    jobDescription: "Paste the full job description"
  },
  options: {
    studiesListed: [
      ["", "Select"],
      ["true", "Yes"],
      ["false", "No"]
    ],
    experienceSelectionMode: [
      ["lastFive", "Last five experiences only"],
      ["all", "All experiences"]
    ]
  },
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
    cvBasics: "High Impact CV basics",
    closeModal: "X",
    closeModalLabel: "Close CV basics",
    precheckIdle: "Run CV Evidence Precheck",
    precheckLoading: "Running precheck...",
    analyzeIdle: "Generate CV Reconstruction Plan",
    analyzeLoading: "Generating plan...",
    continueAnyway: "Continue anyway",
    continueToTailoring: "Continue to Job Tailoring",
    downloadPlan: "Download TXT plan"
  },
  fallbackText: {
    emptyList: "None noted.",
    noMainProblem: "No central problem reported."
  },
  feedback: {
    initial: "Add your CV, then run the evidence precheck before generating a job-specific plan.",
    readyStatus: "Ready",
    cvInputGuidance: "First add the source CV. The app checks whether there is enough evidence before it rewrites anything for a target job.",
    ageWarning:
      "Your study year may reveal more age related information than necessary. For many private sector CVs, especially after several years of experience, it may be better to keep relevant studies but remove completion years or older education details. This is only a warning. You can keep the year if you want.",
    allExperienceWarning:
      "Including all experiences may make the CV too long or reveal unnecessary historical information. Use this only if the older experience is highly relevant to the target role.",
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
  personalDataWarnings: {
    title: "Privacy and bias risk review",
    intro:
      "The CV appears to include personal details that may be unnecessary or risky in many hiring processes. This is a practical warning, not a legal decision. Keep these details only when the target country, sector, or employer explicitly requires them."
  },
  footer: {
    createdByPrefix: "Created by",
    creatorName: "Federico Navarrete",
    creatorUrl: "https://federiconavarrete.com",
    separator: "/",
    contributeText: "Suggest changes on GitHub",
    contributeUrl: "https://github.com/FANMixco/career-signal"
  },
  cvBasics: {
    title: "High impact CV basics",
    subtitle: "A strong CV makes real evidence easy to see.",
    playlistText: "Watch the CV writing playlist",
    playlistUrl: "https://www.youtube.com/watch?v=5coYf7yimMk&list=PL5qnvXALY_bLkOiKmIAok5G1Hgq92PrUm",
    blocks: [
      {
        title: "What strong bullets prove",
        items: [
          "What changed because of your work.",
          "Who or what was affected: users, clients, systems, teams, countries, budgets, risks, or processes.",
          "The scale of the work and why it mattered.",
          "The result: saved time, reduced cost, improved reliability, increased adoption, lowered risk, delivered migration, or supported decisions."
        ]
      },
      {
        title: "Weak activity language",
        items: [
          "Responsible for training teams.",
          "Introduced governance framework.",
          "Supported stakeholders.",
          "Implemented process improvements.",
          "Participated in projects."
        ]
      },
      {
        title: "Stronger evidence pattern",
        text: "Use action, object, scale, purpose, and result. The bullet should survive the question: so what?",
        examples: [
          ["example", "Weak: Trained teams during COVID."],
          [
            "example strong",
            "Stronger: Supported approximately 200 to 300 people per day during peak COVID operations, maintaining patient flow under high pressure conditions."
          ]
        ]
      },
      {
        title: "Before tailoring",
        items: [
          "Recover numbers where they are true and defensible.",
          "Remove or de-emphasize old details that do not help the target role.",
          "Keep studies and credentials only when relevant or required; avoid unnecessary completion years after several years of experience.",
          "Never invent metrics, tools, responsibilities, employers, dates, certifications, or achievements."
        ]
      },
      {
        title: "Sensitive personal details",
        items: [
          "Avoid date of birth, exact age, marital status, family status, gender, citizenship, nationality, full home address, or photo references unless they are explicitly required.",
          "Use location only at the useful level for the role, such as city, country, or work authorization when relevant.",
          "These details can create privacy, discrimination, or age-bias risk and usually do not strengthen the evidence of impact."
        ]
      }
    ]
  },
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
