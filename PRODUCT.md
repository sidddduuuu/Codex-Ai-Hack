# Product

## Register

product

## Users

Agent developers and security engineers investigating how a tool-using AI agent
crossed a security boundary. They arrive mid-incident or mid-review with a
stored trace, need to reconstruct the chain (untrusted source → model step →
privileged tool call → unsafe action), and leave with a finding they can share.
Secondary: hackathon judges and prospects evaluating the product from the same
screen — the demo IS the product surface.

## Product Purpose

Agent Breach Replay is a security trace layer plus visual replay studio.
The studio loads a recorded agent run (from the SDK or a bundled fixture),
replays it step by step, surfaces deterministic security predicates
(exfiltration, untrusted-to-action, confused deputy, destructive write),
shows how defenses would have changed the outcome, and exports a markdown
finding. Success: a viewer understands exactly where the breach happened
within one replay, without reading raw logs.

## Brand Personality

Forensic, calm, precise. Wireshark/Linear energy: the tool is confident and
quiet so the evidence can be loud. Severity is communicated with restrained,
semantic color against a neutral surface — never with alarm-console noise.

## Anti-references

- SOC/SIEM alarm walls: blinking reds, threat-level gauges, dark "hacker" chrome.
- Generic SaaS dashboard-by-numbers: uniform stat-card grids, decorative charts.
- Attack-tool aesthetics: this is a debugger/replay workbench, not an offensive tool.

## Design Principles

1. **The trace is the hero.** Chrome recedes; timeline, graph, and predicates
   carry the visual weight. No decoration that competes with evidence.
2. **Severity is semantic.** Red/amber/green mean triggered/observed/blocked —
   consistently, everywhere, and never used decoratively.
3. **Replay is a narrative.** Stepping through a run should read as a story
   with a clear current position, past, and future.
4. **Calm under bad news.** The UI stays composed while showing a breach;
   precision and legibility over urgency theatrics.
5. **Metadata-first honesty.** Privacy posture (metadata-only capture) is
   visible in the UI, not buried in docs.

## Accessibility & Inclusion

- Target WCAG 2.1 AA: 4.5:1 body contrast, visible focus, full keyboard
  operability for replay controls.
- Severity states never rely on color alone (pair with icons/labels).
- Respect `prefers-reduced-motion` for replay/graph animation.
