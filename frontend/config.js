// Runtime configuration loader.
// User-facing copy, option labels, modal content, and localization live in
// content/app.*.json so non-technical contributors can review text without
// editing event-handler code.
function resolveApiBaseUrl(location) {
  const separateFrontendPorts = new Set(["5500", "5173", "4173", "8080"]);
  const isGitHubPagesPreview = location.hostname === "fanmixco.github.io" && location.pathname.startsWith("/career-signal/frontend");

  if (isGitHubPagesPreview) {
    return "";
  }

  if (location.protocol.startsWith("http") && !separateFrontendPorts.has(location.port)) {
    return "";
  }

  const hostname = location.hostname;
  const isPrivateHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "10.0.2.2" ||
    hostname === "10.0.3.2" ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

  if (isPrivateHost) {
    const hostForUrl = hostname === "::1" ? "[::1]" : hostname;
    return `http://${hostForUrl}:3001`;
  }

  return "http://localhost:3001";
}

function loadContentJson(path) {
  const request = new XMLHttpRequest();
  request.open("GET", path, false);
  request.send(null);

  if (request.status >= 400 || !request.responseText) {
    throw new Error(`Could not load frontend content from ${path}.`);
  }

  return JSON.parse(request.responseText);
}

const baseContent = loadContentJson("content/app.en.json");

window.CAREER_SIGNAL_CONFIG = {
  apiBaseUrl: resolveApiBaseUrl(window.location),
  pdfMaxBytes: 5 * 1024 * 1024,
  ...baseContent,
  translations: {
    es: loadContentJson("content/app.es.json"),
    fr: loadContentJson("content/app.fr.json"),
    de: loadContentJson("content/app.de.json")
  }
};
