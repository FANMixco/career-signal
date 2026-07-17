// Cross-cutting helpers for URLs, feedback, localization, and small HTML
// snippets. Keep business copy in the config JSON files whenever possible.
function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function isGitHubPagesPreview() {
  return window.location.hostname === "fanmixco.github.io" && window.location.pathname.startsWith("/career-signal/frontend");
}

function storedBackendUrl() {
  return localStorage.getItem(backendStorageKey) || "";
}

function storedTheme() {
  return localStorage.getItem(themeStorageKey) || "";
}

function normalizeTheme(theme) {
  return theme === "dark" ? "dark" : "light";
}

function preferredTheme() {
  const savedTheme = storedTheme();
  if (savedTheme) return normalizeTheme(savedTheme);
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  state.theme = normalizeTheme(theme);
  document.documentElement.dataset.theme = state.theme;
  els.themeToggleButton.setAttribute("aria-pressed", String(state.theme === "dark"));
  updateThemeToggleCopy();
}

function toggleTheme() {
  const nextTheme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem(themeStorageKey, nextTheme);
  applyTheme(nextTheme);
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

// Feedback helpers centralize class names so loading/success/error UI behaves
// consistently across precheck, tailoring, import/export, and settings flows.
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

// Translation files are overlays on top of English. Refreshing a language
// rebuilds localized selects, then restores the user's selected values.
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

function persistLanguage(language) {
  localStorage.setItem(languageStorageKey, normalizeLanguage(language));
}

function refreshLanguage() {
  const selectedLanguage = normalizeLanguage(els.outputLanguage.value || "en");
  const values = {
    aiProvider: els.aiProvider.value,
    aiModel: els.aiModel.value,
    hasDegree: els.hasDegree.value,
    experienceSelectionMode: els.experienceSelectionMode.value,
    targetStyle: els.targetStyle.value
  };

  persistLanguage(selectedLanguage);
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
  updateThemeToggleCopy();
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

function updateThemeToggleCopy() {
  if (!els.themeToggleButton) return;
  const label = config.buttons.themeLabel || "Toggle dark mode";
  els.themeToggleButton.setAttribute("aria-label", label);
  els.themeToggleButton.setAttribute("title", label);
}

// Render helpers produce app-owned markup. Any string from users, sessions, or
// backend responses should be escaped before insertion.
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
