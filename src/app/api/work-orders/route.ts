import { NextResponse } from "next/server";
import { z } from "zod";
import { addHours } from "date-fns";
import { accessRole } from "@/lib/access-control";
import { auditAction } from "@/lib/audit";
import { requireUser } from "@/lib/api-auth";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const booleanInput = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean()).optional();

const schema = z.object({
  title: z.string().optional(),
  type: z.string().optional(),
  assetType: z.string().optional(),
  departmentCode: z.string().optional(),
  serviceCode: z.string().optional(),
  assignedTeamCode: z.string().optional(),
  assignedToEmail: z.string().optional(),
  jobPlanCode: z.string().optional(),
  priority: z.string().optional(),
  assetTag: z.string().optional(),
  jobPlan: z.string().optional(),
  photoUrls: z.string().optional(),
  isIncidentCase: booleanInput,
});

const dueHours = {
  LOW: 120,
  MEDIUM: 72,
  HIGH: 24,
  CRITICAL: 6,
};

function departmentValues(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return Array.from(
    new Set(
      String(user?.department ?? "")
        .split(/[;,|]/)
        .map((department) => department.trim())
        .filter(Boolean),
    ),
  );
}

function visibleWorkWhere(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const role = accessRole(user);
  const roleName = String(user?.role ?? "").toLowerCase();
  const isManagerRole = roleName.includes("facility manager") || roleName.includes("maintenance manager");
  const departmentsForUser = departmentValues(user);
  const isGenericSupervisor = roleName === "supervisor" && (!departmentsForUser.length || departmentsForUser.some((department) => ["general", "all", "fbc"].includes(String(department).trim().toLowerCase())));
  const teamCode = user?.team?.code;
  if (role === "admin" || role === "readonly" || isManagerRole || isGenericSupervisor) return {};
  if (role === "supervisor") {
    const conditions = [
      departmentsForUser.length ? { departmentCode: { in: departmentsForUser } } : null,
      teamCode ? { assignedTeamCode: teamCode } : null,
      user?.id ? { assignedToId: user.id } : null,
    ].filter(Boolean) as any[];
    return conditions.length ? { OR: conditions } : { assignedToId: "__none__" };
  }
  if (role === "technician") {
    const conditions = [
      user?.id ? { assignedToId: user.id } : null,
      teamCode ? { assignedTeamCode: teamCode } : null,
      departmentsForUser.length ? { departmentCode: { in: departmentsForUser } } : null,
    ].filter(Boolean) as any[];
    return conditions.length ? { OR: conditions } : { assignedToId: "__none__" };
  }
  return { assignedToId: "__none__" };
}

export async function GET(request: Request) {
  const { error, user } = await requireUser();
  if (error) return error;
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "";
  const priority = url.searchParams.get("priority")?.trim() || "";
  const category = url.searchParams.get("category")?.trim() || "";
  const department = url.searchParams.get("department")?.trim() || "";
  const type = url.searchParams.get("type")?.trim() || "";
  const assigned = url.searchParams.get("assigned")?.trim() || "";
  const overdueOnly = url.searchParams.get("overdueOnly") === "true";
  const delayedOnly = url.searchParams.get("delayedOnly") === "true";
  const pageInput = Number(url.searchParams.get("page") || 1);
  const pageSizeParam = url.searchParams.get("pageSize") || "100";
  const pageSizeInput = pageSizeParam === "all" ? Number.MAX_SAFE_INTEGER : Number(pageSizeParam);
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const pageSize = pageSizeParam === "all" ? 20000 : Number.isFinite(pageSizeInput) ? Math.min(500, Math.max(25, Math.floor(pageSizeInput))) : 100;
  const baseWhere = visibleWorkWhere(user);
  if (url.searchParams.get("options") === "true") {
    const cleanValues = (rows: Array<Record<string, unknown>>, key: string) =>
      Array.from(
        new Set(
          rows
            .map((row) => String(row[key] ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((first, second) =>
        first.localeCompare(second, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    const [statuses, priorities, categories, departments, types, teams] =
      await Promise.all([
        prisma.workOrder.findMany({
          where: baseWhere,
          distinct: ["status"],
          select: { status: true },
          orderBy: { status: "asc" },
        }),
        prisma.workOrder.findMany({
          where: baseWhere,
          distinct: ["priority"],
          select: { priority: true },
          orderBy: { priority: "asc" },
        }),
        prisma.workOrder.findMany({
          where: baseWhere,
          distinct: ["assetType"],
          select: { assetType: true },
          orderBy: { assetType: "asc" },
        }),
        prisma.workOrder.findMany({
          where: baseWhere,
          distinct: ["departmentCode"],
          select: { departmentCode: true },
          orderBy: { departmentCode: "asc" },
        }),
        prisma.workOrder.findMany({
          where: baseWhere,
          distinct: ["type"],
          select: { type: true },
          orderBy: { type: "asc" },
        }),
        prisma.workOrder.findMany({
          where: baseWhere,
          distinct: ["assignedTeamCode"],
          select: { assignedTeamCode: true },
          orderBy: { assignedTeamCode: "asc" },
        }),
      ]);
    return NextResponse.json({
      options: {
        statuses: cleanValues(statuses, "status"),
        priorities: cleanValues(priorities, "priority"),
        categories: cleanValues(categories, "assetType"),
        departments: cleanValues(departments, "departmentCode"),
        types: cleanValues(types, "type"),
        teams: cleanValues(teams, "assignedTeamCode"),
      },
    });
  }
  const where: any = {
    ...baseWhere,
    ...(status && status !== "All" ? { status } : {}),
    ...(priority && priority !== "All" ? { priority } : {}),
    ...(category && category !== "All" ? { assetType: category } : {}),
    ...(department && department !== "All" ? { departmentCode: department } : {}),
    ...(type && type !== "All" ? { type } : {}),
  };
  const andFilters: any[] = [];
  if (assigned && assigned !== "All") {
    andFilters.push(
      assigned === "Not Assigned"
        ? { OR: [{ assignedTeamCode: null }, { assignedTeamCode: "" }] }
        : { assignedTeamCode: assigned },
    );
  }
  if (overdueOnly) {
    andFilters.push({
      dueAt: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      status: { not: "CLOSED" },
    });
  }
  if (delayedOnly) {
    andFilters.push({
      OR: [
        { responseAt: null },
        { resolutionAt: null },
        { finishedAt: null },
        { status: { not: "CLOSED" } },
      ],
    });
  }
  if (query) {
    andFilters.push({
      OR: [
        { woNo: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { type: { contains: query, mode: "insensitive" } },
        { assetType: { contains: query, mode: "insensitive" } },
        { departmentCode: { contains: query, mode: "insensitive" } },
        { serviceCode: { contains: query, mode: "insensitive" } },
        { assignedTeamCode: { contains: query, mode: "insensitive" } },
        { jobPlanCode: { contains: query, mode: "insensitive" } },
        { jobPlan: { contains: query, mode: "insensitive" } },
        { asset: { is: { tag: { contains: query, mode: "insensitive" } } } },
        { asset: { is: { name: { contains: query, mode: "insensitive" } } } },
        { request: { is: { ticketNo: { contains: query, mode: "insensitive" } } } },
      ],
    });
  }
  if (andFilters.length) where.AND = andFilters;
  const [total, workOrders] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { dueAt: "asc" }],
      include: {
        assignedTo: { select: { name: true, email: true } },
        asset: { select: { tag: true, name: true, assetDescription: true, buildingCode: true, floor: true, room: true } },
        inventoryIssues: { take: 5, include: { item: { select: { sku: true, name: true, unit: true } } }, orderBy: { issuedAt: "desc" } },
        request: { select: { ticketNo: true, title: true, description: true, requester: true, attachmentUrls: true, location: true, category: true, createdAt: true } },
      },
    }),
  ]);
  return NextResponse.json({ workOrders, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await getCurrentUser();
    const role = accessRole(user);
    if (!["admin", "supervisor"].includes(role)) {
      return NextResponse.json({ message: "Only Admin or Supervisor can create work orders." }, { status: 403 });
    }
    const priority = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(input.priority || "") ? input.priority as keyof typeof dueHours : "MEDIUM";
    const [count, asset, team] = await Promise.all([
      prisma.workOrder.count(),
      input.assetTag ? prisma.asset.findUnique({ where: { tag: input.assetTag } }) : null,
      input.assignedTeamCode ? prisma.team.findUnique({ where: { code: input.assignedTeamCode } }) : null,
    ]);

    const created = await prisma.workOrder.create({
      data: {
        woNo: `WO-${String(count + 81001).padStart(5, "0")}`,
        title: input.title || `Work Order ${count + 1}`,
        type: input.type || "Reactive",
        assetType: input.assetType || asset?.assetGroup || asset?.category || null,
        departmentCode: input.departmentCode || user?.department || null,
        serviceCode: input.serviceCode || null,
        assignedTeamCode: input.assignedTeamCode || team?.code || null,
        jobPlanCode: input.jobPlanCode || null,
        priority,
        status: input.assignedTeamCode ? "ASSIGNED" : "PENDING_ASSIGNMENT",
        assetId: asset?.id,
        assignedToId: null,
        plannedStart: new Date(),
        dueAt: addHours(new Date(), dueHours[priority]),
        estimatedHours: priority === "CRITICAL" ? 2 : 4,
        cost: 0,
        jobPlan: input.jobPlan || input.title || "Work to be defined by supervisor.",
        safetyNotes: "Supervisor must verify permits, isolation and access requirements before work starts.",
        photoUrls: input.photoUrls || null,
        isIncidentCase: input.isIncidentCase ?? false,
      },
    });

    if (asset?.id) {
      await prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          eventType: "WORK_ORDER_CREATED",
          title: `${created.woNo} created`,
          details: `${created.title} assigned to ${created.assignedTeamCode || "unassigned team"}.`,
          actor: user?.name || user?.email || "System",
        },
      });
    }

    await auditAction({ user, action: "WORK_ORDER_CREATE", entity: "work_order", entityId: created.id, details: { input, createdRecord: created } });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Unable to create work order",
      },
      { status: 500 },
    );
  }
}



