import { SignIn } from "@/components/session-controls";
import { redirect } from "next/navigation";
import { hosted } from "@/lib/hosted";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  if (!hosted()) redirect("/");
  return <SignIn classic={(await searchParams).mode === "workspace"} />;
}
