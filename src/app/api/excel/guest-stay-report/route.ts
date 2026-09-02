import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { csv, guestStayReportRows } from "@/lib/guest-stay-report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const configuredToken = process.env.EXCEL_REPORT_TOKEN || "";
  const suppliedToken = url.searchParams.get("token") || request.headers.get("x-excel-report-token") || "";

  if (configuredToken) {
    if (suppliedToken !== configuredToken) {
      return NextResponse.json({ message: "Invalid Excel report token." }, { status: 403 });
    }
  } else {
    const { error } = await requirePermission("reports.view");
    if (error) return error;
  }

  const rows = await guestStayReportRows();
  return new NextResponse(csv(rows), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="guest-stay-report.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
