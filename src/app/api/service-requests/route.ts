import { NextResponse } from "next/server";
import { z } from "zod";
import { addHours } from "date-fns";
import { auditAction } from "@/lib/audit";
import { requirePermission } from "@/lib/api-auth";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const booleanInput = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean()).optional();

const schema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  departmentCode: z.string().optional(),
  serviceCode: z.string().optional(),
  assignedTeamCode: z.string().optional(),
  requester: z.string().optional(),
  priority: z.string().optional(),
  location: z.string().optional(),
  attachmentUrls: z.string().optional(),
  description: z.string().optional(),
  isIncidentCase: booleanInput,
});

const slaByPriority = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 12,
  CRITICAL: 4,
};

function cleanText(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function normalizePriority(value?: string | null) {
  const priority = cleanText(value)?.toUpperCase();
  return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority ?? "")
    ? (priority as keyof typeof slaByPriority)
    : "LOW";
}

async function nextServiceRequestTicketNo(startAt: number) {
  let current = Math.max(24001, startAt);
  for (let attempt = 0; attempt < 25000; attempt += 1) {
    const ticketNo = `SR-${String(current + attempt).padStart(5, "0")}`;
    const existing = await prisma.serviceRequest.findUnique({
      where: { ticketNo },
      select: { id: true },
    });
    if (!existing) return ticketNo;
  }
  return `SR-${Date.now()}`;
}

function createErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
      .join("; ");
  }
  if (error instanceof Error) return error.message;
  return "Unable to create service request";
}


export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("servicerequests.view");
    if (error) return error;
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim() || "";
    const status = url.searchParams.get("status")?.trim() || "All";
    const priority = url.searchParams.get("priority")?.trim() || "All";
    const category = url.searchParams.get("category")?.trim() || "All";
    const overdueOnly = url.searchParams.get("overdueOnly") === "true";
    const pageInput = Number(url.searchParams.get("page") || 1);
    const pageSizeParam = url.searchParams.get("pageSize") || "100";
    const pageSizeInput = pageSizeParam === "all" ? Number.MAX_SAFE_INTEGER : Number(pageSizeParam);
    const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
    const pageSize = pageSizeParam === "all" ? 10000 : Number.isFinite(pageSizeInput) ? Math.min(500, Math.max(25, Math.floor(pageSizeInput))) : 100;
    const where: any = {
      ...(status !== "All" ? { status } : {}),
      ...(priority !== "All" ? { priority } : {}),
      ...(category !== "All" ? { category } : {}),
      ...(overdueOnly ? { dueAt: { lt: new Date() }, status: { notIn: ["CLOSED", "REJECTED"] } } : {}),
    };
    if (query) {
      where.OR = [
        { ticketNo: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { requester: { contains: query, mode: "insensitive" } },
        { location: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
        { departmentCode: { contains: query, mode: "insensitive" } },
        { serviceCode: { contains: query, mode: "insensitive" } },
      ];
    }
    const [allTotal, total, requests] = await Promise.all([
      prisma.serviceRequest.count(),
      prisma.serviceRequest.count({ where }),
      prisma.serviceRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { workOrder: { select: { id: true, woNo: true, status: true } } },
      }),
    ]);
    return NextResponse.json({ requests, allTotal, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    return NextResponse.json({ message: "Unable to load service requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requirePermission("servicerequests.create");
    if (error) return error;
    const input = schema.parse(await request.json());
    const user = await getCurrentUser();
    const count = await prisma.serviceRequest.count();
    const priority = normalizePriority(input.priority);
    const slaHours = slaByPriority[priority];
    const departmentCode = cleanText(input.departmentCode);
    const serviceCode = cleanText(input.serviceCode);
    const assignedTeamCode = cleanText(input.assignedTeamCode);
    const title = cleanText(input.title);
    const category = cleanText(input.category);
    const location = cleanText(input.location);
    const requester = cleanText(input.requester);
    const description = cleanText(input.description);
    const attachmentUrls = cleanText(input.attachmentUrls);
    const ticketNo = await nextServiceRequestTicketNo(count + 24001);
    const department = departmentCode ? await prisma.department.findUnique({ where: { code: departmentCode } }) : null;
    const supervisor = departmentCode
      ? await prisma.user.findFirst({
          where: {
            role: { contains: "Supervisor", mode: "insensitive" },
            OR: [
              { department: { contains: departmentCode, mode: "insensitive" } },
              { department: { contains: department?.name ?? departmentCode, mode: "insensitive" } },
            ],
            active: true,
          },
          orderBy: { name: "asc" },
        })
      : null;

    const created = await prisma.serviceRequest.create({
      data: {
        title: title || `Service Request ${count + 1}`,
        category: category || "General",
        departmentCode: departmentCode || null,
        serviceCode: serviceCode || null,
        assignedTeamCode: assignedTeamCode || null,
        requester: requester || user?.name || user?.email || "Requester",
        priority,
        location: location || "Unassigned",
        attachmentUrls: attachmentUrls || null,
        description: description || title || "No description provided.",
        isIncidentCase: input.isIncidentCase ?? false,
        assignedSupervisorEmail: supervisor?.email || null,
        channel: "Web Portal",
        ticketNo,
        slaHours,
        dueAt: addHours(new Date(), slaHours),
        status: "NEW",
      },
    });

    await auditAction({ user, action: "SERVICE_REQUEST_CREATE", entity: "service_request", entityId: created.id, details: { input, createdRecord: created } });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Unable to create service request", error);
    return NextResponse.json(
      {
        message: `Unable to create service request: ${createErrorMessage(error)}`,
      },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}
