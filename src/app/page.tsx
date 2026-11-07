import Link from "next/link";
import { Workspace } from "@/components/workspace";
import { SqlProvider } from "@/components/data-provider";
import { DemoProvider } from "@/components/demo-provider";
import { LiveWorkspace } from "@/components/live/workspace";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  if (mode === "demo")
    return (
      <DemoProvider>
        <div className="demo-mode-banner" role="status">
          FIXTURE DEMO — browser-only data.{" "}
          <Link href="/">Return to SQL Server workspace</Link>
        </div>
        <Workspace />
      </DemoProvider>
    );
  if (mode === "workspace")
    return (
      <SqlProvider>
        <Workspace />
      </SqlProvider>
    );
  return <LiveWorkspace />;
}
