# @agent-breach/adapter-claude-code

A Claude Code hook adapter that turns real tool calls into Agent Breach security
traces, blocks untrusted-to-action chains **before they execute**, and streams
the replay to Agent Breach Studio.

It is the first real integration for the SDK: instead of a scripted trace, this
watches your live Claude Code session.

## What it does

On every `PreToolUse` event, the adapter:

1. **Classifies the tool call** onto the trace schema — untrusted external
   content (Gmail, web, tickets) becomes a `source.read`; protected local reads
   (`.env`, keys, secrets) and privileged actions (send, write, delete, external
   request) become `tool.call` events.
2. **Tracks taint** across the session (persisted per `session_id`).
3. **Evaluates risk** with the same `evaluateToolRisk` rule the studio
   visualizes. If untrusted content is influencing a privileged action, it
   returns a `deny` decision and Claude Code never runs the tool.
4. **Streams the trace** to the studio so you can replay the blocked chain.

Capture is **metadata-only**: tool names, boundaries, trust labels, and taint
links — never message bodies or file contents.

## Wire it into Claude Code

Add to `.claude/settings.json` (project) or `~/.claude/settings.json` (global):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "node /ABS/PATH/packages/adapter-claude-code/dist/cli.js" }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "node /ABS/PATH/packages/adapter-claude-code/dist/cli.js" }
        ]
      }
    ]
  }
}
```

Build first: `npm run build --workspace @agent-breach/adapter-claude-code`.

## Configuration (env vars)

| Var | Default | Purpose |
| --- | --- | --- |
| `AGENT_BREACH_ENDPOINT` | `http://127.0.0.1:5173/api/traces` | Studio ingest URL |
| `AGENT_BREACH_INGEST_KEY` | _(none)_ | Sent as `Authorization: Bearer` when the studio requires it |
| `AGENT_BREACH_ENFORCE` | `1` | `0` = observe-only (record + warn, never block) |
| `AGENT_BREACH_UPLOAD` | `1` | `0` = capture locally, do not upload |
| `AGENT_BREACH_APP` | `Claude Code Session` | Run label in the studio |
| `AGENT_BREACH_INTERNAL_DOMAINS` | _(none)_ | Comma list; recipients on these domains count as internal |
| `AGENT_BREACH_SECRET_GLOBS` | built-in | Comma list of substrings that mark a file secret-class |
| `AGENT_BREACH_STATE_DIR` | `$TMPDIR/agent-breach` | Where per-session trace state is kept |

## Demo (no Gmail required)

With the studio running (`PORT=5173 npm run dev`):

```sh
npm run demo --workspace @agent-breach/adapter-claude-code
```

This feeds the classic chain — untrusted email → secret read → external send —
through the real CLI. Step 3 is denied, and the run appears in the studio board
as `run_cc_gmail-attack-demo`.

## Fail-open by design

Any adapter error (bad input, studio down, classification bug) allows the tool
and logs to stderr. A monitoring hook should never brick your session. Run with
`AGENT_BREACH_ENFORCE=0` first to watch what it flags before letting it block.
