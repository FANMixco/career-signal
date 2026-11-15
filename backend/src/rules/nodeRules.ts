import { AsyncLocalStorage } from "node:async_hooks";
import { currentRules, setRulesContext, type RuleData } from "./rulesRuntime.js";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { RulesManager, type RulesStorage, type StoredRules } from "./rulesRuntime.js";

export function fileRulesStorage(directory: string): RulesStorage {
  return {
    async read() {
      try { return JSON.parse(await readFile(path.join(directory, "rules-state.json"), "utf8")); }
      catch { return undefined; }
    },
    async write(state: StoredRules) {
      await mkdir(directory, { recursive: true });
      const temporary = path.join(directory, `rules-state.${process.pid}.tmp`);
      await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
      await rename(temporary, path.join(directory, "rules-state.json"));
    }
  };
}

const context = new AsyncLocalStorage<RuleData>();
setRulesContext(() => context.getStore());
export function withRules<T>(fn: () => T): T { return context.run(currentRules(), fn); }

let manager: RulesManager | undefined;
export async function initializeRules() {
  if (manager) return manager;
  const directory = process.env.CAREER_SIGNAL_RULES_DIR || path.join(os.homedir(), ".career-signal", "rules");
  const hours = Number(process.env.CAREER_SIGNAL_RULES_REFRESH_HOURS || 24);
  manager = new RulesManager(fileRulesStorage(directory), process.env.CAREER_SIGNAL_RULES_SOURCE, Number.isFinite(hours) && hours > 0 ? hours * 3600000 : 86400000);
  await manager.load();
  void manager.refresh(); // No network on the startup/analysis critical path.
  const timer = setInterval(() => { void manager?.refresh(); }, 60000);
  timer.unref();
  return manager;
}
