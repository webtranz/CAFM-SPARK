import { NextResponse } from "next/server";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAnyPermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const actions = [
  "schedule",
  "preview",
  "generate",
  "assign",
  "accept",
  "start",
  "hold",
  "submit",
  "approve",
  "reject",
  "rework",
  "close",
  "cancel",
  "defect",
] as const;
const workflowStatuses = [
  "DRAFT",
  "SCHEDULED",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "SUBMITTED",
  "REWORK",
  "COMPLETED",
  "CLOSED",
  "OVERDUE",
  "CANCELLED",
] as const;

const previewRowSchema = z.object({
  ppmId: z.string().min(1),
  scheduledDate: z.string().optional(),
});

const schema = z.object({
  ppmId: z.string().min(1),
  action: z.enum(actions),
  workflowStatus: z.enum(workflowStatuses).optional(),
  effectiveDate: z.string().optional(),
  dueMonth: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  ppmIds: z.array(z.string()).optional(),
  previewRows: z.array(previewRowSchema).optional(),
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

function frequencyInterval(frequency: string, periodUom?: string) {
  const rawFrequency = String(frequency || "").trim();
  const rawPeriodUom = String(periodUom || "").trim();
  const numeric = Number(
    `${rawFrequency} ${rawPeriodUom}`.match(/\d+(?:\.\d+)?/)?.[0] || "",
  );
  const amount =
    Number.isFinite(numeric) && numeric > 0
      ? Math.max(1, Math.floor(numeric))
      : 1;
  const label = `${rawFrequency} ${rawPeriodUom}`.toLowerCase();
  if (label.includes("daily") || label.includes(" day"))
    return { amount, unit: "day" as const };
  if (label.includes("biweekly") || label.includes("bi-weekly"))
    return { amount: numeric > 0 ? amount : 2, unit: "week" as const };
  if (label.includes("weekly") || label.includes(" week"))
    return { amount, unit: "week" as const };
  if (label.includes("quarter"))
    return { amount: numeric > 0 ? amount : 3, unit: "month" as const };
  if (label.includes("half") || label.includes("semi"))
    return { amount: numeric > 0 ? amount : 6, unit: "month" as const };
  if (label.includes("annual") || label.includes("year"))
    return { amount, unit: "year" as const };
  if (label.includes("month")) return { amount, unit: "month" as const };
  return { amount, unit: "month" as const };
}

function nextDueDate(current: Date, frequency: string, periodUom?: string) {
  const interval = frequencyInterval(frequency, periodUom);
  if (interval.unit === "day") return addDays(current, interval.amount);
  if (interval.unit === "week") return addWeeks(current, interval.amount);
  if (interval.unit === "year") return addYears(current, interval.amount);
  return addMonths(current, interval.amount);
}

function workflowNote(input: z.infer<typeof schema>) {
  return [
    input.checklistCompleted ? "Mandatory checklist completed: Yes" : "",
    input.readings ? `Readings:\n${input.readings}` : "",
    input.remarks ? `Remarks:\n${input.remarks}` : "",
    input.labor ? `Labor:\n${input.labor}` : "",
    input.materials ? `Materials:\n${input.materials}` : "",
    input.defectDescription ? `Defects:\n${input.defectDescription}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function findUserId(email?: string, db: any = prisma) {
  if (!email) return null;
  const user = await db.user.findUnique({ where: { email } });
  return user?.id ?? null;
}

const DEFAULT_PPM_EFFECTIVE_DATE = "2026-01-01";
const INVALID_GENERATED_WORK_ORDER_STATUSES = ["REJECTED"] as const;

function utcDateFromInput(
  value?: string,
  fallback = DEFAULT_PPM_EFFECTIVE_DATE,
) {
  const raw = String(value || fallback || DEFAULT_PPM_EFFECTIVE_DATE).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match)
    return new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date(Date.UTC(2026, 0, 1)) : date;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthStartFromInput(value: string | undefined, fallbackDate: Date) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (match)
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Date(
    Date.UTC(fallbackDate.getUTCFullYear(), fallbackDate.getUTCMonth(), 1),
  );
}

function addOneDay(date: Date) {
  return addDays(date, 1);
}

function ppmPlanningWindow(
  ppm: PpmRecord,
  input?: Pick<
    z.infer<typeof schema>,
    "effectiveDate" | "dueMonth" | "periodStart" | "periodEnd"
  >,
) {
  const effectiveDate = utcDateFromInput(input?.effectiveDate);
  const selectedMonthStart = monthStartFromInput(
    input?.dueMonth,
    new Date(ppm.nextDue),
  );
  const selectedMonthEnd = new Date(
    Date.UTC(
      selectedMonthStart.getUTCFullYear(),
      selectedMonthStart.getUTCMonth() + 1,
      1,
    ),
  );
  const rawPeriodStart = input?.periodStart
    ? utcDateFromInput(
        input.periodStart,
        selectedMonthStart.toISOString().slice(0, 10),
      )
    : selectedMonthStart;
  const rawPeriodEnd = input?.periodEnd
    ? addOneDay(
        utcDateFromInput(
          input.periodEnd,
          addDays(selectedMonthEnd, -1).toISOString().slice(0, 10),
        ),
      )
    : selectedMonthEnd;
  const rangeStart =
    effectiveDate.getTime() > rawPeriodStart.getTime()
      ? effectiveDate
      : rawPeriodStart;
  const rangeEnd =
    rawPeriodEnd.getTime() > rangeStart.getTime()
      ? rawPeriodEnd
      : addOneDay(rangeStart);
  return {
    effectiveDate,
    effectiveDateText: effectiveDate.toISOString().slice(0, 10),
    dueMonth: monthKey(selectedMonthStart),
    monthStart: rawPeriodStart,
    monthEnd: rangeEnd,
    periodStartText: rangeStart.toISOString().slice(0, 10),
    periodEndText: addDays(rangeEnd, -1).toISOString().slice(0, 10),
    dateFilter: { gte: rangeStart, lt: rangeEnd },
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

function ppmGroupWhere(
  ppm: PpmRecord,
  input?: Pick<
    z.infer<typeof schema>,
    "effectiveDate" | "dueMonth" | "periodStart" | "periodEnd"
  >,
) {
  return {
    ...ppmGroupBaseWhere(ppm),
    nextDue: ppmPlanningWindow(ppm, input).dateFilter,
  };
}

function rowIsInsidePlanningWindow(
  row: PpmRecord,
  input?: Pick<
    z.infer<typeof schema>,
    "effectiveDate" | "dueMonth" | "periodStart" | "periodEnd"
  >,
) {
  if (!input?.effectiveDate && !input?.dueMonth) return true;
  const planningWindow = ppmPlanningWindow(row, input);
  const nextDue = new Date(row.nextDue);
  const nextDueTime = nextDue.getTime();
  return (
    Number.isFinite(nextDueTime) &&
    nextDueTime >= planningWindow.dateFilter.gte.getTime() &&
    nextDueTime < planningWindow.dateFilter.lt.getTime()
  );
}

async function loadPpmGroup(
  ppm: PpmRecord,
  input?: Pick<
    z.infer<typeof schema>,
    "effectiveDate" | "dueMonth" | "periodStart" | "periodEnd" | "ppmIds"
  >,
) {
  const orderBy = [
    { locationCode: "asc" as const },
    { assetTag: "asc" as const },
    { nextDue: "asc" as const },
  ];
  const selectedIds = Array.from(
    new Set((input?.ppmIds || []).filter(Boolean)),
  );
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
  if (rows.length || (!input?.effectiveDate && !input?.dueMonth))
    return rows.length ? rows : [ppm];

  const unfilteredRows = await prisma.preventiveMaintenance.findMany({
    where: ppmGroupBaseWhere(ppm),
    orderBy,
    take: 20000,
  });
  return unfilteredRows.filter((row) => rowIsInsidePlanningWindow(row, input));
}

async function nextPpmWorkOrderNumber(db: any = prisma) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix =
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    const woNo = `PPM-WO-${suffix}`;
    const existing = await db.workOrder.findUnique({
      where: { woNo },
      select: { id: true },
    });
    if (!existing) return woNo;
  }
  return `PPM-WO-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
}

async function ensurePpmWorkOrder(
  ppm: PpmRecord,
  input: z.infer<typeof schema>,
  user: any,
  scheduledDate = ppm.nextDue,
  db: any = prisma,
) {
  const scheduledStart = new Date(scheduledDate);
  const scheduledEnd = addDays(scheduledStart, 1);
  const existingByPpmAndDate = await db.workOrder.findFirst({
    where: {
      ppmId: ppm.id,
      plannedStart: { gte: scheduledStart, lt: scheduledEnd },
      status: { notIn: [...INVALID_GENERATED_WORK_ORDER_STATUSES] as any },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existingByPpmAndDate)
    return { workOrder: existingByPpmAndDate, created: false };

  const [asset, team, technicianId] = await Promise.all([
    ppm.assetTag
      ? db.asset.findUnique({ where: { tag: ppm.assetTag } })
      : null,
    input.assignedTeamCode || ppm.assignedTeamCode
      ? db.team.findUnique({
          where: { code: input.assignedTeamCode || ppm.assignedTeamCode },
        })
      : null,
    findUserId(input.technicianEmail || ppm.technicianEmail, db),
  ]);
  const priority = ppm.priority;
  const target = ppm.assetTag || ppm.locationCode || ppm.code;
  let created: Awaited<ReturnType<typeof prisma.workOrder.create>> | null =
    null;
  let lastCreateError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const woNo = await nextPpmWorkOrderNumber(db);
    try {
      created = await db.workOrder.create({
        data: {
          woNo,
          title:
            `PPM | ${ppm.ppmCode || ppm.code} | ${target} | ${scheduledStart.toISOString().slice(0, 10)} | ${ppm.name}`.trim(),
          type: "Preventive",
          assetType:
            asset?.assetGroup || asset?.category || ppm.objectCategory || null,
          departmentCode: ppm.departmentCode || asset?.departmentCode || null,
          serviceCode: ppm.objectClass || null,
          assignedTeamCode:
            input.assignedTeamCode ||
            ppm.assignedTeamCode ||
            team?.code ||
            null,
          jobPlanCode: ppm.ppmCode || ppm.code,
          priority,
          status:
            input.assignedTeamCode || ppm.assignedTeamCode || technicianId
              ? "ASSIGNED"
              : "PENDING_ASSIGNMENT",
          assetId: asset?.id,
          assignedToId: technicianId,
          ppmId: ppm.id,
          plannedStart: scheduledStart,
          dueAt: addDays(
            scheduledStart,
            Math.max(1, Math.ceil(dueHours(priority) / 24)),
          ),
          estimatedHours: ppm.durationHrs,
          cost: 0,
          jobPlan:
            ppm.checklist || "PPM checklist to be completed before submission.",
          safetyNotes:
            "Verify isolation, access, permits and asset condition before starting PPM.",
          workNotes: `Generated from PPM ${ppm.ppmCode || ppm.code}. PPM row: ${ppm.code}. Target: ${target}. Scheduled date: ${scheduledStart.toISOString().slice(0, 10)}.`,
        },
      });
      break;
    } catch (error: any) {
      lastCreateError = error;
      if (error?.code !== "P2002") throw error;
    }
  }
  if (!created)
    throw lastCreateError instanceof Error
      ? lastCreateError
      : new Error(
          "Unable to create PPM work order after retrying work order numbers.",
        );
  if (asset?.id) {
    await db.assetHistory.create({
      data: {
        assetId: asset.id,
        eventType: "PPM_WORK_ORDER_CREATED",
        title: `${created.woNo} generated`,
        details: `PPM ${ppm.ppmCode || ppm.code} generated for ${ppm.assetTag || ppm.locationCode}.`,
        actor: user?.name || user?.email || "System",
      },
    });
  }
  return { workOrder: created, created: true };
}

async function advancePpmAfterGeneratedWorkOrder(
  db: any,
  ppm: PpmRecord,
  workOrder: any,
  user: any,
  generatedAt = new Date(),
  assignmentData: Partial<{
    assignedTeamCode: string;
    technicianEmail: string;
    supervisorEmail: string;
  }> = {},
) {
  if (!workOrder?.id) return { ppm, advanced: false };
  if (INVALID_GENERATED_WORK_ORDER_STATUSES.includes(workOrder.status as any))
    return { ppm, advanced: false };

  const currentPpm = await db.preventiveMaintenance.findUnique({
    where: { id: ppm.id },
  });
  if (!currentPpm) throw new Error("PPM plan not found while updating due date.");

  const generatedScheduleDate = new Date(workOrder.plannedStart || currentPpm.nextDue);
  const previousDueDate = Number.isNaN(generatedScheduleDate.getTime())
    ? new Date(currentPpm.nextDue)
    : generatedScheduleDate;
  const newDueDate = nextDueDate(
    previousDueDate,
    currentPpm.frequency,
    currentPpm.periodUom,
  );
  const currentDueDate = new Date(currentPpm.nextDue);
  const shouldMoveForward =
    Number.isNaN(currentDueDate.getTime()) ||
    newDueDate.getTime() > currentDueDate.getTime();
  const generatedBy = user?.name || user?.email || "System";

  const existingHistory = await db.ppmDueDateHistory.findUnique({
    where: { workOrderId: workOrder.id },
  });
  if (existingHistory) {
    if (shouldMoveForward) {
      const updatedPpm = await db.preventiveMaintenance.update({
        where: { id: currentPpm.id },
        data: {
          assignedTeamCode:
            assignmentData.assignedTeamCode ?? currentPpm.assignedTeamCode,
          technicianEmail:
            assignmentData.technicianEmail ?? currentPpm.technicianEmail,
          supervisorEmail:
            assignmentData.supervisorEmail ?? currentPpm.supervisorEmail,
          generatedWorkOrderId: workOrder.id,
          lastGeneratedAt: generatedAt,
          workflowStatus: "SCHEDULED",
          nextDue: newDueDate,
        },
      });
      return {
        ppm: updatedPpm,
        advanced: true,
        previousDueDate: existingHistory.previousDueDate || previousDueDate,
        newDueDate,
      };
    }
    return { ppm: currentPpm, advanced: false, previousDueDate, newDueDate };
  }

  const updatedPpm = shouldMoveForward
    ? await db.preventiveMaintenance.update({
        where: { id: currentPpm.id },
        data: {
          assignedTeamCode:
            assignmentData.assignedTeamCode ?? currentPpm.assignedTeamCode,
          technicianEmail:
            assignmentData.technicianEmail ?? currentPpm.technicianEmail,
          supervisorEmail:
            assignmentData.supervisorEmail ?? currentPpm.supervisorEmail,
          generatedWorkOrderId: workOrder.id,
          lastGeneratedAt: generatedAt,
          workflowStatus: "SCHEDULED",
          nextDue: newDueDate,
        },
      })
    : currentPpm;

  await db.ppmDueDateHistory.create({
    data: {
      ppmId: currentPpm.id,
      workOrderId: workOrder.id,
      previousDueDate,
      newDueDate,
      workOrderNumber: workOrder.woNo,
      scheduleStatus: "GENERATED",
      generatedBy,
      generatedAt,
    },
  });

  return { ppm: updatedPpm, advanced: shouldMoveForward, previousDueDate, newDueDate };
}

async function reconcileGeneratedPpmWorkOrders(
  db: any,
  ppm: PpmRecord,
  user: any,
  assignmentData: Partial<{
    assignedTeamCode: string;
    technicianEmail: string;
    supervisorEmail: string;
  }> = {},
) {
  const workOrders = await db.workOrder.findMany({
    where: {
      ppmId: ppm.id,
      status: { notIn: [...INVALID_GENERATED_WORK_ORDER_STATUSES] as any },
    },
    orderBy: [{ plannedStart: "asc" }, { createdAt: "asc" }],
  });
  let current = ppm;
  let advanced = false;
  let previousDueDate: Date | undefined;
  let newDueDate: Date | undefined;
  for (const workOrder of workOrders) {
    const result = await advancePpmAfterGeneratedWorkOrder(
      db,
      current,
      workOrder,
      user,
      workOrder.createdAt || new Date(),
      assignmentData,
    );
    current = result.ppm || current;
    advanced = advanced || Boolean(result.advanced);
    previousDueDate = result.previousDueDate || previousDueDate;
    newDueDate = result.newDueDate || newDueDate;
  }
  return { ppm: current, advanced, previousDueDate, newDueDate };
}async function createPpmWorkOrder(
  ppm: PpmRecord,
  input: z.infer<typeof schema>,
  user: any,
  db: any = prisma,
) {
  return (await ensurePpmWorkOrder(ppm, input, user, ppm.nextDue, db)).workOrder;
}

async function findWorkflowWorkOrder(
  ppm: PpmRecord,
  input: z.infer<typeof schema>,
) {
  if (ppm.generatedWorkOrderId) {
    const generated = await prisma.workOrder.findUnique({
      where: { id: ppm.generatedWorkOrderId },
    });
    if (generated) return generated;
  }
  const planningWindow = ppmPlanningWindow(ppm, input);
  return prisma.workOrder.findFirst({
    where: {
      ppmId: ppm.id,
      plannedStart: planningWindow.dateFilter,
      status: { notIn: [...INVALID_GENERATED_WORK_ORDER_STATUSES] as any },
    },
    orderBy: [{ plannedStart: "desc" }, { createdAt: "desc" }],
  });
}
type PpmOccurrence = {
  row: PpmRecord;
  scheduledDate: Date;
};

function ppmOccurrencesForPeriod(
  rows: PpmRecord[],
  input: z.infer<typeof schema>,
) {
  const explicitRows = input.previewRows || [];
  if (explicitRows.length) {
    const rowById = new Map(rows.map((row) => [row.id, row]));
    return explicitRows.flatMap((previewRow) => {
      const row = rowById.get(previewRow.ppmId);
      if (!row) return [];
      const scheduledDate = utcDateFromInput(
        previewRow.scheduledDate,
        row.nextDue.toISOString().slice(0, 10),
      );
      return [{ row, scheduledDate }];
    });
  }
  return rows.flatMap((row) => {
    const planningWindow = ppmPlanningWindow(row, input);
    const occurrences: PpmOccurrence[] = [];
    let scheduledDate = new Date(row.nextDue);
    let guard = 0;
    while (scheduledDate < planningWindow.dateFilter.gte && guard < 500) {
      const next = nextDueDate(scheduledDate, row.frequency, row.periodUom);
      if (next.getTime() <= scheduledDate.getTime()) break;
      scheduledDate = next;
      guard += 1;
    }
    while (
      scheduledDate >= planningWindow.dateFilter.gte &&
      scheduledDate < planningWindow.dateFilter.lt &&
      guard < 1000
    ) {
      occurrences.push({ row, scheduledDate: new Date(scheduledDate) });
      const next = nextDueDate(scheduledDate, row.frequency, row.periodUom);
      if (next.getTime() <= scheduledDate.getTime()) break;
      scheduledDate = next;
      guard += 1;
    }
    return occurrences;
  });
}
async function createPpmWorkOrdersForGroup(
  ppm: PpmRecord,
  input: z.infer<typeof schema>,
  user: any,
) {
  const planningWindow = ppmPlanningWindow(ppm, input);
  const rows = await loadPpmGroup(ppm, input);
  const occurrences = ppmOccurrencesForPeriod(rows, input);
  if (!occurrences.length) {
    throw new Error(
      `No PPM work orders are due for ${ppmGroupCode(ppm)} in the selected period. Click Preview Period WOs and then Create again.`,
    );
  }
  const generatedAt = new Date();
  const assignmentData = {
    assignedTeamCode: input.assignedTeamCode || "",
    technicianEmail: input.technicianEmail || "",
    supervisorEmail: input.supervisorEmail || "",
  };
  const results: Array<{
    ppmId: string;
    ppmCode: string;
    code: string;
    assetTag?: string;
    locationCode?: string;
    departmentCode?: string;
    equipmentDescription?: string | null;
    frequency?: string;
    periodUom?: string;
    previousDue?: Date;
    nextDue?: Date;
    scheduledDate: Date;
    workOrder: any;
    created: boolean;
    dueDateAdvanced: boolean;
  }> = [];

  for (const occurrence of occurrences) {
    const row = occurrence.row;
    const result = await prisma.$transaction(async (tx) => {
      const ensured = await ensurePpmWorkOrder(
        row,
        input,
        user,
        occurrence.scheduledDate,
        tx,
      );
      const dueUpdate = ensured.workOrder
        ? await advancePpmAfterGeneratedWorkOrder(
            tx,
            row,
            ensured.workOrder,
            user,
            generatedAt,
            assignmentData,
          )
        : { ppm: row, advanced: false };
      return { ...ensured, dueUpdate };
    });

    results.push({
      ppmId: row.id,
      ppmCode: row.ppmCode || ppmGroupCode(row),
      code: row.code,
      assetTag: row.assetTag,
      locationCode: row.locationCode,
      departmentCode: row.departmentCode,
      equipmentDescription: row.equipmentDescription,
      frequency: row.frequency,
      periodUom: row.periodUom,
      previousDue: result.dueUpdate.previousDueDate || row.nextDue,
      nextDue: result.dueUpdate.ppm?.nextDue || row.nextDue,
      scheduledDate: occurrence.scheduledDate,
      workOrder: result.workOrder,
      created: result.created,
      dueDateAdvanced: Boolean(result.dueUpdate.advanced),
    });
  }
  return {
    groupCode: ppmGroupCode(ppm),
    effectiveDate: planningWindow.effectiveDateText,
    dueMonth: planningWindow.dueMonth,
    periodStart: planningWindow.periodStartText,
    periodEnd: planningWindow.periodEndText,
    total: occurrences.length,
    createdCount: results.filter((item) => item.created).length,
    reusedCount: results.filter((item) => !item.created).length,
    advancedCount: results.filter((item) => item.dueDateAdvanced).length,
    results,
  };
}
async function buildPpmWorkOrderPreview(
  ppm: PpmRecord,
  input: z.infer<typeof schema>,
) {
  const planningWindow = ppmPlanningWindow(ppm, input);
  const rows = await loadPpmGroup(ppm, input);
  const occurrences = ppmOccurrencesForPeriod(rows, input);
  const rowIds = rows.map((row) => row.id);
  const existingWorkOrders = rowIds.length
    ? await prisma.workOrder.findMany({
        where: {
          ppmId: { in: rowIds },
          plannedStart: planningWindow.dateFilter,
          status: { notIn: [...INVALID_GENERATED_WORK_ORDER_STATUSES] as any },
        },
        select: {
          id: true,
          ppmId: true,
          woNo: true,
          status: true,
          plannedStart: true,
          dueAt: true,
        },
      })
    : [];
  const existingByPpmDate = new Map(
    existingWorkOrders.map((workOrder) => [
      `${workOrder.ppmId || ""}|${workOrder.plannedStart.toISOString().slice(0, 10)}`,
      workOrder,
    ]),
  );
  const previewRows = occurrences.map((occurrence) => {
    const row = occurrence.row;
    const scheduledDateText = occurrence.scheduledDate
      .toISOString()
      .slice(0, 10);
    const existing = existingByPpmDate.get(`${row.id}|${scheduledDateText}`);
    return {
      ppmId: row.id,
      ppmCode: row.ppmCode || ppmGroupCode(row),
      code: row.code,
      title: row.name,
      assetTag: row.assetTag,
      locationCode: row.locationCode,
      departmentCode: row.departmentCode,
      equipmentDescription: row.equipmentDescription,
      frequency: row.frequency,
      periodUom: row.periodUom,
      nextDue: occurrence.scheduledDate,
      plannedStart: occurrence.scheduledDate,
      scheduledDate: scheduledDateText,
      existingWorkOrderNo: existing?.woNo || "",
      existingStatus: existing?.status || "",
      willCreate: !existing,
    };
  });
  return {
    groupCode: ppmGroupCode(ppm),
    effectiveDate: planningWindow.effectiveDateText,
    dueMonth: planningWindow.dueMonth,
    periodStart: planningWindow.periodStartText,
    periodEnd: planningWindow.periodEndText,
    monthStart: planningWindow.periodStartText,
    monthEnd: planningWindow.periodEndText,
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
    const requiredPermission = ["accept", "start", "hold", "submit"].includes(
      input.action,
    )
      ? "ppm.execute"
      : ["approve", "reject", "rework", "close"].includes(input.action)
        ? "ppm.approve"
        : "ppm.manage";
    const { error, user } = await requireAnyPermission([
      requiredPermission,
      "ppm.manage",
    ]);
    if (error) return error;
    const ppm = await loadPpm(input.ppmId);
    if (!ppm) throw new Error("PPM plan not found");

    const assignmentData = {
      assignedTeamCode: input.assignedTeamCode ?? ppm.assignedTeamCode,
      technicianEmail: input.technicianEmail ?? ppm.technicianEmail,
      supervisorEmail: input.supervisorEmail ?? ppm.supervisorEmail,
    };
    let workOrder = await findWorkflowWorkOrder(ppm, input);
    let workflowStatus: (typeof workflowStatuses)[number] | undefined;
    const workUpdate: any = {};
    const ppmUpdate: any = { ...assignmentData };

    if (input.action === "schedule") workflowStatus = "SCHEDULED";
    if (input.action === "preview") {
      const preview = await buildPpmWorkOrderPreview(ppm, input);
      return NextResponse.json({
        ppm,
        preview,
        groupCode: preview.groupCode,
        totalWorkOrders: preview.total,
      });
    }
    if (input.action === "generate") {
      const generation = await createPpmWorkOrdersForGroup(ppm, input, user);
      const selectedResult =
        generation.results.find((item) => item.ppmId === ppm.id) ||
        generation.results[0];
      workOrder = selectedResult?.workOrder || null;
      const updatedPpm = await prisma.preventiveMaintenance.findUnique({
        where: { id: ppm.id },
      });
      const preview = {
        groupCode: generation.groupCode,
        effectiveDate: generation.effectiveDate,
        dueMonth: generation.dueMonth,
        periodStart: generation.periodStart,
        periodEnd: generation.periodEnd,
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
          previousDue: item.previousDue,
          nextDue: item.nextDue,
          scheduledDate: item.scheduledDate?.toISOString?.().slice(0, 10) || "",
          frequency: item.frequency,
          periodUom: item.periodUom,
          workOrderNo: item.workOrder.woNo,
          willCreate: item.created,
          dueDateAdvanced: item.dueDateAdvanced,
        })),
        limited: generation.results.length > 300,
      };
      await auditAction({
        user,
        action: "PPM_WORKFLOW_GENERATE",
        entity: "preventive_maintenance",
        entityId: ppm.id,
        details: {
          before: ppm,
          input,
          groupCode: generation.groupCode,
          dueMonth: generation.dueMonth,
          periodStart: generation.periodStart,
          periodEnd: generation.periodEnd,
          effectiveDate: generation.effectiveDate,
          total: generation.total,
          createdCount: generation.createdCount,
          reusedCount: generation.reusedCount,
        },
      });
      return NextResponse.json({
        ppm: updatedPpm,
        workOrder,
        workOrders: generation.results.map((item) => item.workOrder),
        generatedRows: generation.results.map((item: any) => ({
          ppmId: item.ppmId,
          code: item.code,
          workOrderId: item.workOrder.id,
          woNo: item.workOrder.woNo,
          created: item.created,
          previousDue: item.previousDue,
          nextDue: item.nextDue,
          scheduledDate: item.scheduledDate?.toISOString?.().slice(0, 10) || "",
          frequency: item.frequency,
          periodUom: item.periodUom,
          generatedAt: item.workOrder.createdAt,
          workflowStatus: item.dueDateAdvanced ? "SCHEDULED" : undefined,
          dueDateAdvanced: item.dueDateAdvanced,
        })),
        preview,
        groupCode: generation.groupCode,
        effectiveDate: generation.effectiveDate,
        dueMonth: generation.dueMonth,
        totalWorkOrders: generation.total,
        generatedCount: generation.createdCount,
        reusedCount: generation.reusedCount,
        periodStart: generation.periodStart,
        periodEnd: generation.periodEnd,
        message: `Created ${generation.createdCount.toLocaleString()} new PPM work orders and linked ${generation.total.toLocaleString()} work orders for ${generation.periodStart} to ${generation.periodEnd}.`,
      });
    }
    if (input.action === "assign") {
      const generatedAt = new Date();
      const result = await prisma.$transaction(async (tx) => {
        const ensured = await ensurePpmWorkOrder(ppm, input, user, ppm.nextDue, tx);
        const dueUpdate = ensured.workOrder
          ? await advancePpmAfterGeneratedWorkOrder(
              tx,
              ppm,
              ensured.workOrder,
              user,
              generatedAt,
              assignmentData,
            )
          : { ppm, advanced: false };
        return { ...ensured, dueUpdate };
      });
      workOrder = result.workOrder;
      if (result.created && workOrder) {
        return NextResponse.json({
          ppm: result.dueUpdate.ppm,
          workOrder,
          dueDateAdvanced: result.dueUpdate.advanced,
          message: `PPM work order ${workOrder.woNo} created. Current schedule marked Generated and next due date scheduled.`,
        });
      }
      if (!workOrder) {
        throw new Error("PPM work order could not be created or found.");
      }
      workflowStatus =
        assignmentData.assignedTeamCode || assignmentData.technicianEmail
          ? "ASSIGNED"
          : "SCHEDULED";
      ppmUpdate.generatedWorkOrderId = workOrder.id;
      ppmUpdate.lastGeneratedAt = generatedAt;
      if (workOrder) {
        workUpdate.assignedTeamCode = assignmentData.assignedTeamCode || null;
        workUpdate.assignedToId =
          (await findUserId(assignmentData.technicianEmail)) || null;
        workUpdate.status = "ASSIGNED";
      }
    }
    if (!workOrder && !["schedule", "cancel"].includes(input.action))
      throw new Error(
        "Generate the PPM work order first, then run this workflow action.",
      );
    if (input.action === "accept") {
      workflowStatus = "ASSIGNED";
      workUpdate.status = "ACCEPTED";
      workUpdate.responseAt = new Date();
    }
    if (input.action === "start") {
      workflowStatus = "IN_PROGRESS";
      workUpdate.status = "IN_PROGRESS";
      workUpdate.responseAt = workOrder?.responseAt || new Date();
    }
    if (input.action === "hold") {
      workflowStatus = "ON_HOLD";
      workUpdate.status = "ON_HOLD";
    }
    if (input.action === "submit") {
      if (ppm.checklistMandatory && !input.checklistCompleted)
        throw new Error(
          "Mandatory checklist must be completed before submitting for supervisor review.",
        );
      workflowStatus = "SUBMITTED";
      workUpdate.status = "PENDING_SUPERVISOR_REVIEW";
      workUpdate.resolutionAt = new Date();
      workUpdate.workNotes = [workOrder?.workNotes, workflowNote(input)]
        .filter(Boolean)
        .join("\n\n");
      workUpdate.photoUrls = input.photoUrls || workOrder?.photoUrls;
      workUpdate.assetsUsed = input.labor || workOrder?.assetsUsed;
      workUpdate.inventoryUsed = input.materials || workOrder?.inventoryUsed;
      workUpdate.materialRequest =
        input.materials || workOrder?.materialRequest;
    }
    if (input.action === "approve") {
      workflowStatus = "COMPLETED";
      workUpdate.status = "VERIFIED";
      workUpdate.verifiedAt = new Date();
      workUpdate.supervisorDecision =
        input.supervisorDecision || "Approved by supervisor.";
    }
    if (input.action === "reject" || input.action === "rework") {
      workflowStatus = "REWORK";
      workUpdate.status = "REOPENED";
      workUpdate.rejectionReason =
        input.rejectionReason ||
        input.supervisorDecision ||
        "Returned for rework.";
      workUpdate.supervisorDecision =
        input.supervisorDecision || "Returned for rework.";
    }
    if (input.action === "close") {
      workflowStatus = "CLOSED";
      workUpdate.status = "CLOSED";
      workUpdate.finishedAt = new Date();
      workUpdate.verifiedAt = workOrder?.verifiedAt || new Date();
      ppmUpdate.lastCompletedAt = new Date();

    }
    if (input.action === "cancel") {
      workflowStatus = "CANCELLED";
      if (workOrder) workUpdate.status = "REJECTED";
    }
    if (input.action === "defect") {
      if (!input.defectDescription?.trim())
        throw new Error("Defect description is required.");
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
          assetId: ppm.assetTag
            ? (
                await prisma.asset.findUnique({
                  where: { tag: ppm.assetTag },
                  select: { id: true },
                })
              )?.id
            : undefined,
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
      await auditAction({
        user,
        action: "PPM_DEFECT_CORRECTIVE_WO_CREATE",
        entity: "work_order",
        entityId: corrective.id,
        details: { ppm, input, corrective },
      });
      return NextResponse.json({ ppm, workOrder, corrective });
    }

    if (workOrder && Object.keys(workUpdate).length) {
      workOrder = await prisma.workOrder.update({
        where: { id: workOrder.id },
        data: workUpdate,
      });
    }
    const updatedPpm = await prisma.preventiveMaintenance.update({
      where: { id: ppm.id },
      data: { ...ppmUpdate, ...(workflowStatus ? { workflowStatus } : {}) },
    });

    if (input.action === "close" && workOrder?.assetId) {
      await prisma.assetHistory.create({
        data: {
          assetId: workOrder.assetId,
          eventType: "PPM_CLOSED",
          title: `${workOrder.woNo} closed`,
          details: `PPM ${updatedPpm.ppmCode || updatedPpm.code} closed. Next due: ${updatedPpm.nextDue.toISOString().slice(0, 10)}.`,
          actor: user?.name || user?.email || "System",
        },
      });
    }

    await auditAction({
      user,
      action: `PPM_WORKFLOW_${input.action.toUpperCase()}`,
      entity: "preventive_maintenance",
      entityId: ppm.id,
      details: { before: ppm, input, after: updatedPpm, workOrder },
    });
    return NextResponse.json({
      ppm: updatedPpm,
      workOrder,
      message: `PPM workflow action ${input.action.replace(/_/g, " ")} completed successfully.`,
    });
  } catch (error) {
    return apiError(
      error,
      error instanceof Error ? error.message : "Unable to process PPM workflow",
      error instanceof Error ? 400 : 500,
    );
  }
}
