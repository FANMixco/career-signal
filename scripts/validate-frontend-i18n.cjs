const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const contentRoot = path.join(repoRoot, "frontend", "src", "content");
const baseLanguage = "en";
const filePattern = /^app\.([a-z]{2})\.json$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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

function formatPath(parts) {
  return parts.length ? parts.join(".") : "<root>";
}

function getAtPath(value, pathParts) {
  return pathParts.reduce((current, key) => current?.[key], value);
}

function pathStartsWith(pathParts, prefix) {
  return prefix.every((part, index) => pathParts[index] === part);
}

function structuralArrayPath(pathParts) {
  const pathText = formatPath(pathParts);
  return (
    pathStartsWith(pathParts, ["options", "aiProviders"]) ||
    pathStartsWith(pathParts, ["options", "studiesListed"]) ||
    pathStartsWith(pathParts, ["options", "experienceSelectionMode"]) ||
    pathStartsWith(pathParts, ["options", "outputLanguages"]) ||
    pathText.startsWith("options.aiModels.") ||
    pathText === "precheckSections" ||
    pathText === "analysisSections"
  );
}

function looksHumanFacing(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 4) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^[a-z0-9_.:/@-]+$/i.test(trimmed)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return false;
  return /[a-zA-Z]/.test(trimmed);
}

function shouldSkipTranslationCoverage(pathParts, baseValue) {
  const pathText = formatPath(pathParts);
  const last = pathParts.at(-1);
  const previous = pathParts.at(-2);

  return (
    last === "id" ||
    last === "path" ||
    last === "url" ||
    last === "keyUrl" ||
    last === "creatorName" ||
    last === "creatorUrl" ||
    last === "playlistUrl" ||
    last === "contributeUrl" ||
    last === "storageKey" ||
    last === "separator" ||
    last === "version" ||
    pathText === "site.title" ||
    pathText.includes(".modelCommands.") ||
    pathText.includes(".aiModels.") ||
    pathText.includes(".aiProviders.") ||
    pathText.includes(".targetStyles.") ||
    pathText.includes(".recommendations.") ||
    pathText.startsWith("precheckSections.") ||
    pathText.startsWith("analysisSections.") ||
    (previous === "examples" && last === 0) ||
    (typeof previous === "number" && last === 0) ||
    /^[A-Z][A-Za-z0-9 /.-]*$/.test(baseValue)
  );
}

function compareRuntimeShape(baseValue, effectiveValue, pathParts, language, issues) {
  const currentPath = formatPath(pathParts);

  if (Array.isArray(baseValue)) {
    if (!Array.isArray(effectiveValue)) {
      issues.push(`[${language}] expected array at ${currentPath}`);
      return;
    }

    if (structuralArrayPath(pathParts) && baseValue.length !== effectiveValue.length) {
      issues.push(`[${language}] structural array length mismatch at ${currentPath}: expected ${baseValue.length}, got ${effectiveValue.length}`);
    }

    const limit = Math.min(baseValue.length, effectiveValue.length);
    for (let index = 0; index < limit; index += 1) {
      compareRuntimeShape(baseValue[index], effectiveValue[index], [...pathParts, index], language, issues);
    }
    return;
  }

  if (isPlainObject(baseValue)) {
    if (!isPlainObject(effectiveValue)) {
      issues.push(`[${language}] expected object at ${currentPath}`);
      return;
    }

    for (const key of Object.keys(baseValue)) {
      compareRuntimeShape(baseValue[key], effectiveValue[key], [...pathParts, key], language, issues);
    }
    return;
  }

  if (typeof baseValue !== typeof effectiveValue) {
    issues.push(`[${language}] type mismatch at ${currentPath}: expected ${typeof baseValue}, got ${typeof effectiveValue}`);
    return;
  }

  if (typeof effectiveValue === "string" && effectiveValue.trim() === "" && baseValue !== "") {
    issues.push(`[${language}] empty string at ${currentPath}`);
  }
}

function collectCoverageWarnings(baseValue, overrideValue, effectiveValue, pathParts, language, warnings) {
  if (Array.isArray(baseValue)) {
    const effectiveArray = Array.isArray(effectiveValue) ? effectiveValue : [];
    const overrideArray = Array.isArray(overrideValue) ? overrideValue : undefined;
    const limit = Math.min(baseValue.length, effectiveArray.length);
    for (let index = 0; index < limit; index += 1) {
      collectCoverageWarnings(
        baseValue[index],
        overrideArray?.[index],
        effectiveArray[index],
        [...pathParts, index],
        language,
        warnings
      );
    }
    return;
  }

  if (isPlainObject(baseValue)) {
    const effectiveObject = isPlainObject(effectiveValue) ? effectiveValue : {};
    const overrideObject = isPlainObject(overrideValue) ? overrideValue : undefined;
    for (const key of Object.keys(baseValue)) {
      collectCoverageWarnings(
        baseValue[key],
        overrideObject?.[key],
        effectiveObject[key],
        [...pathParts, key],
        language,
        warnings
      );
    }
    return;
  }

  if (
    language !== baseLanguage &&
    typeof baseValue === "string" &&
    looksHumanFacing(baseValue) &&
    !shouldSkipTranslationCoverage(pathParts, baseValue) &&
    (overrideValue === undefined || effectiveValue === baseValue)
  ) {
    warnings.push(`[${language}] untranslated or inherited English at ${formatPath(pathParts)}: ${JSON.stringify(baseValue)}`);
  }
}

function main() {
  const files = fs
    .readdirSync(contentRoot)
    .map((fileName) => ({ fileName, match: filePattern.exec(fileName) }))
    .filter(({ match }) => match)
    .map(({ fileName, match }) => ({ fileName, language: match[1] }))
    .sort((left, right) => left.language.localeCompare(right.language));

  const baseFile = files.find((file) => file.language === baseLanguage);
  if (!baseFile) {
    throw new Error(`Missing base language file app.${baseLanguage}.json in ${contentRoot}`);
  }

  const baseContent = readJson(path.join(contentRoot, baseFile.fileName));
  const issues = [];
  const warnings = [];

  for (const file of files) {
    const overrideContent = readJson(path.join(contentRoot, file.fileName));
    const effectiveContent = file.language === baseLanguage ? overrideContent : mergeConfig(baseContent, overrideContent);

    compareRuntimeShape(baseContent, effectiveContent, [], file.language, issues);
    collectCoverageWarnings(baseContent, file.language === baseLanguage ? baseContent : overrideContent, effectiveContent, [], file.language, warnings);
  }

  if (warnings.length) {
    console.warn(`Frontend i18n coverage warnings (${warnings.length}):`);
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (issues.length) {
    console.error(`Frontend i18n validation failed (${issues.length}):`);
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Frontend i18n validation passed for ${files.length} language files.`);
}

main();
