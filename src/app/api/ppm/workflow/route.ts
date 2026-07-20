import { NextResponse } from "next/server";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAnyPermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const actions = ["schedule", "generate", "assign", "accept", "start", "hold", "submit", "approve", "reject", "rework", "close", "cancel", "defect"] as const;
const workflowStatuses = ["DRAFT", "SCHEDULED", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "SUBMITTED", "REWORK", "COMPLETED", "CLOSED", "OVERDUE", "CANCELLED"] as const;

const schema = z.object({
  ppmId: z.string().min(1),
  action: z.enum(actions),
  workflowStatus: z.enum(workflowStatuses).optional(),
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

function ppmGroupCode(ppm: PpmRecord) {
  return ppm.ppmCode || String(ppm.code || "").split("-")[0] || ppm.code;
}

function ppmGroupWhere(ppm: PpmRecord) {
  const groupCode = ppmGroupCode(ppm);
  return {
    OR: [
      { ppmCode: groupCode },
      { code: groupCode },
      { code: { startsWith: `${groupCode}-`, mode: "insensitive" as const } },
    ],
  };
}

async function loadPpmGroup(ppm: PpmRecord) {
  const rows = await prisma.preventiveMaintenance.findMany({
    where: ppmGroupWhere(ppm),
    orderBy: [{ locationCode: "asc" }, { assetTag: "asc" }, { nextDue: "asc" }],
    take: 20000,
  });
  return rows.length ? rows : [ppm];
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
    if (existing && !["CLOSED", "CANCELLED", "REJECTED"].includes(existing.status)) return { workOrder: existing, created: false };
  }
  const existingByPpm = await prisma.workOrder.findFirst({
    where: { ppmId: ppm.id, status: { notIn: ["CLOSED", "CANCELLED", "REJECTED"] as any } },
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
  const rows = await loadPpmGroup(ppm);
  const generatedAt = new Date();
  const workflowStatus = input.assignedTeamCode || input.technicianEmail ? "ASSIGNED" : "SCHEDULED";
  const results: Array<{ ppmId: string; ppmCode: string; code: string; workOrder: any; created: boolean }> = [];
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
    results.push({ ppmId: row.id, ppmCode: row.ppmCode || ppmGroupCode(row), code: row.code, workOrder: result.workOrder, created: result.created });
  }
  return {
    groupCode: ppmGroupCode(ppm),
    total: rows.length,
    createdCount: results.filter((item) => item.created).length,
    reusedCount: results.filter((item) => !item.created).length,
    results,
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
    if (input.action === "generate") {
      const generation = await createPpmWorkOrdersForGroup(ppm, input, user);
      const selectedResult = generation.results.find((item) => item.ppmId === ppm.id) || generation.results[0];
      workOrder = selectedResult?.workOrder || null;
      const updatedPpm = await prisma.preventiveMaintenance.findUnique({ where: { id: ppm.id } });
      await auditAction({
        user,
        action: "PPM_WORKFLOW_GENERATE",
        entity: "preventive_maintenance",
        entityId: ppm.id,
        details: { before: ppm, input, groupCode: generation.groupCode, total: generation.total, createdCount: generation.createdCount, reusedCount: generation.reusedCount },
      });
      return NextResponse.json({
        ppm: updatedPpm,
        workOrder,
        workOrders: generation.results.map((item) => item.workOrder),
        generatedRows: generation.results.map((item) => ({ ppmId: item.ppmId, code: item.code, workOrderId: item.workOrder.id, woNo: item.workOrder.woNo, created: item.created })),
        groupCode: generation.groupCode,
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