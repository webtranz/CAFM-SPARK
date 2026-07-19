import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  const url = new URL(request.url);
  const pageInput = Number(url.searchParams.get("page") || 1);
  const pageSizeInput = Number(url.searchParams.get("pageSize") || 50000);
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const pageSize = Number.isFinite(pageSizeInput) ? Math.min(100000, Math.max(1000, Math.floor(pageSizeInput))) : 50000;

  const [totalRows, rows] = await Promise.all([
    prisma.ppmChecklistHistory.count(),
    prisma.ppmChecklistHistory.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { id: "asc" },
      select: {
        id: true,
        uploadKey: true,
        ackEvent: true,
        ackObject: true,
        ackCode: true,
        ackAct: true,
        ackSequence: true,
        ackDescription: true,
        sourceFile: true,
        sourceYear: true,
        linkStatus: true,
      },
    }),
  ]);

  return NextResponse.json({
    page,
    pageSize,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    rows,
  });
}