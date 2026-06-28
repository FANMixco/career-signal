const state = {
  cvText: "",
  precheck: null,
  precheckInFlight: false,
  analysisInFlight: false,
  continueDespiteWeakPrecheck: false,
  downloadableText: ""
};

const config = window.CAREER_SIGNAL_CONFIG;

const els = {
  status: document.querySelector("#status"),
  siteFooterInner: document.querySelector("#siteFooterInner"),
  cvBasicsButton: document.querySelector("#cvBasicsButton"),
  cvBasicsModal: document.querySelector("#cvBasicsModal"),
  cvBasicsBody: document.querySelector("#cvBasicsBody"),
  cvBasicsClose: document.querySelector("#cvBasicsClose"),
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
  aiProvider: document.querySelector("#aiProvider"),
  aiApiKeyLabel: document.querySelector("#aiApiKeyLabel"),
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
  companyDescription: document.querySelector("#companyDescription"),
  targetStyle: document.querySelector("#targetStyle"),
  jobDescription: document.querySelector("#jobDescription"),
  analyzeButton: document.querySelector("#analyzeButton"),
  outputPanel: document.querySelector("#outputPanel"),
  analysisResult: document.querySelector("#analysisResult"),
  downloadButton: document.querySelector("#downloadButton")
};

const API_BASE_URL = config.apiBaseUrl;

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

function configValue(path) {
  return path.split(".").reduce((value, key) => value?.[key], config);
}

function applyConfiguredText() {
  document.querySelectorAll("[data-copy]").forEach((element) => {
    element.textContent = configValue(element.dataset.copy) || "";
  });

  document.querySelectorAll("[data-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", configValue(element.dataset.placeholder) || "");
  });

  els.cvBasicsClose.textContent = config.buttons.closeModal;
  els.cvBasicsClose.setAttribute("aria-label", config.buttons.closeModalLabel);
  renderFooter();
  renderCvBasics();
}

function show(element, visible = true) {
  element.classList.toggle("hidden", !visible);
}

function setModalOpen(isOpen) {
  show(els.cvBasicsModal, isOpen);
  document.body.classList.toggle("modal-open", isOpen);

  if (isOpen) {
    els.cvBasicsClose.focus();
  } else {
    els.cvBasicsButton.focus();
  }
}

function list(items) {
  if (!items || items.length === 0) return `<p>${escapeHtml(config.fallbackText.emptyList)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(String(item))}</li>`).join("")}</ul>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function optionList(options) {
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
}

function renderFooter() {
  els.siteFooterInner.innerHTML = `
    <span>${escapeHtml(config.footer.createdByPrefix)} <a href="${escapeHtml(config.footer.creatorUrl)}" target="_blank" rel="noreferrer">${escapeHtml(config.footer.creatorName)}</a></span>
    <span class="footer-separator" aria-hidden="true">${escapeHtml(config.footer.separator)}</span>
    <a href="${escapeHtml(config.footer.contributeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(config.footer.contributeText)}</a>
  `;
}

function renderCvBasics() {
  const blocks = config.cvBasics.blocks
    .map((block) => {
      const items = block.items ? `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
      const text = block.text ? `<p>${escapeHtml(block.text)}</p>` : "";
      const examples = block.examples
        ? block.examples.map(([className, example]) => `<p class="${escapeHtml(className)}">${escapeHtml(example)}</p>`).join("")
        : "";

      return `<div class="basics-block"><h3>${escapeHtml(block.title)}</h3>${text}${items}${examples}</div>`;
    })
    .join("");

  els.cvBasicsBody.innerHTML = `
    ${blocks}
    <a class="playlist-link" href="${escapeHtml(config.cvBasics.playlistUrl)}" target="_blank" rel="noreferrer">${escapeHtml(config.cvBasics.playlistText)}</a>
  `;
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

  els.tailoringGuidance.textContent = isAllowed ? config.tailoring.guidanceUnlocked : config.tailoring.guidanceLocked;
}

function populateTargetStyles() {
  els.targetStyle.innerHTML = "";
  config.targetStyles.forEach((style) => {
    const option = document.createElement("option");
    option.value = style;
    option.textContent = style;
    els.targetStyle.append(option);
  });
}

function populateStaticSelects() {
  els.aiProvider.innerHTML = optionList(config.options.aiProviders);
  els.hasDegree.innerHTML = optionList(config.options.studiesListed);
  els.experienceSelectionMode.innerHTML = optionList(config.options.experienceSelectionMode);
}

function updateApiKeyCopy() {
  const providerCopy = config.apiKeys[els.aiProvider.value] || config.apiKeys.gemini;
  els.aiApiKeyLabel.textContent = providerCopy.label;
  els.openaiApiKey.setAttribute("placeholder", providerCopy.placeholder);
}

async function runPrecheck() {
  if (state.precheckInFlight) return;

  const form = new FormData();
  const yearsValue = els.yearsOfExperience.value.trim();
  const years = Number(yearsValue);

  if (!yearsValue || Number.isNaN(years)) {
    setStatus("Missing profile");
    setFeedback("error", config.feedback.missingYears);
    els.yearsOfExperience.focus();
    return;
  }

  if (years > 5 && !els.hasDegree.value) {
    setStatus("Missing profile");
    setFeedback("error", config.feedback.missingStudies);
    els.hasDegree.focus();
    return;
  }

  if (years > 5 && els.hasDegree.value === "true" && !els.degreeYear.value.trim()) {
    setStatus("Missing profile");
    setFeedback("error", config.feedback.missingStudyYear);
    els.degreeYear.focus();
    return;
  }

  if (!els.cvText.value.trim() && !els.cvPdf.files[0]) {
    setStatus("Add CV");
    setFeedback("error", config.feedback.missingCv);
    els.cvText.focus();
    return;
  }

  if (els.cvPdf.files[0] && els.cvPdf.files[0].type !== "application/pdf") {
    setStatus("Invalid PDF");
    setFeedback("error", config.feedback.invalidPdf);
    els.cvPdf.focus();
    return;
  }

  if (els.cvPdf.files[0] && els.cvPdf.files[0].size > config.pdfMaxBytes) {
    setStatus("PDF too large");
    setFeedback("error", config.feedback.pdfTooLarge);
    els.cvPdf.focus();
    return;
  }

  if (!els.ageWarning.classList.contains("hidden") && !els.ageWarningAcknowledged.checked) {
    setStatus("Acknowledge warning");
    setFeedback("error", config.feedback.acknowledgeStudyWarning);
    els.ageWarningAcknowledged.focus();
    return;
  }

  form.append("yearsOfExperience", String(years));
  form.append("experienceSelectionMode", els.experienceSelectionMode.value);
  form.append("aiProvider", els.aiProvider.value);
  if (years > 5) form.append("hasDegree", els.hasDegree.value);
  if (els.degreeYear.value) form.append("degreeYear", els.degreeYear.value);
  if (els.cvText.value.trim()) form.append("cvText", els.cvText.value.trim());
  if (els.cvPdf.files[0]) form.append("cvPdf", els.cvPdf.files[0]);
  if (els.openaiApiKey.value.trim()) form.append("aiApiKey", els.openaiApiKey.value.trim());

  state.precheckInFlight = true;
  setBusy(true);
  setStatus("Prechecking");
  setFeedback("loading", config.feedback.precheckLoading(API_BASE_URL));

  try {
    const response = await fetch(apiUrl("/api/precheck-cv"), { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Precheck failed.");

    state.cvText = data.cvText;
    state.precheck = {
      ...data.precheck,
      personalDataWarnings: data.personalDataWarnings || []
    };
    state.continueDespiteWeakPrecheck = false;
    setTailoringAccess(
      false,
      data.precheck.proceedRecommendation === config.recommendations.improve ? config.tailoring.weakLock : config.tailoring.reviewLock
    );
    renderPrecheck(data);
    setStatus("Precheck done");
    setFeedback("success", config.feedback.precheckComplete);
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
  const blocks = config.precheckSections.map(([title, key, type]) => [title, formatPrecheckValue(precheck, key, type)]);
  show(els.precheckPanel);
  els.precheckResult.innerHTML = `
    <div class="score">${precheck.cvEvidenceScore}<span>/ 100</span></div>
    <div class="result-grid">${blocks.map(([title, value]) => renderResultBlock(title, value)).join("")}</div>
    ${data.agePrivacyWarning?.show ? `<p class="warning">${escapeHtml(data.agePrivacyWarning.message)}</p>` : ""}
    ${renderPersonalDataWarnings(data.personalDataWarnings)}
  `;
  renderDecisionGate(precheck.proceedRecommendation, precheck.questionsToRecoverMetrics);
}

function renderPersonalDataWarnings(warnings) {
  if (!warnings || warnings.length === 0) {
    return "";
  }

  return `
    <section class="warning">
      <h3>${escapeHtml(config.personalDataWarnings.title)}</h3>
      <p>${escapeHtml(config.personalDataWarnings.intro)}</p>
      <ul>${warnings.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.warning)}</li>`).join("")}</ul>
    </section>
  `;
}

function formatPrecheckValue(precheck, key, type) {
  const value = precheck[key];

  if (type === "list") {
    return list(value);
  }

  if (type === "mainProblem") {
    return value || config.fallbackText.noMainProblem;
  }

  return value;
}

function renderDecisionGate(recommendation, questions) {
  els.decisionGate.innerHTML = "";
  const improve = document.createElement("button");
  improve.className = recommendation === config.recommendations.improve ? "primary" : "secondary";
  improve.textContent = config.recommendations.improve;
  improve.addEventListener("click", () => {
    els.decisionGate.insertAdjacentHTML("beforeend", `<div class="warning">${list(questions)}</div>`);
  });

  const continueButton = document.createElement("button");
  continueButton.className = recommendation === config.recommendations.improve ? "danger" : "primary";
  continueButton.textContent = recommendation === config.recommendations.improve ? config.buttons.continueAnyway : config.buttons.continueToTailoring;
  continueButton.addEventListener("click", () => {
    state.continueDespiteWeakPrecheck = recommendation === config.recommendations.improve;
    setTailoringAccess(true, recommendation === config.recommendations.improve ? config.tailoring.weakUnlock : "");
    els.tailoringPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (recommendation === config.recommendations.proceed) {
    els.decisionGate.append(continueButton);
  } else if (recommendation === config.recommendations.caution) {
    els.decisionGate.append(continueButton, improve);
  } else {
    const strongWarning = document.createElement("p");
    strongWarning.className = "warning";
    strongWarning.textContent = config.weakCvWarning;
    els.decisionGate.append(strongWarning, improve, continueButton);
  }
}

async function runAnalysis() {
  if (state.analysisInFlight) return;

  if (!state.precheck) {
    setStatus("Run precheck first");
    setFeedback("error", config.feedback.runPrecheckFirst);
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
        aiProvider: els.aiProvider.value,
        aiApiKey: els.openaiApiKey.value.trim(),
        cvText: state.cvText,
        jobDescription: els.jobDescription.value.trim(),
        companyName: els.companyName.value.trim(),
        companyDescription: els.companyDescription.value.trim(),
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
  const blocks = config.analysisSections.map(([title, key, type]) => [title, formatAnalysisValue(analysis, key, type)]);

  els.analysisResult.innerHTML = `<div class="result-grid">${blocks
    .map(([title, value]) => renderResultBlock(title, value))
    .join("")}</div>`;
  els.outputPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderResultBlock(title, value) {
  const html = String(value || "");
  const body = html.trim().startsWith("<") ? html : `<p>${escapeHtml(html)}</p>`;
  return `<div class="result-block"><h3>${escapeHtml(title)}</h3>${body}</div>`;
}

function formatAnalysisValue(analysis, key, type) {
  const value = analysis[key];

  if (type === "list") {
    return list(value);
  }

  if (type === "rewrittenBullets") {
    return list((value || []).map((item) => `${item.rewritten} (${item.integrityClassification})`));
  }

  if (type === "integrityAudit") {
    return list((value || []).map((item) => `${item.recommendation}: ${item.classification}. ${item.explanation}`));
  }

  if (type === "jobFitAssessment") {
    return renderJobFitAssessment(value);
  }

  return value;
}

function renderJobFitAssessment(assessment) {
  if (!assessment) {
    return `<p>${escapeHtml(config.fallbackText.emptyList)}</p>`;
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(assessment.score) || 0)));
  const warning = assessment.companyDecisionWarning || config.jobFitAssessment.warningFallback;

  return `
    <div class="fit-assessment">
      <div class="fit-score">
        <span class="score compact">${score}<span>/ 100</span></span>
        <strong>${escapeHtml(assessment.verdict || config.jobFitAssessment.scoreLabel)}</strong>
      </div>
      <p>${escapeHtml(assessment.explanation || "")}</p>
      <h4>Strongest reasons</h4>
      ${list(assessment.strongestReasons)}
      <h4>Main risks</h4>
      ${list(assessment.mainRisks)}
      <p class="warning">${escapeHtml(warning)}</p>
    </div>
  `;
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
  els.precheckButton.textContent = state.precheckInFlight ? config.buttons.precheckLoading : config.buttons.precheckIdle;
  els.precheckButton.classList.toggle("is-loading", state.precheckInFlight);
  els.analyzeButton.disabled = state.analysisInFlight || els.tailoringPanel.classList.contains("locked");
  els.analyzeButton.textContent = state.analysisInFlight ? config.buttons.analyzeLoading : config.buttons.analyzeIdle;
  els.analyzeButton.classList.toggle("is-loading", state.analysisInFlight);
}

["input", "change"].forEach((eventName) => {
  els.yearsOfExperience.addEventListener(eventName, updateMetadataVisibility);
  els.hasDegree.addEventListener(eventName, updateMetadataVisibility);
  els.degreeYear.addEventListener(eventName, updateMetadataVisibility);
  els.experienceSelectionMode.addEventListener(eventName, updateMetadataVisibility);
});

els.aiProvider.addEventListener("change", updateApiKeyCopy);
els.precheckButton.addEventListener("click", runPrecheck);
els.analyzeButton.addEventListener("click", runAnalysis);
els.downloadButton.addEventListener("click", downloadTxt);
els.cvBasicsButton.addEventListener("click", () => setModalOpen(true));
els.cvBasicsClose.addEventListener("click", () => setModalOpen(false));
els.cvBasicsModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) {
    setModalOpen(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.cvBasicsModal.classList.contains("hidden")) {
    setModalOpen(false);
  }
});
applyConfiguredText();
populateStaticSelects();
populateTargetStyles();
updateApiKeyCopy();
updateMetadataVisibility();
setFeedback("", config.feedback.initial);
setTailoringAccess(false, config.tailoring.initialLock);
