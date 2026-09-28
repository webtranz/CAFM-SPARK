import { NextResponse } from "next/server";
import { accessRole } from "@/lib/access-control";
import { requireUser } from "@/lib/api-auth";
import { emptyOperatingData } from "@/lib/empty-operating-data";
import { convertExpiredUncheckedHousingBookingsToNoShow } from "@/lib/housing-no-show";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRbacOnce } from "@/lib/rbac-runtime";
import { getDashboardStats, getTotalEntryCounts } from "@/lib/data";

export const dynamic = "force-dynamic";

const DASHBOARD_LIMIT = 60;

type DashboardUser = Awaited<ReturnType<typeof requireUser>>["user"];

function departmentValues(user: DashboardUser) {
  return Array.from(
    new Set(
      String(user?.department ?? "")
        .split(/[;,|]/)
        .map((department) => department.trim())
        .filter(Boolean),
    ),
  );
}

function visibleWorkWhere(user: DashboardUser) {
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

export async function GET() {
  const { error, user } = await requireUser();
  if (error) return error;

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const workScope = visibleWorkWhere(user);

  try {
    await ensureDefaultRbacOnce();
    await convertExpiredUncheckedHousingBookingsToNoShow(user?.name || user?.email || "Dashboard Sync");

    const [
      requests,
      workOrders,
      workOrdersTotal,
      assets,
      inventory,
      inspections,
      alerts,
      ppms,
      jobPlans,
      locations,
      complianceCertificates,
      documentUploads,
      employees,
      users,
      auditLogs,
      housingBookings,
      housingInspections,
      housingAssets,
      housingInventory,
      housingApprovals,
      housingNotifications,
      housingHistory,
      rolePermissions,
      totalEntries,
      dashboardStats,
    ] = await Promise.all([
      prisma.serviceRequest.findMany({ where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }, { dueAt: { gte: since, lte: now } }] }, orderBy: { updatedAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.workOrder.findMany({ where: { AND: [workScope, { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }, { dueAt: { gte: since, lte: now } }, { plannedStart: { gte: since, lte: now } }] }] }, orderBy: { updatedAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.workOrder.count({ where: workScope }),
      prisma.asset.findMany({ orderBy: { tag: "asc" }, take: DASHBOARD_LIMIT }),
      prisma.inventoryItem.findMany({ orderBy: { sku: "asc" }, take: DASHBOARD_LIMIT }),
      prisma.inspection.findMany({ where: { dueAt: { gte: since, lte: now } }, orderBy: { dueAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.iotAlert.findMany({ where: { detectedAt: { gte: since } }, orderBy: { detectedAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.preventiveMaintenance.findMany({ where: { nextDue: { gte: since, lte: now } }, orderBy: { nextDue: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.jobPlan.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.location.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.complianceCertificate.findMany({ where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }, { expiryDate: { gte: since, lte: now } }, { issueDate: { gte: since, lte: now } }] }, orderBy: { updatedAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.documentUpload.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.employee.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.user.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.auditLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.housingBooking.findMany({ where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }, { checkIn: { gte: since, lte: now } }] }, orderBy: { updatedAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.housingInspection.findMany({ where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }, { dueAt: { gte: since, lte: now } }] }, orderBy: { updatedAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.housingAsset.findMany({ where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }, { nextPmDue: { gte: since, lte: now } }, { lastInspectionAt: { gte: since, lte: now } }] }, orderBy: { updatedAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.housingInventory.findMany({ where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }, { lastMovementAt: { gte: since } }] }, orderBy: { updatedAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.housingApproval.findMany({ where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }] }, orderBy: { updatedAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.housingNotification.findMany({ where: { OR: [{ createdAt: { gte: since } }, { sentAt: { gte: since } }] }, orderBy: { createdAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.housingHistory.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.rolePermission.findMany({ include: { permission: true }, orderBy: { role: "asc" } }),
      getTotalEntryCounts(),
      getDashboardStats(workScope),
    ]);

    return NextResponse.json({
      ...emptyOperatingData,
      live: true,
      requests,
      workOrders,
      workOrdersTotal,
      assets,
      inventory,
      inspections,
      alerts,
      ppms,
      jobPlans,
      locations,
      complianceCertificates,
      documentUploads,
      employees,
      users,
      auditLogs,
      rolePermissions,
      totalEntries,
      dashboardStats,
      housing: {
        ...emptyOperatingData.housing,
        bookings: housingBookings,
        inspections: housingInspections,
        assets: housingAssets,
        inventory: housingInventory,
        approvals: housingApprovals,
        notifications: housingNotifications,
        history: housingHistory,
      },
    });
  } catch {
    return NextResponse.json({ ...emptyOperatingData, live: false }, { status: 200 });
  }
}







