// Buy Me a Coffee's widget initializes only from a parser-loaded script because
// its own code waits for DOMContentLoaded. Keep this small loader before app.js.
(function () {
  const baseConfig = window.CAREER_SIGNAL_CONFIG;
  const languageStorageKey = "careerSignalLanguage";

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

  function supportedLanguageCodes() {
    return (baseConfig.options.outputLanguages || []).map(([code]) => code);
  }

  function normalizeLanguage(language) {
    const code = String(language || "").toLowerCase().split("-")[0];
    return supportedLanguageCodes().includes(code) ? code : "en";
  }

  function preferredLanguage() {
    const storedLanguage = localStorage.getItem(languageStorageKey);
    if (storedLanguage) return normalizeLanguage(storedLanguage);

    const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
    const detected = browserLanguages.map(normalizeLanguage).find((language) => language !== "en");
    return detected || normalizeLanguage(browserLanguages[0]) || "en";
  }

  function escapeAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  const language = preferredLanguage();
  const config = mergeConfig(baseConfig, baseConfig.translations?.[language] || {});
  const copy = config.buyMeCoffee || baseConfig.buyMeCoffee;

  document.write(
    '<scr' +
      'ipt data-name="BMC-Widget" data-cfasync="false" src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js" data-id="fanmixco" data-description="' +
      escapeAttribute(copy.description) +
      '" data-message="' +
      escapeAttribute(copy.message) +
      '" data-color="#FF813F" data-position="Right" data-x_margin="18" data-y_margin="18"></scr' +
      "ipt>"
  );
})();
