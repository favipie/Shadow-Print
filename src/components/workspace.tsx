"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronsLeft,
  CircleHelp,
  Command,
  Database,
  FileChartColumn,
  Fingerprint,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Network,
  Search,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityChart } from "@/components/activity-chart";
import { EvidenceDialog, type Detail } from "@/components/evidence-dialog";
import {
  accounts,
  activity,
  events,
  sections,
  type FlagEvent,
} from "@/lib/mock-data";
import { ScreenRouter } from "@/components/screen-router";
import { useDemo } from "@/components/demo-provider";
import { comments, profiles } from "@/lib/investigation-data";
import {
  route,
  csvText,
  download,
  coordinationEvidence,
} from "@/lib/demo-engine";
const icons = [
  LayoutDashboard,
  Users,
  Network,
  ShieldAlert,
  Activity,
  FolderOpen,
  FileChartColumn,
  Settings2,
];
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      <i />
      {value}
    </span>
  );
}
function PanelTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function Workspace() {
  const [section, setSection] = useState("overview");
  const [routeQuery, setRouteQuery] = useState("");
  const { state, update, ready, storageError } = useDemo();
  const cases = state.cases.map((c) => ({
    ...c,
    accounts: c.accountIds.length,
    detail: c.description,
    priority: "Context review",
  }));
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [days, setDays] = useState(7);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("All priorities");
  const [detail, setDetail] = useState<Detail | null>(null);
  const reviewed = events
    .filter((e) => {
      const ids = comments.filter((c) => c.eventId === e.id).map((c) => c.id);
      return ids.length > 0 && ids.every((id) => state.reviewed.includes(id));
    })
    .map((e) => e.id);
  function setReviewed(fn: (ids: string[]) => string[]) {
    const next = fn(reviewed);
    const changed = events.filter(
      (e) => next.includes(e.id) !== reviewed.includes(e.id),
    );
    update("Updated event review state", (s) => {
      let ids = [...s.reviewed];
      for (const e of changed) {
        const members = comments
          .filter((c) => c.eventId === e.id)
          .map((c) => c.id);
        ids = ids.filter((id) => !members.includes(id));
        if (next.includes(e.id)) ids.push(...members);
      }
      return { ...s, reviewed: [...new Set(ids)] };
    });
  }
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const sync = () => {
      const [slug, query = ""] = window.location.hash.slice(1).split("?");
      setRouteQuery(query);
      setMobile(false);
      setDetail(null);
      setSection(sections.some((s) => s.slug === slug) ? slug : "overview");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const period = activity.slice(-days);
  const current = sections.find((s) => s.slug === section)!;
  const periodEvents = events.filter((e) => e.day >= 19 - days);
  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          e.day >= 19 - days &&
          (priority === "All priorities" || e.priority === priority) &&
          `${e.account} ${e.category} ${e.id}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [days, priority, query],
  );
  const categoryCounts = Object.entries(
    periodEvents.reduce<Record<string, number>>(
      (acc, e) => ({ ...acc, [e.category]: (acc[e.category] || 0) + 1 }),
      {},
    ),
  );
  function inspect(event: FlagEvent) {
    setDetail({
      title: event.id + " / @" + event.account,
      subtitle: event.category + " · " + event.time,
      records: event.evidence,
    });
  }
  function exportCSV() {
    download(
      "shadowprint-synthetic-events.csv",
      csvText([
        ["Event", "Account", "Category", "Priority", "UTC timestamp", "Review"],
        ...filtered.map((e) => [
          e.id,
          e.account,
          e.category,
          e.priority,
          e.time,
          reviewed.includes(e.id) ? "Reviewed" : "Unreviewed",
        ]),
      ]),
    );
    setNotice("Exported " + filtered.length + " synthetic events.");
  }
  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a href="#overview" className="brand">
          <Fingerprint size={31} />
          <span>
            SHADOWPRINT<span className="brand-dot">®</span>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-label">
          <span className="workspace-icon">S</span>
          <div>
            Safety operations<small>Academic workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {sections.map((s, i) => {
            const Icon = icons[i];
            return (
              <a
                href={"#" + s.slug}
                key={s.slug}
                title={s.name}
                aria-current={section === s.slug ? "page" : undefined}
                onClick={() => setMobile(false)}
                className={section === s.slug ? "active" : ""}
              >
                <Icon size={18} />
                <span>{s.name}</span>
                {s.slug === "threats" && <b>{events.length}</b>}
              </a>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <Database size={17} />
            <span>
              Built on evidence.<small>Synthetic data · UI preview</small>
            </span>
            <i />
          </div>
          <button
            className="help"
            onClick={() =>
              setDetail({
                title: "An evidence-first workspace",
                subtitle: "SHADOWPRINT · Phase 2",
                records: [
                  "All identities, events, labels, and metrics in this preview are fictional fixtures.",
                  "Cases, notes, thresholds and comment review marks save in this browser. No backend or database is connected.",
                  "Navigate from comments to accounts, network evidence, cases and reports. All analysis is frontend-only.",
                ],
              })
            }
          >
            <CircleHelp size={17} />
            <span>Workspace guide</span>
            <ArrowUpRight size={14} />
          </button>
          <button
            className="profile"
            onClick={() =>
              setDetail({
                title: "Demo reviewer",
                subtitle: "Local preview access",
                records: [
                  "This is a demo-only workspace without authentication.",
                  "No real account, credential, or personal profile is being used.",
                ],
              })
            }
          >
            <span className="avatar reviewer">DR</span>
            <span>
              Demo reviewer<small>Investigator</small>
            </span>
            <ChevronsLeft size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button desktop-toggle"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu size={18} />
            </button>
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{current.name}</strong>
          </div>
          <div className="header-actions">
            <span className="preview-pill">
              <i /> SYNTHETIC PREVIEW
            </span>
            <button
              className="icon-button notification"
              aria-label="Review notifications"
              onClick={() =>
                setDetail({
                  title: "Review queue",
                  subtitle: "Synthetic preview notifications",
                  records: events
                    .filter(
                      (e) => !reviewed.includes(e.id) && e.priority === "High",
                    )
                    .map((e) => `${e.id}: @${e.account} — ${e.category}`),
                })
              }
            >
              <Bell size={18} />
              <i />
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <a
            className="skip-link"
            href="#main-content"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("main-content")?.focus();
            }}
          >
            Skip to content
          </a>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                INTELLIGENCE /{" "}
                {String(
                  sections.findIndex((s) => s.slug === section) + 1,
                ).padStart(2, "0")}
              </p>
              <h1>
                {section === "overview" ? "See the pattern." : current.name}
              </h1>
              <p>
                {section === "overview"
                  ? "Different identities. Hidden connections. One digital footprint."
                  : current.description}
              </p>
            </div>
            {section === "overview" && (
              <div className="heading-actions">
                <label className="select-wrap">
                  <span className="sr-only">Date range</span>
                  <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
                <Button variant="outline" onClick={exportCSV}>
                  <ArrowDownToLine size={15} />
                  Export snapshot
                </Button>
              </div>
            )}
          </div>
          {storageError && (
            <div className="callout" role="alert">
              {storageError}
            </div>
          )}
          {!ready ? (
            <section className="panel" role="status">
              Loading local workspace…
            </section>
          ) : section !== "overview" ? (
            <ScreenRouter section={section} query={routeQuery} />
          ) : (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="eyebrow">
                    <span className="status-dot" /> THE SIGNAL BEHIND THE NOISE
                  </span>
                  <h2>
                    Connections leave traces.
                    <br />
                    <em>Make them visible.</em>
                  </h2>
                  <p>
                    Bring scattered signals into focus.
                    <br />
                    Investigate patterns. Follow the evidence.
                  </p>
                  <Button onClick={() => inspect(events[0])}>
                    Examine priority signal <ArrowUpRight size={16} />
                  </Button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <span className="art-grid" />
                  <span className="art-signal art-signal-one" />
                  <span className="art-signal art-signal-two" />
                  <div className="art-corner">RELATIONSHIP STUDY — 001</div>
                  <span className="art-label">
                    <i /> 3 ACCOUNTS / 1 SHARED TARGET
                  </span>
                </div>
                <span className="hero-index">SHADOWPRINT / FIELD NOTES</span>
              </section>
              <div className="dataset-line">
                <span>
                  <Database size={13} /> Fixed demo window: {period[0].label}
                  –18, 2026
                </span>
                <span>All counts derived from inspectable fixtures</span>
              </div>
              <section className="metrics" aria-label="Overview metrics">
                {[
                  {
                    title: "Sample comments",
                    value: period
                      .reduce((n, a) => n + a.analyzed, 0)
                      .toLocaleString(),
                    sub: "Original inspectable records",
                    icon: Command,
                  },
                  {
                    title: "Flagged comments",
                    value: period.reduce((n, a) => n + a.flagged, 0).toString(),
                    sub: "Authored labels + rule examples",
                    icon: ShieldAlert,
                  },
                  {
                    title: "Matching groups",
                    value: coordinationEvidence(state.thresholds).length
                      ? "1"
                      : "0",
                    sub: "Current frontend thresholds",
                    icon: Network,
                  },
                  {
                    title: "Open investigations",
                    value: cases
                      .filter((c) => !["Closed", "Resolved"].includes(c.status))
                      .length.toString(),
                    sub: "Across all demo dates",
                    icon: FolderOpen,
                  },
                ].map((m, i) => (
                  <article className="metric" key={m.title}>
                    <div>
                      <span>{m.title}</span>
                      <m.icon size={17} />
                    </div>
                    <strong>
                      {m.value}
                      <span className={i === 1 ? "amber" : "teal"}>
                        {i === 1 ? "REVIEW" : i === 2 ? "DEMO" : ""}
                      </span>
                    </strong>
                    <small>
                      <span className="metric-tick" />
                      {m.sub}
                    </small>
                  </article>
                ))}
              </section>
              <div className="analytics-grid">
                <section className="panel activity-panel">
                  <PanelTitle
                    eyebrow="ACTIVITY OVER TIME"
                    title="Suspicious activity"
                  >
                    <span className="chart-legend">
                      <i />
                      Flagged comments
                    </span>
                  </PanelTitle>
                  <div className="chart-summary">
                    <strong>{period.reduce((n, a) => n + a.flagged, 0)}</strong>
                    <span>flagged sample comments in period</span>
                    <span className="chart-window">{days}-DAY WINDOW</span>
                  </div>
                  <ActivityChart days={days} />
                </section>
                <section className="panel categories">
                  <PanelTitle
                    eyebrow="REVIEW COMPOSITION"
                    title="Threat categories"
                  >
                    <ShieldCheck size={18} />
                  </PanelTitle>
                  <p className="muted">
                    {periodEvents.length} signal groups in selected period
                  </p>
                  {categoryCounts.map(([name, count], i) => (
                    <div className="category" key={name}>
                      <div>
                        <span>
                          <i
                            style={{
                              background: [
                                "#2dd4bf",
                                "#b9e979",
                                "#f2b968",
                                "#eb858c",
                                "#8695ad",
                              ][i],
                            }}
                          />
                          {name}
                        </span>
                        <b>{count}</b>
                      </div>
                      <div className="track">
                        <span
                          style={{
                            width: `${(count / periodEvents.length) * 100}%`,
                            background: [
                              "#2dd4bf",
                              "#b9e979",
                              "#f2b968",
                              "#eb858c",
                              "#8695ad",
                            ][i],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="category-note">
                    Groups summarize comments; they are not comment counts.
                  </div>
                </section>
              </div>
              <section className="panel events-panel">
                <PanelTitle
                  eyebrow="SIGNALS TO EXAMINE"
                  title="Sample signal groups"
                >
                  <span className="count-pill">{filtered.length} events</span>
                </PanelTitle>
                <div className="table-controls">
                  <label className="search">
                    <Search size={16} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search account, event, or category…"
                      aria-label="Search events"
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <label className="select-wrap">
                    <SlidersHorizontal size={14} />
                    <span className="sr-only">Priority filter</span>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option>All priorities</option>
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>ACCOUNT</th>
                        <th>SIGNAL / CONTEXT</th>
                        <th>PRIORITY</th>
                        <th>DETECTED AT</th>
                        <th>REVIEW</th>
                        <th>
                          <span className="sr-only">Evidence</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <button
                              className="account-cell"
                              onClick={() => {
                                window.location.hash = route(
                                  "accounts",
                                  "account",
                                  profiles.find((p) => p.handle === e.account)!
                                    .id,
                                );
                              }}
                            >
                              <span className="avatar">{e.initials}</span>
                              <span>
                                @{e.account}
                                <small>{e.id}</small>
                              </span>
                            </button>
                          </td>
                          <td>
                            <strong className="signal-title">
                              {e.category}
                            </strong>
                            <small>{e.reason}</small>
                          </td>
                          <td>
                            <Badge value={e.priority} />
                          </td>
                          <td className="date-cell">{e.time}</td>
                          <td>
                            <button
                              className={`review-button ${reviewed.includes(e.id) ? "reviewed" : ""}`}
                              onClick={() =>
                                setReviewed((r) =>
                                  r.includes(e.id)
                                    ? r.filter((id) => id !== e.id)
                                    : [...r, e.id],
                                )
                              }
                              aria-label={`${reviewed.includes(e.id) ? "Undo review for" : "Mark reviewed"} ${e.id}`}
                            >
                              {reviewed.includes(e.id)
                                ? "Reviewed"
                                : "Mark reviewed"}
                            </button>
                          </td>
                          <td>
                            <button
                              className="icon-button"
                              aria-label={`View evidence for ${e.id}`}
                              onClick={() => inspect(e)}
                            >
                              <ArrowUpRight size={17} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filtered.length && (
                    <div className="empty">
                      <Search size={24} />
                      <h3>No matching signals</h3>
                      <p>Try another account, category, or priority.</p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setQuery("");
                          setPriority("All priorities");
                        }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  )}
                </div>
                <div className="table-footer">
                  <span>
                    Showing {filtered.length} of {periodEvents.length} signal
                    groups
                  </span>
                  <span>
                    <ShieldCheck size={13} /> Human review required
                  </span>
                </div>
              </section>
              <div className="bottom-grid">
                <section className="panel">
                  <PanelTitle
                    eyebrow="ACTIVE WORK"
                    title="Recent investigations"
                  />
                  {cases.map((c) => (
                    <button
                      className="case-row"
                      key={c.id}
                      onClick={() => {
                        window.location.hash = route("cases", "case", c.id);
                      }}
                    >
                      <span className="case-icon">
                        <FolderOpen size={18} />
                      </span>
                      <span>
                        <strong>{c.title}</strong>
                        <small>
                          {c.id} · {c.accounts} accounts
                        </small>
                      </span>
                      <span className="case-status">{c.status}</span>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </section>
                <section className="panel">
                  <PanelTitle
                    eyebrow="ACCOUNT SIGNALS"
                    title="Top monitored accounts"
                  />
                  {accounts.map((a) => (
                    <button
                      className="monitored-row"
                      key={a.name}
                      onClick={() => {
                        window.location.hash = route(
                          "accounts",
                          "account",
                          profiles.find((p) => p.handle === a.name)!.id,
                        );
                      }}
                    >
                      <span className="avatar">{a.initials}</span>
                      <span>
                        <strong>@{a.name}</strong>
                        <small>{a.signals} authored signal groups</small>
                      </span>
                      <Badge value={a.priority} />
                    </button>
                  ))}
                </section>
                <section className="panel priority-panel">
                  <PanelTitle
                    eyebrow="TRIAGE"
                    title="Authored group priority"
                  />
                  <div className="priority-total">
                    <strong>
                      {periodEvents
                        .filter(
                          (e) =>
                            e.priority === "High" && !reviewed.includes(e.id),
                        )
                        .length.toString()
                        .padStart(2, "0")}
                    </strong>
                    <span>
                      high-priority groups
                      <br />
                      awaiting review
                    </span>
                  </div>
                  <div className="priority-bars">
                    {["High", "Medium", "Low"].map((p) => (
                      <div key={p}>
                        <span>{p}</span>
                        <div className="track">
                          <span
                            className={p.toLowerCase()}
                            style={{
                              width: `${(periodEvents.filter((e) => e.priority === p).length / periodEvents.length) * 100}%`,
                            }}
                          />
                        </div>
                        <b>
                          {periodEvents.filter((e) => e.priority === p).length}
                        </b>
                      </div>
                    ))}
                  </div>
                  <p>
                    Priority guides attention.
                    <br />
                    Evidence guides decisions.
                  </p>
                </section>
              </div>
              <footer>
                <span>
                  <Fingerprint size={15} /> SHADOWPRINT{" "}
                  <span className="footer-divider">/</span> Evidence before
                  assumptions.
                </span>
                <span>Phase 02 · Frontend only</span>
              </footer>
            </>
          )}
          {notice && (
            <div className="toast" role="status">
              {notice}
              <button
                aria-label="Dismiss notification"
                className="icon-button"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
        </main>
      </div>
      <EvidenceDialog detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
