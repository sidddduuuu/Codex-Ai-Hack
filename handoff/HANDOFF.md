# Agent Breach Replay — Studio UI · Handoff spec

Reference implementation: `Agent Breach Replay Studio.html` (single self-contained file in this folder). Open it in a browser — it is fully interactive. Its source contains the complete markup, all inline styles, and a `Component` class with the state machine and all demo data. **Treat it as the source of truth; this doc is the map.**

## What to build
A React (Vite) SPA: a security trace replay studio for tool-using AI agents. 5 screens in one console shell, 3 demo scenarios.

## Screens (all present in the reference)
1. **Incidents** — 4 stat cards + incident table (colored severity/mode/decision pills). Row click → Replay.
2. **Replay** — split view: step timeline (left, ~0.68fr) ⇄ influence graph (right, ~1.52fr). Prev/Play/Next + tick scrubber. Stepping reveals graph nodes/edges progressively; final step shows a red violation banner.
3. **Policy log** — table of rule evaluations (time / rule / target / decision / reason).
4. **Guardrails** — Observed (UNSAFE) vs With-guardrails (SAFE) chains side by side + recommendation card.
5. **Report** — printable incident report card (meta grid, summary, security path, policy decisions).

## App state (see `state` + `vals()` in reference JS)
`{ screen: 'board'|'replay'|'policy'|'guard'|'report', scen: 0-2, step: number, playing: bool }`
- Scenario tabs (INC-0042 / INC-0038 / INC-0035) in the top bar on non-board screens.
- Play = setInterval advancing `step` (default 1500ms), pauses at last step.
- A graph node/edge is visible when its `at <= step`; current step's node gets a glow ring.

## Data model (3 scenarios embedded in reference `scen()`)
Scenario: `{ id, app, violation, severity, decision, when, dur, mode, predicates[], summary, nodes[], edges[], steps[], policies[], guardrail }`
- `nodes`: `{ id, label, sub, kind: trusted|untrusted|model|tool|protected|external|policy, at, x, y }` (x/y are 0–1 fractions of the graph canvas)
- `edges`: `{ f, t, at, taint?, blocked? }` — taint = red 2.5px + arrowhead; blocked = dashed + red × marker at target.
- `steps`: `{ t, kind: source|model|tool|data|policy|violation, title, detail, decision? }`

## Design tokens
- Fonts: Instrument Sans (UI), JetBrains Mono (ids, labels, timestamps). Google Fonts.
- Surfaces: page `#f7f6f2`, sidebar `#fbfaf7`, cards `#fff`, borders `#e5e3dd` / row dividers `#f0eee8`, ink `#1c1e21`, muted `#74777d` / `#9a988f`.
- Vibrant pills (bg / text): trusted-green `#e3f6ec/#0f7a4d`, untrusted-red `#fde9e4/#d3402a`, amber `#fdf1dc/#b06a00`, tool-blue `#e9edff/#4353ff`, policy-purple `#f1edff/#6b46ff`, SDK `#e6f4fd/#0b7fc2`, ADAPTER `#e6f7f3/#0d8a6a`, PROXY `#f1edff/#6b46ff`.
- Decision chips: Blocked/Violation/Denied red, Allowed/Prevented green, others amber.
- Taint/danger accent: `#d3402a`. Primary buttons: `#1c1e21`. Logo: conic-gradient rounded square.
- Graph canvas: white with `radial-gradient(#e8e6df 1px, transparent 1px)` 22px dot grid; edges are cubic béziers (horizontal S-curves between node edges).
- Node cards: 144×80, white, radius 12, kind word (SOURCE / MODEL STEP / TOOL CALL / DATA / DESTINATION / DECISION) top-left + colored pill top-right; untrusted/external get a 1.5px red border + soft red halo.

## Suggested React structure
`AppShell` (sidebar + topbar) · `IncidentsBoard` · `ReplayView` (`Timeline`, `InfluenceGraph`, `TransportControls`) · `PolicyLog` · `GuardrailCompare` · `ReportCard` · `scenarios.ts` (data). Graph = absolutely-positioned divs over one SVG layer (as in reference) — no graph library needed.
