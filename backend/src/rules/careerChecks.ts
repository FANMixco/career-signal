import { getEvaluation } from "./rulesRuntime.js";

export type Position = { title: string; text: string; start: number; end: number; achievements: number; words: number };
const independent = /\b(freelanc\w*|self[- ]employed|entrepreneur\w*|founder|cofounder|créateur|creador|création de contenu|content creat\w*|newsletter|blog|publications?|author|auteur|autor|gründ\w*|selbstständig|autónomo)\b/i;
const arrangement = /\b(freelanc\w*|self[- ]employed|part[- ]time|temps partiel|tiempo parcial|teilzeit|consultan\w*|contract\w*|concurrent|parallel|internal transition|promotion|promoted)\b/i;
const classified = /\b(freelanc\w*|self[- ]employed|entrepreneur\w*|founder|cofounder|publications?|content creat\w*|création de contenu|creación de contenido|selbstständig|autónomo)\b/i;
const outcome = /\b(reduced|increased|improved|delivered|launched|migrated|saved|built|created|enabled|automated|réduit|amélioré|livré|créé|reducido|mejorado|entregado|creado|reduziert|verbessert|entwickelt)\b/i;
const scope = /\d|\b(users|clients|teams|countries|systems|customers|reliability|adoption|risk|cost|time|utilisateurs|équipes|usuarios|equipos|kunden|teams)\b/i;
const months: Record<string, number> = { jan: 0, ene: 0, feb: 1, fév: 1, mar: 2, mär: 2, apr: 3, avr: 3, abr: 3, may: 4, mai: 4, jun: 5, juin: 5, jul: 6, juil: 6, aug: 7, ago: 7, aoû: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, déc: 11, dez: 11, dic: 11 };
const datePattern = /(?:(\d{1,2})[/.\-]|([\p{L}]{3,10})\.?\s+)?((?:19|20)\d{2})\s*(?:[-–—]|to|à|a|bis)\s*(?:(?:(\d{1,2})[/.\-]|([\p{L}]{3,10})\.?\s+)?((?:19|20)\d{2})|(present|current|now|présent|actuel|actualidad|presente|heute|aktuell))/iu;
const stopSection = /^(education|studies|formation|études|educación|estudios|ausbildung|bildung|certifications?|skills|compétences|habilidades|kenntnisse|publications?|projects?|projets?|proyectos|projekte|interests|languages|langues|idiomas)\b/i;

// Intentionally conservative: ambiguous/unstructured dates are left to the AI
// reviewer. Education, undated activities, and achievement dates are not jobs.
export function extractPositions(cvText: string, now = new Date()): Position[] {
  const lines = cvText.split(/\r?\n/).map((line) => line.trim());
  const positions: Position[] = []; let current: Position | undefined; let excluded = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\b((?:19|20)\d{2})[/-](0?[1-9]|1[0-2])\b/g, "$2/$1");
    if (line.length < 90 && stopSection.test(line)) { current = undefined; excluded = true; continue; }
    if (/^(professional experience|work experience|employment(?: history)?|career history|experience|expérience(?: professionnelle)?|experiencia(?: profesional| laboral)?|berufserfahrung|beruflicher werdegang)\s*:?$/i.test(line)) { excluded = false; current = undefined; continue; }
    const match = !excluded && line.length < 180 && !/^[-*•]/.test(line) ? datePattern.exec(line) : null;
    if (match) {
      const title = line.replace(match[0], "").trim() || lines[i - 1] || "";
      if (!/[\p{L}]{3}/u.test(title) || stopSection.test(title)) { current = undefined; continue; }
      const month = (numeric?: string, name?: string) => numeric ? Number(numeric) - 1 : name ? months[name.toLowerCase().slice(0, 4)] ?? months[name.toLowerCase().slice(0, 3)] : undefined;
      const sm = month(match[1], match[2]), em = month(match[4], match[5]);
      if ((match[1] && (Number(match[1]) < 1 || Number(match[1]) > 12)) || (match[4] && (Number(match[4]) < 1 || Number(match[4]) > 12))) continue;
      if ((match[2] && sm === undefined) || (match[5] && em === undefined)) continue;
      const startYear = Number(match[3]);
      const start = startYear * 12 + (sm ?? (startYear === now.getFullYear() ? now.getMonth() : 11));
      const end = match[7] ? now.getFullYear() * 12 + now.getMonth() : Number(match[6]) * 12 + (em ?? 0);
      // Same-year, year-only roles still count as positions even though their
      // conservative bounds cannot prove overlap with another role.
      if (startYear > (match[7] ? now.getFullYear() : Number(match[6])) || (sm !== undefined && em !== undefined && start > end) || start > now.getFullYear() * 12 + now.getMonth()) { current = undefined; continue; }
      current = { title, text: title, start, end, achievements: 0, words: 0 }; positions.push(current);
    } else if (current && line) {
      current.text += "\n" + line;
      current.words += line.split(/\s+/).length;
      if (outcome.test(line) && scope.test(line)) current.achievements++;
    }
  }
  return positions;
}

export type CareerWarning = { id: string; severity: string; recommendation: string; message: string };
export function evaluateCareerChecks(cvText: string, language = "en", now = new Date()): CareerWarning[] {
  const e = getEvaluation(), rules = e.rules;
  const positions = extractPositions(cvText, now);
  const cut = now.getFullYear() * 12 + now.getMonth() - rules.CV02.thresholds.recentYears * 12;
  const older = positions.filter((p) => p.end < cut).reduce((sum, p) => sum + p.words, 0);
  const recent = positions.filter((p) => p.end >= cut).reduce((sum, p) => sum + p.words, 0);
  const overlaps = positions.some((a, i) => positions.slice(i + 1).some((b) => !arrangement.test(a.title) && !arrangement.test(b.title) && Math.min(a.end, b.end) - Math.max(a.start, b.start) + 1 >= rules.CV04.thresholds.minimumOverlapMonths));
  const triggered = {
    CV01: positions.length >= rules.CV01.thresholds.minimumPositions && positions.filter((p) => p.achievements < rules.CV01.thresholds.minimumAchievements).length >= rules.CV01.thresholds.minimumWeakPositions,
    CV02: positions.some((p) => p.end >= cut) && older >= rules.CV02.thresholds.minimumOlderWords && older > recent * rules.CV02.thresholds.olderDetailRatio,
    CV03: positions.some((p) => independent.test(p.text) && !classified.test(p.title)) || (positions.length === 0 && cvText.split(/\r?\n/).some((line) => independent.test(line) && !classified.test(line) && line.length < 180)),
    CV04: overlaps
  };
  return (Object.keys(triggered) as (keyof typeof triggered)[]).filter((id) => rules[id].enabled && triggered[id]).map((id) => {
    const rule = rules[id];
    const copy = e.recommendations[rule.recommendation as keyof typeof e.recommendations];
    const message = (copy[language as keyof typeof copy] || copy.en).replace(/\{recentYears\}/g, String(rules.CV02.thresholds.recentYears));
    return { id, severity: rule.severity, recommendation: rule.recommendation, message };
  });
}

export function mergeCareerWarnings(existing: string[], warnings: CareerWarning[]) {
  // Stable IDs avoid multiplying warnings when a precheck is reused/imported.
  const retained = existing.filter((text) => !/^\[CV0[1-4]\]/.test(text) && !warnings.some((w) => w.message === text) && !(warnings.some((w) => w.id === "CV01") && text === getEvaluation().legacyText.compressedCvWarning));
  return [...new Set([...retained, ...warnings.map((w) => `[${w.id}] ${w.message}`)])];
}
