import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { workOrderKpis, workOrderMetrics } from "@/lib/work-order-analytics";

type ReportRow = Record<string, string | number | boolean | null>;

export async function GET(request: Request) {
  const { error } = await requirePermission("reports.view");
  if (error) return error;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "assets";
  const format = url.searchParams.get("format") || "preview";
  const filters = reportFilters(url);
  const rows = await reportRows(type, filters);
  const kpis = type === "work-orders" ? workOrderKpis(rows) : null;

  if (format === "csv") {
    return file(csv(rows), "text/csv", `${type}.csv`);
  }
  if (format === "excel") {
    return file(excel(rows, type, kpis), "application/vnd.ms-excel", `${type}.xls`);
  }
  if (format === "pdf") {
    return file(pdf(rows, type, kpis, filters), "application/pdf", `${type}.pdf`);
  }
  if (format === "html") {
    return html(htmlPreview(rows, type, kpis, filters));
  }
  return NextResponse.json({ type, rows, kpis, filters });
}

function reportFilters(url: URL) {
  return {
    responseGreaterThan: numberParam(url, "responseGreaterThan"),
    resolutionGreaterThan: numberParam(url, "resolutionGreaterThan"),
    slaBreach: url.searchParams.get("slaBreach"),
    delayedOnly: url.searchParams.get("delayedOnly") === "true",
    dateFrom: url.searchParams.get("dateFrom") || "",
    dateTo: url.searchParams.get("dateTo") || "",
    company: url.searchParams.get("company") || "",
    building: url.searchParams.get("building") || "",
    floor: url.searchParams.get("floor") || "",
    room: url.searchParams.get("room") || "",
    status: url.searchParams.get("status") || "",
  };
}

function numberParam(url: URL, key: string) {
  const value = url.searchParams.get(key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function reportRows(type: string, filters: ReturnType<typeof reportFilters>): Promise<ReportRow[]> {
  if (type.startsWith("housing-")) {
    return housingReportRows(type, filters);
  }
  if (type === "work-orders") {
    const rows = await prisma.workOrder.findMany({
      include: { asset: true, assignedTo: true },
      orderBy: { createdAt: "desc" },
    });
    return rows
      .map((row) => workOrderMetrics(row))
      .filter((row) => {
        if (filters.responseGreaterThan !== null && Number(row.response_duration_mins ?? -1) <= filters.responseGreaterThan) return false;
        if (filters.resolutionGreaterThan !== null && Number(row.response_to_resolution_mins ?? -1) <= filters.resolutionGreaterThan) return false;
        if (filters.slaBreach === "yes" && !row.sla_breached) return false;
        if (filters.slaBreach === "no" && row.sla_breached) return false;
        if (filters.delayedOnly && !row.delayed) return false;
        return true;
      });
  }
  if (type === "requests") {
    const rows = await prisma.serviceRequest.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((row) => ({
      ticketNo: row.ticketNo,
      title: row.title,
      category: row.category,
      departmentCode: row.departmentCode,
      serviceCode: row.serviceCode,
      assignedTeamCode: row.assignedTeamCode,
      supervisor: row.assignedSupervisorEmail,
      requester: row.requester,
      priority: row.priority,
      status: row.status,
      location: row.location,
      dueAt: dateValue(row.dueAt),
      createdAt: dateValue(row.createdAt),
    }));
  }
  if (type === "inventory") {
    const rows = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });
    return rows.map((row) => ({ sku: row.sku, name: row.name, category: row.category, unit: row.unit, onHand: row.onHand, reorderPoint: row.reorderPoint, unitCost: Number(row.unitCost), vendor: row.vendor, location: row.location }));
  }
  if (type === "ppm") {
    const rows = await prisma.preventiveMaintenance.findMany({ orderBy: { nextDue: "asc" } });
    return rows.map((row) => ({ code: row.code, name: row.name, assetTag: row.assetTag, frequency: row.frequency, nextDue: dateValue(row.nextDue), durationHrs: Number(row.durationHrs), checklist: row.checklist, active: row.active }));
  }
  if (type === "employees") {
    const rows = await prisma.employee.findMany({ orderBy: { name: "asc" } });
    return rows.map((row) => ({ name: row.name, email: row.email, companyId: row.companyId, nationalityType: row.nationalityType, departmentCode: row.departmentCode, siteLocation: row.siteLocation, createdAt: dateValue(row.createdAt) }));
  }
  if (type === "users") {
    const rows = await prisma.user.findMany({ include: { team: true }, orderBy: { name: "asc" } });
    return rows.map((row) => ({ name: row.name, email: row.email, phone: row.phone, role: row.role, department: row.department, teamCode: row.team?.code ?? "", teamName: row.team?.name ?? "", active: row.active, createdAt: dateValue(row.createdAt) }));
  }
  if (type === "permissions") {
    const rows = await prisma.rolePermission.findMany({ include: { permission: true }, orderBy: [{ role: "asc" }] });
    return rows.map((row) => ({ role: row.role, permissionCode: row.permission.code, permission: row.permission.name, module: row.permission.module, scope: row.scope, description: row.permission.description }));
  }
  if (type === "departments") {
    const rows = await prisma.department.findMany({ orderBy: { code: "asc" } });
    return rows.map((row) => ({ code: row.code, name: row.name, siteLocation: row.siteLocation, description: row.description, createdAt: dateValue(row.createdAt) }));
  }
  if (type === "teams") {
    const rows = await prisma.team.findMany({ orderBy: { code: "asc" } });
    return rows.map((row) => ({ code: row.code, name: row.name, type: row.type, supervisor: row.supervisor, phone: row.phone, email: row.email, shift: row.shift, coverage: row.coverage, createdAt: dateValue(row.createdAt) }));
  }
  if (type === "services") {
    const rows = await prisma.serviceCatalog.findMany({ include: { team: true }, orderBy: { code: "asc" } });
    return rows.map((row) => ({ code: row.code, name: row.name, category: row.category, type: row.type, priority: row.priority, slaHours: row.slaHours, teamCode: row.team?.code ?? "", teamName: row.team?.name ?? "", active: row.active, description: row.description, createdAt: dateValue(row.createdAt) }));
  }
  if (type === "asset-categories") {
    const rows = await prisma.assetCategory.findMany({ orderBy: { code: "asc" } });
    return rows.map((row) => ({ code: row.code, name: row.name, type: row.type, defaultLifeYrs: row.defaultLifeYrs, statutory: row.statutory, description: row.description, createdAt: dateValue(row.createdAt) }));
  }
  if (type === "locations") {
    const rows = await prisma.location.findMany({ orderBy: { code: "asc" } });
    return rows.map((row) => ({
      Location: row.code,
      Description: row.description,
      Class: row.locationClass || row.type,
      "Parent Location": row.parentLocation || row.zone,
      "Out of Service": row.outOfService ? "YES" : "NO",
      Residential: row.residential ? "YES" : "NO",
    }));
  }
  if (type === "job-plans") {
    const rows = await prisma.jobPlan.findMany({ orderBy: { code: "asc" } });
    return rows.map((row) => ({ code: row.code, name: row.name, assetType: row.assetType, departmentCode: row.departmentCode, serviceCode: row.serviceCode, estimatedHours: Number(row.estimatedHours), priority: row.priority, steps: row.steps, safetyNotes: row.safetyNotes, active: row.active, createdAt: dateValue(row.createdAt) }));
  }
  if (type === "inspections") {
    const rows = await prisma.inspection.findMany({ orderBy: { dueAt: "asc" } });
    return rows.map((row) => ({ code: row.code, title: row.title, area: row.area, inspector: row.inspector, risk: row.risk, score: row.score, status: row.status, dueAt: dateValue(row.dueAt), findings: row.findings }));
  }
  if (type === "compliance") {
    const rows = await prisma.complianceCertificate.findMany({ orderBy: [{ expiryDate: "asc" }, { certificateNo: "asc" }] });
    return rows.map((row) => ({
      certificateNo: row.certificateNo,
      title: row.title,
      authority: row.authority,
      category: row.category,
      assetTag: row.assetTag ?? "",
      location: row.location,
      owner: row.owner,
      issueDate: dateValue(row.issueDate),
      expiryDate: dateValue(row.expiryDate),
      status: row.status,
      risk: row.risk,
      renewalLeadDays: row.renewalLeadDays,
      evidenceUrl: row.evidenceUrl ?? "",
      notes: row.notes,
    }));
  }
  if (type === "iot-alerts") {
    const rows = await prisma.iotAlert.findMany({ orderBy: { detectedAt: "desc" } });
    return rows.map((row) => ({ source: row.source, assetTag: row.assetTag, severity: row.severity, message: row.message, status: row.status, detectedAt: dateValue(row.detectedAt) }));
  }
  if (type === "audit-logs") {
    const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
    return rows.map((row) => ({ time: dateValue(row.createdAt), actorName: row.actorName, role: row.role, action: row.action, entity: row.entity, entityId: row.entityId, details: row.details }));
  }
  const rows = await prisma.asset.findMany({ include: { building: true, site: true }, orderBy: { tag: "asc" } });
  return rows.map((row) => ({
    EQUIPMENTNO: row.tag,
    EQUIPMENTDESC: row.assetDescription || row.name,
    ASSETSTATUS: row.assetStatusText || row.status,
    EQTYPE: row.eqType,
    ORGANIZATION: row.organization || "",
    COMMISSIONDATE: dateValue(row.installDate),
    DEPARTMENT: row.departmentCode || "",
    DEPARTMENT_DESC: row.departmentDesc || "",
    CLASS: row.classCode || row.assetGroup || "",
    CLASS_DESC: row.classDesc || "",
    CATEGORY: row.category,
    CATEGORY_DESC: row.categoryDesc || "",
    SERIALNUMBER: row.serialNumber || "",
    MODEL: row.model,
    MANUFACTURER: row.manufacturer,
    GSRC: row.gsrc || "",
    ENDOFUSEFULLIFE: dateValue(row.replacementDate),
    ATTRIBUTE: row.attribute || "",
    ENVIRONMENT: row.environment || "",
    PRESSURE_BAR: row.pressureBar || "",
    FLOW_LPS: row.flowLps || "",
    SUPPLY_VOLTAGE_Volt: row.supplyVoltageVolt || "",
    OUTOFSERVICE: row.outOfService ? "YES" : "NO",
    SERVICELIFE: row.serviceLife || "",
    LOCATION: row.locationCode || row.room || "",
    LOCATION_DESC: row.locationDesc || "",
    POSITION: row.position || "",
    CLASSORGANIZATION: row.classOrganization || "",
    EQUIPMENTVALUE: Number(row.purchaseCost),
    PRIMARYSYSTEM: row.primarySystem || row.system,
    ADDITIONAL_NOTE: row.additionalNote || row.additionalDescription || "",
  }));
}

async function housingReportRows(type: string, filters: ReturnType<typeof reportFilters>): Promise<ReportRow[]> {
  if (type === "housing-dashboard") {
    const [rooms, bookings, inspections, assets, inventory, approvals, notifications] = await Promise.all([
      prisma.housingRoom.findMany({ include: { property: true, block: true } }),
      prisma.housingBooking.findMany({ include: { room: { include: { property: true, block: true } }, resident: true } }),
      prisma.housingInspection.findMany({ include: { room: { include: { property: true, block: true } } } }),
      prisma.housingAsset.findMany({ include: { room: { include: { property: true, block: true } } } }),
      prisma.housingInventory.findMany({ include: { room: { include: { property: true, block: true } } } }),
      prisma.housingApproval.findMany(),
      prisma.housingNotification.findMany(),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const capacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
    const occupancy = rooms.reduce((sum, room) => sum + room.occupancy, 0);
    const metricRows: ReportRow[] = [
      { section: "Summary", metric: "Total available rooms", value: rooms.filter((room) => room.status === "AVAILABLE").length, detail: "Rooms ready for allocation" },
      { section: "Summary", metric: "Total occupied rooms", value: rooms.filter((room) => room.status === "OCCUPIED" || room.occupancy >= room.capacity).length, detail: "Rooms currently occupied" },
      { section: "Summary", metric: "Total vacant rooms", value: rooms.filter((room) => room.status === "AVAILABLE" && room.occupancy === 0).length, detail: "Vacant rooms" },
      { section: "Summary", metric: "Total blocked rooms", value: rooms.filter((room) => room.status === "BLOCKED").length, detail: "Blocked rooms" },
      { section: "Summary", metric: "Total under-maintenance rooms", value: rooms.filter((room) => room.status === "MAINTENANCE").length, detail: "Rooms under maintenance" },
      { section: "Summary", metric: "Total check-ins today", value: bookings.filter((booking) => dateValue(booking.checkIn).slice(0, 10) === today).length, detail: today },
      { section: "Summary", metric: "Total check-outs today", value: bookings.filter((booking) => dateValue(booking.checkOut).slice(0, 10) === today).length, detail: today },
      { section: "Summary", metric: "Bed occupancy percentage", value: capacity ? Math.round((occupancy / capacity) * 100) : 0, detail: `${occupancy}/${capacity} beds occupied` },
      { section: "Summary", metric: "Ticket summary", value: bookings.filter((booking) => ["REQUESTED", "PENDING_APPROVAL"].includes(booking.status)).length + inspections.filter((inspection) => inspection.status === "FAILED").length, detail: "Open booking requests and inspection findings" },
      { section: "Summary", metric: "Asset status summary", value: assets.length, detail: "Housing assets tracked" },
      { section: "Summary", metric: "Housekeeping status summary", value: inspections.filter((inspection) => inspection.inspectionType.toLowerCase().includes("housekeeping") && !["PASSED", "CLOSED"].includes(inspection.status)).length, detail: "Open housekeeping checks" },
      { section: "Summary", metric: "Pending approvals summary", value: approvals.filter((approval) => approval.status === "PENDING").length, detail: "Awaiting approval" },
      { section: "Summary", metric: "Safety observations and incidents summary", value: inspections.filter((inspection) => inspection.status === "FAILED" || inspection.score < 80).length + notifications.filter((notification) => ["HIGH", "CRITICAL"].includes(notification.severity)).length, detail: "Open safety observations or high alerts" },
      { section: "Inventory", metric: "Housing inventory items", value: inventory.length, detail: "Inventory SKUs in housing" },
    ];
    const buildingRows = Array.from(rooms.reduce((map, room) => {
      const key = room.block?.name ?? room.property.name;
      const current = map.get(key) ?? { capacity: 0, occupancy: 0, rooms: 0 };
      current.capacity += room.capacity;
      current.occupancy += room.occupancy;
      current.rooms += 1;
      map.set(key, current);
      return map;
    }, new Map<string, { capacity: number; occupancy: number; rooms: number }>()).entries()).map(([building, values]) => ({
      section: "Building-wise occupancy",
      metric: building,
      value: values.capacity ? Math.round((values.occupancy / values.capacity) * 100) : 0,
      detail: `${values.occupancy}/${values.capacity} beds, ${values.rooms} rooms`,
    }));
    const categoryRows = Array.from(rooms.reduce((map, room) => {
      const current = map.get(room.roomType) ?? { capacity: 0, occupancy: 0, rooms: 0 };
      current.capacity += room.capacity;
      current.occupancy += room.occupancy;
      current.rooms += 1;
      map.set(room.roomType, current);
      return map;
    }, new Map<string, { capacity: number; occupancy: number; rooms: number }>()).entries()).map(([category, values]) => ({
      section: "Room category occupancy",
      metric: category,
      value: values.capacity ? Math.round((values.occupancy / values.capacity) * 100) : 0,
      detail: `${values.occupancy}/${values.capacity} beds, ${values.rooms} rooms`,
    }));
    const companyRows = Array.from(bookings.reduce((map, booking) => {
      const key = booking.resident?.companyId || booking.departmentCode || "Unassigned";
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()).entries()).map(([company, count]) => ({
      section: "Company-wise occupancy",
      metric: company,
      value: count,
      detail: "Active or requested housing bookings",
    }));
    return applyHousingFilters([...metricRows, ...companyRows, ...buildingRows, ...categoryRows], filters);
  }
  if (["housing-rooms", "housing-room-utilization", "housing-room-readiness"].includes(type)) {
    const rows = await prisma.housingRoom.findMany({ include: { property: true, block: true, beds: true }, orderBy: { roomNumber: "asc" } });
    const mapped = rows.map((row) => ({ code: row.code, property: row.property.name, building: row.block?.name ?? row.property.name, block: row.block?.name ?? "", floor: row.floor, room: row.roomNumber, roomNumber: row.roomNumber, roomType: row.roomType, genderRestriction: row.genderRestriction, capacity: row.capacity, occupancy: row.occupancy, utilizationPercent: row.capacity ? Math.round((row.occupancy / row.capacity) * 100) : 0, vacantBeds: Math.max(0, row.capacity - row.occupancy), status: row.status, readiness: row.status === "AVAILABLE" && row.occupancy === 0 ? "READY" : row.status, qrCode: row.qrCode, remarks: row.remarks, createdAt: dateValue(row.createdAt) }));
    return applyHousingFilters(type === "housing-room-readiness" ? mapped.filter((row) => ["READY", "AVAILABLE", "MAINTENANCE", "BLOCKED"].includes(String(row.readiness))) : mapped, filters);
  }
  if (type === "housing-room-holds") {
    const rows = await prisma.housingRoomHold.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: [{ status: "asc" }, { startDate: "desc" }] });
    return applyHousingFilters(rows.map((row) => ({
      roomNumber: row.room.roomNumber,
      roomType: row.room.roomType,
      property: row.room.property.name,
      building: row.room.block?.name ?? "",
      floor: row.room.floor,
      holdStartDate: dateValue(row.startDate),
      holdEndDate: dateValue(row.endDate),
      reason: row.reason,
      remarks: row.remarks ?? "",
      createdBy: row.createdBy,
      createdDate: dateValue(row.createdAt),
      status: row.status,
    })), filters);
  }
  if (type === "housing-check-movements") {
    const rows = await prisma.housingBooking.findMany({ include: { room: { include: { property: true, block: true } }, bed: true, resident: true }, orderBy: [{ checkIn: "asc" }, { checkOut: "asc" }] });
    return applyHousingFilters(rows.flatMap((row) => [
      { movement: "Check-In", guestName: row.residentName, bookingNo: row.bookingNo, roomNumber: row.roomNumber ?? row.room.roomNumber, roomType: row.room.roomType, checkInDate: dateValue(row.checkIn), checkOutDate: dateValue(row.checkOut), status: row.status },
      row.checkOut ? { movement: "Check-Out", guestName: row.residentName, bookingNo: row.bookingNo, roomNumber: row.roomNumber ?? row.room.roomNumber, roomType: row.room.roomType, checkInDate: dateValue(row.checkIn), checkOutDate: dateValue(row.checkOut), status: row.status } : null,
    ].filter(Boolean) as ReportRow[]), filters);
  }
  if (["housing-bookings", "housing-occupancy-daily", "housing-occupancy-weekly", "housing-occupancy-monthly", "housing-company-occupancy", "housing-building-occupancy", "housing-bed-occupancy"].includes(type)) {
    const rows = await prisma.housingBooking.findMany({ include: { room: { include: { property: true, block: true } }, bed: true, resident: true }, orderBy: { createdAt: "desc" } });
    const mapped = rows.map((row) => ({ reportPeriod: periodLabel(type, row.checkIn), bookingNo: row.bookingNo, employeeId: row.employeeId ?? row.resident?.residentNo ?? "", employeeName: row.residentName, companyName: row.companyName ?? row.resident?.companyName ?? "", company: row.companyName ?? row.resident?.companyName ?? "", department: row.departmentCode, nationality: row.nationality ?? row.resident?.nationality ?? "", contactNumber: row.contactNumber ?? row.resident?.phone ?? "", gender: row.gender ?? row.resident?.gender ?? "", building: row.buildingNumber ?? row.room.block?.name ?? "", buildingNumber: row.buildingNumber ?? row.room.block?.name ?? "", floor: row.floorNumber ?? row.room.floor, floorNumber: row.floorNumber ?? row.room.floor, room: row.roomNumber ?? row.room.roomNumber, roomNumber: row.roomNumber ?? row.room.roomNumber, bedNumber: row.bedNumber ?? row.bed?.label ?? "", bookingType: row.bookingType, allocationType: row.allocationType, property: row.room.property.name, block: row.room.block?.name ?? "", checkIn: dateValue(row.checkIn), checkOut: dateValue(row.checkOut), status: row.status, priority: row.priority, requestedBy: row.requestedBy, approvedBy: row.approvedBy, approvalLevel: row.approvalLevel, keyHandoverBy: row.keyHandoverBy, keyHandoverAt: dateValue(row.keyHandoverAt), campIdNumber: row.campIdNumber, campIdIssuedAt: dateValue(row.campIdIssuedAt), cancellationReason: row.cancellationReason, transferReason: row.transferReason, blacklistReason: row.blacklistReason, noShowAt: dateValue(row.noShowAt), notes: row.notes }));
    return applyHousingFilters(mapped, filters);
  }
  if (["housing-inspections", "housing-cleaning-daily", "housing-deep-cleaning", "housing-inspection-report"].includes(type)) {
    const rows = await prisma.housingInspection.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: { dueAt: "asc" } });
    const mapped = rows.map((row) => ({
      inspectionNo: row.inspectionNo,
      property: row.room.property.name,
      building: row.room.block?.name ?? row.room.property.name,
      block: row.room.block?.name ?? "",
      floor: row.room.floor,
      room: row.room.roomNumber,
      bedId: row.bedId,
      occupant: row.occupantName,
      assetId: row.assetId,
      workOrderRef: row.workOrderRef,
      inspector: row.inspector,
      inspectionType: row.inspectionType,
      status: row.status,
      score: row.score,
      furnitureCondition: row.furnitureCondition,
      mattressCondition: row.mattressCondition,
      bedSheetCondition: row.bedSheetCondition,
      tvCondition: row.tvCondition,
      refrigeratorCondition: row.refrigeratorCondition,
      acCondition: row.acCondition,
      waterLeakageCheck: row.waterLeakageCheck,
      lightingCondition: row.lightingCondition,
      curtainCondition: row.curtainCondition,
      doorLockCondition: row.doorLockCondition,
      smokeDetectorCondition: row.smokeDetectorCondition,
      fireExtinguisherAvailability: row.fireExtinguisherAvailability,
      bathroomCleanliness: row.bathroomCleanliness,
      generalRoomCleanliness: row.generalRoomCleanliness,
      missingAssetVerification: row.missingAssetVerification,
      damageFound: row.damageFound,
      damageReport: row.damageReport,
      missingAssetFound: row.missingAssetFound,
      missingAssetReport: row.missingAssetReport,
      repairRequired: row.repairRequired,
      estimatedRepairCost: Number(row.estimatedRepairCost),
      occupantLiability: row.occupantLiability,
      maintenanceTicketNo: row.maintenanceTicketNo,
      dueAt: dateValue(row.dueAt),
      completedAt: dateValue(row.completedAt),
      beforePhotoUrls: row.beforePhotoUrls,
      afterPhotoUrls: row.afterPhotoUrls,
      findings: row.findings,
    }));
    const narrowed = type === "housing-cleaning-daily" ? mapped.filter((row) => String(row.inspectionType).toLowerCase().includes("clean")) : type === "housing-deep-cleaning" ? mapped.filter((row) => String(row.inspectionType).toLowerCase().includes("deep")) : mapped;
    return applyHousingFilters(narrowed, filters);
  }
  if (["housing-assets", "housing-missing-assets", "housing-damaged-assets", "housing-asset-transfers", "housing-asset-depreciation", "housing-asset-audit"].includes(type)) {
    const rows = await prisma.housingAsset.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: { tag: "asc" } });
    const mapped = rows.map((row) => ({
      assetCode: row.tag,
      barcodeQrCode: row.qrCode,
      description: row.description ?? row.name,
      category: row.category,
      serialNumber: row.serialNumber,
      brand: row.brand,
      model: row.model,
      purchaseDate: dateValue(row.purchaseDate),
      warrantyExpiry: dateValue(row.warrantyExpiry),
      supplierName: row.supplierName,
      assetValue: Number(row.assetValue),
      currentValue: Number(row.currentValue),
      depreciationValue: Math.max(0, Number(row.assetValue) - Number(row.currentValue)),
      depreciationRate: Number(row.depreciationRate),
      property: row.room?.property.name ?? "",
      building: row.buildingLocation ?? row.room?.block?.name ?? "",
      buildingLocation: row.buildingLocation ?? row.room?.block?.name ?? "",
      room: row.roomLocation ?? row.room?.roomNumber ?? "",
      roomLocation: row.roomLocation ?? row.room?.roomNumber ?? "",
      floor: row.room?.floor ?? "",
      status: row.status,
      custodianName: row.custodianName,
      custodianContact: row.custodianContact,
      issuedTo: row.issuedTo,
      issuedAt: dateValue(row.issuedAt),
      transferredFrom: row.transferredFrom,
      transferredTo: row.transferredTo,
      transferredAt: dateValue(row.transferredAt),
      replacementOf: row.replacementOf,
      replacedAt: dateValue(row.replacedAt),
      pmSchedule: row.pmSchedule,
      nextPmDue: dateValue(row.nextPmDue),
      lastInspectionAt: dateValue(row.lastInspectionAt),
      missingOrDamaged: ["MISSING", "DAMAGED"].includes(String(row.status).toUpperCase()),
    }));
    const narrowed =
      type === "housing-missing-assets" ? mapped.filter((row) => row.status === "MISSING") :
      type === "housing-damaged-assets" ? mapped.filter((row) => row.status === "DAMAGED") :
      type === "housing-asset-transfers" ? mapped.filter((row) => Boolean(row.transferredAt || row.transferredTo || row.transferredFrom)) :
      mapped;
    return applyHousingFilters(narrowed, filters);
  }
  if (type === "housing-inventory") {
    const rows = await prisma.housingInventory.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: { sku: "asc" } });
    return applyHousingFilters(rows.map((row) => ({
      sku: row.sku,
      name: row.name,
      category: row.category,
      description: row.description,
      property: row.room?.property.name ?? "",
      block: row.room?.block?.name ?? "",
      room: row.room?.roomNumber ?? "",
      storeLocation: row.storeLocation,
      onHand: row.onHand,
      minimumStock: row.minimumStock,
      reorderPoint: row.reorderPoint,
      unit: row.unit,
      unitCost: Number(row.unitCost),
      stockValue: Number(row.unitCost) * row.onHand,
      supplierName: row.supplierName,
      supplierContact: row.supplierContact,
      preferredSupplier: row.preferredSupplier,
      expiryDate: dateValue(row.expiryDate),
      expired: row.expiryDate ? row.expiryDate.getTime() <= Date.now() : false,
      minimumStockAlert: row.onHand <= row.minimumStock,
      reorderAlert: row.onHand <= row.reorderPoint,
      lastMovementType: row.lastMovementType,
      lastMovementQty: row.lastMovementQty,
      lastMovementAt: dateValue(row.lastMovementAt),
      lastMovementBy: row.lastMovementBy,
      transferFrom: row.transferFrom,
      transferTo: row.transferTo,
      adjustmentReason: row.adjustmentReason,
      purchaseRequestNo: row.purchaseRequestNo,
      purchaseRequestStatus: row.purchaseRequestStatus,
      qrCode: row.qrCode,
    })), filters);
  }
  if (type === "housing-approvals") {
    const rows = await prisma.housingApproval.findMany({ orderBy: { createdAt: "desc" } });
    return applyHousingFilters(rows.map((row) => ({ entity: row.entity, entityId: row.entityId, step: row.step, level: row.level, approver: row.approver, status: row.status, action: row.action, approverName: row.approverName, remarks: row.remarks, actedAt: dateValue(row.actedAt), createdAt: dateValue(row.createdAt), updatedAt: dateValue(row.updatedAt) })), filters);
  }
  if (type === "housing-notifications") {
    const rows = await prisma.housingNotification.findMany({ orderBy: { createdAt: "desc" } });
    return applyHousingFilters(rows.map((row) => ({ alertType: row.alertType, channel: row.channel, role: row.role, title: row.title, message: row.message, severity: row.severity, recipient: row.recipient, status: row.status, read: row.read, entity: row.entity, entityId: row.entityId, queuedAt: dateValue(row.queuedAt), sentAt: dateValue(row.sentAt), deliveryRef: row.deliveryRef, createdAt: dateValue(row.createdAt) })), filters);
  }
  if (type === "housing-notification-settings") {
    const rows = await prisma.housingNotificationSetting.findMany({ orderBy: { label: "asc" } });
    return applyHousingFilters(rows.map((row) => ({ alertType: row.alertType, label: row.label, enabled: row.enabled, roles: row.roles, channels: row.channels, leadDays: row.leadDays, thresholdDays: row.thresholdDays, severity: row.severity, description: row.description, updatedBy: row.updatedBy, createdAt: dateValue(row.createdAt), updatedAt: dateValue(row.updatedAt) })), filters);
  }
  if (type === "housing-history") {
    const rows = await prisma.housingHistory.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
    return applyHousingFilters(rows.map((row) => ({ entity: row.entity, entityId: row.entityId, action: row.action, actor: row.actor, details: row.details, createdAt: dateValue(row.createdAt) })), filters);
  }
  if (["housing-maintenance-open", "housing-maintenance-closed", "housing-maintenance-delayed"].includes(type)) return housingMaintenanceReport(type, filters);
  if (type === "housing-preventive-maintenance") return housingPreventiveMaintenanceReport(filters);
  if (type === "housing-technician-performance") return housingTechnicianPerformanceReport(filters);
  return [];
}

function dateValue(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

async function housingMaintenanceReport(type: string, filters: ReturnType<typeof reportFilters>) {
  const rows = await prisma.serviceRequest.findMany({
    where: { OR: [{ category: { contains: "Housing", mode: "insensitive" } }, { departmentCode: "HOUSING" }] },
    include: { workOrder: { include: { assignedTo: true } } },
    orderBy: { createdAt: "desc" },
  });
  const now = Date.now();
  const mapped = rows.map((row) => ({
    ticketNo: row.ticketNo,
    title: row.title,
    category: row.category,
    department: row.departmentCode,
    service: row.serviceCode,
    assignedTeam: row.assignedTeamCode,
    technician: row.workOrder?.assignedTo?.name ?? "",
    supervisor: row.assignedSupervisorEmail,
    requester: row.requester,
    priority: row.priority,
    status: row.status,
    location: row.location,
    building: locationPart(row.location, 1),
    floor: locationPart(row.location, 2),
    room: locationPart(row.location, 3),
    dueAt: dateValue(row.dueAt),
    createdAt: dateValue(row.createdAt),
    closedAt: dateValue(row.workOrder?.finishedAt ?? row.workOrder?.verifiedAt),
    delayed: row.dueAt.getTime() < now && !["CLOSED", "REJECTED"].includes(row.status),
    workOrder: row.workOrder?.woNo ?? "",
  }));
  const narrowed =
    type === "housing-maintenance-open" ? mapped.filter((row) => !["CLOSED", "REJECTED"].includes(String(row.status))) :
    type === "housing-maintenance-closed" ? mapped.filter((row) => String(row.status) === "CLOSED" || Boolean(row.closedAt)) :
    type === "housing-maintenance-delayed" ? mapped.filter((row) => row.delayed) :
    mapped;
  return applyHousingFilters(narrowed, filters);
}

async function housingPreventiveMaintenanceReport(filters: ReturnType<typeof reportFilters>) {
  const rows = await prisma.housingAsset.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: { nextPmDue: "asc" } });
  return applyHousingFilters(rows.filter((row) => row.pmSchedule || row.nextPmDue).map((row) => ({
    assetCode: row.tag,
    asset: row.name,
    category: row.category,
    pmSchedule: row.pmSchedule,
    nextPmDue: dateValue(row.nextPmDue),
    status: row.status,
    property: row.room?.property.name ?? "",
    building: row.room?.block?.name ?? row.buildingLocation ?? "",
    floor: row.room?.floor ?? "",
    room: row.room?.roomNumber ?? row.roomLocation ?? "",
    custodian: row.custodianName,
  })), filters);
}

async function housingTechnicianPerformanceReport(filters: ReturnType<typeof reportFilters>) {
  const rows = await prisma.workOrder.findMany({
    where: { OR: [{ departmentCode: "HOUSING" }, { type: { contains: "Housing", mode: "insensitive" } }] },
    include: { assignedTo: true, request: true },
    orderBy: { createdAt: "desc" },
  });
  const metrics = new Map<string, { technician: string; assigned: number; closed: number; delayed: number; totalHours: number }>();
  rows.forEach((row) => {
    const technician = row.assignedTo?.name || row.assignedTeamCode || "Unassigned";
    const current = metrics.get(technician) || { technician, assigned: 0, closed: 0, delayed: 0, totalHours: 0 };
    current.assigned += 1;
    if (["CLOSED", "COMPLETED"].includes(row.status)) current.closed += 1;
    if (row.dueAt.getTime() < Date.now() && !["CLOSED", "COMPLETED"].includes(row.status)) current.delayed += 1;
    if (row.responseAt && row.finishedAt) current.totalHours += Math.max(0, (row.finishedAt.getTime() - row.responseAt.getTime()) / 3600000);
    metrics.set(technician, current);
  });
  return applyHousingFilters(Array.from(metrics.values()).map((row) => ({
    technician: row.technician,
    assignedWorkOrders: row.assigned,
    closedWorkOrders: row.closed,
    delayedWorkOrders: row.delayed,
    averageCompletionHours: row.closed ? Math.round((row.totalHours / row.closed) * 100) / 100 : 0,
    status: row.delayed ? "ACTION" : "ON_TRACK",
  })), filters);
}

function applyHousingFilters(rows: ReportRow[], filters: ReturnType<typeof reportFilters>) {
  return rows.filter((row) => {
    if (filters.company && !includesValue(row, ["company", "companyName", "department", "departmentCode"], filters.company)) return false;
    if (filters.building && !includesValue(row, ["building", "buildingNumber", "buildingLocation", "block", "property"], filters.building)) return false;
    if (filters.floor && !includesValue(row, ["floor", "floorNumber"], filters.floor)) return false;
    if (filters.room && !includesValue(row, ["room", "roomNumber", "roomLocation"], filters.room)) return false;
    if (filters.status && !includesValue(row, ["status", "readiness"], filters.status)) return false;
    if ((filters.dateFrom || filters.dateTo) && !rowMatchesDate(row, filters.dateFrom, filters.dateTo)) return false;
    return true;
  });
}

function includesValue(row: ReportRow, keys: string[], expected: string) {
  const target = expected.toLowerCase();
  return keys.some((key) => String(row[key] ?? "").toLowerCase().includes(target));
}

function rowMatchesDate(row: ReportRow, dateFrom: string, dateTo: string) {
  const keys = ["createdAt", "updatedAt", "checkIn", "checkOut", "dueAt", "completedAt", "purchaseDate", "warrantyExpiry", "transferredAt", "nextPmDue", "closedAt", "sentAt", "queuedAt"];
  return keys.some((key) => {
    const value = row[key];
    if (!value) return false;
    const time = new Date(String(value)).getTime();
    if (Number.isNaN(time)) return false;
    if (dateFrom && time < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
    if (dateTo && time > new Date(`${dateTo}T23:59:59`).getTime()) return false;
    return true;
  });
}

function periodLabel(type: string, value: Date) {
  if (type === "housing-occupancy-weekly") {
    const start = new Date(value);
    start.setDate(start.getDate() - start.getDay());
    return `${start.getFullYear()}-W${Math.ceil((start.getDate() + 6) / 7)}`;
  }
  if (type === "housing-occupancy-monthly") return value.toISOString().slice(0, 7);
  return value.toISOString().slice(0, 10);
}

function locationPart(location: string, index: number) {
  return String(location || "").split("/").map((part) => part.trim())[index] || "";
}

function csv(rows: ReportRow[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => quote(row[header])).join(","))].join("\n");
}

function excel(rows: ReportRow[], title: string, kpis: Record<string, unknown> | null) {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  return `<html><body><h1>${escapeHtml(title)}</h1>${kpiHtml(kpis)}<table border="1"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((h) => `<td>${escapeHtml(spreadsheetSafeValue(row[h] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}

function htmlPreview(rows: ReportRow[], title: string, kpis: Record<string, unknown> | null, filters: ReturnType<typeof reportFilters>) {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const filterText = `Date: ${filters.dateFrom || "-"} to ${filters.dateTo || "-"} | Company: ${filters.company || "all"} | Building: ${filters.building || "all"} | Floor: ${filters.floor || "all"} | Room: ${filters.room || "all"} | Status: ${filters.status || "all"} | Response > ${filters.responseGreaterThan ?? "-"} mins | Resolution > ${filters.resolutionGreaterThan ?? "-"} mins | SLA: ${filters.slaBreach ?? "all"} | Delayed: ${filters.delayedOnly ? "yes" : "no"}`;
  const filterQuery = reportFilterQuery(title, filters);
  const table = rows.length
    ? `<div class="table-wrap"><table><thead><tr><th>#</th>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row, index) => `<tr><td>${index + 1}</td>${headers.map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">No records found for this report.</div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} Report</title>
  <style>
    :root { color-scheme: light; --ink:#111827; --muted:#64748b; --line:#dbe7ef; --soft:#f4f8fb; --lagoon:#0f8b8d; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Arial, Helvetica, sans-serif; color:var(--ink); background:#eef6f6; }
    header { padding:24px 28px; background:linear-gradient(90deg,#c026d3,#4f46e5); color:white; }
    h1 { margin:0; font-size:28px; letter-spacing:0; }
    .meta { margin-top:8px; color:rgba(255,255,255,.82); font-size:13px; font-weight:700; }
    main { padding:22px; }
    .toolbar, .kpis, .table-wrap, .empty { border:1px solid var(--line); background:white; border-radius:8px; box-shadow:0 12px 30px rgba(15,23,42,.07); }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; padding:12px; margin-bottom:16px; }
    .actions { display:flex; flex-wrap:wrap; gap:8px; }
    a, button { border:0; border-radius:8px; padding:10px 13px; font-size:13px; font-weight:800; text-decoration:none; cursor:pointer; }
    a { background:var(--lagoon); color:white; }
    button { background:#111827; color:white; }
    .kpis { display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); padding:12px; margin-bottom:16px; }
    .kpi { background:var(--soft); border-radius:8px; padding:12px; }
    .kpi span { display:block; color:var(--muted); font-size:11px; font-weight:900; text-transform:uppercase; }
    .kpi strong { display:block; margin-top:6px; font-size:18px; }
    .table-wrap { overflow:auto; }
    table { width:100%; min-width:900px; border-collapse:collapse; }
    th, td { border-bottom:1px solid #e8eef3; padding:11px 12px; text-align:left; vertical-align:top; font-size:13px; white-space:nowrap; }
    th { position:sticky; top:0; background:#f8fafc; color:#475569; text-transform:uppercase; font-size:11px; }
    tr:nth-child(even) td { background:#fbfdff; }
    .empty { padding:24px; color:var(--muted); font-weight:800; }
    @media print { header, .toolbar { box-shadow:none; } .actions, button { display:none; } body { background:white; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(prettyTitle(title))} Report Preview</h1>
    <div class="meta">Generated ${escapeHtml(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }))} | ${rows.length} records</div>
  </header>
  <main>
    <div class="toolbar">
      <div><strong>Filters</strong><br /><span style="color:var(--muted);font-size:13px">${escapeHtml(filterText)}</span></div>
      <div class="actions">
        <a href="/api/reports?${filterQuery}&format=csv">CSV</a>
        <a href="/api/reports?${filterQuery}&format=excel">Excel</a>
        <a href="/api/reports?${filterQuery}&format=pdf">PDF</a>
        <button onclick="window.print()">Print</button>
      </div>
    </div>
    ${kpiHtml(kpis, "div")}
    ${table}
  </main>
</body>
</html>`;
}

function pdf(rows: ReportRow[], title: string, kpis: Record<string, unknown> | null, filters: ReturnType<typeof reportFilters>) {
  const kpiLines = kpis ? Object.entries(kpis).map(([key, value]) => `${key}: ${value ?? "-"}`) : [];
  const filterLines = [`Filters: date=${filters.dateFrom || "-"} to ${filters.dateTo || "-"}, company=${filters.company || "all"}, building=${filters.building || "all"}, floor=${filters.floor || "all"}, room=${filters.room || "all"}, status=${filters.status || "all"}, response>${filters.responseGreaterThan ?? "-"} mins, resolution>${filters.resolutionGreaterThan ?? "-"} mins, sla=${filters.slaBreach ?? "all"}, delayed=${filters.delayedOnly ? "yes" : "no"}`];
  const lines = [`Tamimi Global CAFM Report: ${title}`, `Generated: ${new Date().toISOString()}`, ...filterLines, ...kpiLines, "", ...rows.slice(0, 35).map((row) => Object.values(row).join(" | "))];
  const text = lines.join("\\n").replace(/[()\\]/g, "");
  return `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>endobj
4 0 obj<</Length ${text.length + 64}>>stream
BT /F1 9 Tf 40 760 Td (${text}) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
trailer<</Root 1 0 R/Size 6>>
startxref
0
%%EOF`;
}

function reportFilterQuery(type: string, filters: ReturnType<typeof reportFilters>) {
  const params = new URLSearchParams({ type });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== false && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

function kpiHtml(kpis: Record<string, unknown> | null, mode: "list" | "div" = "list") {
  if (!kpis) return "";
  if (mode === "div") {
    return `<section class="kpis">${Object.entries(kpis).map(([key, value]) => `<div class="kpi"><span>${escapeHtml(key.replaceAll("_", " "))}</span><strong>${escapeHtml(value ?? "-")}</strong></div>`).join("")}</section>`;
  }
  return `<h2>KPI Summary</h2><ul>${Object.entries(kpis).map(([key, value]) => `<li>${escapeHtml(key)}: ${escapeHtml(value ?? "-")}</li>`).join("")}</ul>`;
}

function quote(value: unknown) {
  return `"${spreadsheetSafeValue(value).replaceAll('"', '""')}"`;
}

function spreadsheetSafeValue(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function prettyTitle(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function file(body: string, contentType: string, filename: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function html(body: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
