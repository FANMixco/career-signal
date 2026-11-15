// Static UI renderers for footer, help, and CV basics sections. The text comes
// from localized config; this file owns only the markup structure.
function renderFooter() {
  const version = config.footer.version ? `
    <span class="footer-separator" aria-hidden="true">${escapeHtml(config.footer.separator)}</span>
    <span>${escapeHtml(`v${config.footer.version}`)}</span>
  ` : "";

  els.siteFooterInner.innerHTML = `
    <p class="footer-disclaimer">${escapeHtml(config.footer.disclaimer)}</p>
    <div class="footer-links">
      <span>${escapeHtml(config.footer.createdByPrefix)} <a href="${escapeHtml(config.footer.creatorUrl)}" target="_blank" rel="noreferrer">${escapeHtml(config.footer.creatorName)}</a></span>
      <span class="footer-separator" aria-hidden="true">${escapeHtml(config.footer.separator)}</span>
      <a href="${escapeHtml(config.footer.contributeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(config.footer.contributeText)}</a>
      ${version}
    </div>
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

// CV basics is data-driven so non-code contributors can revise guidance without
// touching event handlers or layout behavior.
function renderCvBasics() {
  const language = els.outputLanguage.value || "en";
  const content = state.backendCvBasics?.language === language
    ? state.backendCvBasics.content
    : window.CareerSignalRules.getCvBasics(language);
  els.cvBasicsTitle.textContent = content.title;
  els.cvBasicsSubtitle.textContent = content.subtitle;
  const blocks = content.blocks
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
    <a class="playlist-link" href="${escapeHtml(content.playlistUrl)}" target="_blank" rel="noreferrer">${escapeHtml(content.playlistText)}</a>
  `;
}

async function refreshBackendCvBasics() {
  const language = els.outputLanguage.value || "en";
  const url = apiUrl(`/api/cv-basics?language=${encodeURIComponent(language)}`);
  try {
    const response = await fetch(url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error("CV basics unavailable");
    const content = await response.json();
    if (language !== els.outputLanguage.value || url !== apiUrl(`/api/cv-basics?language=${encodeURIComponent(language)}`)) return;
    state.backendCvBasics = { language, content: window.CareerSignalRules.validateCvBasicsView(content) };
  } catch {
    if (language !== els.outputLanguage.value || url !== apiUrl(`/api/cv-basics?language=${encodeURIComponent(language)}`)) return;
    state.backendCvBasics = null;
  }
  renderCvBasics();
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
