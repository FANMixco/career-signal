// Browser controller for the single-page app.
// This file wires DOM state, validation, API calls, and rendering. Product copy
// and visible rules should stay in config.js unless the behavior itself changes.
// Shared mutable app state. Keep this compact so language refresh, imports, and
// output re-rendering can reuse it without needing a larger state framework.
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

// Static DOM cache. index.html owns the structure; these references keep the
// controller readable without repeatedly querying the document.
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
  newSessionButton: document.querySelector("#newSessionButton"),
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
