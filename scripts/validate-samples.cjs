const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const contentRoot = path.join(repoRoot, "frontend", "src", "content");
const supportedLanguages = ["en", "es", "fr", "de"];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function valueAtPath(value, pathParts) {
  return pathParts.reduce((current, key) => current?.[key], value);
}

function requirePath(bundle, pathText, issues) {
  const value = valueAtPath(bundle, pathText.split("."));
  if (value === undefined || value === null || value === "") {
    issues.push(`missing or empty ${pathText}`);
  }
  return value;
}

function requireObject(bundle, pathText, issues) {
  const value = requirePath(bundle, pathText, issues);
  if (value !== undefined && value !== null && !isPlainObject(value)) {
    issues.push(`expected object at ${pathText}`);
  }
  return value;
}

function requireArray(bundle, pathText, issues) {
  const value = requirePath(bundle, pathText, issues);
  if (value !== undefined && value !== null && !Array.isArray(value)) {
    issues.push(`expected array at ${pathText}`);
  }
  return value;
}

function expectedLanguageForPath(relativePath) {
  const match = /-([a-z]{2})\.json$/.exec(relativePath);
  return match?.[1] || "en";
}

function validateSessionSample(relativePath) {
  const issues = [];
  const bundle = readJson(relativePath);
  const expectedLanguage = expectedLanguageForPath(relativePath);

  if (bundle.schema !== "career-signal-session") {
    issues.push(`expected schema career-signal-session, got ${JSON.stringify(bundle.schema)}`);
  }

  if (bundle.schemaVersion !== 1) {
    issues.push(`expected schemaVersion 1, got ${JSON.stringify(bundle.schemaVersion)}`);
  }

  requirePath(bundle, "exportedAt", issues);
  requireObject(bundle, "inputs", issues);
  requireObject(bundle, "inputs.profile", issues);
  requirePath(bundle, "inputs.profile.yearsOfExperience", issues);
  requirePath(bundle, "inputs.profile.hasDegree", issues);
  requirePath(bundle, "inputs.profile.experienceSelectionMode", issues);
  requirePath(bundle, "inputs.profile.outputLanguage", issues);
  requirePath(bundle, "inputs.cvText", issues);
  requireObject(bundle, "inputs.aiSettings", issues);
  requirePath(bundle, "inputs.aiSettings.provider", issues);
  requirePath(bundle, "inputs.aiSettings.model", issues);
  requireObject(bundle, "inputs.tailoring", issues);
  requirePath(bundle, "inputs.tailoring.companyName", issues);
  requirePath(bundle, "inputs.tailoring.jobPosition", issues);
  requirePath(bundle, "inputs.tailoring.jobDescription", issues);
  requirePath(bundle, "inputs.tailoring.targetStyle", issues);
  requireObject(bundle, "outputs", issues);
  requireObject(bundle, "outputs.precheck", issues);
  requirePath(bundle, "outputs.precheck.cvEvidenceScore", issues);
  requirePath(bundle, "outputs.precheck.proceedRecommendation", issues);
  requireArray(bundle, "outputs.precheck.specificWarnings", issues);
  requireArray(bundle, "outputs.precheck.missingEvidenceTypes", issues);
  requireArray(bundle, "outputs.precheck.questionsToRecoverMetrics", issues);
  requireObject(bundle, "outputs.precheckPayload", issues);
  requireObject(bundle, "outputs.analysis", issues);
  requireObject(bundle, "outputs.analysis.jobFitAssessment", issues);
  requirePath(bundle, "outputs.analysis.jobFitAssessment.score", issues);
  requireArray(bundle, "outputs.analysis.finalReconstructionPlan", issues);
  requirePath(bundle, "outputs.downloadableText", issues);

  const outputLanguage = valueAtPath(bundle, ["inputs", "profile", "outputLanguage"]);
  if (outputLanguage && !supportedLanguages.includes(outputLanguage)) {
    issues.push(`unsupported inputs.profile.outputLanguage ${JSON.stringify(outputLanguage)}`);
  }

  if (outputLanguage !== expectedLanguage) {
    issues.push(`expected inputs.profile.outputLanguage ${JSON.stringify(expectedLanguage)}, got ${JSON.stringify(outputLanguage)}`);
  }

  return issues;
}

function main() {
  const baseContent = JSON.parse(fs.readFileSync(path.join(contentRoot, "app.en.json"), "utf8"));
  const samplePath = baseContent.demoProfile?.path;

  if (!samplePath) {
    throw new Error("Missing demoProfile.path in frontend/src/content/app.en.json");
  }

  const sampleFullPath = path.join(repoRoot, samplePath);
  if (!fs.existsSync(sampleFullPath)) {
    console.error(`Configured demo sample does not exist: ${samplePath}`);
    process.exitCode = 1;
    return;
  }

  for (const language of supportedLanguages) {
    const localizedPath = language === "en" ? samplePath : samplePath.replace(/\.json$/, `-${language}.json`);
    if (!fs.existsSync(path.join(repoRoot, localizedPath))) {
      console.error(`Missing ${language} demo sample: ${localizedPath}`);
      process.exitCode = 1;
      return;
    }
  }

  const sampleFiles = fs
    .readdirSync(path.join(repoRoot, "sample"))
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => path.join("sample", fileName))
    .sort();

  const issues = [];
  for (const relativePath of sampleFiles) {
    for (const issue of validateSessionSample(relativePath)) {
      issues.push(`[${relativePath}] ${issue}`);
    }
  }

  if (issues.length) {
    console.error(`Sample validation failed (${issues.length}):`);
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Sample validation passed for ${sampleFiles.length} file(s).`);
}

main();
