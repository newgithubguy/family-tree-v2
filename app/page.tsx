import { ensureDatabase } from "@/lib/db";
import { Workspace } from "@/components/Workspace";

export const runtime = "nodejs";

export default function HomePage() {
  ensureDatabase();
  return <Workspace />;
}
