import { NextResponse } from "next/server";
import { addHours } from "date-fns";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAnyPermission, requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const securitySchema = z.object({
  type: z.enum(["location", "gatePass", "dailyReport", "fireDrill", "checklist", "gatePassStatus"]),
  id: z.string().optional(),
  code: z.string().optional(),
  name: z.string().optional(),
  gateName: z.string().optional(),
  siteCode: z.string().optional(),
  locationCode: z.string().optional(),
  active: z.coerce.boolean().optional(),
  passNo: z.string().optional(),
  requesterName: z.string().optional(),
  visitorName: z.string().optional(),
  visitorCompany: z.string().optional(),
  visitorIdNo: z.string().optional(),
  contactNo: z.string().optional(),
  purpose: z.string().optional(),
  securityLocationCode: z.string().optional(),
  locationName: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  vehicleNo: z.string().optional(),
  materials: z.string().optional(),
  status: z.string().optional(),
  rejectionReason: z.string().optional(),
  issuedBy: z.string().optional(),
  reportNo: z.string().optional(),
  reportDate: z.string().optional(),
  shift: z.string().optional(),
  officerName: z.string().optional(),
  visitorCount: z.coerce.number().int().min(0).optional(),
  vehicleCount: z.coerce.number().int().min(0).optional(),
  incidents: z.string().optional(),
  handoverNotes: z.string().optional(),
  drillNo: z.string().optional(),
  drillDate: z.string().optional(),
  alarmType: z.string().optional(),
  conductedBy: z.string().optional(),
  evacuationTimeMin: z.coerce.number().int().min(0).optional(),
  participants: z.coerce.number().int().min(0).optional(),
  observations: z.string().optional(),
  correctiveActions: z.string().optional(),
  checklistNo: z.string().optional(),
  checklistDate: z.string().optional(),
  checklistItemsJson: z.string().optional(),
  remarks: z.string().optional(),
});

type SecurityInput = z.infer<typeof securitySchema>;

type ChecklistItem = {
  code: string;
  section: string;
  item: string;
  departmentCode?: string;
  serviceCode?: string;
  assignedTeamCode?: string;
  status: string;
  priority?: string;
  remarks?: string;
  createRequest?: boolean;
};

const slaByPriority = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 12,
  CRITICAL: 4,
};

export async function GET() {
  const { error } = await requireAnyPermission(["security.view", "security.approve"]);
  if (error) return error;

  const [locations, gatePasses, dailyReports, fireDrills, checklists] = await Promise.all([
    prisma.securityLocation.findMany({ orderBy: { code: "asc" } }),
    prisma.securityGatePass.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.securityDailyReport.findMany({ orderBy: { reportDate: "desc" }, take: 500 }),
    prisma.securityFireDrillReport.findMany({ orderBy: { drillDate: "desc" }, take: 500 }),
    prisma.securityChecklistReport.findMany({ orderBy: { checklistDate: "desc" }, take: 500 }),
  ]);

  return NextResponse.json({ locations, gatePasses, dailyReports, fireDrills, checklists });
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const input = securitySchema.parse(raw);
    const permission = input.type === "gatePassStatus" ? "security.approve" : "security.create";
    const { error } = await requirePermission(permission);
    if (error) return error;

    const user = await getCurrentUser();
    const actor = user?.name || user?.email || "System";
    const result = await saveSecurityRecord(input, actor);
    await auditAction({
      user,
      action: input.type === "gatePassStatus" ? `SECURITY_GATE_PASS_${String(input.status || "STATUS")}` : `SECURITY_${input.type.toUpperCase()}_SAVE`,
      entity: `security_${input.type}`,
      entityId: result.id,
      details: { input, savedRecord: result },
    });
    return NextResponse.json(result, { status: input.type === "gatePassStatus" ? 200 : 201 });
  } catch (error) {
    return apiError(error, "Unable to save security record");
  }
}

function clean(value?: string | null) {
  return String(value ?? "").trim();
}

function required(value: string | undefined, label: string) {
  const cleaned = clean(value);
  if (!cleaned) throw new Error(`${label} is required.`);
  return cleaned;
}

function asDate(value: string | undefined, label: string) {
  const cleaned = required(value, label);
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return date;
}

function validPriority(value?: string): keyof typeof slaByPriority {
  const priority = clean(value).toUpperCase();
  return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority) ? (priority as keyof typeof slaByPriority) : "MEDIUM";
}

function parseChecklistItems(value?: string): ChecklistItem[] {
  const raw = clean(value);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Checklist items must be a valid array.");
  return parsed.map((item, index) => {
    const status = clean(item.status).toUpperCase() || "OK";
    if (!["OK", "NOT_OK", "NA"].includes(status)) throw new Error(`Checklist item ${index + 1} has an invalid status.`);
    return {
      code: clean(item.code) || `ITEM-${index + 1}`,
      section: clean(item.section) || "General",
      item: required(item.item, `Checklist item ${index + 1}`),
      departmentCode: clean(item.departmentCode) || undefined,
      serviceCode: clean(item.serviceCode) || undefined,
      assignedTeamCode: clean(item.assignedTeamCode) || undefined,
      status,
      priority: validPriority(item.priority),
      remarks: clean(item.remarks) || undefined,
      createRequest: Boolean(item.createRequest),
    };
  });
}

async function nextCode(prefix: string, model: "gatePass" | "dailyReport" | "fireDrill" | "checklist") {
  const count =
    model === "gatePass"
      ? await prisma.securityGatePass.count()
      : model === "dailyReport"
      ? await prisma.securityDailyReport.count()
      : model === "fireDrill"
      ? await prisma.securityFireDrillReport.count()
      : await prisma.securityChecklistReport.count();
  return `${prefix}-${String(count + 1).padStart(6, "0")}`;
}

async function createChecklistServiceRequest(tx: any, item: ChecklistItem, input: SecurityInput, actor: string, ticketNo: string, checklistNo: string) {
  const priority = validPriority(item.priority);
  const slaHours = slaByPriority[priority];
  const department = item.departmentCode ? await tx.department.findUnique({ where: { code: item.departmentCode } }) : null;
  const supervisor = item.departmentCode
    ? await tx.user.findFirst({
        where: {
          role: { contains: "Supervisor", mode: "insensitive" },
          OR: [
            { department: { contains: item.departmentCode, mode: "insensitive" } },
            { department: { contains: department?.name ?? item.departmentCode, mode: "insensitive" } },
          ],
          active: true,
        },
        orderBy: { name: "asc" },
      })
    : null;
  const locationParts = [clean(input.securityLocationCode), clean(input.locationName)].filter(Boolean).join(" - ");

  return tx.serviceRequest.create({
    data: {
      title: `Security checklist exception - ${item.item}`,
      category: item.section || "Security Checklist",
      departmentCode: item.departmentCode || null,
      serviceCode: item.serviceCode || null,
      assignedTeamCode: item.assignedTeamCode || null,
      requester: actor,
      priority,
      location: locationParts || "Security checkpoint",
      description: [
        `Security checklist ${checklistNo}`,
        `Shift: ${clean(input.shift) || "-"}`,
        `Officer: ${clean(input.officerName) || actor}`,
        `Item: ${item.item}`,
        `Department: ${item.departmentCode || "Unassigned"}`,
        `Remarks: ${item.remarks || "No remarks provided."}`,
      ].join("\n"),
      isIncidentCase: false,
      assignedSupervisorEmail: supervisor?.email || null,
      channel: "Security Checklist",
      ticketNo,
      slaHours,
      dueAt: addHours(new Date(), slaHours),
      status: "NEW",
    },
  });
}

async function saveSecurityRecord(input: SecurityInput, actor: string) {
  if (input.type === "location") {
    const code = required(input.code, "Security location code").toUpperCase();
    return prisma.securityLocation.upsert({
      where: { code },
      update: {
        name: required(input.name, "Security location name"),
        gateName: clean(input.gateName) || null,
        siteCode: clean(input.siteCode) || null,
        locationCode: clean(input.locationCode) || null,
        active: input.active ?? true,
      },
      create: {
        code,
        name: required(input.name, "Security location name"),
        gateName: clean(input.gateName) || null,
        siteCode: clean(input.siteCode) || null,
        locationCode: clean(input.locationCode) || null,
        active: input.active ?? true,
        createdBy: actor,
      },
    });
  }

  if (input.type === "gatePass") {
    const securityLocation = clean(input.securityLocationCode);
    const passNo = clean(input.passNo) || (await nextCode("GP", "gatePass"));
    const validFrom = asDate(input.validFrom, "Valid from");
    const validTo = asDate(input.validTo, "Valid to");
    if (validTo < validFrom) throw new Error("Valid to must be after valid from.");
    return prisma.securityGatePass.create({
      data: {
        passNo,
        requesterName: required(input.requesterName, "Requester name"),
        visitorName: required(input.visitorName, "Visitor name"),
        visitorCompany: clean(input.visitorCompany) || null,
        visitorIdNo: clean(input.visitorIdNo) || null,
        contactNo: clean(input.contactNo) || null,
        purpose: required(input.purpose, "Purpose"),
        securityLocationCode: securityLocation || null,
        locationName: clean(input.locationName) || null,
        validFrom,
        validTo,
        vehicleNo: clean(input.vehicleNo) || null,
        materials: clean(input.materials) || null,
        issuedBy: clean(input.issuedBy) || actor,
        createdBy: actor,
        status: "PENDING_HELPDESK",
      },
    });
  }

  if (input.type === "gatePassStatus") {
    const id = required(input.id, "Gate pass id");
    const status = required(input.status, "Status").toUpperCase();
    if (!["APPROVED", "REJECTED", "CANCELLED"].includes(status)) throw new Error("Unsupported gate pass status.");
    return prisma.securityGatePass.update({
      where: { id },
      data: {
        status,
        helpdeskApprovedBy: status === "APPROVED" ? actor : null,
        helpdeskApprovedAt: status === "APPROVED" ? new Date() : null,
        rejectionReason: status === "REJECTED" ? clean(input.rejectionReason) || "Rejected by Helpdesk" : null,
      },
    });
  }

  if (input.type === "dailyReport") {
    const reportNo = clean(input.reportNo) || (await nextCode("SDR", "dailyReport"));
    return prisma.securityDailyReport.create({
      data: {
        reportNo,
        reportDate: asDate(input.reportDate, "Report date"),
        shift: required(input.shift, "Shift"),
        securityLocationCode: clean(input.securityLocationCode) || null,
        locationName: clean(input.locationName) || null,
        officerName: required(input.officerName, "Officer name"),
        visitorCount: input.visitorCount ?? 0,
        vehicleCount: input.vehicleCount ?? 0,
        incidents: clean(input.incidents) || null,
        handoverNotes: clean(input.handoverNotes) || null,
        createdBy: actor,
      },
    });
  }

  if (input.type === "checklist") {
    const checklistNo = clean(input.checklistNo) || (await nextCode("SCL", "checklist"));
    const checklistDate = asDate(input.checklistDate, "Checklist date");
    const items = parseChecklistItems(input.checklistItemsJson);
    if (!items.length) throw new Error("At least one checklist item is required.");
    const failedItems = items.filter((item) => item.status === "NOT_OK").length;
    const actionableItems = items.filter((item) => item.status === "NOT_OK" && item.createRequest);
    const startingTicketCount = await prisma.serviceRequest.count();

    return prisma.$transaction(async (tx) => {
      const linkedRequests = [];
      for (let index = 0; index < actionableItems.length; index += 1) {
        const item = actionableItems[index];
        const ticketNo = `SR-${String(startingTicketCount + 24001 + index).padStart(5, "0")}`;
        const request = await createChecklistServiceRequest(tx, item, input, actor, ticketNo, checklistNo);
        linkedRequests.push({ itemCode: item.code, ticketNo: request.ticketNo, id: request.id, departmentCode: item.departmentCode ?? null });
      }

      return tx.securityChecklistReport.create({
        data: {
          checklistNo,
          checklistDate,
          shift: required(input.shift, "Shift"),
          securityLocationCode: clean(input.securityLocationCode) || null,
          locationName: clean(input.locationName) || null,
          officerName: required(input.officerName, "Officer name"),
          status: failedItems > 0 ? "ACTION_REQUIRED" : "COMPLETED",
          totalItems: items.length,
          failedItems,
          items,
          linkedRequests,
          remarks: clean(input.remarks) || null,
          createdBy: actor,
        },
      });
    });
  }

  const drillNo = clean(input.drillNo) || (await nextCode("FAD", "fireDrill"));
  return prisma.securityFireDrillReport.create({
    data: {
      drillNo,
      drillDate: asDate(input.drillDate, "Drill date"),
      securityLocationCode: clean(input.securityLocationCode) || null,
      locationName: clean(input.locationName) || null,
      alarmType: required(input.alarmType, "Alarm type"),
      conductedBy: required(input.conductedBy, "Conducted by"),
      evacuationTimeMin: input.evacuationTimeMin ?? null,
      participants: input.participants ?? null,
      observations: clean(input.observations) || null,
      correctiveActions: clean(input.correctiveActions) || null,
      status: clean(input.status) || "SUBMITTED",
      createdBy: actor,
    },
  });
}
