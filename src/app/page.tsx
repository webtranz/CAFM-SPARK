import { CafmConsole } from "@/components/cafm-console";
import { getCurrentUser } from "@/lib/auth";
import { emptyOperatingData } from "@/lib/empty-operating-data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <CafmConsole data={emptyOperatingData} user={user} deferInitialData />;
}
