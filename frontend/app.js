const state = {
  cvText: "",
  precheck: null,
  precheckInFlight: false,
  analysisInFlight: false,
  continueDespiteWeakPrecheck: false,
  downloadableText: ""
};

const els = {
  status: document.querySelector("#status"),
  yearsOfExperience: document.querySelector("#yearsOfExperience"),
  degreeWrap: document.querySelector("#degreeWrap"),
  hasDegree: document.querySelector("#hasDegree"),
  degreeYearWrap: document.querySelector("#degreeYearWrap"),
  degreeYear: document.querySelector("#degreeYear"),
  ageWarning: document.querySelector("#ageWarning"),
  allExperienceWarning: document.querySelector("#allExperienceWarning"),
  ageWarningAcknowledged: document.querySelector("#ageWarningAcknowledged"),
  experienceSelectionMode: document.querySelector("#experienceSelectionMode"),
  cvPdf: document.querySelector("#cvPdf"),
  cvText: document.querySelector("#cvText"),
  openaiApiKey: document.querySelector("#openaiApiKey"),
  precheckFeedback: document.querySelector("#precheckFeedback"),
  precheckButton: document.querySelector("#precheckButton"),
  precheckPanel: document.querySelector("#precheckPanel"),
  precheckResult: document.querySelector("#precheckResult"),
  decisionGate: document.querySelector("#decisionGate"),
  tailoringPanel: document.querySelector("#tailoringPanel"),
  tailoringGuidance: document.querySelector("#tailoringGuidance"),
  tailoringLockMessage: document.querySelector("#tailoringLockMessage"),
  companyName: document.querySelector("#companyName"),
  targetStyle: document.querySelector("#targetStyle"),
  jobDescription: document.querySelector("#jobDescription"),
  analyzeButton: document.querySelector("#analyzeButton"),
  outputPanel: document.querySelector("#outputPanel"),
  analysisResult: document.querySelector("#analysisResult"),
  downloadButton: document.querySelector("#downloadButton")
};

const API_BASE_URL = window.location.port === "3001" ? "" : "http://localhost:3001";

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function setStatus(message) {
  els.status.textContent = message;
}

function setFeedback(type, message) {
  els.precheckFeedback.className = `feedback ${type}`;
  els.precheckFeedback.textContent = message;
}

function show(element, visible = true) {
  element.classList.toggle("hidden", !visible);
}

function list(items) {
  if (!items || items.length === 0) return "<p>None noted.</p>";
  return `<ul>${items.map((item) => `<li>${escapeHtml(String(item))}</li>`).join("")}</ul>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function updateMetadataVisibility() {
  const years = Number(els.yearsOfExperience.value || 0);
  show(els.degreeWrap, years > 5);
  show(els.degreeYearWrap, years > 5 && els.hasDegree.value === "true");

  const degreeYear = Number(els.degreeYear.value || 0);
  const showAgeWarning = years > 5 && els.hasDegree.value === "true" && degreeYear && degreeYear < new Date().getFullYear() - 5;
  show(els.ageWarning, Boolean(showAgeWarning));
  show(els.allExperienceWarning, els.experienceSelectionMode.value === "all");
}

function setTailoringAccess(isAllowed, message) {
  els.tailoringPanel.classList.toggle("locked", !isAllowed);
  els.analyzeButton.disabled = !isAllowed;
  els.tailoringLockMessage.textContent = message;
  show(els.tailoringLockMessage, Boolean(message));

  els.tailoringGuidance.textContent = isAllowed
    ? "Use the target company and job description to generate a reconstruction plan grounded in the CV evidence already checked above."
    : "You can add the target company and job description now. Generation unlocks after the CV evidence precheck, or after you explicitly choose to continue despite a weak precheck.";
}

async function runPrecheck() {
  if (state.precheckInFlight) return;

  const form = new FormData();
  const yearsValue = els.yearsOfExperience.value.trim();
  const years = Number(yearsValue);

  if (!yearsValue || Number.isNaN(years)) {
    setStatus("Missing profile");
    setFeedback("error", "Enter your years of professional experience before running the precheck.");
    els.yearsOfExperience.focus();
    return;
  }

  if (years > 5 && !els.hasDegree.value) {
    setStatus("Missing profile");
    setFeedback("error", "Select whether you list studies or education on your CV before running the precheck.");
    els.hasDegree.focus();
    return;
  }

  if (years > 5 && els.hasDegree.value === "true" && !els.degreeYear.value.trim()) {
    setStatus("Missing profile");
    setFeedback("error", "Enter the study completion year, or select No if you do not list studies or education.");
    els.degreeYear.focus();
    return;
  }

  if (!els.cvText.value.trim() && !els.cvPdf.files[0]) {
    setStatus("Add CV");
    setFeedback("error", "Add a LinkedIn PDF or paste complete CV text before running the precheck.");
    els.cvText.focus();
    return;
  }

  if (els.cvPdf.files[0] && els.cvPdf.files[0].type !== "application/pdf") {
    setStatus("Invalid PDF");
    setFeedback("error", "Only PDF uploads are supported. Choose a LinkedIn PDF export or paste CV text instead.");
    els.cvPdf.focus();
    return;
  }

  if (els.cvPdf.files[0] && els.cvPdf.files[0].size > 5 * 1024 * 1024) {
    setStatus("PDF too large");
    setFeedback("error", "The PDF is larger than 5MB. Paste the CV text manually or upload a smaller PDF.");
    els.cvPdf.focus();
    return;
  }

  if (!els.ageWarning.classList.contains("hidden") && !els.ageWarningAcknowledged.checked) {
    setStatus("Acknowledge warning");
    setFeedback("error", "Acknowledge the study-year privacy warning before continuing.");
    els.ageWarningAcknowledged.focus();
    return;
  }

  form.append("yearsOfExperience", String(years));
  form.append("experienceSelectionMode", els.experienceSelectionMode.value);
  if (years > 5) form.append("hasDegree", els.hasDegree.value);
  if (els.degreeYear.value) form.append("degreeYear", els.degreeYear.value);
  if (els.cvText.value.trim()) form.append("cvText", els.cvText.value.trim());
  if (els.cvPdf.files[0]) form.append("cvPdf", els.cvPdf.files[0]);
  if (els.openaiApiKey.value.trim()) form.append("openaiApiKey", els.openaiApiKey.value.trim());

  state.precheckInFlight = true;
  setBusy(true);
  setStatus("Prechecking");
  setFeedback(
    "loading",
    `Running CV Evidence Precheck against ${API_BASE_URL || "this server"}. This can take a little while while the model reviews the CV evidence.`
  );

  try {
    const response = await fetch(apiUrl("/api/precheck-cv"), { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Precheck failed.");

    state.cvText = data.cvText;
    state.precheck = data.precheck;
    state.continueDespiteWeakPrecheck = false;
    setTailoringAccess(
      false,
      data.precheck.proceedRecommendation === "Improve CV first"
        ? "The precheck recommends improving the CV first. Choose Continue anyway below to unlock generation."
        : "Review the precheck result, then choose Continue to Job Tailoring below to unlock generation."
    );
    renderPrecheck(data);
    setStatus("Precheck done");
    setFeedback("success", "Precheck complete. Review the score and choose the next action below.");
  } catch (error) {
    setStatus("Error");
    setFeedback("error", error.message);
  } finally {
    state.precheckInFlight = false;
    setBusy(false);
  }
}

function renderPrecheck(data) {
  const precheck = data.precheck;
  show(els.precheckPanel);
  els.precheckResult.innerHTML = `
    <div class="score">${precheck.cvEvidenceScore}<span>/ 100</span></div>
    <div class="result-grid">
      <div class="result-block"><h3>Recommendation</h3><p>${escapeHtml(precheck.proceedRecommendation)}</p></div>
      <div class="result-block"><h3>Main problem</h3><p>${escapeHtml(precheck.mainProblem || "No central problem reported.")}</p></div>
      <div class="result-block"><h3>Specific warnings</h3>${list(precheck.specificWarnings)}</div>
      <div class="result-block"><h3>Missing evidence types</h3>${list(precheck.missingEvidenceTypes)}</div>
      <div class="result-block"><h3>Weak bullet examples</h3>${list(precheck.examplesOfWeakBullets)}</div>
      <div class="result-block"><h3>Questions to recover metrics</h3>${list(precheck.questionsToRecoverMetrics)}</div>
    </div>
    ${data.agePrivacyWarning?.show ? `<p class="warning">${escapeHtml(data.agePrivacyWarning.message)}</p>` : ""}
  `;
  renderDecisionGate(precheck.proceedRecommendation, precheck.questionsToRecoverMetrics);
}

function renderDecisionGate(recommendation, questions) {
  els.decisionGate.innerHTML = "";
  const improve = document.createElement("button");
  improve.className = recommendation === "Improve CV first" ? "primary" : "secondary";
  improve.textContent = "Improve CV first";
  improve.addEventListener("click", () => {
    els.decisionGate.insertAdjacentHTML("beforeend", `<div class="warning">${list(questions)}</div>`);
  });

  const continueButton = document.createElement("button");
  continueButton.className = recommendation === "Improve CV first" ? "danger" : "primary";
  continueButton.textContent = recommendation === "Improve CV first" ? "Continue anyway" : "Continue to Job Tailoring";
  continueButton.addEventListener("click", () => {
    state.continueDespiteWeakPrecheck = recommendation === "Improve CV first";
    setTailoringAccess(true, recommendation === "Improve CV first" ? "Unlocked because you chose to continue despite the weak CV warning." : "");
    els.tailoringPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (recommendation === "Proceed") {
    els.decisionGate.append(continueButton);
  } else if (recommendation === "Proceed with caution") {
    els.decisionGate.append(continueButton, improve);
  } else {
    const strongWarning = document.createElement("p");
    strongWarning.className = "warning";
    strongWarning.textContent =
      "This CV appears to contain mostly descriptions of responsibilities rather than measurable results. Tailoring it to a job description now may produce a better looking document, but it will not solve the core problem. Add concrete outcomes and numerical evidence first.";
    els.decisionGate.append(strongWarning, improve, continueButton);
  }
}

async function runAnalysis() {
  if (state.analysisInFlight) return;

  if (!state.precheck) {
    setStatus("Run precheck first");
    setFeedback("error", "Run the CV Evidence Precheck before generating the reconstruction plan.");
    return;
  }

  state.analysisInFlight = true;
  setBusy(true);
  setStatus("Tailoring");

  try {
    const response = await fetch(apiUrl("/api/analyze-cv"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openaiApiKey: els.openaiApiKey.value.trim(),
        cvText: state.cvText,
        jobDescription: els.jobDescription.value.trim(),
        companyName: els.companyName.value.trim(),
        targetStyle: els.targetStyle.value,
        experienceSelectionMode: els.experienceSelectionMode.value,
        precheckResult: state.precheck,
        continueDespiteWeakPrecheck: state.continueDespiteWeakPrecheck
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Analysis failed.");

    state.downloadableText = data.downloadableText;
    renderAnalysis(data.analysis);
    setStatus("Plan ready");
  } catch (error) {
    setStatus("Error");
    setFeedback("error", error.message);
  } finally {
    state.analysisInFlight = false;
    setBusy(false);
  }
}

function renderAnalysis(analysis) {
  show(els.outputPanel);
  const blocks = [
    ["Role diagnosis", analysis.roleDiagnosis],
    ["Company signal interpretation", analysis.companySignalInterpretation],
    ["Candidate positioning", analysis.candidatePositioning],
    ["Strongest matching evidence", list(analysis.strongestMatchingEvidence)],
    ["Weak or missing signals", list(analysis.weakOrMissingSignals)],
    ["Keywords to include", list(analysis.keywordsToInclude)],
    ["Keywords to avoid", list(analysis.keywordsToAvoid)],
    ["Suggested professional summary", analysis.suggestedProfessionalSummary],
    ["Rewritten CV bullets", list((analysis.rewrittenCvBullets || []).map((item) => `${item.rewritten} (${item.integrityClassification})`))],
    ["Suggested CV structure", list(analysis.suggestedCvStructure)],
    ["ATS friendly skills section", list(analysis.atsFriendlySkillsSection)],
    ["Recruiter interpretation", analysis.recruiterInterpretation],
    ["Final reconstruction plan", list(analysis.finalReconstructionPlan)],
    ["Integrity audit", list((analysis.integrityAudit || []).map((item) => `${item.recommendation}: ${item.classification}. ${item.explanation}`))],
    ["Precheck warning summary", analysis.precheckWarningSummary]
  ];

  els.analysisResult.innerHTML = `<div class="result-grid">${blocks
    .map(([title, value]) => `<div class="result-block"><h3>${title}</h3>${String(value).startsWith("<") ? value : `<p>${escapeHtml(String(value || ""))}</p>`}</div>`)
    .join("")}</div>`;
  els.outputPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function downloadTxt() {
  const company = els.companyName.value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "company";
  const blob = new Blob([state.downloadableText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cv-reconstruction-plan-${company}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function setBusy(isBusy) {
  els.precheckButton.disabled = state.precheckInFlight;
  els.precheckButton.textContent = state.precheckInFlight ? "Running precheck..." : "Run CV Evidence Precheck";
  els.precheckButton.classList.toggle("is-loading", state.precheckInFlight);
  els.analyzeButton.disabled = state.analysisInFlight || els.tailoringPanel.classList.contains("locked");
  els.analyzeButton.textContent = state.analysisInFlight ? "Generating plan..." : "Generate CV Reconstruction Plan";
  els.analyzeButton.classList.toggle("is-loading", state.analysisInFlight);
}

["input", "change"].forEach((eventName) => {
  els.yearsOfExperience.addEventListener(eventName, updateMetadataVisibility);
  els.hasDegree.addEventListener(eventName, updateMetadataVisibility);
  els.degreeYear.addEventListener(eventName, updateMetadataVisibility);
  els.experienceSelectionMode.addEventListener(eventName, updateMetadataVisibility);
});

els.precheckButton.addEventListener("click", runPrecheck);
els.analyzeButton.addEventListener("click", runAnalysis);
els.downloadButton.addEventListener("click", downloadTxt);
updateMetadataVisibility();
setTailoringAccess(false, "Run the CV Evidence Precheck first. This keeps the tailoring step from polishing weak or unsupported claims.");
