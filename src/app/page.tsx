import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hosted, sessionCookie, sessionRequest } from "@/lib/hosted";
import { SignOut } from "@/components/session-controls";
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
  let banner = null;
  if (hosted()) {
    const token = (await cookies()).get(sessionCookie)?.value;
    const signin =
      mode === "workspace" ? "/sign-in?mode=workspace" : "/sign-in";
    if (!token) redirect(signin);
    const identity = await sessionRequest("GET", token).catch(() => null);
    if (identity?.status === 401) redirect(signin);
    if (!identity?.ok)
      return (
        <main role="alert">
          Investigation service unavailable. Reload to retry.
        </main>
      );
    banner = <SignOut investigator={(await identity.json()).investigator} />;
  }
  if (mode === "demo")
    return (
      <DemoProvider>
        {banner}
        <div className="demo-mode-banner" role="status">
          FIXTURE DEMO — browser-only data.{" "}
          <Link href="/">Return to SQL Server workspace</Link>
        </div>
        <Workspace />
      </DemoProvider>
    );
  if (mode === "workspace")
    return (
      <>
        {banner}
        <SqlProvider>
          <Workspace />
        </SqlProvider>
      </>
    );
  return (
    <>
      {banner}
      <LiveWorkspace />
    </>
  );
}
