import { RulesManager, getEvaluation, type StoredRules, type RulesStorage } from "./rulesRuntime.js";
import { evaluateCareerChecks, mergeCareerWarnings } from "./careerChecks.js";
import { buildLocalPrecheckBaseline } from "../services/ai/localCvEvidence.js";
import { detectSensitivePersonalDataWarnings, educationPrivacy } from "./cvRules.js";

export function indexedDbStorage(): RulesStorage {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("career-signal-rules", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("rules");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("Rules database blocked"));
  });
  const access = async (write: boolean, state?: StoredRules) => {
    const db = await open();
    return new Promise<StoredRules | undefined>((resolve, reject) => {
      const transaction = db.transaction("rules", write ? "readwrite" : "readonly");
      const store = transaction.objectStore("rules");
      const request = write ? store.put(state, "state") : store.get("state");
      transaction.oncomplete = () => { db.close(); resolve(write ? undefined : request.result); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
  };
  return { read: () => access(false), write: async (state) => { await access(true, state); } };
}

const options = (globalThis as typeof globalThis & { CAREER_SIGNAL_RULES_OPTIONS?: { source?: string; refreshHours?: number } }).CAREER_SIGNAL_RULES_OPTIONS || {};
const hours = Number(options.refreshHours || 24);
export const manager = new RulesManager(indexedDbStorage(), options.source, Number.isFinite(hours) && hours > 0 ? hours * 3600000 : 86400000);
// Only local storage is awaited by an offline check. Remote refresh is detached.
export const ready = manager.load().catch(() => undefined);
void ready.then(() => manager.refresh());
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void ready.then(() => manager.refresh()); });
  setInterval(() => { void ready.then(() => manager.refresh()); }, 60000);
}
export async function precheck(input: { cvText: string; yearsOfExperience: number; hasDegree?: boolean; degreeYear?: number; outputLanguage?: string }) {
  await ready;
  if (input.cvText.length < 300) throw Error("Please provide a complete CV (at least 300 characters).");
  const precheck = buildLocalPrecheckBaseline(input);
  const careerWarnings = evaluateCareerChecks(input.cvText, input.outputLanguage);
  precheck.specificWarnings = mergeCareerWarnings(precheck.specificWarnings, careerWarnings);
  const showAge = Boolean(input.degreeYear && input.degreeYear < new Date().getFullYear() - getEvaluation().localEvidence.educationYears);
  return { cvText: input.cvText, cvTextPreview: input.cvText.slice(0, 600), precheck, careerWarnings, scoreBands: getEvaluation().scoreBands, personalDataWarnings: detectSensitivePersonalDataWarnings(input.cvText), agePrivacyWarning: { show: showAge, message: showAge ? educationPrivacy.ageWarning : "" }, recommendedNextAction: precheck.proceedRecommendation };
}
