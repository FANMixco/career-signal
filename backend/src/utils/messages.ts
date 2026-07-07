import { readFileSync } from "node:fs";

type BackendMessages = {
  errors: Record<string, string>;
};

export const messages = JSON.parse(readFileSync(new URL("../content/messages.json", import.meta.url), "utf8")) as BackendMessages;
