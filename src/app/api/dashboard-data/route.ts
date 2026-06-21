import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { emptyOperatingData } from "@/lib/empty-operating-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DASHBOARD_LIMIT = 60;

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [
      requests,
      workOrders,
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
    ] = await Promise.all([
      prisma.serviceRequest.findMany({ where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }, { dueAt: { gte: since, lte: now } }] }, orderBy: { updatedAt: "desc" }, take: DASHBOARD_LIMIT }),
      prisma.workOrder.findMany({ where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }, { dueAt: { gte: since, lte: now } }, { plannedStart: { gte: since, lte: now } }] }, orderBy: { updatedAt: "desc" }, take: DASHBOARD_LIMIT }),
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
    ]);

    return NextResponse.json({
      ...emptyOperatingData,
      live: true,
      requests,
      workOrders,
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
