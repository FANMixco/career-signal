// Browser controller for the single-page app.
// This file wires DOM state, validation, API calls, and rendering. Product copy
// and visible rules should stay in config.js unless the behavior itself changes.
const state = {
  cvText: "",
  precheck: null,
  precheckSignature: "",
  precheckInFlight: false,
  analysisInFlight: false,
  continueDespiteWeakPrecheck: false,
  lastPrecheckPayload: null,
  lastAnalysis: null,
  customAiModels: {},
  currentAiProvider: "",
  downloadableText: "",
  appHelpTab: "use"
};

const baseConfig = window.CAREER_SIGNAL_CONFIG;
let config = baseConfig;
const backendStorageKey = baseConfig.backendSettings.storageKey;
const languageStorageKey = "careerSignalLanguage";

const els = {
  status: document.querySelector("#status"),
  siteFooterInner: document.querySelector("#siteFooterInner"),
  shareButton: document.querySelector("#shareButton"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsModal: document.querySelector("#settingsModal"),
  settingsClose: document.querySelector("#settingsClose"),
  backendUrlInput: document.querySelector("#backendUrlInput"),
  backendUrlCurrent: document.querySelector("#backendUrlCurrent"),
  backendSettingsFeedback: document.querySelector("#backendSettingsFeedback"),
  saveBackendUrlButton: document.querySelector("#saveBackendUrlButton"),
  testBackendUrlButton: document.querySelector("#testBackendUrlButton"),
  resetBackendUrlButton: document.querySelector("#resetBackendUrlButton"),
  previewWarning: document.querySelector("#previewWarning"),
  previewSettingsButton: document.querySelector("#previewSettingsButton"),
  appHelpButton: document.querySelector("#appHelpButton"),
  appHelpModal: document.querySelector("#appHelpModal"),
  appHelpTabs: document.querySelector("#appHelpTabs"),
  appHelpBody: document.querySelector("#appHelpBody"),
  appHelpClose: document.querySelector("#appHelpClose"),
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
  outputLanguage: document.querySelector("#outputLanguage"),
  cvPdf: document.querySelector("#cvPdf"),
  cvText: document.querySelector("#cvText"),
  importJsonFile: document.querySelector("#importJsonFile"),
  importJsonButton: document.querySelector("#importJsonButton"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  loadDemoProfileButton: document.querySelector("#loadDemoProfileButton"),
  importExportFeedback: document.querySelector("#importExportFeedback"),
  aiProvider: document.querySelector("#aiProvider"),
  aiModel: document.querySelector("#aiModel"),
  ollamaCustomModelField: document.querySelector("#ollamaCustomModelField"),
  ollamaCustomModel: document.querySelector("#ollamaCustomModel"),
  aiApiKeyLabel: document.querySelector("#aiApiKeyLabel"),
  openaiApiKey: document.querySelector("#openaiApiKey"),
  apiKeyHelpLink: document.querySelector("#apiKeyHelpLink"),
  ollamaUrlField: document.querySelector("#ollamaUrlField"),
  ollamaBaseUrl: document.querySelector("#ollamaBaseUrl"),
  ollamaGuidance: document.querySelector("#ollamaGuidance"),
  precheckFeedback: document.querySelector("#precheckFeedback"),
  precheckButton: document.querySelector("#precheckButton"),
  precheckPanel: document.querySelector("#precheckPanel"),
  precheckResult: document.querySelector("#precheckResult"),
  decisionGate: document.querySelector("#decisionGate"),
  tailoringPanel: document.querySelector("#tailoringPanel"),
  tailoringGuidance: document.querySelector("#tailoringGuidance"),
  tailoringLockMessage: document.querySelector("#tailoringLockMessage"),
  tailoringFeedback: document.querySelector("#tailoringFeedback"),
  companyName: document.querySelector("#companyName"),
  companyDescription: document.querySelector("#companyDescription"),
  jobPosition: document.querySelector("#jobPosition"),
  targetStyle: document.querySelector("#targetStyle"),
  jobDescription: document.querySelector("#jobDescription"),
  analyzeButton: document.querySelector("#analyzeButton"),
  outputPanel: document.querySelector("#outputPanel"),
  analysisResult: document.querySelector("#analysisResult"),
  downloadButton: document.querySelector("#downloadButton")
};

let API_BASE_URL = storedBackendUrl() || baseConfig.apiBaseUrl;

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function isGitHubPagesPreview() {
  return window.location.hostname === "fanmixco.github.io" && window.location.pathname.startsWith("/career-signal/frontend");
}

function isLocalhostPage() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function storedBackendUrl() {
  return localStorage.getItem(backendStorageKey) || "";
}

function normalizeBackendUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function isLocalHttpBackend(url) {
  return /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|10\.0\.2\.2|10\.0\.3\.2)(?::\d+)?$/i.test(url);
}

function validateBackendUrl(value) {
  const normalized = normalizeBackendUrl(value);

  if (!normalized) {
    return { ok: false, message: config.backendSettings.emptyUrl };
  }

  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { ok: false, message: config.backendSettings.invalidUrl };
    }

    if (window.location.protocol === "https:" && parsed.protocol === "http:" && !isLocalHttpBackend(normalized)) {
      return { ok: false, message: config.backendSettings.httpsRequired };
    }

    return { ok: true, url: normalized };
  } catch {
    return { ok: false, message: config.backendSettings.invalidUrl };
  }
}

function setStatus(message) {
  els.status.textContent = config.statusMessages?.[message] || message;
}

function setFeedback(type, message) {
  els.precheckFeedback.className = `feedback ${type}`;
  els.precheckFeedback.textContent = message;
}

function setTailoringFeedback(type, message) {
  els.tailoringFeedback.className = `feedback ${type}`;
  els.tailoringFeedback.textContent = message;
  show(els.tailoringFeedback, Boolean(message));
}

function setImportExportFeedback(type, message) {
  els.importExportFeedback.className = `feedback ${type}`;
  els.importExportFeedback.textContent = message;
  show(els.importExportFeedback, Boolean(message));
}

function clearAnalysisReview() {
  state.downloadableText = "";
  state.lastAnalysis = null;
  els.analysisResult.innerHTML = "";
  show(els.outputPanel, false);
  setTailoringFeedback("", "");
}

function clearPrecheckReview() {
  state.precheck = null;
  state.precheckSignature = "";
  state.continueDespiteWeakPrecheck = false;
  state.lastPrecheckPayload = null;
  els.precheckResult.innerHTML = "";
  els.decisionGate.innerHTML = "";
  show(els.precheckPanel, false);
  clearAnalysisReview();
}

function setBackendSettingsFeedback(type, message) {
  els.backendSettingsFeedback.className = `feedback ${type}`;
  els.backendSettingsFeedback.textContent = message;
  show(els.backendSettingsFeedback, Boolean(message));
}

function analysisErrorMessage(error) {
  if (error instanceof TypeError) {
    return config.errorMessages.apiAnalyzeUnreachable;
  }

  if (error?.name === "AbortError" || /aborted/i.test(error?.message || "")) {
    return config.ollama.timeoutMessage;
  }

  return error?.message || config.errorMessages.reconstructionFailed;
}

// Local Ollama reconstruction can return a useful partial result if one section
// times out. Detect that case so the UI warns without hiding completed sections.
function isPartialLocalAnalysis(analysis) {
  const warningText = `${analysis?.precheckWarningSummary || ""} ${(analysis?.finalReconstructionPlan || []).join(" ")}`;
  return /partial local result|did not complete|took too long/i.test(warningText);
}

function configValue(path) {
  return path.split(".").reduce((value, key) => value?.[key], config);
}

function mergeConfig(base, override) {
  if (!override || typeof override !== "object") return base;

  const output = Array.isArray(base) ? [...base] : { ...base };
  Object.entries(override).forEach(([key, value]) => {
    const current = output[key];
    output[key] =
      current &&
      value &&
      typeof current === "object" &&
      typeof value === "object" &&
      !Array.isArray(current) &&
      !Array.isArray(value)
        ? mergeConfig(current, value)
        : value;
  });
  return output;
}

function setActiveLanguage(language) {
  config = mergeConfig(baseConfig, baseConfig.translations?.[language] || {});
}

function supportedLanguageCodes() {
  return (baseConfig.options.outputLanguages || []).map(([code]) => code);
}

function normalizeLanguage(language) {
  const code = String(language || "").toLowerCase().split("-")[0];
  return supportedLanguageCodes().includes(code) ? code : "en";
}

function preferredLanguage() {
  const savedLanguage = normalizeLanguage(localStorage.getItem(languageStorageKey));
  if (localStorage.getItem(languageStorageKey)) return savedLanguage;

  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const detected = browserLanguages.map(normalizeLanguage).find((language) => language !== "en");
  return detected || normalizeLanguage(browserLanguages[0]) || "en";
}

function refreshLanguage() {
  const selectedLanguage = els.outputLanguage.value || "en";
  const values = {
    aiProvider: els.aiProvider.value,
    aiModel: els.aiModel.value,
    hasDegree: els.hasDegree.value,
    experienceSelectionMode: els.experienceSelectionMode.value,
    targetStyle: els.targetStyle.value
  };

  setActiveLanguage(selectedLanguage);
  applyConfiguredText();
  populateStaticSelects();
  populateAiModels();
  populateTargetStyles();

  els.outputLanguage.value = selectedLanguage;
  els.aiProvider.value = values.aiProvider || els.aiProvider.value;
  populateAiModels();
  els.aiModel.value = values.aiModel || els.aiModel.value;
  els.hasDegree.value = values.hasDegree;
  els.experienceSelectionMode.value = values.experienceSelectionMode || els.experienceSelectionMode.value;
  els.targetStyle.value = values.targetStyle || els.targetStyle.value;

  updateApiKeyCopy();
  updateMetadataVisibility();
  setFeedback("", state.precheck ? config.feedback.precheckComplete : config.feedback.initial);
  renderCurrentOutputs();
  refreshTailoringLockCopy();
  setBusy(state.precheckInFlight || state.analysisInFlight);
}

function refreshTailoringLockCopy() {
  const isAllowed = !els.tailoringPanel.classList.contains("locked");
  if (isAllowed) {
    setTailoringAccess(true, state.continueDespiteWeakPrecheck ? config.tailoring.weakUnlock : "");
    return;
  }

  if (!state.precheck) {
    setTailoringAccess(false, config.tailoring.initialLock);
    return;
  }

  const message =
    state.precheck.proceedRecommendation === baseConfig.recommendations.improve
      ? config.tailoring.weakLock
      : config.tailoring.reviewLock;
  setTailoringAccess(false, message);
}

function renderCurrentOutputs() {
  if (state.lastPrecheckPayload) {
    renderPrecheck(state.lastPrecheckPayload);
  }

  if (state.lastAnalysis) {
    renderAnalysis(state.lastAnalysis, { scroll: false });
  }
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
  els.shareButton.setAttribute("aria-label", config.buttons.shareLabel);
  els.shareButton.setAttribute("title", config.buttons.shareLabel);
  els.settingsButton.setAttribute("aria-label", config.buttons.settingsLabel);
  els.settingsClose.textContent = config.buttons.closeModal;
  els.settingsClose.setAttribute("aria-label", config.buttons.closeSettingsLabel);
  els.appHelpButton.setAttribute("aria-label", config.buttons.appHelpLabel);
  els.appHelpClose.textContent = config.buttons.closeModal;
  els.appHelpClose.setAttribute("aria-label", config.buttons.closeHelpLabel);
  renderFooter();
  renderAppHelp();
  renderCvBasics();
  renderBackendSettings();
  show(els.previewWarning, isGitHubPagesPreview());
  refreshDemoProfileVisibility();
}

function show(element, visible = true) {
  element.classList.toggle("hidden", !visible);
}

function isAnyModalOpen() {
  return (
    !els.settingsModal.classList.contains("hidden") ||
    !els.cvBasicsModal.classList.contains("hidden") ||
    !els.appHelpModal.classList.contains("hidden")
  );
}

function setModalOpen(modal, trigger, closeButton, isOpen) {
  show(modal, isOpen);
  document.body.classList.toggle("modal-open", isAnyModalOpen());

  if (isOpen) {
    closeButton.focus();
  } else if (trigger) {
    trigger.focus();
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

function localizedTitle(title) {
  return config.localizedSectionTitles?.[title] || title;
}

function renderFooter() {
  const version = config.footer.version ? `
    <span class="footer-separator" aria-hidden="true">${escapeHtml(config.footer.separator)}</span>
    <span>${escapeHtml(`v${config.footer.version}`)}</span>
  ` : "";

  els.siteFooterInner.innerHTML = `
    <span>${escapeHtml(config.footer.createdByPrefix)} <a href="${escapeHtml(config.footer.creatorUrl)}" target="_blank" rel="noreferrer">${escapeHtml(config.footer.creatorName)}</a></span>
    <span class="footer-separator" aria-hidden="true">${escapeHtml(config.footer.separator)}</span>
    <a href="${escapeHtml(config.footer.contributeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(config.footer.contributeText)}</a>
    ${version}
  `;
}

function renderLinks(links = []) {
  if (!links.length) return "";
  return `<div class="help-links">${links
    .map(([label, href]) => `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`)
    .join("")}</div>`;
}

function renderHelpBlocks(blocks) {
  return blocks
    .map((block) => {
      const text = block.text ? `<p>${escapeHtml(block.text)}</p>` : "";
      const items = block.items ? `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
      const links = renderLinks(block.links);

      return `<div class="help-block"><h3>${escapeHtml(block.title)}</h3>${text}${items}${links}</div>`;
    })
    .join("");
}

function renderAppHelp() {
  const tabs = config.appHelp.tabs;
  const activeTab = tabs.find((tab) => tab.id === state.appHelpTab) || tabs[0];
  state.appHelpTab = activeTab.id;

  els.appHelpTabs.innerHTML = tabs
    .map(
      (tab) => `
        <button
          class="tab-button ${tab.id === activeTab.id ? "is-active" : ""}"
          type="button"
          role="tab"
          aria-selected="${tab.id === activeTab.id}"
          data-help-tab="${escapeHtml(tab.id)}"
        >${escapeHtml(tab.label)}</button>
      `
    )
    .join("");

  els.appHelpBody.innerHTML = renderHelpBlocks(activeTab.blocks);
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

function setSelectValue(select, value) {
  if (value === undefined || value === null) return;
  const normalizedValue = String(value);
  if ([...select.options].some((option) => option.value === normalizedValue)) {
    select.value = normalizedValue;
  }
}

function currentFormSnapshot() {
  return {
    profile: {
      yearsOfExperience: els.yearsOfExperience.value.trim(),
      hasDegree: els.hasDegree.value,
      degreeYear: els.degreeYear.value.trim(),
      ageWarningAcknowledged: els.ageWarningAcknowledged.checked,
      experienceSelectionMode: els.experienceSelectionMode.value,
      outputLanguage: els.outputLanguage.value
    },
    cvText: state.cvText || els.cvText.value.trim(),
    pastedCvText: els.cvText.value.trim(),
    aiSettings: {
      provider: els.aiProvider.value,
      model: selectedAiModel(),
      selectedModelOption: els.aiModel.value,
      customModels: state.customAiModels,
      ollamaBaseUrl: els.ollamaBaseUrl.value.trim()
    },
    tailoring: {
      companyName: els.companyName.value.trim(),
      companyDescription: els.companyDescription.value.trim(),
      jobPosition: els.jobPosition.value.trim(),
      jobDescription: els.jobDescription.value.trim(),
      targetStyle: els.targetStyle.value,
      unlocked: !els.tailoringPanel.classList.contains("locked"),
      continueDespiteWeakPrecheck: state.continueDespiteWeakPrecheck
    }
  };
}

function buildExportBundle() {
  return {
    schema: "career-signal-session",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: config.footer?.version || "",
    inputs: currentFormSnapshot(),
    outputs: {
      precheck: state.precheck,
      precheckPayload: state.lastPrecheckPayload,
      precheckSignature: state.precheckSignature,
      evidenceRecoveryTips: state.precheck ? buildEvidenceRecoveryExamples() : null,
      analysis: state.lastAnalysis,
      downloadableText: state.downloadableText
    },
    notes: {
      apiKeysExcluded: true,
      pdfFileExcluded: true,
      jobPositionFrontendOnly: true
    }
  };
}

function filenameTimestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, "");
}

function downloadJson() {
  const bundle = buildExportBundle();
  const company = els.companyName.value.trim() || els.jobPosition.value.trim() || "career-signal";
  const safeName = company.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "career-signal";
  const timestamp = filenameTimestamp();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}-career-signal-session-${timestamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setImportExportFeedback("success", config.feedback.exportJsonComplete);
}

function demoProfileUrls() {
  const samplePath = config.demoProfile?.path || "sample/bain-company-career-signal-session-20260712T082827Z.json";
  const candidates = new Set([samplePath, `../${samplePath}`, `/${samplePath}`]);
  const frontendPathIndex = window.location.pathname.indexOf("/frontend");

  if (frontendPathIndex >= 0) {
    candidates.add(`${window.location.pathname.slice(0, frontendPathIndex)}/${samplePath}`);
  }

  return [...candidates];
}

function shouldShowDemoProfileButton() {
  return isGitHubPagesPreview() || isLocalhostPage();
}

function refreshDemoProfileVisibility() {
  show(els.loadDemoProfileButton, shouldShowDemoProfileButton());
}

async function loadDemoProfile() {
  setImportExportFeedback("loading", config.feedback.demoProfileLoading);

  for (const url of demoProfileUrls()) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const bundle = await response.json();
      applyImportedSession(bundle);
      setImportExportFeedback("success", config.feedback.demoProfileComplete);
      return;
    } catch {
      // Try the next candidate path.
    }
  }

  setImportExportFeedback("error", config.errorMessages.demoProfileFailed);
}

function applyImportedSession(bundle) {
  if (!bundle || typeof bundle !== "object") {
    throw new Error(config.errorMessages.invalidJsonImport);
  }

  const inputs = bundle.inputs || {};
  const profile = inputs.profile || {};
  const tailoring = inputs.tailoring || {};
  const aiSettings = inputs.aiSettings || {};
  const outputs = bundle.outputs || {};
  const language = normalizeLanguage(profile.outputLanguage || inputs.outputLanguage || els.outputLanguage.value);

  setActiveLanguage(language);
  localStorage.setItem(languageStorageKey, language);
  applyConfiguredText();
  populateStaticSelects();
  els.outputLanguage.value = language;

  setSelectValue(els.aiProvider, aiSettings.provider || inputs.aiProvider);
  populateAiModels();
  state.customAiModels = aiSettings.customModels && typeof aiSettings.customModels === "object" ? { ...aiSettings.customModels } : {};
  const importedModel = aiSettings.selectedModelOption || aiSettings.model || inputs.aiModel;
  if (importedModel && ![...els.aiModel.options].some((option) => option.value === String(importedModel))) {
    state.customAiModels[els.aiProvider.value] = String(aiSettings.model || importedModel);
    els.aiModel.value = "__custom__";
  } else {
    setSelectValue(els.aiModel, importedModel);
  }
  restoreCustomModel();
  if (aiSettings.model && isCustomModelSelected()) {
    els.ollamaCustomModel.value = aiSettings.model;
    state.customAiModels[els.aiProvider.value] = aiSettings.model;
  }
  els.ollamaBaseUrl.value = aiSettings.ollamaBaseUrl || els.ollamaBaseUrl.value;
  state.currentAiProvider = els.aiProvider.value;
  updateApiKeyCopy();

  populateTargetStyles();
  els.yearsOfExperience.value = profile.yearsOfExperience ?? "";
  setSelectValue(els.hasDegree, profile.hasDegree);
  els.degreeYear.value = profile.degreeYear ?? "";
  els.ageWarningAcknowledged.checked = Boolean(profile.ageWarningAcknowledged);
  setSelectValue(els.experienceSelectionMode, profile.experienceSelectionMode);
  setSelectValue(els.targetStyle, tailoring.targetStyle);
  els.companyName.value = tailoring.companyName || "";
  els.companyDescription.value = tailoring.companyDescription || "";
  els.jobPosition.value = tailoring.jobPosition || "";
  els.jobDescription.value = tailoring.jobDescription || "";

  const importedCvText = inputs.cvText || inputs.pastedCvText || outputs.precheckPayload?.cvText || "";
  els.cvText.value = importedCvText;
  els.cvPdf.value = "";
  state.cvText = importedCvText;
  updateMetadataVisibility();

  state.precheck = outputs.precheck || outputs.precheckPayload?.precheck || null;
  state.lastPrecheckPayload = state.precheck
    ? {
        cvText: importedCvText,
        ...outputs.precheckPayload,
        precheck: state.precheck,
        personalDataWarnings: outputs.precheckPayload?.personalDataWarnings || state.precheck.personalDataWarnings || []
      }
    : null;
  state.precheckSignature = state.precheck ? currentPrecheckSignature() : "";
  state.continueDespiteWeakPrecheck = Boolean(tailoring.continueDespiteWeakPrecheck);
  state.lastAnalysis = outputs.analysis || null;
  state.downloadableText = outputs.downloadableText || "";

  els.precheckResult.innerHTML = "";
  els.decisionGate.innerHTML = "";
  els.analysisResult.innerHTML = "";
  show(els.precheckPanel, false);
  show(els.outputPanel, false);

  if (state.lastPrecheckPayload) {
    renderPrecheck(state.lastPrecheckPayload);
  }

  if (state.precheck && (tailoring.unlocked || state.lastAnalysis)) {
    setTailoringAccess(true, state.continueDespiteWeakPrecheck ? config.tailoring.weakUnlock : "");
  } else if (state.precheck) {
    const lockMessage =
      state.precheck.proceedRecommendation === baseConfig.recommendations.improve ? config.tailoring.weakLock : config.tailoring.reviewLock;
    setTailoringAccess(false, lockMessage);
  } else {
    setTailoringAccess(false, config.tailoring.initialLock);
  }

  if (state.lastAnalysis) {
    renderAnalysis(state.lastAnalysis, { scroll: false });
    setTailoringFeedback("success", config.feedback.importJsonAnalysisReady);
  } else {
    setTailoringFeedback("", "");
  }

  setFeedback("", state.precheck ? config.feedback.precheckComplete : config.feedback.initial);
  setStatus(state.lastAnalysis ? "Plan ready" : state.precheck ? "Precheck done" : "ready");
  setBusy(false);
}

async function importJsonFile() {
  const file = els.importJsonFile.files[0];
  if (!file) return;

  try {
    const bundle = JSON.parse(await file.text());
    applyImportedSession(bundle);
    setImportExportFeedback("success", config.feedback.importJsonComplete);
  } catch (error) {
    setImportExportFeedback("error", error?.message || config.errorMessages.invalidJsonImport);
  } finally {
    els.importJsonFile.value = "";
  }
}

function currentPrecheckSignature() {
  const file = els.cvPdf.files[0];
  const fileSignature = file ? `${file.name}:${file.size}:${file.lastModified}` : "";
  return JSON.stringify({
    yearsOfExperience: els.yearsOfExperience.value.trim(),
    hasDegree: els.hasDegree.value,
    degreeYear: els.degreeYear.value.trim(),
    experienceSelectionMode: els.experienceSelectionMode.value,
    outputLanguage: els.outputLanguage.value,
    cvText: els.cvText.value.trim(),
    cvPdf: fileSignature
  });
}

function renderBackendSettings() {
  const current = API_BASE_URL || config.backendSettings.defaultBackend;
  els.backendUrlInput.value = storedBackendUrl();
  els.backendUrlCurrent.textContent = `${config.backendSettings.currentPrefix} ${current}`;
}

function saveBackendUrl() {
  const validation = validateBackendUrl(els.backendUrlInput.value);

  if (!validation.ok) {
    setBackendSettingsFeedback("error", validation.message);
    els.backendUrlInput.focus();
    return;
  }

  localStorage.setItem(backendStorageKey, validation.url);
  API_BASE_URL = validation.url;
  renderBackendSettings();
  setBackendSettingsFeedback("success", config.backendSettings.saved);
}

function resetBackendUrl() {
  localStorage.removeItem(backendStorageKey);
  API_BASE_URL = baseConfig.apiBaseUrl;
  renderBackendSettings();
  setBackendSettingsFeedback("success", config.backendSettings.resetDone);
}

async function testBackendUrl() {
  const validation = els.backendUrlInput.value.trim()
    ? validateBackendUrl(els.backendUrlInput.value)
    : { ok: true, url: API_BASE_URL };

  if (!validation.ok) {
    setBackendSettingsFeedback("error", validation.message);
    els.backendUrlInput.focus();
    return;
  }

  const testBaseUrl = validation.url || "";
  setBackendSettingsFeedback("loading", config.backendSettings.testing);

  try {
    const response = await fetch(`${testBaseUrl}/api/health`);
    if (!response.ok) throw new Error(config.errorMessages.healthCheckFailed);
    setBackendSettingsFeedback("success", config.backendSettings.testSuccess);
  } catch {
    setBackendSettingsFeedback("error", config.backendSettings.testFailed);
  }
}

async function shareApp() {
  const shareData = {
    title: config.site.title,
    text: config.share.text,
    url: config.share.url
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  window.open(config.share.url, "_blank", "noopener,noreferrer");
}

// A successful precheck only applies to the exact CV/profile inputs that were
// reviewed. If the user changes those inputs, lock tailoring until a fresh
// precheck prevents polishing stale or unsupported evidence.
function invalidatePrecheckIfSourceChanged() {
  if (!state.precheck || state.precheckInFlight) return;
  const signature = currentPrecheckSignature();
  if (signature === state.precheckSignature) return;

  clearPrecheckReview();
  setTailoringAccess(false, config.tailoring.staleLock);
  setFeedback("warning", config.feedback.precheckStale);
  setStatus("Precheck needed");
}

function setTailoringAccess(isAllowed, message) {
  els.tailoringPanel.classList.toggle("locked", !isAllowed);
  els.analyzeButton.disabled = !isAllowed;
  els.tailoringLockMessage.textContent = message;
  show(els.tailoringLockMessage, Boolean(message));
  if (!isAllowed) {
    setTailoringFeedback("", "");
  }

  els.tailoringGuidance.textContent = isAllowed ? config.tailoring.guidanceUnlocked : config.tailoring.guidanceLocked;
}

function populateTargetStyles() {
  els.targetStyle.innerHTML = "";
  config.targetStyles.forEach((style) => {
    const option = document.createElement("option");
    option.value = style;
    option.textContent = config.targetStyleLabels?.[style] || style;
    els.targetStyle.append(option);
  });
}

function populateStaticSelects() {
  els.aiProvider.innerHTML = optionList(config.options.aiProviders);
  els.hasDegree.innerHTML = optionList(config.options.studiesListed);
  els.experienceSelectionMode.innerHTML = optionList(config.options.experienceSelectionMode);
  els.outputLanguage.innerHTML = optionList(config.options.outputLanguages);
}

function populateAiModels() {
  const customOption = ["__custom__", config.options.customAiModelLabel || "Custom model..."];
  const options = config.options.aiModels[els.aiProvider.value] || [];
  const hasCustomOption = options.some(([value]) => value === customOption[0]);
  els.aiModel.innerHTML = optionList(hasCustomOption ? options : [...options, customOption]);
}

function isCustomModelSelected() {
  return els.aiModel.value === "__custom__";
}

function selectedAiModel() {
  return isCustomModelSelected() ? els.ollamaCustomModel.value.trim() : els.aiModel.value;
}

function saveCustomModelForProvider(provider) {
  if (isCustomModelSelected()) {
    state.customAiModels[provider] = els.ollamaCustomModel.value.trim();
  }
}

function restoreCustomModel() {
  els.ollamaCustomModel.value = state.customAiModels[els.aiProvider.value] || "";
}

function updateApiKeyCopy() {
  const providerCopy = config.apiKeys[els.aiProvider.value] || config.apiKeys.gemini;
  const isOllama = els.aiProvider.value === "ollama";
  const isCustomModel = isCustomModelSelected();
  const settingsGrid = els.aiProvider.closest(".ai-settings-grid");
  els.aiApiKeyLabel.textContent = providerCopy.label;
  els.openaiApiKey.setAttribute("placeholder", providerCopy.placeholder);
  els.openaiApiKey.disabled = isOllama;
  els.openaiApiKey.closest(".api-key-field").classList.toggle("hidden", isOllama);
  settingsGrid?.classList.toggle("custom-model-active", isCustomModel);
  settingsGrid?.classList.toggle("ollama-active", isOllama);
  els.apiKeyHelpLink.href = providerCopy.keyUrl;
  els.apiKeyHelpLink.textContent = providerCopy.keyLinkText;
  show(els.ollamaUrlField, isOllama);
  show(els.ollamaGuidance, isOllama);
  show(els.ollamaCustomModelField, isCustomModel);
  els.ollamaGuidance.classList.toggle("warning-note", isOllama);

  if (isOllama && !els.ollamaBaseUrl.value.trim()) {
    els.ollamaBaseUrl.value = config.ollama.defaultBaseUrl;
  }

  if (isOllama) {
    const command = config.ollama.modelCommands[els.aiModel.value];
    els.ollamaGuidance.textContent = isCustomModel
      ? `${config.ollama.guidance} ${config.ollama.customGuidance}`
      : command
        ? `${config.ollama.guidance} ${command}`
        : config.ollama.guidance;
  }
}

function clearApiKeyInput() {
  els.openaiApiKey.value = "";
}

function shouldShowPaidModelSuggestion() {
  return ["openrouter", "ollama"].includes(els.aiProvider.value);
}

function paidModelSuggestionHtml() {
  return shouldShowPaidModelSuggestion() ? `<p class="model-suggestion precheck-suggestion">${escapeHtml(config.feedback.paidModelSuggestion)}</p>` : "";
}

async function runPrecheck() {
  if (state.precheckInFlight) return;

  const form = new FormData();
  const precheckSignature = currentPrecheckSignature();
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

  if (isCustomModelSelected() && !selectedAiModel()) {
    setStatus("Missing model");
    setFeedback("error", config.feedback.missingCustomAiModel || config.feedback.missingOllamaCustomModel);
    els.ollamaCustomModel.focus();
    return;
  }

  form.append("yearsOfExperience", String(years));
  form.append("experienceSelectionMode", els.experienceSelectionMode.value);
  form.append("outputLanguage", els.outputLanguage.value);
  form.append("aiProvider", els.aiProvider.value);
  form.append("aiModel", selectedAiModel());
  if (els.aiProvider.value === "ollama") form.append("ollamaBaseUrl", els.ollamaBaseUrl.value.trim() || config.ollama.defaultBaseUrl);
  if (years > 5) form.append("hasDegree", els.hasDegree.value);
  if (els.degreeYear.value) form.append("degreeYear", els.degreeYear.value);
  if (els.cvText.value.trim()) form.append("cvText", els.cvText.value.trim());
  if (els.cvPdf.files[0]) form.append("cvPdf", els.cvPdf.files[0]);
  if (els.openaiApiKey.value.trim()) form.append("aiApiKey", els.openaiApiKey.value.trim());

  state.precheckInFlight = true;
  clearPrecheckReview();
  setTailoringAccess(false, config.tailoring.initialLock);
  setBusy(true);
  setStatus("Prechecking");
  setFeedback("loading", config.feedback.precheckLoadingText);

  try {
    const response = await fetch(apiUrl("/api/precheck-cv"), { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || config.errorMessages.precheckFailed);

    state.cvText = data.cvText;
    state.precheckSignature = precheckSignature;
    state.precheck = {
      ...data.precheck,
      personalDataWarnings: data.personalDataWarnings || []
    };
    state.lastPrecheckPayload = data;
    state.continueDespiteWeakPrecheck = false;
    setTailoringAccess(
      false,
      data.precheck.proceedRecommendation === baseConfig.recommendations.improve ? config.tailoring.weakLock : config.tailoring.reviewLock
    );
    renderPrecheck(data);
    setStatus("Precheck done");
    setFeedback("success", config.feedback.precheckComplete);
  } catch (error) {
    setStatus("Error");
    setFeedback("error", error instanceof TypeError ? config.errorMessages.apiPrecheckUnreachable : error.message);
  } finally {
    state.precheckInFlight = false;
    setBusy(false);
  }
}

function renderPrecheck(data) {
  const precheck = data.precheck;
  const blocks = config.precheckSections.map(([title, key, type]) => [localizedTitle(title), formatPrecheckValue(precheck, key, type)]);
  const score = Math.max(0, Math.min(100, Math.round(Number(precheck.cvEvidenceScore) || 0)));
  show(els.precheckPanel);
  els.precheckResult.innerHTML = `
    <div class="score ${scoreLevelClass(score)}">${score}<span>/ 100</span></div>
    ${paidModelSuggestionHtml()}
    <div class="result-grid">${blocks.map(([title, value]) => renderResultBlock(title, value)).join("")}</div>
    ${data.agePrivacyWarning?.show ? `<p class="warning">${escapeHtml(data.agePrivacyWarning.message)}</p>` : ""}
    ${renderPersonalDataWarnings(data.personalDataWarnings)}
  `;
  renderDecisionGate(precheck.proceedRecommendation, precheck.questionsToRecoverMetrics, precheck.specificWarnings);
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

function inferRecoveryContext(cvText) {
  const lower = cvText.toLowerCase();
  const context = {
    role: config.evidenceRecovery.genericRole,
    subjects: config.evidenceRecovery.genericSubjects,
    outcomes: config.evidenceRecovery.genericOutcomes
  };

  if (/\b(?:nurse|nursing|patient|patients|ward|hospital|clinic|care|healthcare|medical)\b/.test(lower)) {
    return {
      role: config.evidenceRecovery.contexts.healthcare.role,
      subjects: config.evidenceRecovery.contexts.healthcare.subjects,
      outcomes: config.evidenceRecovery.contexts.healthcare.outcomes
    };
  }

  if (/\b(?:teacher|teaching|student|students|class|classes|school|training|curriculum|learning)\b/.test(lower)) {
    return {
      role: config.evidenceRecovery.contexts.education.role,
      subjects: config.evidenceRecovery.contexts.education.subjects,
      outcomes: config.evidenceRecovery.contexts.education.outcomes
    };
  }

  if (/\b(?:sales|customer|customers|client|clients|account|accounts|revenue|pipeline)\b/.test(lower)) {
    return {
      role: config.evidenceRecovery.contexts.customer.role,
      subjects: config.evidenceRecovery.contexts.customer.subjects,
      outcomes: config.evidenceRecovery.contexts.customer.outcomes
    };
  }

  if (/\b(?:system|systems|application|applications|software|cloud|data|users|platform|database|automation|engineering)\b/.test(lower)) {
    return {
      role: config.evidenceRecovery.contexts.technology.role,
      subjects: config.evidenceRecovery.contexts.technology.subjects,
      outcomes: config.evidenceRecovery.contexts.technology.outcomes
    };
  }

  if (/\b(?:operation|operations|process|processes|logistics|inventory|service|services|compliance|quality)\b/.test(lower)) {
    return {
      role: config.evidenceRecovery.contexts.operations.role,
      subjects: config.evidenceRecovery.contexts.operations.subjects,
      outcomes: config.evidenceRecovery.contexts.operations.outcomes
    };
  }

  return context;
}

function candidateRecoveryLines(cvText, precheck) {
  const fromPrecheck = Array.isArray(precheck?.examplesOfWeakBullets) ? precheck.examplesOfWeakBullets : [];
  const fromText = cvText
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[-*]|\u2022)\s*/, ""))
    .filter((line) => line.length >= 24 && line.length <= 180)
    .filter((line) => /\b(?:responsible|participated|worked|helped|assisted|handled|managed|supported|provided|prepared|coordinated)\b/i.test(line))
    .slice(0, 4);

  return [...new Set([...fromPrecheck, ...fromText])].slice(0, 4);
}

function buildEvidenceRecoveryExamples() {
  const recovery = config.evidenceRecovery;
  const context = inferRecoveryContext(state.cvText || "");
  const weakLines = candidateRecoveryLines(state.cvText || "", state.precheck);
  const questions = Array.isArray(state.precheck?.questionsToRecoverMetrics) ? state.precheck.questionsToRecoverMetrics.slice(0, 5) : [];
  const missingEvidence = Array.isArray(state.precheck?.missingEvidenceTypes) ? state.precheck.missingEvidenceTypes.slice(0, 4) : [];

  return {
    context,
    weakLines,
    missingEvidence,
    questions: questions.length > 0 ? questions : recovery.defaultQuestions
  };
}

function renderEvidenceRecoveryExamples() {
  const recovery = config.evidenceRecovery;
  const examples = buildEvidenceRecoveryExamples();
  const subject = examples.context.subjects;
  const outcome = examples.context.outcomes;
  const role = examples.context.role;
  const weakItems =
    examples.weakLines.length > 0
      ? examples.weakLines
          .map(
            (line) => `
              <div class="recovery-example">
                <p class="example">${escapeHtml(recovery.beforePrefix)} ${escapeHtml(line)}</p>
                <p class="example strong">${escapeHtml(
                  recovery.afterPattern
                    .replace("{activity}", line.replace(/[.!?]$/, "").toLowerCase())
                    .replace("{subjects}", subject)
                    .replace("{outcomes}", outcome)
                )}</p>
              </div>
            `
          )
          .join("")
      : `<p>${escapeHtml(recovery.noWeakExamples)}</p>`;

  return `
    <section class="evidence-recovery">
      <h3>${escapeHtml(recovery.title)}</h3>
      <p>${escapeHtml(recovery.intro)}</p>
      <p class="warning">${escapeHtml(recovery.guardrail)}</p>
      <div class="result-grid">
        ${renderResultBlock(
          recovery.summaryTitle,
          `<p class="example strong">${escapeHtml(
            recovery.summaryPattern
              .replace("{role}", role)
              .replace("{subjects}", subject)
              .replace("{outcomes}", outcome)
          )}</p>`
        )}
        ${renderResultBlock(recovery.missingEvidenceTitle, list(examples.missingEvidence.length > 0 ? examples.missingEvidence : recovery.defaultMissingEvidence))}
        ${renderResultBlock(recovery.bulletTitle, weakItems)}
        ${renderResultBlock(recovery.questionsTitle, list(examples.questions))}
      </div>
    </section>
  `;
}

function formatPrecheckValue(precheck, key, type) {
  const value = precheck[key];

  if (key === "proceedRecommendation") {
    return displayRecommendation(value);
  }

  if (type === "list") {
    return list(value);
  }

  if (type === "mainProblem") {
    return value || config.fallbackText.noMainProblem;
  }

  return value;
}

function renderDecisionGate(recommendation, questions, warnings = []) {
  els.decisionGate.innerHTML = "";
  const examplesContainer = document.createElement("div");
  examplesContainer.className = "evidence-recovery-wrap hidden";

  const improve = document.createElement("button");
  improve.className = recommendation === baseConfig.recommendations.improve ? "primary" : "secondary";
  improve.classList.add("decision-action");
  improve.textContent = config.buttons.showImprovementExamples;
  improve.addEventListener("click", () => {
    examplesContainer.innerHTML = renderEvidenceRecoveryExamples();
    show(examplesContainer, true);
    examplesContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  const continueButton = document.createElement("button");
  continueButton.className = recommendation === baseConfig.recommendations.improve ? "danger" : "primary";
  continueButton.classList.add("decision-action");
  continueButton.textContent = recommendation === baseConfig.recommendations.improve ? config.buttons.continueAnyway : config.buttons.continueToTailoring;
  continueButton.addEventListener("click", () => {
    state.continueDespiteWeakPrecheck = recommendation === baseConfig.recommendations.improve;
    setTailoringAccess(true, recommendation === baseConfig.recommendations.improve ? config.tailoring.weakUnlock : "");
    els.tailoringPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (recommendation === baseConfig.recommendations.proceed) {
    if (warnings.length > 0) {
      const warningNote = document.createElement("p");
      warningNote.className = "warning";
      warningNote.textContent = config.feedback.precheckPassedWithWarnings;
      els.decisionGate.append(warningNote);
    }
    els.decisionGate.append(continueButton);
  } else if (recommendation === baseConfig.recommendations.caution) {
    if (warnings.length > 0) {
      const warningNote = document.createElement("p");
      warningNote.className = "warning";
      warningNote.textContent = config.feedback.precheckPassedWithWarnings;
      els.decisionGate.append(warningNote);
    }
    els.decisionGate.append(continueButton, improve, examplesContainer);
  } else {
    const strongWarning = document.createElement("p");
    strongWarning.className = "warning";
    strongWarning.textContent = config.weakCvWarning;
    els.decisionGate.append(strongWarning, improve, continueButton, examplesContainer);
  }
}

async function runAnalysis() {
  if (state.analysisInFlight) return;

  if (!state.precheck) {
    setStatus("Run precheck first");
    setFeedback("error", config.feedback.runPrecheckFirst);
    return;
  }

  if (isCustomModelSelected() && !selectedAiModel()) {
    setStatus("Missing model");
    setFeedback("error", config.feedback.missingCustomAiModel || config.feedback.missingOllamaCustomModel);
    els.ollamaCustomModel.focus();
    return;
  }

  state.analysisInFlight = true;
  clearAnalysisReview();
  setBusy(true);
  setStatus("Tailoring");
  setTailoringFeedback("loading", els.aiProvider.value === "ollama" ? config.ollama.analysisGuidance : config.feedback.analysisLoading);

  try {
    const response = await fetch(apiUrl("/api/analyze-cv"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aiProvider: els.aiProvider.value,
        aiModel: selectedAiModel(),
        aiApiKey: els.openaiApiKey.value.trim(),
        ollamaBaseUrl: els.aiProvider.value === "ollama" ? els.ollamaBaseUrl.value.trim() || config.ollama.defaultBaseUrl : undefined,
        cvText: state.cvText,
        jobDescription: els.jobDescription.value.trim(),
        companyName: els.companyName.value.trim(),
        companyDescription: els.companyDescription.value.trim(),
        targetStyle: els.targetStyle.value,
        experienceSelectionMode: els.experienceSelectionMode.value,
        outputLanguage: els.outputLanguage.value,
        precheckResult: state.precheck,
        continueDespiteWeakPrecheck: state.continueDespiteWeakPrecheck
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || config.errorMessages.analysisFailed);

    state.downloadableText = data.downloadableText;
    state.lastAnalysis = data.analysis;
    renderAnalysis(data.analysis);
    setStatus("Plan ready");
    const isPartial = isPartialLocalAnalysis(data.analysis);
    setTailoringFeedback(isPartial ? "warning" : "success", isPartial ? config.feedback.analysisPartial : config.feedback.analysisComplete);
  } catch (error) {
    setStatus("Error");
    setTailoringFeedback("error", analysisErrorMessage(error));
  } finally {
    state.analysisInFlight = false;
    setBusy(false);
  }
}

function renderAnalysis(analysis, options = {}) {
  show(els.outputPanel);
  const blocks = config.analysisSections.map(([title, key, type]) => [localizedTitle(title), formatAnalysisValue(analysis, key, type)]);

  els.analysisResult.innerHTML = `<div class="result-grid">${blocks
    .map(([title, value]) => renderResultBlock(title, value))
    .join("")}</div>
    <p class="model-suggestion">${escapeHtml(config.feedback.paidModelSuggestion)}</p>`;
  if (options.scroll !== false) {
    els.outputPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
  const verdict = config.jobFitAssessment.verdictLabels?.[assessment.verdict] || assessment.verdict || config.jobFitAssessment.scoreLabel;

  return `
    <div class="fit-assessment">
      <div class="fit-score">
        <span class="score compact ${scoreLevelClass(score)}">${score}<span>/ 100</span></span>
        <strong>${escapeHtml(verdict)}</strong>
      </div>
      <p>${escapeHtml(assessment.explanation || "")}</p>
      <h4>${escapeHtml(localizedTitle("Strongest reasons"))}</h4>
      ${list(assessment.strongestReasons)}
      <h4>${escapeHtml(localizedTitle("Main risks"))}</h4>
      ${list(assessment.mainRisks)}
      <p class="warning">${escapeHtml(warning)}</p>
    </div>
  `;
}

function displayRecommendation(recommendation) {
  return config.recommendationLabels?.[recommendation] || recommendation || "";
}

function scoreLevelClass(score) {
  if (score >= 75) return "score-strong";
  if (score >= 50) return "score-caution";
  return "score-weak";
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
  [els.yearsOfExperience, els.hasDegree, els.degreeYear, els.experienceSelectionMode].forEach((element) => {
    element.addEventListener(eventName, () => {
      updateMetadataVisibility();
      invalidatePrecheckIfSourceChanged();
    });
  });
});

[els.cvText, els.cvPdf].forEach((element) => {
  ["input", "change"].forEach((eventName) => {
    element.addEventListener(eventName, invalidatePrecheckIfSourceChanged);
  });
});

els.aiProvider.addEventListener("change", () => {
  saveCustomModelForProvider(state.currentAiProvider || els.aiProvider.value);
  clearApiKeyInput();
  populateAiModels();
  restoreCustomModel();
  updateApiKeyCopy();
  state.currentAiProvider = els.aiProvider.value;
});
els.aiModel.addEventListener("change", () => {
  saveCustomModelForProvider(els.aiProvider.value);
  restoreCustomModel();
  updateApiKeyCopy();
});
els.ollamaCustomModel.addEventListener("input", () => {
  if (isCustomModelSelected()) {
    state.customAiModels[els.aiProvider.value] = els.ollamaCustomModel.value.trim();
  }
});
els.outputLanguage.addEventListener("change", () => {
  localStorage.setItem(languageStorageKey, els.outputLanguage.value);
  refreshLanguage();
  invalidatePrecheckIfSourceChanged();
});
els.shareButton.addEventListener("click", shareApp);
els.precheckButton.addEventListener("click", runPrecheck);
els.analyzeButton.addEventListener("click", runAnalysis);
els.downloadButton.addEventListener("click", downloadTxt);
els.exportJsonButton.addEventListener("click", downloadJson);
els.importJsonButton.addEventListener("click", () => els.importJsonFile.click());
els.importJsonFile.addEventListener("change", importJsonFile);
els.loadDemoProfileButton.addEventListener("click", loadDemoProfile);
els.settingsButton.addEventListener("click", () => {
  renderBackendSettings();
  setBackendSettingsFeedback("", "");
  setModalOpen(els.settingsModal, els.settingsButton, els.settingsClose, true);
});
els.previewSettingsButton.addEventListener("click", () => {
  renderBackendSettings();
  setBackendSettingsFeedback("", "");
  setModalOpen(els.settingsModal, els.previewSettingsButton, els.settingsClose, true);
});
els.settingsClose.addEventListener("click", () => setModalOpen(els.settingsModal, els.settingsButton, els.settingsClose, false));
els.saveBackendUrlButton.addEventListener("click", saveBackendUrl);
els.testBackendUrlButton.addEventListener("click", testBackendUrl);
els.resetBackendUrlButton.addEventListener("click", resetBackendUrl);
els.settingsModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) {
    setModalOpen(els.settingsModal, els.settingsButton, els.settingsClose, false);
  }
});
els.appHelpButton.addEventListener("click", () => setModalOpen(els.appHelpModal, els.appHelpButton, els.appHelpClose, true));
els.appHelpClose.addEventListener("click", () => setModalOpen(els.appHelpModal, els.appHelpButton, els.appHelpClose, false));
els.appHelpTabs.addEventListener("click", (event) => {
  const tabButton = event.target.closest("[data-help-tab]");
  if (!tabButton) return;

  state.appHelpTab = tabButton.dataset.helpTab;
  renderAppHelp();
  els.appHelpTabs.querySelector(`[data-help-tab="${CSS.escape(state.appHelpTab)}"]`)?.focus();
});
els.appHelpModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) {
    setModalOpen(els.appHelpModal, els.appHelpButton, els.appHelpClose, false);
  }
});
els.cvBasicsButton.addEventListener("click", () => setModalOpen(els.cvBasicsModal, els.cvBasicsButton, els.cvBasicsClose, true));
els.cvBasicsClose.addEventListener("click", () => setModalOpen(els.cvBasicsModal, els.cvBasicsButton, els.cvBasicsClose, false));
els.cvBasicsModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) {
    setModalOpen(els.cvBasicsModal, els.cvBasicsButton, els.cvBasicsClose, false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (!els.settingsModal.classList.contains("hidden")) {
    setModalOpen(els.settingsModal, els.settingsButton, els.settingsClose, false);
  } else if (!els.appHelpModal.classList.contains("hidden")) {
    setModalOpen(els.appHelpModal, els.appHelpButton, els.appHelpClose, false);
  } else if (!els.cvBasicsModal.classList.contains("hidden")) {
    setModalOpen(els.cvBasicsModal, els.cvBasicsButton, els.cvBasicsClose, false);
  }
});
const initialLanguage = preferredLanguage();
setActiveLanguage(initialLanguage);
applyConfiguredText();
populateStaticSelects();
els.outputLanguage.value = initialLanguage;
populateAiModels();
populateTargetStyles();
state.currentAiProvider = els.aiProvider.value;
updateApiKeyCopy();
updateMetadataVisibility();
setFeedback("", config.feedback.initial);
setTailoringAccess(false, config.tailoring.initialLock);
