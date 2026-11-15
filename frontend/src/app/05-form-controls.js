// Form-control helpers keep dependent selects and provider-specific fields in
// sync with the current localized config.
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

// Provider/model selection supports built-in model options plus a custom model
// entry. Custom text is remembered per provider while the page is open.
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
  const provider = els.aiProvider.value;
  const catalog = state.backendModelCatalog || window.CareerSignalRules.getModelCatalog();
  const entry = catalog.providers[provider];
  const suffix = provider === "openrouter" ? config.options.modelLabels.free : provider === "anthropic" ? config.options.modelLabels.experimental : "";
  const options = (entry?.models || []).map(({ id, label }) => [id, suffix ? `${label} (${suffix})` : label]);
  els.aiModel.innerHTML = optionList([...options, customOption]);
  if (entry) els.aiModel.value = entry.defaultModel;
}

function refreshAvailableModels() {
  const provider = els.aiProvider.value;
  const selected = els.aiModel.value;
  const selectedId = selectedAiModel();
  populateAiModels();
  if (state.aiModelSelectionTouched && selected) {
    if ([...els.aiModel.options].some((option) => option.value === selected)) {
      els.aiModel.value = selected;
    } else {
      // Preserve an explicit selection when a catalog retires it. The user can
      // choose a replacement; synchronization must not silently change costs.
      state.customAiModels[provider] = selectedId;
      els.aiModel.value = "__custom__";
    }
    restoreCustomModel();
  }
  updateApiKeyCopy();
}

async function refreshBackendModelCatalog() {
  const url = apiUrl("/api/model-catalog");
  try {
    const response = await fetch(url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error("Model catalog unavailable");
    const catalog = await response.json();
    if (url !== apiUrl("/api/model-catalog")) return;
    state.backendModelCatalog = window.CareerSignalRules.validateModelCatalog(catalog);
  } catch {
    if (url !== apiUrl("/api/model-catalog")) return;
    state.backendModelCatalog = null;
  }
  refreshAvailableModels();
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
