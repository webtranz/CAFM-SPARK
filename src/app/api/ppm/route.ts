import { NextResponse } from "next/server";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAdmin, requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { cleanImportedNarrative } from "@/lib/friendly-display";
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

const workflowStatuses = ["DRAFT", "SCHEDULED", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "SUBMITTED", "REWORK", "COMPLETED", "CLOSED", "OVERDUE", "CANCELLED"] as const;
const INVALID_GENERATED_WORK_ORDER_STATUSES = ["REJECTED"] as const;

function ppmFrequencyInterval(frequency: string, periodUom?: string) {
  const rawFrequency = String(frequency || "").trim();
  const rawPeriodUom = String(periodUom || "").trim();
  const numeric = Number(`${rawFrequency} ${rawPeriodUom}`.match(/\d+(?:\.\d+)?/)?.[0] || "");
  const amount = Number.isFinite(numeric) && numeric > 0 ? Math.max(1, Math.floor(numeric)) : 1;
  const label = `${rawFrequency} ${rawPeriodUom}`.toLowerCase();
  if (label.includes("daily") || label.includes(" day")) return { amount, unit: "day" as const };
  if (label.includes("weekly") || label.includes(" week") || label.includes("biweekly") || label.includes("bi-weekly")) return { amount: label.includes("biweekly") || label.includes("bi-weekly") ? 2 : amount, unit: "week" as const };
  if (label.includes("quarter")) return { amount: numeric > 0 ? amount : 3, unit: "month" as const };
  if (label.includes("half") || label.includes("semi")) return { amount: numeric > 0 ? amount : 6, unit: "month" as const };
  if (label.includes("annual") || label.includes("year")) return { amount, unit: "year" as const };
  return { amount, unit: "month" as const };
}

function ppmNextDueDate(current: Date, frequency: string, periodUom?: string) {
  const interval = ppmFrequencyInterval(frequency, periodUom);
  if (interval.unit === "day") return addDays(current, interval.amount);
  if (interval.unit === "week") return addWeeks(current, interval.amount);
  if (interval.unit === "year") return addYears(current, interval.amount);
  return addMonths(current, interval.amount);
}

async function reconcilePpmGeneratedWorkOrders(ppm: any) {
  const workOrders = await prisma.workOrder.findMany({
    where: {
      ppmId: ppm.id,
      status: { notIn: [...INVALID_GENERATED_WORK_ORDER_STATUSES] as any },
    },
    orderBy: [{ plannedStart: "asc" }, { createdAt: "asc" }],
  });
  let current = ppm;
  for (const workOrder of workOrders) {
    const previousDueDate = new Date(workOrder.plannedStart || current.nextDue);
    if (Number.isNaN(previousDueDate.getTime())) continue;
    const newDueDate = ppmNextDueDate(previousDueDate, current.frequency, current.periodUom);
    const currentDue = new Date(current.nextDue);
    const shouldMoveForward = Number.isNaN(currentDue.getTime()) || newDueDate.getTime() > currentDue.getTime();
    const existingHistory = await prisma.ppmDueDateHistory.findUnique({ where: { workOrderId: workOrder.id } });
    if (!existingHistory) {
      await prisma.ppmDueDateHistory.create({
        data: {
          ppmId: current.id,
          workOrderId: workOrder.id,
          previousDueDate,
          newDueDate,
          workOrderNumber: workOrder.woNo,
          scheduleStatus: "GENERATED",
          generatedBy: "System",
          generatedAt: workOrder.createdAt || new Date(),
        },
      });
    }
    if (shouldMoveForward) {
      current = await prisma.preventiveMaintenance.update({
        where: { id: current.id },
        data: {
          generatedWorkOrderId: workOrder.id,
          lastGeneratedAt: workOrder.createdAt || new Date(),
          workflowStatus: "SCHEDULED",
          nextDue: newDueDate,
        },
      });
    }
  }
  return current;
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
  periodUom: z.string().optional(),
  nextDue: z.string().optional(),
  durationHrs: z.coerce.number().min(0.25).optional(),
  checklist: z.string().optional(),
  active: boolValue.optional(),
  workflowStatus: z.enum(workflowStatuses).optional(),
  assignedTeamCode: z.string().optional(),
  technicianEmail: z.string().optional(),
  supervisorEmail: z.string().optional(),
  checklistMandatory: boolValue.optional(),
  complianceNotes: z.string().optional(),
  applyToGroup: boolValue.optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "All";
  const groupCode = url.searchParams.get("groupCode")?.trim() || "";
  if (groupCode) {
    const sourceGroupedPpms = await prisma.preventiveMaintenance.findMany({
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
    const groupedPpms: any[] = [];
    for (const ppm of sourceGroupedPpms) {
      groupedPpms.push(await reconcilePpmGeneratedWorkOrders(ppm));
    }
    groupedPpms.sort(
      (left, right) =>
        String(left.locationCode || "").localeCompare(String(right.locationCode || "")) ||
        String(left.assetTag || "").localeCompare(String(right.assetTag || "")) ||
        new Date(left.nextDue).getTime() - new Date(right.nextDue).getTime(),
    );
    const assetTags = [...new Set(groupedPpms.map((item) => item.assetTag).filter(Boolean))];
    const locationCodes = [...new Set(groupedPpms.map((item) => item.locationCode).filter(Boolean))];
    const [assets, locations, dueDateHistories] = await Promise.all([
      assetTags.length ? prisma.asset.findMany({ where: { tag: { in: assetTags } }, select: { id: true, tag: true, name: true, assetDescription: true, locationCode: true, locationDesc: true, departmentCode: true, category: true, categoryDesc: true, buildingCode: true, floor: true, room: true, status: true } }) : [],
      locationCodes.length ? prisma.location.findMany({ where: { code: { in: locationCodes } }, select: { id: true, code: true, site: true, zone: true, building: true, floor: true, room: true, type: true, description: true, parentLocation: true, locationClass: true, active: true } }) : [],
      groupedPpms.length
        ? prisma.ppmDueDateHistory.findMany({
            where: { ppmId: { in: groupedPpms.map((item) => item.id) } },
            orderBy: [{ previousDueDate: "asc" }, { generatedAt: "asc" }],
          })
        : [],
    ]);
    const dueDateHistoryByPpmId = new Map<string, any[]>();
    dueDateHistories.forEach((history: any) => {
      const current = dueDateHistoryByPpmId.get(history.ppmId) || [];
      current.push(history);
      dueDateHistoryByPpmId.set(history.ppmId, current);
    });
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
        periodUom: item.periodUom,
        durationHrs: item.durationHrs,
        nextDue: item.nextDue,
        active: item.active,
        workflowStatus: item.workflowStatus,
        assignedTeamCode: item.assignedTeamCode,
        technicianEmail: item.technicianEmail,
        supervisorEmail: item.supervisorEmail,
        generatedWorkOrderId: item.generatedWorkOrderId,
        dueDateHistory: dueDateHistoryByPpmId.get(item.id) || [],
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
  const normalizedStatus = status.toUpperCase().replace(/[ -]/g, "_");
  const where: any = {
    ...(status === "Active" ? { active: true } : {}),
    ...(status === "Paused" ? { active: false } : {}),
    ...(workflowStatuses.includes(normalizedStatus as any) ? { workflowStatus: normalizedStatus as any } : {}),
  };
  if (query) {
    const workflowQuery = workflowStatuses.includes(query.toUpperCase().replace(/[ -]/g, "_") as any) ? query.toUpperCase().replace(/[ -]/g, "_") as any : null;
    where.OR = [
      { code: { contains: query, mode: "insensitive" } },
      { ppmCode: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
      { equipmentDescription: { contains: query, mode: "insensitive" } },
      { assetTag: { contains: query, mode: "insensitive" } },
      { locationCode: { contains: query, mode: "insensitive" } },
      { departmentCode: { contains: query, mode: "insensitive" } },
      { frequency: { contains: query, mode: "insensitive" } },
      { periodUom: { contains: query, mode: "insensitive" } },
      ...(workflowQuery ? [{ workflowStatus: { equals: workflowQuery } }] : []),
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
      periodUom: input.periodUom || "",
      durationHrs: input.durationHrs ?? 1,
      checklist:
        cleanImportedNarrative(input.checklist, "checklist") ||
        "Checklist to be defined.",
      nextDue: input.nextDue ? new Date(input.nextDue) : addDays(new Date(), 7),
      active: input.active ?? true,
      workflowStatus: input.workflowStatus || "DRAFT",
      assignedTeamCode: input.assignedTeamCode || "",
      technicianEmail: input.technicianEmail || "",
      supervisorEmail: input.supervisorEmail || "",
      checklistMandatory: input.checklistMandatory ?? true,
      complianceNotes: input.complianceNotes || "",
    };
    const duplicate = await prisma.preventiveMaintenance.findFirst({
      where: {
        code: { not: code },
        assetTag: data.assetTag,
        locationCode: data.locationCode,
        frequency: data.frequency,
        periodUom: data.periodUom,
        name: data.name,
        active: true,
      },
      select: { code: true },
    });
    if (duplicate) {
      return NextResponse.json({ message: `Duplicate PPM schedule already exists: ${duplicate.code}` }, { status: 409 });
    }
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
    const cleanedChecklist =
      input.checklist === undefined
        ? undefined
        : cleanImportedNarrative(input.checklist, "checklist");
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
      periodUom: input.periodUom,
      durationHrs: input.durationHrs,
      checklist: cleanedChecklist,
      active: input.active,
      workflowStatus: input.workflowStatus,
      assignedTeamCode: input.assignedTeamCode,
      technicianEmail: input.technicianEmail,
      supervisorEmail: input.supervisorEmail,
      checklistMandatory: input.checklistMandatory,
      complianceNotes: input.complianceNotes,
      nextDue: input.nextDue ? new Date(input.nextDue) : undefined,
    };
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    if (input.applyToGroup && groupCode && cleanedChecklist !== undefined) {
      const result = await prisma.preventiveMaintenance.updateMany({
        where: {
          OR: [
            { ppmCode: groupCode },
            { code: groupCode },
            { code: { startsWith: `${groupCode}-`, mode: "insensitive" } },
          ],
        },
        data: { checklist: cleanedChecklist },
      });
      await auditAction({ user, action: "PPM_GROUP_CHECKLIST_UPDATE", entity: "preventive_maintenance", entityId: groupCode, details: { input, updatedCount: result.count } });
      return NextResponse.json({
        ok: true,
        ppmCode: groupCode,
        updatedCount: result.count,
        checklist: cleanedChecklist,
      });
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
