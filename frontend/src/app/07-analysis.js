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
