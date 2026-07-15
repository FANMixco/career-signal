// CV evidence precheck flow. Validate local form state first, then send the
// CV/profile payload to the backend for scoring and warnings.
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
    if (data.precheck.proceedRecommendation === baseConfig.recommendations.proceed) {
      setTailoringAccess(true, "");
    } else {
      setTailoringAccess(
        false,
        data.precheck.proceedRecommendation === baseConfig.recommendations.improve ? config.tailoring.weakLock : config.tailoring.reviewLock
      );
    }
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

// Render the score, warning sections, privacy review, and decision gate that
// either unlocks tailoring or shows improvement prompts.
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

// Evidence recovery examples are local prompts for finding truthful support in
// the CV. They are not final copy and should not invent metrics.
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
