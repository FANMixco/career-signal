const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const contentRoot = path.join(repoRoot, "frontend", "src", "content");
const baseLanguage = "en";
const filePattern = /^app\.([a-z]{2})\.json$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function formatPath(parts) {
  return parts.length ? parts.join(".") : "<root>";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBlankString(value) {
  return typeof value === "string" && value.trim() === "";
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

function shouldSkipExactMatch(pathParts, baseValue) {
  const pathText = formatPath(pathParts);
  const last = pathParts.at(-1) || "";

  return (
    last === "id" ||
    last === "path" ||
    last === "url" ||
    last === "keyUrl" ||
    last === "creatorUrl" ||
    last === "playlistUrl" ||
    last === "contributeUrl" ||
    last === "storageKey" ||
    pathText.includes(".modelCommands.") ||
    pathText.includes(".aiModels.") ||
    pathText.includes(".targetStyles.") ||
    pathText.includes(".recommendations.") ||
    /^[A-Z][A-Za-z0-9 /.-]*$/.test(baseValue)
  );
}

function compareValues(baseValue, translatedValue, pathParts, language, issues, warnings) {
  const currentPath = formatPath(pathParts);

  if (translatedValue === undefined) {
    issues.push(`[${language}] missing ${currentPath}`);
    return;
  }

  if (isBlankString(translatedValue)) {
    issues.push(`[${language}] empty string at ${currentPath}`);
  }

  if (Array.isArray(baseValue)) {
    if (!Array.isArray(translatedValue)) {
      issues.push(`[${language}] expected array at ${currentPath}`);
      return;
    }

    if (baseValue.length !== translatedValue.length) {
      issues.push(`[${language}] array length mismatch at ${currentPath}: expected ${baseValue.length}, got ${translatedValue.length}`);
    }

    const limit = Math.min(baseValue.length, translatedValue.length);
    for (let index = 0; index < limit; index += 1) {
      compareValues(baseValue[index], translatedValue[index], [...pathParts, index], language, issues, warnings);
    }
    return;
  }

  if (isPlainObject(baseValue)) {
    if (!isPlainObject(translatedValue)) {
      issues.push(`[${language}] expected object at ${currentPath}`);
      return;
    }

    for (const key of Object.keys(baseValue)) {
      compareValues(baseValue[key], translatedValue[key], [...pathParts, key], language, issues, warnings);
    }

    for (const key of Object.keys(translatedValue)) {
      if (!(key in baseValue)) {
        issues.push(`[${language}] extra key ${formatPath([...pathParts, key])}`);
      }
    }
    return;
  }

  if (typeof baseValue !== typeof translatedValue) {
    issues.push(`[${language}] type mismatch at ${currentPath}: expected ${typeof baseValue}, got ${typeof translatedValue}`);
    return;
  }

  if (
    language !== baseLanguage &&
    typeof baseValue === "string" &&
    translatedValue === baseValue &&
    looksHumanFacing(baseValue) &&
    !shouldSkipExactMatch(pathParts, baseValue)
  ) {
    warnings.push(`[${language}] possible untranslated string at ${currentPath}: ${JSON.stringify(baseValue)}`);
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
    const content = readJson(path.join(contentRoot, file.fileName));
    compareValues(baseContent, content, [], file.language, issues, warnings);
  }

  if (warnings.length) {
    console.warn(`Frontend i18n warnings (${warnings.length}):`);
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
