import { Ban } from "lucide-react";

interface ChainNode {
  kicker: string;
  tag: string;
  label: string;
  sub: string;
  pill: string;
  ink: string;
  border: string;
}

const NODES: ChainNode[] = [
  { kicker: "SOURCE", tag: "TR", label: "User task", sub: "trusted · internal", pill: "#e3f6ec", ink: "#0f7a4d", border: "#dfddd6" },
  { kicker: "SOURCE", tag: "UN", label: "External email", sub: "untrusted · inbound", pill: "#fde9e4", ink: "#d3402a", border: "#d3402a" },
  { kicker: "MODEL", tag: "AI", label: "Agent plan", sub: "reads secret.txt", pill: "#fdf1dc", ink: "#b06a00", border: "#dfddd6" },
  { kicker: "TOOL", tag: "EX", label: "email.send", sub: "→ audit@example.net", pill: "#fde9e4", ink: "#d3402a", border: "#d3402a" },
];

/**
 * The influence chain as the hero: a trusted task and an untrusted email drive
 * a plan and an external send that gets blocked. Vertical so it fits any column
 * without clipping, mirroring the studio's timeline.
 */
export function HeroChain() {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Influence graph</p>
        <span className="inline-flex items-center rounded-full bg-[#fde9e4] px-2.5 py-1 font-mono text-[11px] font-semibold text-red">
          Untrusted-to-action · Blocked
        </span>
      </div>

      <ol className="rounded-xl border border-line bg-dot-grid p-3 sm:p-4">
        {NODES.map((node, index) => (
          <li key={node.label}>
            {index > 0 && <Connector tainted={index >= 2} />}
            <Node node={node} />
          </li>
        ))}
        <li>
          <Connector tainted blocked />
          <BlockedNode />
        </li>
      </ol>
    </div>
  );
}

function Node({ node }: { node: ChainNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-2.5 shadow-card" style={{ border: `1.5px solid ${node.border}` }}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-semibold" style={{ background: node.pill, color: node.ink }}>
        {node.tag}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{node.label}</p>
          <span className="shrink-0 font-mono text-[10px] font-semibold text-muted">{node.kicker}</span>
        </div>
        <p className="truncate font-mono text-[10px] text-soft">{node.sub}</p>
      </div>
    </div>
  );
}

function BlockedNode() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red/30 bg-[#fde9e4] px-3.5 py-2.5 shadow-card">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red/10">
        <Ban aria-hidden="true" className="h-4 w-4 text-red" />
      </span>
      <div>
        <p className="text-sm font-semibold text-red">Blocked before execution</p>
        <p className="font-mono text-[10px] text-red/70">policy · enforced</p>
      </div>
    </div>
  );
}

function Connector({ tainted, blocked }: { tainted: boolean; blocked?: boolean }) {
  const color = tainted ? "#d3402a" : "#c6c4bd";

  return (
    <div aria-hidden="true" className="flex justify-start pl-[1.55rem]">
      <span
        className="my-0.5 h-4 w-0.5 rounded-full"
        style={{
          background: blocked ? undefined : color,
          opacity: tainted ? 0.9 : 0.5,
          ...(blocked
            ? { backgroundImage: `repeating-linear-gradient(${color} 0 3px, transparent 3px 6px)` }
            : {}),
        }}
      />
    </div>
  );
}
