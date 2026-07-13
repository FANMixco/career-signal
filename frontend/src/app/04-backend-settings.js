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
