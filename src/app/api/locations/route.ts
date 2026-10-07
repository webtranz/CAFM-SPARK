import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  cleanDisplayText,
  cleanLocationRecord,
  meaningfulDisplayText,
} from "@/lib/friendly-display";

const boolInput = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["yes", "true", "1", "y"].includes(normalized)) return true;
    if (["no", "false", "0", "n", ""].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const schema = z.object({
  code: z.string().optional(),
  location: z.string().optional(),
  site: z.string().optional(),
  zone: z.string().optional(),
  building: z.string().optional(),
  floor: z.string().optional(),
  room: z.string().optional(),
  type: z.string().optional(),
  parentLocation: z.string().optional(),
  locationClass: z.string().optional(),
  class: z.string().optional(),
  outOfService: boolInput.optional(),
  residential: boolInput.optional(),
  description: z.string().optional(),
});

export async function GET(request: Request) {
  const { error } = await requirePermission("requests.manage");
  if (error) return error;
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() || "";
  const parentLocation = url.searchParams.get("parentLocation")?.trim() || "";
  const locationClass = url.searchParams.get("locationClass")?.trim() || "";
  const residential = url.searchParams.get("residential")?.trim() || "";
  const pageInput = Number(url.searchParams.get("page") || 1);
  const pageSizeParam = url.searchParams.get("pageSize") || "100";
  const pageSizeInput = pageSizeParam === "all" ? Number.MAX_SAFE_INTEGER : Number(pageSizeParam);
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const pageSize = pageSizeParam === "all" ? 10000 : Number.isFinite(pageSizeInput) ? Math.min(500, Math.max(25, Math.floor(pageSizeInput))) : 100;
  const where: any = {
    ...(parentLocation ? { parentLocation } : {}),
    ...(locationClass ? { locationClass } : {}),
    ...(residential === "YES" ? { residential: true } : {}),
    ...(residential === "NO" ? { residential: false } : {}),
  };
  if (query) {
    where.OR = [
      { code: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { parentLocation: { contains: query, mode: "insensitive" } },
      { locationClass: { contains: query, mode: "insensitive" } },
      { site: { contains: query, mode: "insensitive" } },
      { building: { contains: query, mode: "insensitive" } },
      { floor: { contains: query, mode: "insensitive" } },
      { room: { contains: query, mode: "insensitive" } },
    ];
  }
  const [allTotal, total, locations] = await Promise.all([
    prisma.location.count(),
    prisma.location.count({ where }),
    prisma.location.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ code: "asc" }],
    }),
  ]);
  return NextResponse.json({
    locations: locations.map(cleanLocationRecord),
    allTotal,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requirePermission("requests.manage");
    if (error) return error;
    const input = schema.parse(await request.json());
    const count = await prisma.location.count();
    const code = cleanDisplayText(input.code || input.location) || `LOC-${String(count + 1).padStart(4, "0")}`;
    const locationClass = cleanDisplayText(input.locationClass || input.class || input.type) || "Facility Location";
    const outOfService = input.outOfService ?? false;
    const data = {
      code,
      site: meaningfulDisplayText(input.site) || "Main Site",
      zone: meaningfulDisplayText(input.parentLocation || input.zone),
      building: meaningfulDisplayText(input.building),
      floor: meaningfulDisplayText(input.floor),
      room: meaningfulDisplayText(input.room),
      type: locationClass,
      parentLocation: meaningfulDisplayText(input.parentLocation || input.zone),
      locationClass,
      outOfService,
      residential: input.residential ?? false,
      active: !outOfService,
      description: cleanDisplayText(input.description),
    };
    const location = await prisma.location.upsert({
      where: { code },
      update: data,
      create: data,
    });
    await auditAction({ user, action: "LOCATION_SAVE", entity: "location", entityId: location.id, details: { input, savedRecord: location } });
    return NextResponse.json(cleanLocationRecord(location), { status: 201 });
  } catch (error) {
    return apiError(error, "Unable to save location");
  }
}
