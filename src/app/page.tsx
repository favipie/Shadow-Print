import { Workspace } from "@/components/workspace";
import { SqlProvider } from "@/components/data-provider";
export default function Home() {
  return (
    <SqlProvider>
      <Workspace />
    </SqlProvider>
  );
}
