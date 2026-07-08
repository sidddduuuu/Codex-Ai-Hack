import type { DataClass, DestinationClass, SourceKind, ToolBoundary } from "@agent-breach/trace-schema";
import type { AdapterConfig } from "./config.js";

export interface SourceMeta {
  id: string;
  kind: SourceKind;
  label: string;
  trust: "trusted" | "untrusted";
  dataClass: DataClass;
}

export interface ToolMeta {
  name: string;
  boundary: ToolBoundary;
  target: string;
  targetClass: DataClass;
  destinationClass?: DestinationClass;
  authority?: string;
}

export type Classification =
  | { kind: "ignore" }
  | { kind: "source"; source: SourceMeta }
  | { kind: "protected-read"; tool: ToolMeta }
  | { kind: "action"; tool: ToolMeta };

const READ_HINT = /(read|search|list|get|fetch|thread|message|inbox|view|query|load)/i;
const SEND_HINT = /(send|reply|forward|email|post|publish|webhook|dispatch|notify)/i;
const MUTATE_HINT = /(delete|remove|drop|destroy|archive|trash|purge|update|patch|move)/i;
const NETWORK_CMD = /\b(curl|wget|nc|ncat|scp|sftp|ssh|rsync|http[sp]?:\/\/)\b/i;
const DELETE_CMD = /\brm\s+-|\brmdir\b|\bshred\b|\bdd\s+if=/i;

/**
 * Maps a Claude Code tool invocation onto the Agent Breach trace schema.
 * Untrusted external content becomes a source.read; protected local reads and
 * privileged actions become tool.call events the risk engine can evaluate.
 */
export function classifyTool(toolName: string, toolInput: unknown, config: AdapterConfig): Classification {
  const name = toolName ?? "";
  const input = isRecord(toolInput) ? toolInput : {};
  const lower = name.toLowerCase();

  if (isEmailTool(lower)) {
    return classifyChannel(name, input, config, "email", "user-email-account");
  }

  if (isChatOrTicketTool(lower)) {
    return classifyChannel(name, input, config, ticketKind(lower), "workspace-integration");
  }

  if (isWebTool(lower)) {
    return { kind: "source", source: sourceMeta(name, webTarget(input), "webpage", "untrusted", "public") };
  }

  if (isFileWrite(lower)) {
    const target = pickString(input, ["file_path", "path", "target", "notebook_path"]) ?? name;
    return {
      kind: "action",
      tool: toolMeta(name, "write", target, fileClass(target, config), "internal", "local-workspace"),
    };
  }

  if (isFileRead(lower)) {
    const target = pickString(input, ["file_path", "path", "target"]) ?? name;
    const dataClass = fileClass(target, config);

    if (dataClass === "protected" || dataClass === "secret") {
      return { kind: "protected-read", tool: toolMeta(name, "read", target, dataClass, undefined, "local-workspace") };
    }

    return { kind: "ignore" };
  }

  if (lower === "bash" || lower.endsWith("__bash") || lower.includes("shell")) {
    return classifyBash(name, input);
  }

  if (isMutationTool(lower)) {
    const target = pickString(input, ["target", "id", "resource", "path", "name"]) ?? name;
    return { kind: "action", tool: toolMeta(name, "delete", target, "internal", "internal", "workspace-integration") };
  }

  if (isGenericHttpTool(lower)) {
    const target = webTarget(input);
    return { kind: "action", tool: toolMeta(name, "external-request", target, "internal", "external", "network") };
  }

  return { kind: "ignore" };
}

function classifyChannel(
  name: string,
  input: Record<string, unknown>,
  config: AdapterConfig,
  kind: SourceKind,
  authority: string,
): Classification {
  if (SEND_HINT.test(name) && !READ_HINT.test(name)) {
    const recipient = pickString(input, ["to", "recipient", "recipients", "email", "address", "channel"]) ?? "unknown";
    const destinationClass: DestinationClass = isExternalRecipient(recipient, config) ? "external" : "internal";
    return { kind: "action", tool: toolMeta(name, "send", recipient, "internal", destinationClass, authority) };
  }

  const target = pickString(input, ["query", "q", "id", "thread_id", "mailbox", "label", "search"]) ?? kind;
  return { kind: "source", source: sourceMeta(name, target, kind, "untrusted", "internal") };
}

function classifyBash(name: string, input: Record<string, unknown>): Classification {
  const command = pickString(input, ["command", "cmd", "script"]) ?? "";

  if (NETWORK_CMD.test(command)) {
    return { kind: "action", tool: toolMeta(name, "external-request", firstToken(command), "internal", "external", "shell") };
  }

  if (DELETE_CMD.test(command)) {
    return { kind: "action", tool: toolMeta(name, "delete", firstToken(command), "internal", "internal", "shell") };
  }

  return { kind: "ignore" };
}

function toolMeta(
  name: string,
  boundary: ToolBoundary,
  target: string,
  targetClass: DataClass,
  destinationClass: DestinationClass | undefined,
  authority: string,
): ToolMeta {
  return {
    name,
    boundary,
    target,
    targetClass,
    ...(destinationClass ? { destinationClass } : {}),
    authority,
  };
}

function sourceMeta(
  name: string,
  target: string,
  kind: SourceKind,
  trust: "trusted" | "untrusted",
  dataClass: DataClass,
): SourceMeta {
  return {
    id: `src_${slug(`${name}_${target}`)}`,
    kind,
    label: `${prettyName(name)}: ${truncate(target, 48)}`,
    trust,
    dataClass,
  };
}

function isEmailTool(name: string): boolean {
  return /(gmail|\bmail\b|outlook|imap|smtp|sendgrid|mailgun|ses)/.test(name);
}

function isChatOrTicketTool(name: string): boolean {
  return /(slack|notion|linear|jira|asana|zendesk|intercom|discord|teams|confluence)/.test(name);
}

function ticketKind(name: string): SourceKind {
  return /(jira|linear|asana|zendesk|intercom)/.test(name) ? "ticket" : "webpage";
}

function isWebTool(name: string): boolean {
  return (
    name === "webfetch" ||
    name === "websearch" ||
    /(web_?fetch|web_?search|browser|puppeteer|playwright|crawl|scrape|fetch_url)/.test(name)
  );
}

function isFileWrite(name: string): boolean {
  return ["write", "edit", "multiedit", "notebookedit"].includes(name) || /(write_file|create_file|apply_patch)/.test(name);
}

function isFileRead(name: string): boolean {
  return name === "read" || /(fs_?read|read_file|cat_file|open_file)/.test(name);
}

function isMutationTool(name: string): boolean {
  return MUTATE_HINT.test(name);
}

function isGenericHttpTool(name: string): boolean {
  return /(http|request|api_call|rest|graphql)/.test(name);
}

function isExternalRecipient(recipient: string, config: AdapterConfig): boolean {
  const at = recipient.lastIndexOf("@");
  if (at === -1) {
    return true;
  }

  const domain = recipient.slice(at + 1).toLowerCase();
  return !config.internalDomains.some((internal) => domain === internal || domain.endsWith(`.${internal}`));
}

function fileClass(target: string, config: AdapterConfig): DataClass {
  return config.secretPatterns.some((pattern) => pattern.test(target)) ? "secret" : "internal";
}

function webTarget(input: Record<string, unknown>): string {
  return pickString(input, ["url", "uri", "query", "q", "prompt"]) ?? "web";
}

function pickString(input: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0].trim();
    }
  }

  return undefined;
}

function firstToken(command: string): string {
  return command.trim().split(/\s+/)[0] ?? command;
}

function prettyName(name: string): string {
  const parts = name.split("__");
  return parts[parts.length - 1] ?? name;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
