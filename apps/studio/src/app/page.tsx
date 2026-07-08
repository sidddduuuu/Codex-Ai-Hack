import {
  ArrowRight,
  Ban,
  Eye,
  FileSearch,
  GitBranch,
  Lock,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { HeroChain } from "../components/landing/HeroChain";

const PREDICATES = [
  { name: "Exfiltration", severity: "critical", tone: "#d3402a", bg: "#fde9e4", desc: "Protected data reaches an external destination through the tool chain." },
  { name: "Untrusted-to-action", severity: "high", tone: "#d3402a", bg: "#fde9e4", desc: "Content from an untrusted source drives a privileged or real-world action." },
  { name: "Confused deputy", severity: "high", tone: "#6b46ff", bg: "#f1edff", desc: "The agent's own authority is used to satisfy an attacker-originated goal." },
  { name: "Destructive write", severity: "high", tone: "#b06a00", bg: "#fdf1dc", desc: "An unsafe influence chain reaches a write, delete, or mutation boundary." },
];

const PILLARS = [
  {
    icon: FileSearch,
    kicker: "TRACE",
    title: "Instrument tool calls, not inboxes",
    body: "An SDK and a Claude Code hook wrap the tools your agent already uses. Every call becomes a metadata-only event with trust labels and taint links — never message bodies.",
  },
  {
    icon: Workflow,
    kicker: "DETECT",
    title: "Deterministic security predicates",
    body: "Four rules run over the trace graph: exfiltration, untrusted-to-action, confused deputy, and destructive write. No model, no guesswork — the same rule that blocks is the one you replay.",
  },
  {
    icon: ShieldCheck,
    kicker: "REPLAY & BLOCK",
    title: "Stop it before it runs, then prove it",
    body: "In enforce mode the hook denies the unsafe call before execution. In the studio you scrub the whole chain step by step and export a shareable finding.",
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteNav />

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-16 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-10 lg:pt-20">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-red" />
            Security replay for AI agents
          </span>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
            Replay how your agent crossed the line.
          </h1>
          <p className="mt-5 text-lg leading-7 text-muted">
            Agents don&apos;t fail on one bad prompt. They fail across a chain — untrusted input,
            a tainted plan, a privileged tool, an unsafe action. Cordon traces that chain, blocks
            it before it runs, and lets you replay exactly what happened.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90"
              href="/studio"
            >
              Open the Studio
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white px-5 text-sm font-semibold transition hover:bg-active"
              href="#how"
            >
              How it works
            </a>
          </div>
          <p className="mt-5 font-mono text-[11px] text-soft">Wireshark for AI agents · metadata-only capture</p>
        </div>

        <div className="lg:pl-4">
          <HeroChain />
        </div>
      </section>

      <section className="border-y border-line bg-sidebar" id="how">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
              The failure is the chain, not the prompt.
            </h2>
            <p className="mt-3 text-base leading-7 text-muted">
              A single trusted task meets a single piece of untrusted content, and five steps later
              your agent is exfiltrating a secret. Cordon makes every hop visible and names the exact
              boundary that was crossed.
            </p>
          </div>

          <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["01", "Trusted task", "The user's real instruction"],
              ["02", "Untrusted content", "Email, webpage, ticket, file"],
              ["03", "Tainted plan", "Attacker text treated as authority"],
              ["04", "Privileged tool", "Read secret · send · delete"],
              ["05", "Unsafe action", "Crosses the boundary — or gets blocked"],
            ].map(([num, title, sub], index) => (
              <li
                className={`rounded-xl border bg-white p-4 shadow-card ${index === 4 ? "border-red/30" : "border-line"}`}
                key={num}
              >
                <p className={`font-mono text-[11px] font-semibold ${index === 4 ? "text-red" : "text-muted"}`}>{num}</p>
                <p className="mt-3 font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-5 text-muted">{sub}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-3">
          {PILLARS.map((pillar) => (
            <article className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-card" key={pillar.kicker}>
              <pillar.icon aria-hidden="true" className="h-6 w-6 text-ink" strokeWidth={1.8} />
              <p className="mt-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{pillar.kicker}</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.01em]">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-sidebar">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Four predicates, one meaning for color.</h2>
              <p className="mt-3 text-base leading-7 text-muted">
                Severity is semantic, never decorative. Red is triggered, amber is observed, green is
                blocked — the same language across the graph, the timeline, and the report.
              </p>
            </div>
            <a className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold text-ink hover:underline" href="/studio">
              See them in a replay
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {PREDICATES.map((predicate) => (
              <article className="flex items-start gap-4 rounded-xl border border-line bg-white p-5 shadow-card" key={predicate.name}>
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: predicate.bg }}>
                  <Ban aria-hidden="true" className="h-4 w-4" style={{ color: predicate.tone }} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{predicate.name}</h3>
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase"
                      style={{ background: predicate.bg, color: predicate.tone }}
                    >
                      {predicate.severity}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-5 text-muted">{predicate.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="max-w-xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Integrate</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
              Three ways in. Start with the hook.
            </h2>
            <p className="mt-3 text-base leading-7 text-muted">
              The Claude Code adapter watches a live session and denies unsafe tool calls before they
              run — no code changes to your agent. Or wrap tools directly with the SDK, or import a
              trace JSON from any runtime.
            </p>
            <ul className="mt-6 grid gap-3">
              {[
                [GitBranch, "Claude Code hook", "Drop-in PreToolUse hook. Blocks and streams replays."],
                [Workflow, "TypeScript SDK", "wrapTool() with enforce mode for any agent runtime."],
                [Eye, "Trace import", "Upload replay JSON — validate, detect, and replay."],
              ].map(([Icon, title, sub]) => {
                const IconComponent = Icon as typeof GitBranch;
                return (
                  <li className="flex items-start gap-3" key={title as string}>
                    <IconComponent aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={1.8} />
                    <p className="text-sm leading-5">
                      <span className="font-semibold">{title as string}</span>
                      <span className="text-muted"> — {sub as string}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-ink shadow-card">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber" />
              <span className="h-2.5 w-2.5 rounded-full bg-green" />
              <span className="ml-2 font-mono text-[11px] text-white/50">.claude/settings.json</span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 font-mono text-[12px] leading-6 text-white/90">
{`{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node ./adapter/dist/cli.js"
      }]
    }]
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-sidebar">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-5 py-8">
          <Lock aria-hidden="true" className="h-5 w-5 text-ink" strokeWidth={1.8} />
          <p className="max-w-2xl text-sm leading-6 text-muted">
            <span className="font-semibold text-ink">Metadata-only by default.</span> Cordon captures
            tool names, boundaries, trust labels, and taint links — not message bodies or file
            contents. The privacy posture is visible in the studio, not buried in docs.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="max-w-lg">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Built with Codex</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Agent-built, end to end.</h2>
            <p className="mt-3 text-base leading-7 text-muted">
              Cordon was built with Codex as the coding agent. It scaffolded the monorepo from a
              one-page brief, wired the Supabase backend over the Model Context Protocol, wrote the
              deterministic detector engine, and shipped the studio to production — without leaving
              the agent loop.
            </p>
            <ul className="mt-6 grid gap-2.5">
              {[
                "Schema, SDK, detectors, and studio scaffolded from goal.md",
                "Supabase migrations, RLS, and API routes wired via MCP",
                "Iterated to a deployed studio, hook adapter, and trace import",
              ].map((item) => (
                <li className="flex items-start gap-2.5 text-sm leading-5" key={item}>
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
                  <span className="text-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-ink shadow-card">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber" />
              <span className="h-2.5 w-2.5 rounded-full bg-green" />
              <span className="ml-2 font-mono text-[11px] text-white/50">codex — build log</span>
            </div>
            <div className="overflow-x-auto px-4 py-4 font-mono text-[12px] leading-6">
              <p className="text-white/90"><span className="text-green">$</span> codex &quot;scaffold Cordon from goal.md&quot;</p>
              <p className="text-white/60">  ✓ trace-schema · detectors · sdk · studio</p>
              <p className="mt-2 text-white/90"><span className="text-green">$</span> codex mcp add supabase</p>
              <p className="text-white/60">  ✓ migrations · row-level security · routes</p>
              <p className="mt-2 text-white/90"><span className="text-green">$</span> codex &quot;add the hook, import spans, ship it&quot;</p>
              <p className="text-white/60">  ✓ live tool-call tracing + block</p>
              <p className="text-white/60">  ✓ deployed → columbia-kappa.vercel.app</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl border-t border-line px-5 py-20 text-center lg:py-28">
        <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          See the breach your agent almost shipped.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
          Open the studio and replay a real untrusted-to-action chain, step by step, from source to
          blocked boundary.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-6 text-sm font-semibold text-white transition hover:bg-ink/90"
            href="/studio"
          >
            Open the Studio
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[conic-gradient(from_180deg,#d3402a,#4353ff,#0f7a4d,#d3402a)]">
              <div className="h-3 w-3 rounded-full bg-paper" />
            </div>
            <div>
              <p className="text-sm font-semibold">Cordon</p>
              <p className="font-mono text-[10px] text-soft">Security replay for AI agents</p>
            </div>
          </div>
          <div className="flex items-center gap-5 font-mono text-[12px] text-muted">
            <a className="hover:text-ink" href="/studio">Studio</a>
            <a className="hover:text-ink" href="#how">How it works</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SiteNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
        <a className="flex items-center gap-2.5" href="/">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[conic-gradient(from_180deg,#d3402a,#4353ff,#0f7a4d,#d3402a)] shadow-sm">
            <div className="h-3 w-3 rounded-full bg-paper" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Cordon</span>
        </a>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <a className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:text-ink sm:block" href="#how">
            How it works
          </a>
          <a
            className="inline-flex min-h-9 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink/90"
            href="/studio"
          >
            Open Studio
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
