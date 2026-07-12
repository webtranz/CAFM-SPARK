import { NextResponse } from "next/server";
import { z } from "zod";
import { addHours } from "date-fns";
import { auditAction } from "@/lib/audit";
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


export async function GET(request: Request) {
  try {
    await getCurrentUser();
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
    const input = schema.parse(await request.json());
    const user = await getCurrentUser();
    const count = await prisma.serviceRequest.count();
    const priority = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(input.priority || "") ? input.priority as keyof typeof slaByPriority : "MEDIUM";
    const slaHours = slaByPriority[priority];
    const department = input.departmentCode ? await prisma.department.findUnique({ where: { code: input.departmentCode } }) : null;
    const supervisor = input.departmentCode
      ? await prisma.user.findFirst({
          where: {
            role: { contains: "Supervisor", mode: "insensitive" },
            department: { in: [input.departmentCode, department?.name ?? input.departmentCode] },
          },
        })
      : null;

    const created = await prisma.serviceRequest.create({
      data: {
        title: input.title || `Service Request ${count + 1}`,
        category: input.category || "General",
        departmentCode: input.departmentCode || null,
        serviceCode: input.serviceCode || null,
        assignedTeamCode: input.assignedTeamCode || null,
        requester: input.requester || user?.name || user?.email || "Requester",
        priority,
        location: input.location || "Unassigned",
        attachmentUrls: input.attachmentUrls || null,
        description: input.description || input.title || "No description provided.",
        isIncidentCase: input.isIncidentCase ?? false,
        assignedSupervisorEmail: supervisor?.email || null,
        channel: "Web Portal",
        ticketNo: `SR-${String(count + 24001).padStart(5, "0")}`,
        slaHours,
        dueAt: addHours(new Date(), slaHours),
        status: "NEW",
      },
    });

    await auditAction({ user, action: "SERVICE_REQUEST_CREATE", entity: "service_request", entityId: created.id, details: { input, createdRecord: created } });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Unable to create service request",
      },
      { status: 500 },
    );
  }
}
