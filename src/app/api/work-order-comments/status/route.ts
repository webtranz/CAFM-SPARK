import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function splitCommentLines(notes: string | null) {
  return String(notes ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  const url = new URL(request.url);
  const pageInput = Number(url.searchParams.get("page") || 1);
  const pageSizeInput = Number(url.searchParams.get("pageSize") || 5000);
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const pageSize = Number.isFinite(pageSizeInput) ? Math.min(10000, Math.max(100, Math.floor(pageSizeInput))) : 5000;

  const where = { workNotes: { not: null } };
  const [totalWorkOrdersWithNotes, totalWorkOrders, rows] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.count(),
    prisma.workOrder.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { woNo: "asc" },
      select: { id: true, woNo: true, title: true, workNotes: true },
    }),
  ]);

  const commentLinesOnPage = rows.reduce((total, row) => total + splitCommentLines(row.workNotes).length, 0);

  return NextResponse.json({
    page,
    pageSize,
    totalWorkOrders,
    totalWorkOrdersWithNotes,
    totalPages: Math.max(1, Math.ceil(totalWorkOrdersWithNotes / pageSize)),
    commentLinesOnPage,
    workOrders: rows.map((row) => ({
      id: row.id,
      woNo: row.woNo,
      title: row.title,
      workNotes: row.workNotes ?? "",
      commentLineCount: splitCommentLines(row.workNotes).length,
    })),
  });
}