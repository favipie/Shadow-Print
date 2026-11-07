"use client";
import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { useApi, link } from "@/lib/api-client";
import type { Page, Login } from "@/lib/api-types";
import { Head, Load, AccountLink, EvidenceCard } from "./common";
function Graph({ records, focus }: { records: Login[]; focus: string | null }) {
  const initial = useMemo<Node[]>(() => {
    const accounts = [...new Set(records.map((r) => r.account_id))];
    const devices = [...new Set(records.map((r) => r.device_id))];
    return [
      ...accounts.map((id, i) => ({
        id,
        position: { x: 50 + (i % 3) * 230, y: 40 + Math.floor(i / 3) * 140 },
        data: { label: id },
        style: {
          background: "#1d3030",
          color: "#e2f3e9",
          border: "1px solid #406958",
          borderRadius: 9,
        },
      })),
      ...devices.map((id, i) => ({
        id,
        position: { x: 850, y: 40 + i * 110 },
        data: {
          label:
            id + " · " + records.find((r) => r.device_id === id)?.display_name,
        },
        style: {
          background: "#252837",
          color: "#d3d8ef",
          border: "1px solid #565c77",
          borderRadius: 7,
        },
      })),
    ];
  }, [records]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial);
  const [selected, setSelected] = useState<Login | null>(null);
  const focusedDevices = new Set(
    records.filter((r) => r.account_id === focus).map((r) => r.device_id),
  );
  const edges: Edge[] = records.map((r) => ({
    id: r.id,
    source: r.account_id,
    target: r.device_id,
    label: "device observation",
    style: { stroke: focusedDevices.has(r.device_id) ? "#c1ec80" : "#2dd4bf" },
  }));
  return (
    <>
      <div className="action-row">
        <Button variant="outline" onClick={() => setNodes(initial)}>
          Reset layout
        </Button>
        <span>
          {nodes.length} nodes · {edges.length} observations on this page
        </span>
      </div>
      <div className="graph-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => {
            if (records.some((r) => r.account_id === node.id))
              window.location.hash = link("accounts", "account", node.id);
          }}
          onEdgeClick={(_, edge) =>
            setSelected(records.find((r) => r.id === edge.id) ?? null)
          }
          fitView
        >
          <Background color="#27303d" />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      {selected && (
        <section className="callout">
          <strong>
            {selected.id}: {selected.account_id} → {selected.device_id}
          </strong>
          <p>{selected.context}</p>
          {selected.evidence_id && <EvidenceCard id={selected.evidence_id} />}
        </section>
      )}
    </>
  );
}
export default function NetworkScreen({ params }: { params: URLSearchParams }) {
  const [offset, setOffset] = useState(0);
  const result = useApi<Page<Login>>(`network?limit=20&offset=${offset}`);
  return (
    <div className="screen-stack">
      <div className="callout">
        Observed account/device links from SQL Server. Shared access does not
        establish identity and contributes zero points.{" "}
        <a href="#coordination" className="text-link">
          Inspect coordinated posting windows
        </a>
      </div>
      <section className="panel graph-panel">
        <Head title="Network explorer" />
        <Load {...result} />
        {result.data && (
          <>
            <Graph
              key={`${offset}-${result.data.items.map((r) => r.id).join()}`}
              records={result.data.items}
              focus={params.get("account")}
            />
            <div className="action-row">
              <Button disabled={!offset} onClick={() => setOffset(offset - 20)}>
                Previous
              </Button>
              <span>
                {offset + 1}–{offset + result.data.items.length} of{" "}
                {result.data.total} observations
              </span>
              <Button
                disabled={offset + 20 >= result.data.total}
                onClick={() => setOffset(offset + 20)}
              >
                Next
              </Button>
            </div>
            <Head title="Accessible connection evidence" />
            {result.data.items.map((r) => (
              <article className="device-row" key={r.id}>
                <AccountLink id={r.account_id} />
                <span>
                  {" "}
                  → {r.device_id} · {r.display_name}
                </span>
                <p>{r.context}</p>
                {r.evidence_id && <EvidenceCard id={r.evidence_id} />}
              </article>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
