"use client";
import dynamic from "next/dynamic";
const loading = () => (
  <section className="panel" role="status">
    Loading investigation screen…
  </section>
);
const Accounts = dynamic(() => import("./screens/accounts"), { loading });
const Network = dynamic(() => import("./screens/network"), {
  loading,
  ssr: false,
});
const Threats = dynamic(() => import("./screens/threats"), { loading });
const Coordination = dynamic(() => import("./screens/coordination"), {
  loading,
});
const Cases = dynamic(() => import("./screens/cases"), { loading });
const Reports = dynamic(() => import("./screens/reports"), { loading });
const Settings = dynamic(() => import("./screens/settings"), { loading });
export function ScreenRouter({
  section,
  query,
}: {
  section: string;
  query: string;
}) {
  const params = new URLSearchParams(query);
  switch (section) {
    case "accounts":
      return <Accounts params={params} />;
    case "network":
      return <Network key={params.get("account") ?? "all"} params={params} />;
    case "threats":
      return <Threats params={params} />;
    case "coordination":
      return <Coordination />;
    case "cases":
      return <Cases params={params} />;
    case "reports":
      return <Reports params={params} />;
    case "settings":
      return <Settings />;
    default:
      return null;
  }
}
