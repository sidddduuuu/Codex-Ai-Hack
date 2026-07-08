"use client";

import type { Finding, TraceRun } from "@agent-breach/trace-schema";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useMemo } from "react";
import { eventLabel } from "../lib/replay";

export function TraceGraph({ findings, run }: { findings: Finding[]; run: TraceRun }) {
  const { edges, nodes } = useMemo(() => buildGraph(run, findings), [findings, run]);

  return (
    <section className="h-[460px] min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-normal text-breach-violet">Influence graph</p>
        <h2 className="mt-1 text-xl font-semibold">Source to tool boundary</h2>
      </div>
      <div className="h-[370px] min-w-0 overflow-hidden rounded-lg border border-line bg-slate-950/45">
        <ReactFlow
          colorMode="dark"
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          nodes={nodes}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#2b3948" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}

function buildGraph(run: TraceRun, findings: Finding[]): { nodes: Node[]; edges: Edge[] } {
  const findingEventIds = new Set(findings.flatMap((finding) => finding.evidenceEventIds));
  const sourceEvents = run.events.filter((event) => event.type === "source.read");
  const toolEvents = run.events.filter((event) => event.type === "tool.call");

  const nodes: Node[] = [
    ...sourceEvents.map((event, index) => ({
      id: event.source.id,
      type: "default",
      position: { x: 0, y: index * 120 },
      data: { label: `${event.source.trust}: ${event.source.label}` },
      className:
        event.source.trust === "untrusted"
          ? "rounded-lg border border-breach-yellow bg-breach-yellow/20 px-3 py-2 text-ink"
          : "rounded-lg border border-breach-green bg-breach-green/20 px-3 py-2 text-ink",
    })),
    ...toolEvents.map((event, index) => ({
      id: event.id,
      type: "default",
      position: { x: 420, y: index * 120 },
      data: { label: `${event.tool.boundary}: ${eventLabel(event)}` },
      className: `rounded-lg border px-3 py-2 text-ink ${
        findingEventIds.has(event.id)
          ? "border-breach-red bg-breach-red/20"
          : "border-breach-blue bg-breach-blue/20"
      }`,
    })),
  ];

  const edges = toolEvents.flatMap((event) =>
    event.tool.influencedBy
      .filter((id) => nodes.some((node) => node.id === id))
      .map((sourceId) => ({
        id: `${sourceId}-${event.id}`,
        source: sourceId,
        target: event.id,
        animated: findingEventIds.has(event.id),
        style: { stroke: findingEventIds.has(event.id) ? "#ff6b6b" : "#66b3ff" },
      })),
  );

  return { nodes, edges };
}
