import { prisma } from "@/lib/prisma";
import { fallbackData } from "@/lib/demo-data";

type OperatingUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string | null;
  team?: { code: string } | null;
} | null;

function roleKind(user: OperatingUser) {
  const role = String(user?.role ?? "").toLowerCase();
  if (role === "admin" || role.includes("super admin")) return "admin";
  if (role.includes("supervisor")) return "supervisor";
  if (role.includes("technician") || role.includes("service team")) return "technician";
  if (role.includes("read") || role.includes("viewer") || role.includes("view only")) return "readonly";
  return "requester";
}

function departmentValues(user: OperatingUser) {
  return [user?.department, user?.department?.trim()].filter(Boolean) as string[];
}

const INITIAL_LOAD_LIMIT = 100;
const INITIAL_REFERENCE_LIMIT = 200;

export async function getOperatingData(user: OperatingUser = null) {
  if (!process.env.DATABASE_URL) {
    return { ...fallbackData, live: false };
  }

  try {
    const kind = roleKind(user);
    const departmentsForUser = departmentValues(user);
    const teamCode = user?.team?.code;
    const visibleAssetWhere =
      kind === "admin" || kind === "readonly"
        ? {}
        : kind === "supervisor"
        ? { departmentCode: { in: departmentsForUser } }
        : kind === "technician"
        ? { OR: [{ assignedTeamCode: teamCode || "" }, { departmentCode: { in: departmentsForUser } }] }
        : {};
    const visibleRequestWhere =
      kind === "admin" || kind === "readonly"
        ? {}
        : kind === "supervisor"
        ? { OR: [{ departmentCode: { in: departmentsForUser } }, { assignedSupervisorEmail: user?.email || "" }] }
        : kind === "technician"
        ? { OR: [{ assignedTeamCode: teamCode || "" }, { assignedSupervisorEmail: user?.email || "" }] }
        : { requester: user?.name || user?.email || "" };
    const visibleWorkWhere =
      kind === "admin" || kind === "readonly"
        ? {}
        : kind === "supervisor"
        ? { departmentCode: { in: departmentsForUser } }
        : kind === "technician"
        ? { OR: [{ assignedToId: user?.id || "" }, { assignedTeamCode: teamCode || "" }] }
        : { assignedToId: "__none__" };
    const visibleJobPlanWhere = kind === "admin" || kind === "readonly" ? {} : kind === "supervisor" || kind === "technician" ? { departmentCode: { in: departmentsForUser } } : {};
    const visibleUsersWhere = kind === "admin" ? {} : { OR: [{ department: { in: departmentsForUser } }, { id: user?.id || "" }] };

    const [sites, buildings, spaces, assets, requests, workOrders, workOrdersTotal, inventory, inspections, alerts, teams, services, categories, ppms, ppmsTotal, users, permissions, departments, employees, rolePermissions, locations, jobPlans, jobPlansTotal, roles, auditLogs, complianceCertificates, documentUploads, shifts, rotations, roster, housingProperties, housingBlocks, housingRooms, housingBeds, housingResidents, housingBookings, housingInspections, housingAssets, housingInventory, housingApprovals, housingNotifications, housingNotificationSettings, housingHistory] = await Promise.all([
      prisma.site.findMany({ include: { buildings: { take: 10, orderBy: { code: "asc" } } }, orderBy: { name: "asc" }, take: INITIAL_REFERENCE_LIMIT }),
      prisma.building.findMany({ include: { site: true }, orderBy: { code: "asc" }, take: INITIAL_REFERENCE_LIMIT }),
      prisma.space.findMany({ include: { building: { include: { site: true } } }, orderBy: [{ building: { code: "asc" } }, { floor: "asc" }, { name: "asc" }], take: INITIAL_REFERENCE_LIMIT }),
      prisma.asset.findMany({
        where: visibleAssetWhere,
        orderBy: [{ tag: "asc" }],
        take: INITIAL_LOAD_LIMIT,
        include: {
          site: { select: { name: true } },
          building: { select: { name: true, code: true } },
          workOrders: { take: 8, orderBy: { updatedAt: "desc" }, select: { woNo: true, title: true, status: true, updatedAt: true, inventoryUsed: true, workNotes: true } },
          history: { take: 8, orderBy: { createdAt: "desc" } },
        },
      }),
      prisma.serviceRequest.findMany({
        where: visibleRequestWhere,
        orderBy: { createdAt: "desc" },
        take: INITIAL_LOAD_LIMIT,
        include: { workOrder: { select: { id: true, woNo: true, status: true } } },
      }),
      prisma.workOrder.findMany({
        where: visibleWorkWhere,
        orderBy: { dueAt: "asc" },
        take: INITIAL_LOAD_LIMIT,
        include: {
          assignedTo: { select: { name: true, email: true } },
          asset: { select: { tag: true, name: true, assetDescription: true, buildingCode: true, floor: true, room: true } },
          inventoryIssues: { include: { item: { select: { sku: true, name: true, unit: true } } }, orderBy: { issuedAt: "desc" } },
          request: { select: { ticketNo: true, title: true, description: true, requester: true, attachmentUrls: true, location: true, category: true, createdAt: true } },
        },
      }),
      prisma.workOrder.count({ where: visibleWorkWhere }),
      prisma.inventoryItem.findMany({ orderBy: { sku: "asc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.inspection.findMany({ orderBy: { dueAt: "asc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.iotAlert.findMany({ orderBy: { detectedAt: "desc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.team.findMany({ include: { services: true }, orderBy: { name: "asc" } }),
      prisma.serviceCatalog.findMany({ include: { team: true }, orderBy: { name: "asc" } }),
      prisma.assetCategory.findMany({ orderBy: { name: "asc" }, take: INITIAL_REFERENCE_LIMIT }),
      prisma.preventiveMaintenance.findMany({ orderBy: { nextDue: "asc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.preventiveMaintenance.count(),
      prisma.user.findMany({ where: visibleUsersWhere, include: { team: true }, orderBy: { name: "asc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.permission.findMany({ orderBy: [{ module: "asc" }, { name: "asc" }] }),
      prisma.department.findMany({ orderBy: { code: "asc" } }),
      prisma.employee.findMany({ where: kind === "admin" ? {} : { departmentCode: { in: departmentsForUser } }, orderBy: { name: "asc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.rolePermission.findMany({ include: { permission: true }, orderBy: { role: "asc" } }),
      prisma.location.findMany({ orderBy: [{ code: "asc" }], take: INITIAL_REFERENCE_LIMIT }),
      prisma.jobPlan.findMany({ where: visibleJobPlanWhere, orderBy: { code: "asc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.jobPlan.count({ where: visibleJobPlanWhere }),
      prisma.role.findMany({ orderBy: { name: "asc" } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.complianceCertificate.findMany({ orderBy: [{ expiryDate: "asc" }, { certificateNo: "asc" }], take: INITIAL_LOAD_LIMIT }),
      prisma.documentUpload.findMany({ orderBy: { createdAt: "desc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.shiftMaster.findMany({ orderBy: { name: "asc" } }),
      prisma.rotationSetup.findMany({ orderBy: { name: "asc" } }),
      prisma.rosterEntry.findMany({ include: { employee: true, team: true, shift: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: INITIAL_LOAD_LIMIT }),
      prisma.housingProperty.findMany({ orderBy: { name: "asc" }, take: INITIAL_REFERENCE_LIMIT }),
      prisma.housingBlock.findMany({ include: { property: true }, orderBy: { code: "asc" }, take: INITIAL_REFERENCE_LIMIT }),
      prisma.housingRoom.findMany({ include: { property: true, block: true, beds: true }, orderBy: [{ roomNumber: "asc" }], take: INITIAL_REFERENCE_LIMIT }),
      prisma.housingBed.findMany({ include: { room: true }, orderBy: { code: "asc" }, take: INITIAL_REFERENCE_LIMIT }),
      prisma.housingResident.findMany({ orderBy: { name: "asc" }, take: INITIAL_REFERENCE_LIMIT }),
      prisma.housingBooking.findMany({
        include: { room: { include: { property: true, block: true } }, bed: true, resident: true, approvals: true },
        orderBy: { createdAt: "desc" },
        take: INITIAL_LOAD_LIMIT,
      }),
      prisma.housingInspection.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: { dueAt: "asc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.housingAsset.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: { tag: "asc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.housingInventory.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: { sku: "asc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.housingApproval.findMany({ orderBy: { createdAt: "desc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.housingNotification.findMany({ orderBy: { createdAt: "desc" }, take: INITIAL_LOAD_LIMIT }),
      prisma.housingNotificationSetting.findMany({ orderBy: { label: "asc" } }),
      prisma.housingHistory.findMany({ orderBy: { createdAt: "desc" }, take: INITIAL_LOAD_LIMIT }),
    ]);

    const visibleAssetTags = new Set(assets.map((asset) => asset.tag));
    const visibleLocationCodes = new Set(locations.map((location) => location.code));
    const scopedPpms = kind === "admin" ? ppms : ppms.filter((ppm) => visibleAssetTags.has(ppm.assetTag) || visibleLocationCodes.has(ppm.locationCode));

    const housing =
      kind === "admin" || kind === "readonly"
        ? { properties: housingProperties, blocks: housingBlocks, rooms: housingRooms, beds: housingBeds, residents: housingResidents, bookings: housingBookings, inspections: housingInspections, assets: housingAssets, inventory: housingInventory, approvals: housingApprovals, notifications: housingNotifications, notificationSettings: housingNotificationSettings, history: housingHistory }
        : {
            properties: housingProperties,
            blocks: housingBlocks,
            rooms: housingRooms,
            beds: housingBeds,
            residents: housingResidents.filter((resident) => !resident.departmentCode || departmentsForUser.includes(resident.departmentCode)),
            bookings: housingBookings.filter((booking) => !booking.departmentCode || departmentsForUser.includes(booking.departmentCode) || booking.requestedBy === user?.name || booking.requestedBy === user?.email),
            inspections: housingInspections,
            assets: housingAssets,
            inventory: housingInventory,
            approvals: housingApprovals,
            notifications: housingNotifications.filter((notification) => notification.recipient === user?.name || notification.recipient === user?.email || notification.recipient.includes("Supervisor")),
            notificationSettings: housingNotificationSettings,
            history: housingHistory,
          };

    return { sites, buildings, spaces, assets, requests, workOrders, workOrdersTotal, inventory, inspections, alerts, teams, services, categories, ppms: scopedPpms, ppmsTotal, users, permissions, departments, employees, rolePermissions, locations, jobPlans, jobPlansTotal, roles, auditLogs, complianceCertificates, documentUploads, shiftRotation: { shifts, rotations, roster }, housing, live: true };
  } catch {
    return { ...fallbackData, live: false };
  }
}
