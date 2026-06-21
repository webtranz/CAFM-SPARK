import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  siteId: z.string().optional(),
  site: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  floors: z.coerce.number().int().min(0).optional(),
  areaSqm: z.coerce.number().int().min(0).optional(),
});

async function resolveSite(input: z.infer<typeof schema>) {
  if (input.siteId) {
    const site = await prisma.site.findUnique({ where: { id: input.siteId } });
    if (site) return site;
  }
  const name = input.site || "Fadhili Bachelor Camp";
  const city = input.city || "Fadhili";
  const country = input.country || "Saudi Arabia";
  return prisma.site.upsert({
    where: { name_city_country: { name, city, country } },
    update: {},
    create: { name, city, country, type: "Facility", areaSqm: 0 },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageInput = Number(url.searchParams.get("page") || 1);
  const pageSizeInput = Number(url.searchParams.get("pageSize") || 100);
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const pageSize = Number.isFinite(pageSizeInput) ? Math.min(200, Math.max(25, Math.floor(pageSizeInput))) : 100;
  const [total, buildings] = await Promise.all([
    prisma.building.count(),
    prisma.building.findMany({
      include: { site: true },
      orderBy: { code: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return NextResponse.json({ buildings, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requirePermission("assets.manage");
    if (error) return error;
    const input = schema.parse(await request.json());
    const site = await resolveSite(input);
    const count = await prisma.building.count();
    const code = input.code || `BLD-${String(count + 1).padStart(3, "0")}`;
    const name = input.name || code;
    const building = await prisma.building.upsert({
      where: { code },
      update: { name, siteId: site.id, floors: input.floors ?? 1, areaSqm: input.areaSqm ?? 0 },
      create: { code, name, siteId: site.id, floors: input.floors ?? 1, areaSqm: input.areaSqm ?? 0 },
    });
    await auditAction({ user, action: "BUILDING_SAVE", entity: "building", entityId: building.id, details: { input, savedRecord: building } });
    return NextResponse.json(building, { status: 201 });
  } catch (error) {
    return apiError(error, "Unable to save building");
  }
}
