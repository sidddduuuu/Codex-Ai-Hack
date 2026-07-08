import { tmpdir } from "node:os";
import { join } from "node:path";

export interface AdapterConfig {
  endpoint: string;
  apiKey?: string;
  app: string;
  agent: string;
  /** When false, unsafe chains are recorded but the tool call is still allowed (observe-only). */
  enforce: boolean;
  /** When false, traces are not uploaded (offline capture only). */
  upload: boolean;
  stateDir: string;
  internalDomains: string[];
  secretPatterns: RegExp[];
}

const DEFAULT_SECRET_PATTERNS = [
  /\.env(\.|$)/i,
  /secret/i,
  /credential/i,
  /password/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /\btoken\b/i,
  /\.p12$/i,
  /aws.*(key|cred)/i,
];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AdapterConfig {
  const endpoint = env.AGENT_BREACH_ENDPOINT?.trim() || "http://127.0.0.1:5173/api/traces";
  const apiKey = env.AGENT_BREACH_INGEST_KEY?.trim();

  return {
    endpoint,
    ...(apiKey ? { apiKey } : {}),
    app: env.AGENT_BREACH_APP?.trim() || "Claude Code Session",
    agent: env.AGENT_BREACH_AGENT?.trim() || "claude-code",
    enforce: env.AGENT_BREACH_ENFORCE !== "0",
    upload: env.AGENT_BREACH_UPLOAD !== "0",
    stateDir: env.AGENT_BREACH_STATE_DIR?.trim() || join(tmpdir(), "agent-breach"),
    internalDomains: splitList(env.AGENT_BREACH_INTERNAL_DOMAINS),
    secretPatterns: parsePatterns(env.AGENT_BREACH_SECRET_GLOBS) ?? DEFAULT_SECRET_PATTERNS,
  };
}

function splitList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parsePatterns(value: string | undefined): RegExp[] | undefined {
  const items = splitList(value);
  if (items.length === 0) {
    return undefined;
  }

  return items.map((item) => new RegExp(escapeRegExp(item), "i"));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
