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
  const frontendPathIndex = window.location.pathname.indexOf("/frontend");

  if (frontendPathIndex >= 0) {
    const appRoot = window.location.pathname.slice(0, frontendPathIndex).replace(/\/$/, "");
    return [`${appRoot}/${samplePath}`];
  }

  return [samplePath];
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
