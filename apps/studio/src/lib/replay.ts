import type { Finding, TraceEvent, TraceRun, ViolationType } from "@agent-breach/trace-schema";

export interface TimelineStep {
  id: string;
  event: TraceEvent;
  index: number;
  title: string;
  subtitle: string;
  badge: string;
  tone: "blue" | "green" | "yellow" | "red" | "violet" | "muted";
}

export function toTimeline(run: TraceRun): TimelineStep[] {
  return run.events.map((event, index) => ({
    id: event.id,
    event,
    index: index + 1,
    title: titleFor(event),
    subtitle: event.summary,
    badge: event.type,
    tone: toneFor(event),
  }));
}

export function eventLabel(event: TraceEvent): string {
  if (event.type === "source.read") {
    return event.source.label;
  }

  if (event.type === "tool.call") {
    return event.tool.name;
  }

  if (event.type === "policy.decision") {
    return event.decision;
  }

  if (event.type === "violation.detected") {
    return event.violation.type;
  }

  if (event.type === "model.step") {
    return event.step.label;
  }

  return event.type;
}

export function generateMarkdownReport(run: TraceRun, findings: Finding[]): string {
  const findingLines =
    findings.length > 0
      ? findings.map(
          (finding) =>
            `- **${labelViolation(finding.type)} (${finding.severity})**: ${finding.summary} Recommendation: ${finding.recommendation}`,
        )
      : ["- No deterministic findings detected."];

  const traceLines = run.events.map((event, index) => {
    return `${index + 1}. **${event.type}** / ${eventLabel(event)}: ${event.summary}`;
  });

  return [
    `# Agent Breach Replay Report: ${run.app}`,
    "",
    `**Run:** ${run.id}`,
    `**Agent:** ${run.agent}`,
    `**Capture mode:** ${run.captureMode}`,
    "",
    "## Findings",
    ...findingLines,
    "",
    "## Replay Trace",
    ...traceLines,
    "",
    "## Privacy Note",
    "This report was generated from metadata-only security trace events. Raw customer content is not required for this replay.",
    "",
  ].join("\n");
}

export function labelViolation(type: ViolationType): string {
  const labels: Record<ViolationType, string> = {
    exfiltration: "Exfiltration",
    untrusted_to_action: "Untrusted-to-action",
    confused_deputy: "Confused deputy",
    destructive_write: "Destructive write",
  };

  return labels[type];
}

function titleFor(event: TraceEvent): string {
  if (event.type === "source.read") {
    return `Source read: ${event.source.label}`;
  }

  if (event.type === "model.step") {
    return `Model step: ${event.step.label}`;
  }

  if (event.type === "tool.call") {
    return `Tool call: ${event.tool.name}`;
  }

  if (event.type === "policy.decision") {
    return `Policy ${event.decision}`;
  }

  if (event.type === "violation.detected") {
    return `Violation: ${labelViolation(event.violation.type)}`;
  }

  if (event.type === "trace.end") {
    return `Trace ${event.outcome}`;
  }

  return "Trace started";
}

function toneFor(event: TraceEvent): TimelineStep["tone"] {
  if (event.type === "source.read") {
    return event.source.trust === "untrusted" ? "yellow" : "green";
  }

  if (event.type === "tool.call") {
    return event.tool.destinationClass === "external" || event.tool.targetClass === "secret" ? "red" : "blue";
  }

  if (event.type === "policy.decision") {
    return event.decision === "blocked" ? "green" : "violet";
  }

  if (event.type === "violation.detected") {
    return "red";
  }

  if (event.type === "model.step") {
    return "violet";
  }

  return "muted";
}
