import { NextResponse } from "next/server";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAnyPermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const actions = ["schedule", "preview", "generate", "assign", "accept", "start", "hold", "submit", "approve", "reject", "rework", "close", "cancel", "defect"] as const;
const workflowStatuses = ["DRAFT", "SCHEDULED", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "SUBMITTED", "REWORK", "COMPLETED", "CLOSED", "OVERDUE", "CANCELLED"] as const;

const schema = z.object({
  ppmId: z.string().min(1),
  action: z.enum(actions),
  workflowStatus: z.enum(workflowStatuses).optional(),
  effectiveDate: z.string().optional(),
  dueMonth: z.string().optional(),
  ppmIds: z.array(z.string()).optional(),
  assignedTeamCode: z.string().optional(),
  technicianEmail: z.string().optional(),
  supervisorEmail: z.string().optional(),
  checklistCompleted: z.boolean().optional(),
  readings: z.string().optional(),
  remarks: z.string().optional(),
  photoUrls: z.string().optional(),
  labor: z.string().optional(),
  materials: z.string().optional(),
  defectDescription: z.string().optional(),
  supervisorDecision: z.string().optional(),
  rejectionReason: z.string().optional(),
});

type PpmWithAsset = Awaited<ReturnType<typeof loadPpm>>;
type PpmRecord = NonNullable<PpmWithAsset>;

async function loadPpm(ppmId: string) {
  return prisma.preventiveMaintenance.findUnique({ where: { id: ppmId } });
}

function dueHours(priority: string) {
  if (priority === "CRITICAL") return 6;
  if (priority === "HIGH") return 24;
  if (priority === "LOW") return 120;
  return 72;
}

function nextDueDate(current: Date, frequency: string, periodUom?: string) {
  const label = `${frequency || ""} ${periodUom || ""}`.toLowerCase();
  if (label.includes("daily") || label.includes(" day")) return addDays(current, 1);
  if (label.includes("weekly") || label.includes(" week")) return addWeeks(current, 1);
  if (label.includes("quarter")) return addMonths(current, 3);
  if (label.includes("semi")) return addMonths(current, 6);
  if (label.includes("annual") || label.includes("year")) return addYears(current, 1);
  return addMonths(current, 1);
}

function workflowNote(input: z.infer<typeof schema>) {
  return [
    input.checklistCompleted ? "Mandatory checklist completed: Yes" : "",
    input.readings ? `Readings:\n${input.readings}` : "",
    input.remarks ? `Remarks:\n${input.remarks}` : "",
    input.labor ? `Labor:\n${input.labor}` : "",
    input.materials ? `Materials:\n${input.materials}` : "",
    input.defectDescription ? `Defects:\n${input.defectDescription}` : "",
  ].filter(Boolean).join("\n\n");
}

async function findUserId(email?: string) {
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  return user?.id ?? null;
}

const DEFAULT_PPM_EFFECTIVE_DATE = "2026-01-01";
const OPEN_WORK_ORDER_STATUSES_TO_EXCLUDE = ["CLOSED", "CANCELLED", "REJECTED"] as const;

function utcDateFromInput(value?: string, fallback = DEFAULT_PPM_EFFECTIVE_DATE) {
  const raw = String(value || fallback || DEFAULT_PPM_EFFECTIVE_DATE).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date(Date.UTC(2026, 0, 1)) : date;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthStartFromInput(value: string | undefined, fallbackDate: Date) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Date(Date.UTC(fallbackDate.getUTCFullYear(), fallbackDate.getUTCMonth(), 1));
}

function ppmPlanningWindow(ppm: PpmRecord, input?: Pick<z.infer<typeof schema>, "effectiveDate" | "dueMonth">) {
  const effectiveDate = utcDateFromInput(input?.effectiveDate);
  const selectedMonthStart = monthStartFromInput(input?.dueMonth, new Date(ppm.nextDue));
  const selectedMonthEnd = new Date(Date.UTC(selectedMonthStart.getUTCFullYear(), selectedMonthStart.getUTCMonth() + 1, 1));
  const rangeStart = effectiveDate.getTime() > selectedMonthStart.getTime() ? effectiveDate : selectedMonthStart;
  return {
    effectiveDate,
    effectiveDateText: effectiveDate.toISOString().slice(0, 10),
    dueMonth: monthKey(selectedMonthStart),
    monthStart: selectedMonthStart,
    monthEnd: selectedMonthEnd,
    dateFilter: { gte: rangeStart, lt: selectedMonthEnd },
  };
}

function ppmGroupCode(ppm: PpmRecord) {
  return ppm.ppmCode || String(ppm.code || "").split("-")[0] || ppm.code;
}

function ppmGroupBaseWhere(ppm: PpmRecord) {
  const groupCode = ppmGroupCode(ppm);
  return {
    OR: [
      { ppmCode: groupCode },
      { code: groupCode },
      { code: { startsWith: `${groupCode}-`, mode: "insensitive" as const } },
    ],
  };
}

function ppmGroupWhere(ppm: PpmRecord, input?: Pick<z.infer<typeof schema>, "effectiveDate" | "dueMonth">) {
  return {
    ...ppmGroupBaseWhere(ppm),
    nextDue: ppmPlanningWindow(ppm, input).dateFilter,
  };
}

function rowIsInsidePlanningWindow(row: PpmRecord, input?: Pick<z.infer<typeof schema>, "effectiveDate" | "dueMonth">) {
  if (!input?.effectiveDate && !input?.dueMonth) return true;
  const planningWindow = ppmPlanningWindow(row, input);
  const nextDue = new Date(row.nextDue);
  const nextDueTime = nextDue.getTime();
  return Number.isFinite(nextDueTime) && nextDueTime >= planningWindow.dateFilter.gte.getTime() && nextDueTime < planningWindow.dateFilter.lt.getTime();
}

async function loadPpmGroup(ppm: PpmRecord, input?: Pick<z.infer<typeof schema>, "effectiveDate" | "dueMonth" | "ppmIds">) {
  const orderBy = [{ locationCode: "asc" as const }, { assetTag: "asc" as const }, { nextDue: "asc" as const }];
  const selectedIds = Array.from(new Set((input?.ppmIds || []).filter(Boolean)));
  if (selectedIds.length) {
    return prisma.preventiveMaintenance.findMany({
      where: { id: { in: selectedIds } },
      orderBy,
      take: 20000,
    });
  }

  const rows = await prisma.preventiveMaintenance.findMany({
    where: ppmGroupWhere(ppm, input),
    orderBy,
    take: 20000,
  });
  if (rows.length || (!input?.effectiveDate && !input?.dueMonth)) return rows.length ? rows : [ppm];

  const unfilteredRows = await prisma.preventiveMaintenance.findMany({
    where: ppmGroupBaseWhere(ppm),
    orderBy,
    take: 20000,
  });
  return unfilteredRows.filter((row) => rowIsInsidePlanningWindow(row, input));
}

async function nextPpmWorkOrderNumber() {
  const count = await prisma.workOrder.count();
  for (let offset = 0; offset < 50; offset += 1) {
    const woNo = `PPM-WO-${String(count + 81001 + offset).padStart(5, "0")}`;
    const existing = await prisma.workOrder.findUnique({ where: { woNo }, select: { id: true } });
    if (!existing) return woNo;
  }
  return `PPM-WO-${Date.now().toString(36).toUpperCase()}`;
}

async function ensurePpmWorkOrder(ppm: PpmRecord, input: z.infer<typeof schema>, user: any) {
  if (ppm.generatedWorkOrderId) {
    const existing = await prisma.workOrder.findUnique({ where: { id: ppm.generatedWorkOrderId } });
    if (existing && ![...OPEN_WORK_ORDER_STATUSES_TO_EXCLUDE].includes(existing.status as any)) return { workOrder: existing, created: false };
  }
  const existingByPpm = await prisma.workOrder.findFirst({
    where: { ppmId: ppm.id, status: { notIn: [...OPEN_WORK_ORDER_STATUSES_TO_EXCLUDE] as any } },
    orderBy: { createdAt: "desc" },
  });
  if (existingByPpm) return { workOrder: existingByPpm, created: false };

  const [asset, team, technicianId, woNo] = await Promise.all([
    ppm.assetTag ? prisma.asset.findUnique({ where: { tag: ppm.assetTag } }) : null,
    (input.assignedTeamCode || ppm.assignedTeamCode) ? prisma.team.findUnique({ where: { code: input.assignedTeamCode || ppm.assignedTeamCode } }) : null,
    findUserId(input.technicianEmail || ppm.technicianEmail),
    nextPpmWorkOrderNumber(),
  ]);
  const priority = ppm.priority;
  const target = ppm.assetTag || ppm.locationCode || ppm.code;
  const created = await prisma.workOrder.create({
    data: {
      woNo,
      title: `PPM | ${ppm.ppmCode || ppm.code} | ${target} | ${ppm.name}`.trim(),
      type: "Preventive",
      assetType: asset?.assetGroup || asset?.category || ppm.objectCategory || null,
      departmentCode: ppm.departmentCode || asset?.departmentCode || null,
      serviceCode: ppm.objectClass || null,
      assignedTeamCode: input.assignedTeamCode || ppm.assignedTeamCode || team?.code || null,
      jobPlanCode: ppm.ppmCode || ppm.code,
      priority,
      status: (input.assignedTeamCode || ppm.assignedTeamCode || technicianId) ? "ASSIGNED" : "PENDING_ASSIGNMENT",
      assetId: asset?.id,
      assignedToId: technicianId,
      ppmId: ppm.id,
      plannedStart: ppm.nextDue,
      dueAt: addDays(ppm.nextDue, Math.max(1, Math.ceil(dueHours(priority) / 24))),
      estimatedHours: ppm.durationHrs,
      cost: 0,
      jobPlan: ppm.checklist || "PPM checklist to be completed before submission.",
      safetyNotes: "Verify isolation, access, permits and asset condition before starting PPM.",
      workNotes: `Generated from PPM ${ppm.ppmCode || ppm.code}. PPM row: ${ppm.code}. Target: ${target}.`,
    },
  });
  if (asset?.id) {
    await prisma.assetHistory.create({ data: { assetId: asset.id, eventType: "PPM_WORK_ORDER_CREATED", title: `${created.woNo} generated`, details: `PPM ${ppm.ppmCode || ppm.code} generated for ${ppm.assetTag || ppm.locationCode}.`, actor: user?.name || user?.email || "System" } });
  }
  return { workOrder: created, created: true };
}

async function createPpmWorkOrder(ppm: PpmRecord, input: z.infer<typeof schema>, user: any) {
  return (await ensurePpmWorkOrder(ppm, input, user)).workOrder;
}

async function createPpmWorkOrdersForGroup(ppm: PpmRecord, input: z.infer<typeof schema>, user: any) {
  const planningWindow = ppmPlanningWindow(ppm, input);
  const rows = await loadPpmGroup(ppm, input);
  const generatedAt = new Date();
  const workflowStatus = input.assignedTeamCode || input.technicianEmail ? "ASSIGNED" : "SCHEDULED";
  const results: Array<{ ppmId: string; ppmCode: string; code: string; assetTag?: string; locationCode?: string; departmentCode?: string; equipmentDescription?: string | null; nextDue?: Date; workOrder: any; created: boolean }> = [];
  for (const row of rows) {
    const result = await ensurePpmWorkOrder(row, input, user);
    await prisma.preventiveMaintenance.update({
      where: { id: row.id },
      data: {
        assignedTeamCode: input.assignedTeamCode || row.assignedTeamCode,
        technicianEmail: input.technicianEmail || row.technicianEmail,
        supervisorEmail: input.supervisorEmail || row.supervisorEmail,
        generatedWorkOrderId: result.workOrder.id,
        lastGeneratedAt: generatedAt,
        workflowStatus,
      },
    });
    results.push({ ppmId: row.id, ppmCode: row.ppmCode || ppmGroupCode(row), code: row.code, assetTag: row.assetTag, locationCode: row.locationCode, departmentCode: row.departmentCode, equipmentDescription: row.equipmentDescription, nextDue: row.nextDue, workOrder: result.workOrder, created: result.created });
  }
  return {
    groupCode: ppmGroupCode(ppm),
    effectiveDate: planningWindow.effectiveDateText,
    dueMonth: planningWindow.dueMonth,
    total: rows.length,
    createdCount: results.filter((item) => item.created).length,
    reusedCount: results.filter((item) => !item.created).length,
    results,
  };
}
async function buildPpmWorkOrderPreview(ppm: PpmRecord, input: z.infer<typeof schema>) {
  const planningWindow = ppmPlanningWindow(ppm, input);
  const rows = await loadPpmGroup(ppm, input);
  const rowIds = rows.map((row) => row.id);
  const generatedIds = rows.map((row) => row.generatedWorkOrderId).filter(Boolean);
  const orFilters: any[] = rowIds.length ? [{ ppmId: { in: rowIds } }] : [];
  if (generatedIds.length) orFilters.push({ id: { in: generatedIds } });
  const existingWorkOrders = orFilters.length ? await prisma.workOrder.findMany({
    where: { OR: orFilters, status: { notIn: [...OPEN_WORK_ORDER_STATUSES_TO_EXCLUDE] as any } },
    select: { id: true, ppmId: true, woNo: true, status: true, plannedStart: true, dueAt: true },
  }) : [];
  const existingByPpmId = new Map(existingWorkOrders.filter((workOrder) => workOrder.ppmId).map((workOrder) => [workOrder.ppmId, workOrder]));
  const existingById = new Map(existingWorkOrders.map((workOrder) => [workOrder.id, workOrder]));
  const previewRows = rows.map((row) => {
    const existing = existingByPpmId.get(row.id) || (row.generatedWorkOrderId ? existingById.get(row.generatedWorkOrderId) : null);
    return {
      ppmId: row.id,
      ppmCode: row.ppmCode || ppmGroupCode(row),
      code: row.code,
      title: row.name,
      assetTag: row.assetTag,
      locationCode: row.locationCode,
      departmentCode: row.departmentCode,
      equipmentDescription: row.equipmentDescription,
      nextDue: row.nextDue,
      plannedStart: row.nextDue,
      existingWorkOrderNo: existing?.woNo || "",
      existingStatus: existing?.status || "",
      willCreate: !existing,
    };
  });
  return {
    groupCode: ppmGroupCode(ppm),
    effectiveDate: planningWindow.effectiveDateText,
    dueMonth: planningWindow.dueMonth,
    monthStart: planningWindow.monthStart.toISOString().slice(0, 10),
    monthEnd: addDays(planningWindow.monthEnd, -1).toISOString().slice(0, 10),
    total: previewRows.length,
    createCount: previewRows.filter((row) => row.willCreate).length,
    reuseCount: previewRows.filter((row) => !row.willCreate).length,
    rows: previewRows.slice(0, 300),
    limited: previewRows.length > 300,
  };
}
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const requiredPermission = ["accept", "start", "hold", "submit"].includes(input.action) ? "ppm.execute" : ["approve", "reject", "rework", "close"].includes(input.action) ? "ppm.approve" : "ppm.manage";
    const { error, user } = await requireAnyPermission([requiredPermission, "ppm.manage"]);
    if (error) return error;
    const ppm = await loadPpm(input.ppmId);
    if (!ppm) throw new Error("PPM plan not found");

    const assignmentData = {
      assignedTeamCode: input.assignedTeamCode ?? ppm.assignedTeamCode,
      technicianEmail: input.technicianEmail ?? ppm.technicianEmail,
      supervisorEmail: input.supervisorEmail ?? ppm.supervisorEmail,
    };
    let workOrder = ppm.generatedWorkOrderId ? await prisma.workOrder.findUnique({ where: { id: ppm.generatedWorkOrderId } }) : null;
    let workflowStatus: typeof workflowStatuses[number] | undefined;
    const workUpdate: any = {};
    const ppmUpdate: any = { ...assignmentData };

    if (input.action === "schedule") workflowStatus = "SCHEDULED";
    if (input.action === "preview") {
      const preview = await buildPpmWorkOrderPreview(ppm, input);
      return NextResponse.json({ ppm, preview, groupCode: preview.groupCode, totalWorkOrders: preview.total });
    }
    if (input.action === "generate") {
      const generation = await createPpmWorkOrdersForGroup(ppm, input, user);
      const selectedResult = generation.results.find((item) => item.ppmId === ppm.id) || generation.results[0];
      workOrder = selectedResult?.workOrder || null;
      const updatedPpm = await prisma.preventiveMaintenance.findUnique({ where: { id: ppm.id } });
      const preview = {
        groupCode: generation.groupCode,
        effectiveDate: generation.effectiveDate,
        dueMonth: generation.dueMonth,
        total: generation.total,
        createCount: generation.createdCount,
        reuseCount: generation.reusedCount,
        rows: generation.results.slice(0, 300).map((item: any) => ({
          ppmId: item.ppmId,
          ppmCode: item.ppmCode,
          code: item.code,
          assetTag: item.assetTag,
          locationCode: item.locationCode,
          departmentCode: item.departmentCode,
          equipmentDescription: item.equipmentDescription,
          nextDue: item.nextDue,
          workOrderNo: item.workOrder.woNo,
          willCreate: item.created,
        })),
        limited: generation.results.length > 300,
      };
      await auditAction({
        user,
        action: "PPM_WORKFLOW_GENERATE",
        entity: "preventive_maintenance",
        entityId: ppm.id,
        details: { before: ppm, input, groupCode: generation.groupCode, dueMonth: generation.dueMonth, effectiveDate: generation.effectiveDate, total: generation.total, createdCount: generation.createdCount, reusedCount: generation.reusedCount },
      });
      return NextResponse.json({
        ppm: updatedPpm,
        workOrder,
        workOrders: generation.results.map((item) => item.workOrder),
        generatedRows: generation.results.map((item: any) => ({ ppmId: item.ppmId, code: item.code, workOrderId: item.workOrder.id, woNo: item.workOrder.woNo, created: item.created, nextDue: item.nextDue })),
        preview,
        groupCode: generation.groupCode,
        effectiveDate: generation.effectiveDate,
        dueMonth: generation.dueMonth,
        totalWorkOrders: generation.total,
        generatedCount: generation.createdCount,
        reusedCount: generation.reusedCount,
      });
    }
    if (input.action === "assign") {
      workOrder = await createPpmWorkOrder(ppm, input, user);
      workflowStatus = assignmentData.assignedTeamCode || assignmentData.technicianEmail ? "ASSIGNED" : "SCHEDULED";
      ppmUpdate.generatedWorkOrderId = workOrder.id;
      ppmUpdate.lastGeneratedAt = new Date();
      if (workOrder) {
        workUpdate.assignedTeamCode = assignmentData.assignedTeamCode || null;
        workUpdate.assignedToId = await findUserId(assignmentData.technicianEmail) || null;
        workUpdate.status = "ASSIGNED";
      }
    }
    if (!workOrder && !["schedule", "cancel"].includes(input.action)) throw new Error("Generate the PPM work order first.");
    if (input.action === "accept") { workflowStatus = "ASSIGNED"; workUpdate.status = "ACCEPTED"; workUpdate.responseAt = new Date(); }
    if (input.action === "start") { workflowStatus = "IN_PROGRESS"; workUpdate.status = "IN_PROGRESS"; workUpdate.responseAt = workOrder?.responseAt || new Date(); }
    if (input.action === "hold") { workflowStatus = "ON_HOLD"; workUpdate.status = "ON_HOLD"; }
    if (input.action === "submit") {
      if (ppm.checklistMandatory && !input.checklistCompleted) throw new Error("Mandatory checklist must be completed before submitting for supervisor review.");
      workflowStatus = "SUBMITTED";
      workUpdate.status = "PENDING_SUPERVISOR_REVIEW";
      workUpdate.resolutionAt = new Date();
      workUpdate.workNotes = [workOrder?.workNotes, workflowNote(input)].filter(Boolean).join("\n\n");
      workUpdate.photoUrls = input.photoUrls || workOrder?.photoUrls;
      workUpdate.assetsUsed = input.labor || workOrder?.assetsUsed;
      workUpdate.inventoryUsed = input.materials || workOrder?.inventoryUsed;
      workUpdate.materialRequest = input.materials || workOrder?.materialRequest;
    }
    if (input.action === "approve") { workflowStatus = "COMPLETED"; workUpdate.status = "VERIFIED"; workUpdate.verifiedAt = new Date(); workUpdate.supervisorDecision = input.supervisorDecision || "Approved by supervisor."; }
    if (input.action === "reject" || input.action === "rework") { workflowStatus = "REWORK"; workUpdate.status = "REOPENED"; workUpdate.rejectionReason = input.rejectionReason || input.supervisorDecision || "Returned for rework."; workUpdate.supervisorDecision = input.supervisorDecision || "Returned for rework."; }
    if (input.action === "close") {
      workflowStatus = "CLOSED";
      workUpdate.status = "CLOSED";
      workUpdate.finishedAt = new Date();
      workUpdate.verifiedAt = workOrder?.verifiedAt || new Date();
      ppmUpdate.lastCompletedAt = new Date();
      ppmUpdate.nextDue = nextDueDate(new Date(ppm.nextDue), ppm.frequency, ppm.periodUom);
    }
    if (input.action === "cancel") { workflowStatus = "CANCELLED"; if (workOrder) workUpdate.status = "REJECTED"; }
    if (input.action === "defect") {
      if (!input.defectDescription?.trim()) throw new Error("Defect description is required.");
      const corrective = await prisma.workOrder.create({
        data: {
          woNo: `CWO-${String((await prisma.workOrder.count()) + 81001).padStart(5, "0")}`,
          title: `Corrective | ${ppm.assetTag || ppm.locationCode} | ${ppm.name}`,
          type: "Corrective",
          assetType: ppm.objectCategory || null,
          departmentCode: ppm.departmentCode || null,
          assignedTeamCode: ppm.assignedTeamCode || null,
          priority: "HIGH",
          status: "PENDING_ASSIGNMENT",
          assetId: ppm.assetTag ? (await prisma.asset.findUnique({ where: { tag: ppm.assetTag }, select: { id: true } }))?.id : undefined,
          ppmId: ppm.id,
          plannedStart: new Date(),
          dueAt: addDays(new Date(), 3),
          estimatedHours: 4,
          cost: 0,
          jobPlan: input.defectDescription,
          safetyNotes: "Corrective work order raised from PPM defect report.",
          workNotes: `Linked PPM: ${ppm.ppmCode || ppm.code}\nLinked PPM WO: ${workOrder?.woNo || "Not generated"}`,
        },
      });
      await auditAction({ user, action: "PPM_DEFECT_CORRECTIVE_WO_CREATE", entity: "work_order", entityId: corrective.id, details: { ppm, input, corrective } });
      return NextResponse.json({ ppm, workOrder, corrective });
    }

    if (workOrder && Object.keys(workUpdate).length) {
      workOrder = await prisma.workOrder.update({ where: { id: workOrder.id }, data: workUpdate });
    }
    const updatedPpm = await prisma.preventiveMaintenance.update({ where: { id: ppm.id }, data: { ...ppmUpdate, ...(workflowStatus ? { workflowStatus } : {}) } });

    if (input.action === "close" && workOrder?.assetId) {
      await prisma.assetHistory.create({ data: { assetId: workOrder.assetId, eventType: "PPM_CLOSED", title: `${workOrder.woNo} closed`, details: `PPM ${updatedPpm.ppmCode || updatedPpm.code} closed. Next due: ${updatedPpm.nextDue.toISOString().slice(0, 10)}.`, actor: user?.name || user?.email || "System" } });
    }

    await auditAction({ user, action: `PPM_WORKFLOW_${input.action.toUpperCase()}`, entity: "preventive_maintenance", entityId: ppm.id, details: { before: ppm, input, after: updatedPpm, workOrder } });
    return NextResponse.json({ ppm: updatedPpm, workOrder });
  } catch (error) {
    return apiError(error, "Unable to process PPM workflow");
  }
}