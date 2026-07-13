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
els.newSessionButton.addEventListener("click", () => window.location.reload());
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
