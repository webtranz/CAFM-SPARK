import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().optional(),
  floor: z.string().optional(),
  type: z.string().optional(),
  capacity: z.coerce.number().int().min(0).optional(),
  areaSqm: z.coerce.number().int().min(0).optional(),
  occupancy: z.coerce.number().int().min(0).optional(),
  buildingId: z.string().optional(),
  buildingCode: z.string().optional(),
  site: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

async function resolveBuilding(input: z.infer<typeof schema>) {
  if (input.buildingId) {
    const building = await prisma.building.findUnique({ where: { id: input.buildingId } });
    if (building) return building;
  }
  const code = input.buildingCode || "FBC";
  const existing = await prisma.building.findUnique({ where: { code } });
  if (existing) return existing;
  const siteName = input.site || "Fadhili Bachelor Camp";
  const city = input.city || "Fadhili";
  const country = input.country || "Saudi Arabia";
  const site = await prisma.site.upsert({
    where: { name_city_country: { name: siteName, city, country } },
    update: {},
    create: { name: siteName, city, country, type: "Facility", areaSqm: 0 },
  });
  return prisma.building.create({ data: { code, name: code, siteId: site.id, floors: 1, areaSqm: 0 } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageInput = Number(url.searchParams.get("page") || 1);
  const pageSizeInput = Number(url.searchParams.get("pageSize") || 100);
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const pageSize = Number.isFinite(pageSizeInput) ? Math.min(200, Math.max(25, Math.floor(pageSizeInput))) : 100;
  const [total, spaces] = await Promise.all([
    prisma.space.count(),
    prisma.space.findMany({
      include: { building: { include: { site: true } } },
      orderBy: [{ building: { code: "asc" } }, { floor: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return NextResponse.json({ spaces, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requirePermission("assets.manage");
    if (error) return error;
    const input = schema.parse(await request.json());
    const building = await resolveBuilding(input);
    const count = await prisma.space.count();
    const name = input.name || `Space ${String(count + 1).padStart(4, "0")}`;
    const floor = input.floor || "Ground";
    const type = input.type || "Space";
    const space = await prisma.space.upsert({
      where: { buildingId_floor_name: { buildingId: building.id, floor, name } },
      update: { type, capacity: input.capacity ?? 0, areaSqm: input.areaSqm ?? 0, occupancy: input.occupancy ?? 0 },
      create: { buildingId: building.id, name, floor, type, capacity: input.capacity ?? 0, areaSqm: input.areaSqm ?? 0, occupancy: input.occupancy ?? 0 },
    });
    await auditAction({ user, action: "SPACE_SAVE", entity: "space", entityId: space.id, details: { input, savedRecord: space } });
    return NextResponse.json(space, { status: 201 });
  } catch (error) {
    return apiError(error, "Unable to save space");
  }
}
