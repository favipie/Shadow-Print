"use client";
import { useMemo, useState } from "react";
import { useDataset, useLive } from "@/components/data-provider";
import type { WorkspaceData } from "@/lib/api";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import { stamp } from "@/lib/investigation-data";
import { route } from "@/lib/demo-engine";
import { Button } from "@/components/ui/button";
import { AccountLink, Empty, EvidenceRows, Field, SectionHead } from "./shared";
function buildNodes(
  profiles: WorkspaceData["profiles"],
  devices: WorkspaceData["devices"],
): Node[] {
  return [
    ...profiles.map((p, i) => ({
      id: p.id,
      position: { x: 70 + (i % 3) * 300, y: 70 + Math.floor(i / 3) * 190 },
      data: { label: "@" + p.handle },
      style: {
        background: "#1d3030",
        color: "#e2f3e9",
        border: "1px solid #406958",
        borderRadius: 9,
        width: 175,
        fontSize: 12,
      },
    })),
    ...devices.map((d, i) => ({
      id: d.id,
      position: { x: 1050 + (i % 2) * 250, y: 70 + Math.floor(i / 2) * 190 },
      data: { label: d.id + " · " + d.name },
      style: {
        background: "#252837",
        color: "#d3d8ef",
        border: "1px solid #565c77",
        borderRadius: 7,
        width: 185,
        fontSize: 11,
      },
    })),
  ];
}
export default function NetworkScreen({ params }: { params: URLSearchParams }) {
  const { profiles, devices, connections, comments, logins, handle } =
    useDataset();
  const live = useLive();
  const initialNodes = useMemo(
    () => buildNodes(profiles, devices),
    [profiles, devices],
  );
  const focus = params.get("account");
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [kind, setKind] = useState("All");
  const [selected, setSelected] = useState(focus ?? "A-001");
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const allowed = connections.filter((c) => kind === "All" || c.kind === kind);
  const focusedIds = new Set(
    focus
      ? [
          focus,
          ...connections
            .filter((c) => c.source === focus || c.target === focus)
            .flatMap((c) => [c.source, c.target]),
        ]
      : nodes.map((n) => n.id),
  );
  // Include accounts on the focal account's device to make the association inspectable.
  if (focus)
    connections
      .filter((c) => focusedIds.has(c.target))
      .forEach((c) => focusedIds.add(c.source));
  const visibleConnections = allowed.filter(
    (c) => focusedIds.has(c.source) && focusedIds.has(c.target),
  );
  const related = new Set([
    selected,
    ...visibleConnections
      .filter((c) => c.source === selected || c.target === selected)
      .flatMap((c) => [c.source, c.target]),
  ]);
  const edges: Edge[] = visibleConnections.map((c) => ({
    id: c.id,
    source: c.source,
    target: c.target,
    label: c.kind === "Device usage" ? "device" : "same target / text",
    type: "smoothstep",
    style: {
      stroke: c.kind === "Device usage" ? "#8e94b2" : "#2dd4bf",
      strokeWidth: c.id === edgeId ? 3 : 1.5,
      opacity: related.has(c.source) && related.has(c.target) ? 1 : 0.25,
    },
    labelStyle: { fill: "#c6d5e2", fontSize: 9 },
    labelBgStyle: { fill: "#101720" },
    selected: c.id === edgeId,
  }));
  const shownNodes = nodes
    .filter((n) => focusedIds.has(n.id))
    .filter(
      (n) =>
        kind === "All" ||
        visibleConnections.some((c) => c.source === n.id || c.target === n.id),
    )
    .map((n) => ({
      ...n,
      selected: n.id === selected,
      style: {
        ...n.style,
        opacity: related.has(n.id) ? 1 : 0.35,
        borderWidth: n.id === selected ? 2 : 1,
      },
    }));
  const edge = visibleConnections.find((c) => c.id === edgeId);
  const device = devices.find((d) => d.id === selected);
  const profile = profiles.find((p) => p.id === selected);
  return (
    <div className="screen-stack">
      <div className="callout">
        {live
          ? "SQL-derived relationships with original evidence IDs."
          : "Authored mock connections with original record IDs."}{" "}
        A shared device is an association requiring context and contributes zero
        risk points.
      </div>
      <div className="network-layout">
        <section className="panel graph-panel">
          <div className="graph-toolbar">
            <Field label="Connection type">
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setEdgeId(null);
                }}
              >
                <option>All</option>
                <option>Device usage</option>
                <option>Coordinated posting</option>
              </select>
            </Field>
            <span>
              {shownNodes.length} nodes · {edges.length} edges
            </span>
            <Button variant="outline" onClick={() => setNodes(initialNodes)}>
              Reset layout
            </Button>
            {focus && (
              <a href="#network" className="text-link">
                Show full network
              </a>
            )}
          </div>
          <div
            className="graph-canvas"
            aria-label="Account and device relationship graph"
          >
            <ReactFlow
              key={(focus ?? "all") + kind}
              nodes={shownNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onNodeClick={(_, n) => {
                setSelected(n.id);
                setEdgeId(null);
              }}
              onEdgeClick={(_, e) => setEdgeId(e.id)}
              fitView
              minZoom={0.2}
              maxZoom={2}
              nodesConnectable={false}
              deleteKeyCode={null}
              colorMode="dark"
            >
              <Background color="#354152" gap={24} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(n) =>
                  n.id.startsWith("D-") ? "#8588ae" : "#2dd4bf"
                }
                maskColor="#0a0e14aa"
              />
            </ReactFlow>
          </div>
          <p className="subtle">
            Drag nodes; pan the canvas; use +/− and fit-view controls. Select a
            connection below for keyboard-accessible evidence.
          </p>
        </section>
        <aside className="panel network-detail">
          <SectionHead
            label="EVIDENCE INSPECTOR"
            title={
              edge
                ? "Connection evidence"
                : device
                  ? "Device context"
                  : "Account context"
            }
          />
          {edge ? (
            <>
              <h3>{edge.kind}</h3>
              <p>{edge.reason}</p>
              <small>
                {edge.id} · {stamp(edge.at)}
              </small>
              <EvidenceRows
                ids={edge.evidence.filter((id) =>
                  comments.some((c) => c.id === id),
                )}
              />
              {edge.evidence
                .filter((id) => id.startsWith("L-"))
                .map((id) => {
                  const l = logins.find((l) => l.id === id)!;
                  return (
                    <div className="device-row" key={id}>
                      <strong>
                        {id} · {l.deviceId}
                      </strong>
                      <AccountLink id={l.accountId} />
                      <small>{stamp(l.at)}</small>
                    </div>
                  );
                })}
            </>
          ) : device ? (
            <>
              <h3>{device.id}</h3>
              <p>{device.name}</p>
              <div className="callout">{device.context}</div>
              {profiles
                .filter((p) => p.devices.includes(device.id))
                .map((p) => (
                  <p key={p.id}>
                    <AccountLink id={p.id} />
                  </p>
                ))}
            </>
          ) : profile ? (
            <>
              <h3>@{profile.handle}</h3>
              <p>{profile.bio}</p>
              <Button asChild>
                <a href={route("accounts", "account", profile.id)}>
                  Investigate account
                </a>
              </Button>
              <p className="subtle">
                {
                  connections.filter(
                    (c) => c.source === profile.id || c.target === profile.id,
                  ).length
                }{" "}
                evidence-backed connections
              </p>
            </>
          ) : (
            <Empty title="No node selected" />
          )}
        </aside>
      </div>
      <section className="panel">
        <SectionHead
          label="ACCESSIBLE CONNECTION LIST"
          title="Trace every edge"
        />
        {visibleConnections.length ? (
          <div className="connection-list">
            {visibleConnections.map((c) => (
              <button
                key={c.id}
                className={
                  "connection-row " + (edgeId === c.id ? "selected" : "")
                }
                onClick={() => {
                  setEdgeId(c.id);
                  setSelected(c.source);
                }}
              >
                <span>
                  <strong>
                    {handle(c.source)} → {handle(c.target)}
                  </strong>
                  <small>
                    {c.kind} · {c.evidence.join(", ")}
                  </small>
                </span>
                <span>{stamp(c.at)}</span>
              </button>
            ))}
          </div>
        ) : (
          <Empty title="No matching connections" />
        )}
      </section>
    </div>
  );
}
