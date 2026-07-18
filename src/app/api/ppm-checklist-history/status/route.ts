import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const [totalRows, linkedRows, unlinkedRows, bySourceFile, recentUploads] = await Promise.all([
    prisma.ppmChecklistHistory.count(),
    prisma.ppmChecklistHistory.count({ where: { linkStatus: "LINKED" } }),
    prisma.ppmChecklistHistory.count({ where: { NOT: { linkStatus: "LINKED" } } }),
    prisma.ppmChecklistHistory.groupBy({
      by: ["sourceFile"],
      _count: { _all: true },
      orderBy: { _count: { sourceFile: "desc" } },
    }),
    prisma.auditLog.findMany({
      where: { action: "BULK_UPLOAD", entityId: "ppmChecklistHistory" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, createdAt: true, actorName: true, details: true },
    }),
  ]);

  return NextResponse.json({
    totalRows,
    linkedRows,
    unlinkedRows,
    sourceFiles: bySourceFile.map((row) => ({
      sourceFile: row.sourceFile || "Unspecified",
      rows: row._count._all,
    })),
    recentUploads: recentUploads.map((log) => {
      let details: any = {};
      try {
        const parsed = JSON.parse(String(log.details || "{}"));
        details = parsed?.details ?? parsed ?? {};
      } catch {
        details = {};
      }
      return {
        id: log.id,
        createdAt: log.createdAt,
        actorName: log.actorName,
        fileName: details.fileName ?? "",
        totalRows: Number(details.totalRows ?? 0),
        created: Number(details.created ?? 0),
        skipped: Number(details.skipped ?? 0),
        failed: Array.isArray(details.failed) ? details.failed.length : 0,
      };
    }),
  });
}
