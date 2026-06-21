import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getOperatingData } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error, user } = await requireUser();
  if (error) return error;
  const data = await getOperatingData(user);
  return NextResponse.json(JSON.parse(JSON.stringify(data)));
}
