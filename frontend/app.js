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
  loadBuyMeCoffeeWidget();
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
}

function loadBuyMeCoffeeWidget() {
  document.querySelector('script[data-name="BMC-Widget"]').remove();
  document.querySelectorAll("#bmc-wbtn, #bmc-iframe, .bmc-btn-container").forEach((element) => element.remove());

  const script = document.createElement("script");
  script.dataset.name = "BMC-Widget";
  script.dataset.cfasync = "false";
  script.src = "https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js";
  script.dataset.id = "fanmixco";
  script.dataset.description = config.buyMeCoffee.description;
  script.dataset.message = config.buyMeCoffee.message;
  script.dataset.color = "#FF813F";
  script.dataset.position = "Right";
  script.dataset.x_margin = "18";
  script.dataset.y_margin = "18";
  document.body.append(script);
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
  return config.localizedSectionTitles?.[els.outputLanguage.value]?.[title] || title;
}

function renderFooter() {
  els.siteFooterInner.innerHTML = `
    <span>${escapeHtml(config.footer.createdByPrefix)} <a href="${escapeHtml(config.footer.creatorUrl)}" target="_blank" rel="noreferrer">${escapeHtml(config.footer.creatorName)}</a></span>
    <span class="footer-separator" aria-hidden="true">${escapeHtml(config.footer.separator)}</span>
    <a href="${escapeHtml(config.footer.contributeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(config.footer.contributeText)}</a>
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

  state.precheck = null;
  state.precheckSignature = "";
  state.continueDespiteWeakPrecheck = false;
  state.lastPrecheckPayload = null;
  state.lastAnalysis = null;
  state.downloadableText = "";
  els.decisionGate.innerHTML = "";
  els.analysisResult.innerHTML = "";
  show(els.outputPanel, false);
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
    option.textContent = style;
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
  els.aiModel.innerHTML = optionList(config.options.aiModels[els.aiProvider.value] || []);
}

function isCustomOllamaModelSelected() {
  return els.aiProvider.value === "ollama" && els.aiModel.value === "__custom__";
}

function selectedAiModel() {
  return isCustomOllamaModelSelected() ? els.ollamaCustomModel.value.trim() : els.aiModel.value;
}

function updateApiKeyCopy() {
  const providerCopy = config.apiKeys[els.aiProvider.value] || config.apiKeys.gemini;
  const isOllama = els.aiProvider.value === "ollama";
  const isCustomOllama = isCustomOllamaModelSelected();
  els.aiApiKeyLabel.textContent = providerCopy.label;
  els.openaiApiKey.setAttribute("placeholder", providerCopy.placeholder);
  els.openaiApiKey.disabled = isOllama;
  els.openaiApiKey.closest(".api-key-field").classList.toggle("hidden", isOllama);
  els.apiKeyHelpLink.href = providerCopy.keyUrl;
  els.apiKeyHelpLink.textContent = providerCopy.keyLinkText;
  show(els.ollamaUrlField, isOllama);
  show(els.ollamaGuidance, isOllama);
  show(els.ollamaCustomModelField, isCustomOllama);
  els.ollamaGuidance.classList.toggle("warning-note", isOllama);

  if (isOllama && !els.ollamaBaseUrl.value.trim()) {
    els.ollamaBaseUrl.value = config.ollama.defaultBaseUrl;
  }

  if (isOllama) {
    const command = config.ollama.modelCommands[els.aiModel.value];
    els.ollamaGuidance.textContent = isCustomOllama
      ? `${config.ollama.guidance} ${config.ollama.customGuidance}`
      : command
        ? `${config.ollama.guidance} ${command}`
        : config.ollama.guidance;
  }
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

  if (isCustomOllamaModelSelected() && !selectedAiModel()) {
    setStatus("Missing model");
    setFeedback("error", config.feedback.missingOllamaCustomModel);
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
  state.downloadableText = "";
  state.lastAnalysis = null;
  els.analysisResult.innerHTML = "";
  show(els.outputPanel, false);
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
  show(els.precheckPanel);
  els.precheckResult.innerHTML = `
    <div class="score">${precheck.cvEvidenceScore}<span>/ 100</span></div>
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
  const improve = document.createElement("button");
  improve.className = recommendation === baseConfig.recommendations.improve ? "primary" : "secondary";
  improve.classList.add("decision-action");
  improve.textContent = displayRecommendation(baseConfig.recommendations.improve);
  improve.addEventListener("click", () => {
    els.decisionGate.insertAdjacentHTML("beforeend", `<div class="warning">${list(questions)}</div>`);
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

  if (isCustomOllamaModelSelected() && !selectedAiModel()) {
    setStatus("Missing model");
    setFeedback("error", config.feedback.missingOllamaCustomModel);
    els.ollamaCustomModel.focus();
    return;
  }

  state.analysisInFlight = true;
  state.downloadableText = "";
  els.analysisResult.innerHTML = "";
  show(els.outputPanel, false);
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
    .join("")}</div>`;
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
        <span class="score compact">${score}<span>/ 100</span></span>
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
  populateAiModels();
  updateApiKeyCopy();
});
els.aiModel.addEventListener("change", updateApiKeyCopy);
els.outputLanguage.addEventListener("change", () => {
  refreshLanguage();
  invalidatePrecheckIfSourceChanged();
});
els.shareButton.addEventListener("click", shareApp);
els.precheckButton.addEventListener("click", runPrecheck);
els.analyzeButton.addEventListener("click", runAnalysis);
els.downloadButton.addEventListener("click", downloadTxt);
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
setActiveLanguage("en");
applyConfiguredText();
populateStaticSelects();
populateAiModels();
populateTargetStyles();
updateApiKeyCopy();
updateMetadataVisibility();
setFeedback("", config.feedback.initial);
setTailoringAccess(false, config.tailoring.initialLock);
