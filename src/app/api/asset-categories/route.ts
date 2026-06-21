import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAdmin, requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  defaultLifeYrs: z.coerce.number().int().min(1).optional(),
  statutory: z.coerce.boolean().optional(),
  description: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageInput = Number(url.searchParams.get("page") || 1);
  const pageSizeInput = Number(url.searchParams.get("pageSize") || 100);
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const pageSize = Number.isFinite(pageSizeInput) ? Math.min(200, Math.max(25, Math.floor(pageSizeInput))) : 100;
  const [total, categories] = await Promise.all([
    prisma.assetCategory.count(),
    prisma.assetCategory.findMany({
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return NextResponse.json({ categories, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function DELETE(request: Request) {
  try {
    const { error, user } = await requireAdmin();
    if (error) return error;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Asset category id is required");
    const current = await prisma.assetCategory.findUnique({ where: { id } });
    if (!current) throw new Error("Asset category not found");
    await prisma.assetCategory.delete({ where: { id } });
    await auditAction({ user, action: "ASSET_CATEGORY_DELETE", entity: "asset_category", entityId: id, details: { deletedRecord: current } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to delete asset category");
  }
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requirePermission("assets.manage");
    if (error) return error;
    const input = schema.parse(await request.json());
    const count = await prisma.assetCategory.count();
    const code = input.code || `CAT-${String(count + 1).padStart(3, "0")}`;
    const name = input.name || "General Category";
    const created = await prisma.assetCategory.upsert({
      where: { code },
      update: { code, name, type: input.type || "General", defaultLifeYrs: input.defaultLifeYrs ?? 5, statutory: input.statutory ?? false, description: input.description || "" },
      create: { code, name, type: input.type || "General", defaultLifeYrs: input.defaultLifeYrs ?? 5, statutory: input.statutory ?? false, description: input.description || "" },
    });
    await auditAction({ user, action: "ASSET_CATEGORY_SAVE", entity: "asset_category", entityId: created.id, details: { input, savedRecord: created } });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error, "Unable to save asset category");
  }
}
