"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Fingerprint,
  LayoutDashboard,
  Users,
  Network,
  ShieldAlert,
  Activity,
  FolderOpen,
  FileChartColumn,
  Settings2,
  Database,
  Menu,
  X,
} from "lucide-react";
const loading = () => (
  <section className="panel" role="status">
    Loading investigation screen…
  </section>
);
const Overview = dynamic(() => import("./overview"), { loading });
const Accounts = dynamic(() => import("./accounts"), { loading });
const Graph = dynamic(() => import("./network"), { loading, ssr: false });
const Threats = dynamic(() => import("./threats"), { loading });
const Coordination = dynamic(() => import("./coordination"), { loading });
const Cases = dynamic(() => import("./cases"), { loading });
const Reports = dynamic(() => import("./reports"), { loading });
const Settings = dynamic(() => import("./settings"), { loading });
const sections = [
  { slug: "overview", name: "Overview", icon: LayoutDashboard },
  { slug: "accounts", name: "Account Investigator", icon: Users },
  { slug: "network", name: "Network Explorer", icon: Network },
  { slug: "threats", name: "Threat Monitor", icon: ShieldAlert },
  { slug: "coordination", name: "Coordination Analysis", icon: Activity },
  { slug: "cases", name: "Case Management", icon: FolderOpen },
  { slug: "reports", name: "Reports", icon: FileChartColumn },
  { slug: "settings", name: "Settings", icon: Settings2 },
];
export function LiveWorkspace() {
  const [route, setRoute] = useState({ section: "overview", query: "" });
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const sync = () => {
      const [section, query = ""] = window.location.hash.slice(1).split("?");
      setRoute({
        section: sections.some((s) => s.slug === section)
          ? section
          : "overview",
        query,
      });
      setMobile(false);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const current = sections.find((s) => s.slug === route.section)!;
  const params = new URLSearchParams(route.query);
  const screens: Record<string, React.ReactNode> = {
    overview: <Overview />,
    accounts: <Accounts key={route.query} params={params} />,
    network: <Graph key={route.query} params={params} />,
    threats: <Threats key={route.query} params={params} />,
    coordination: <Coordination />,
    cases: <Cases key={route.query} params={params} />,
    reports: <Reports key={route.query} params={params} />,
    settings: <Settings />,
  };
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
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {sections.map((s) => (
            <a
              href={`#${s.slug}`}
              title={s.name}
              key={s.slug}
              aria-current={s.slug === route.section ? "page" : undefined}
              className={s.slug === route.section ? "active" : ""}
            >
              <s.icon size={18} />
              <span>{s.name}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <Database size={17} />
            <span>
              Built on evidence.<small>SQL Server · synthetic records</small>
            </span>
            <i />
          </div>
          <a className="profile" href="#settings">
            <span className="avatar reviewer">DR</span>
            <span>
              Local investigator<small>Persistent workspace</small>
            </span>
          </a>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button desktop-toggle"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed(!collapsed)}
            >
              <Menu size={18} />
            </button>
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={18} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{current.name}</strong>
          </div>
          <span className="preview-pill">
            <i /> DATABASE MODE
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">INTELLIGENCE / SQL SERVER</p>
              <h1>
                {route.section === "overview"
                  ? "See the pattern."
                  : current.name}
              </h1>
              <p>
                Original evidence. Explainable signals. Persistent human review.
              </p>
            </div>
          </div>
          {screens[route.section]}
        </main>
      </div>
    </div>
  );
}
