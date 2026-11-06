import { Workspace } from "@/components/workspace";
import { DemoProvider } from "@/components/demo-provider";
import { LiveWorkspace } from "@/components/live/workspace";
import Link from "next/link";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  if ((await searchParams).mode !== "demo") return <LiveWorkspace />;
  return (
    <DemoProvider>
      <div className="demo-mode-banner" role="status">
        FIXTURE DEMO — browser-only data.{" "}
        <Link href="/">Return to SQL Server workspace</Link>
      </div>
      <Workspace />
    </DemoProvider>
  );
}
