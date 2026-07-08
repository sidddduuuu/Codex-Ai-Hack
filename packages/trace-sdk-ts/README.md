# Agent Breach Trace SDK

TypeScript SDK for recording replay-compatible security traces around agent
sources and tools.

## Install

From a checked-out repo:

```sh
npm install
npm run build:sdk
```

For an external app during alpha, pack the SDK and schema packages:

```sh
npm run pack:sdk
npm install ./agent-breach-trace-schema-0.1.0.tgz ./agent-breach-trace-sdk-ts-0.1.0.tgz
```

After publishing, the install path is:

```sh
npm install @agent-breach/trace-sdk-ts
```

## Block a Risky Tool Call

```ts
import { SecurityPolicyBlockedError, createSecurityTrace, sendReplayTrace } from "@agent-breach/trace-sdk-ts";

const trace = createSecurityTrace({
  app: "Vendor Email Assistant",
  agent: "email-ops-agent",
  captureMode: "metadata-only",
});

const vendorEmail = trace.source({
  id: "src_vendor_email",
  kind: "email",
  label: "External vendor email",
  trust: "untrusted",
  dataClass: "internal",
});

const sendEmail = trace.wrapTool(
  "email.send",
  async (recipient: string) => ({ recipient }),
  {
    boundary: "send",
    destinationClass: "external",
    targetClass: "internal",
    influencedBy: [vendorEmail],
    authority: "user-email-account",
    targetFromArgs: (recipient) => String(recipient),
    enforce: true,
  },
);

try {
  await sendEmail("audit@example.net");
} catch (error) {
  if (!(error instanceof SecurityPolicyBlockedError)) {
    throw error;
  }
}

const replay = trace.end("blocked");
await sendReplayTrace(replay, {
  endpoint: "https://your-studio.example.com/api/traces",
});
```

`enforce: true` records the attempted tool call and a policy decision, then
throws before the wrapped function executes when untrusted influence reaches an
external, protected, privileged, or mutation boundary.
