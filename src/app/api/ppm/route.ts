import { NextResponse } from "next/server";
import { addDays } from "date-fns";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAdmin, requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { allowsCustomPpmLocation } from "@/lib/scoped-ppm-custom-locations";

const boolValue = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

function isInvalidChecklistValue(value: unknown) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  return !raw ||
    normalized === "no match" ||
    raw.startsWith("=") ||
    normalized.includes("iferror(") ||
    normalized.includes("hyperlink(") ||
    normalized.includes("activities & checklist") ||
    normalized.includes("#n/a") ||
    normalized.includes("#value");
}

const schema = z.object({
  code: z.string().optional(),
  ppmCode: z.string().optional(),
  name: z.string().optional(),
  assetTag: z.string().optional(),
  locationCode: z.string().optional(),
  equipmentDescription: z.string().optional(),
  objectType: z.string().optional(),
  objectClass: z.string().optional(),
  objectCategory: z.string().optional(),
  checklistLink: z.string().optional(),
  departmentCode: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  frequency: z.string().optional(),
  nextDue: z.string().optional(),
  durationHrs: z.coerce.number().min(0.25).optional(),
  checklist: z.string().optional(),
  active: boolValue.optional(),
  applyToGroup: boolValue.optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "All";
  const groupCode = url.searchParams.get("groupCode")?.trim() || "";
  if (groupCode) {
    const groupedPpms = await prisma.preventiveMaintenance.findMany({
      where: {
        OR: [
          { ppmCode: groupCode },
          { code: groupCode },
          { code: { startsWith: `${groupCode}-`, mode: "insensitive" } },
        ],
      },
      orderBy: [{ locationCode: "asc" }, { assetTag: "asc" }, { nextDue: "asc" }],
      take: 20000,
    });
    const assetTags = [...new Set(groupedPpms.map((item) => item.assetTag).filter(Boolean))];
    const locationCodes = [...new Set(groupedPpms.map((item) => item.locationCode).filter(Boolean))];
    const [assets, locations] = await Promise.all([
      assetTags.length ? prisma.asset.findMany({ where: { tag: { in: assetTags } } }) : [],
      locationCodes.length ? prisma.location.findMany({ where: { code: { in: locationCodes } } }) : [],
    ]);
    const assetByTag = new Map(assets.map((asset) => [asset.tag, asset]));
    const locationByCode = new Map(locations.map((location) => [location.code, location]));
    const checklistSource = groupedPpms.find((item) => item.checklist && !isInvalidChecklistValue(item.checklist))?.checklist || "No match";
    return NextResponse.json({
      ppmCode: groupCode,
      total: groupedPpms.length,
      checklist: checklistSource,
      equipment: groupedPpms.map((item) => ({
        id: item.id,
        code: item.code,
        assetTag: item.assetTag,
        locationCode: item.locationCode,
        equipmentDescription: item.equipmentDescription,
        objectType: item.objectType,
        objectClass: item.objectClass,
        objectCategory: item.objectCategory,
        departmentCode: item.departmentCode,
        frequency: item.frequency,
        durationHrs: item.durationHrs,
        nextDue: item.nextDue,
        active: item.active,
        assetDetails: item.assetTag ? assetByTag.get(item.assetTag) || null : null,
        locationDetails: item.locationCode ? locationByCode.get(item.locationCode) || null : null,
      })),
    });
  }
  const pageInput = Number(url.searchParams.get("page") || 1);
  const pageSizeParam = url.searchParams.get("pageSize") || "100";
  const pageSizeInput = pageSizeParam === "all" ? Number.MAX_SAFE_INTEGER : Number(pageSizeParam);
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const pageSize = pageSizeParam === "all" ? 20000 : Number.isFinite(pageSizeInput) ? Math.min(500, Math.max(25, Math.floor(pageSizeInput))) : 100;
  const where: any = {
    ...(status === "Active" ? { active: true } : {}),
    ...(status === "Paused" ? { active: false } : {}),
  };
  if (query) {
    where.OR = [
      { code: { contains: query, mode: "insensitive" } },
      { ppmCode: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
      { equipmentDescription: { contains: query, mode: "insensitive" } },
      { assetTag: { contains: query, mode: "insensitive" } },
      { locationCode: { contains: query, mode: "insensitive" } },
      { departmentCode: { contains: query, mode: "insensitive" } },
      { frequency: { contains: query, mode: "insensitive" } },
      { checklist: { contains: query, mode: "insensitive" } },
    ];
  }
  const [total, ppms] = await Promise.all([
    prisma.preventiveMaintenance.count({ where }),
    prisma.preventiveMaintenance.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { nextDue: "asc" },
    }),
  ]);
  return NextResponse.json({ ppms, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function DELETE(request: Request) {
  try {
    const { error, user } = await requireAdmin();
    if (error) return error;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("PPM id is required");
    const current = await prisma.preventiveMaintenance.findUnique({ where: { id } });
    if (!current) throw new Error("PPM not found");
    await prisma.preventiveMaintenance.delete({ where: { id } });
    await auditAction({ user, action: "PPM_DELETE", entity: "preventive_maintenance", entityId: id, details: { deletedRecord: current } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to delete PPM");
  }
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requirePermission("ppm.manage");
    if (error) return error;
    const input = schema.parse(await request.json());
    const count = await prisma.preventiveMaintenance.count();
    const code = input.code || `PPM-${String(count + 1).padStart(4, "0")}`;
    const ppmCode = input.ppmCode || code;
    const canUseCustomLocation = allowsCustomPpmLocation(ppmCode) || allowsCustomPpmLocation(code);
    const data = {
      code,
      ppmCode,
      name: input.name || `PPM ${count + 1}`,
      assetTag: input.assetTag || (canUseCustomLocation ? "" : "Unassigned"),
      locationCode: input.locationCode || (canUseCustomLocation ? ppmCode : ""),
      equipmentDescription: input.equipmentDescription || "",
      objectType: input.objectType || "",
      objectClass: input.objectClass || "",
      objectCategory: input.objectCategory || "",
      checklistLink: input.checklistLink || "",
      departmentCode: input.departmentCode || "",
      priority: input.priority || "MEDIUM",
      frequency: input.frequency || "Monthly",
      durationHrs: input.durationHrs ?? 1,
      checklist: input.checklist || "Checklist to be defined.",
      nextDue: input.nextDue ? new Date(input.nextDue) : addDays(new Date(), 7),
      active: input.active ?? true,
    };
    const created = await prisma.preventiveMaintenance.upsert({
      where: { code },
      update: data,
      create: data,
    });
    await auditAction({ user, action: "PPM_SAVE", entity: "preventive_maintenance", entityId: created.id, details: { input, savedRecord: created } });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error, "Unable to save PPM");
  }
}

export async function PATCH(request: Request) {
  try {
    const { error, user } = await requirePermission("ppm.manage");
    if (error) return error;
    const input = schema.extend({ id: z.string().optional() }).parse(await request.json());
    const id = input.id || undefined;
    const code = input.code || undefined;
    const groupCode = input.ppmCode || code;
    if (!id && !code && !groupCode) throw new Error("PPM id, code or PPM code is required");
    const current = id || code ? await prisma.preventiveMaintenance.findUnique({ where: id ? { id } : { code: code! } }) : null;
    if ((id || code) && !current) throw new Error("PPM not found");
    const data = {
      ppmCode: input.ppmCode,
      name: input.name,
      assetTag: input.assetTag,
      locationCode: input.locationCode,
      equipmentDescription: input.equipmentDescription,
      objectType: input.objectType,
      objectClass: input.objectClass,
      objectCategory: input.objectCategory,
      checklistLink: input.checklistLink,
      departmentCode: input.departmentCode,
      priority: input.priority,
      frequency: input.frequency,
      durationHrs: input.durationHrs,
      checklist: input.checklist,
      active: input.active,
      nextDue: input.nextDue ? new Date(input.nextDue) : undefined,
    };
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    if (input.applyToGroup && groupCode && input.checklist !== undefined) {
      const result = await prisma.preventiveMaintenance.updateMany({
        where: {
          OR: [
            { ppmCode: groupCode },
            { code: groupCode },
            { code: { startsWith: `${groupCode}-`, mode: "insensitive" } },
          ],
        },
        data: { checklist: input.checklist },
      });
      await auditAction({ user, action: "PPM_GROUP_CHECKLIST_UPDATE", entity: "preventive_maintenance", entityId: groupCode, details: { input, updatedCount: result.count } });
      return NextResponse.json({ ok: true, ppmCode: groupCode, updatedCount: result.count, checklist: input.checklist });
    }
    const updated = await prisma.preventiveMaintenance.update({
      where: id ? { id } : { code: code! },
      data: cleanData,
    });
    await auditAction({ user, action: "PPM_UPDATE", entity: "preventive_maintenance", entityId: updated.id, details: { before: current, input, after: updated } });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, "Unable to update PPM");
  }
}
