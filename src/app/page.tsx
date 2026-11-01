import { Workspace } from "@/components/workspace";
import { DemoProvider } from "@/components/demo-provider";
export default function Home() {
  return (
    <DemoProvider>
      <Workspace />
    </DemoProvider>
  );
}
