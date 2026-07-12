import { NextResponse } from "next/server";
import { accessRole } from "@/lib/access-control";
import { requireUser } from "@/lib/api-auth";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const columnFilterFields: Record<string, string[]> = {
  equipmentNo: ["tag"],
  equipmentDesc: ["assetDescription", "name"],
  assetStatusText: ["assetStatusText", "status"],
  eqType: ["eqType"],
  organization: ["organization"],
  departmentCode: ["departmentCode"],
  departmentDesc: ["departmentDesc"],
  classCode: ["classCode"],
  classDesc: ["classDesc"],
  category: ["category", "assetGroup"],
  categoryDesc: ["categoryDesc"],
  serialNumber: ["serialNumber"],
  model: ["model"],
  manufacturer: ["manufacturer"],
  gsrc: ["gsrc"],
  attribute: ["attribute"],
  environment: ["environment"],
  pressureBar: ["pressureBar"],
  flowLps: ["flowLps"],
  supplyVoltageVolt: ["supplyVoltageVolt"],
  serviceLife: ["serviceLife"],
  locationCode: ["locationCode", "room"],
  locationDesc: ["locationDesc"],
  position: ["position"],
  classOrganization: ["classOrganization"],
  primarySystem: ["primarySystem", "system"],
  additionalNote: ["additionalNote", "remarks"],
};

function dateFilter(field: string, value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const start = new Date(parsed);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { [field]: { gte: start, lt: end } };
}

function numberFilter(field: string, value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return { [field]: parsed };
}

function booleanFilter(field: string, value: string) {
  const normalized = value.trim().toLowerCase();
  if (["yes", "true", "1", "y"].includes(normalized)) return { [field]: true };
  if (["no", "false", "0", "n"].includes(normalized)) return { [field]: false };
  return null;
}

function columnFilter(field: string, value: string) {
  if (!value.trim()) return null;
  if (field === "commissionDate") return dateFilter("installDate", value);
  if (field === "endOfUsefulLife") return dateFilter("replacementDate", value);
  if (field === "equipmentValue") return numberFilter("purchaseCost", value);
  if (field === "outOfServiceDisplay") return booleanFilter("outOfService", value);
  const fields = columnFilterFields[field];
  if (!fields?.length) return null;
  return { OR: fields.map((item) => ({ [item]: { contains: value, mode: "insensitive" } })) };
}

export async function GET(request: Request) {
  const { error } = await requireUser();
  if (error) return error;
  const url = new URL(request.url);
  const site = url.searchParams.get("site") || undefined;
  const building = url.searchParams.get("building") || undefined;
  const floor = url.searchParams.get("floor") || undefined;
  const room = url.searchParams.get("room") || undefined;
  const query = url.searchParams.get("query")?.trim() || "";
  const filterField = url.searchParams.get("filterField")?.trim() || "";
  const filterValue = url.searchParams.get("filterValue")?.trim() || "";
  const locationCode = url.searchParams.get("locationCode")?.trim() || "";
  const locationQuery = url.searchParams.get("locationQuery")?.trim() || "";
  const classValue = url.searchParams.get("class")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "";
  const pageInput = Number(url.searchParams.get("page") || 1);
  const pageSizeInput = Number(url.searchParams.get("pageSize") || 100);
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const pageSize = Number.isFinite(pageSizeInput) ? Math.min(200, Math.max(25, Math.floor(pageSizeInput))) : 100;
  const user = await getCurrentUser();
  const role = accessRole(user);
  const searchableFields = new Set([
    "tag",
    "name",
    "assetDescription",
    "assetStatusText",
    "eqType",
    "organization",
    "departmentCode",
    "departmentDesc",
    "classCode",
    "classDesc",
    "category",
    "categoryDesc",
    "serialNumber",
    "model",
    "manufacturer",
    "locationCode",
    "locationDesc",
    "primarySystem",
    "additionalNote",
  ]);
  const where: any = {
    ...(site ? { siteCode: site } : {}),
    ...(building ? { buildingCode: building } : {}),
    ...(floor ? { floor } : {}),
    ...(room ? { room } : {}),
    ...(status ? { assetStatusText: status } : {}),
    ...(role === "supervisor" || role === "technician" ? { departmentCode: user?.department || "__none__" } : {}),
  };
  const andFilters: any[] = [];
  const wantsUndefinedLocation = locationCode === "__unassigned__" || locationCode.toLowerCase() === "unassigned" || locationQuery.toLowerCase() === "unassigned";
  if (wantsUndefinedLocation) {
    andFilters.push({
      AND: [
        { OR: [{ locationCode: null }, { locationCode: "" }] },
        { OR: [{ locationDesc: null }, { locationDesc: "" }] },
        { OR: [{ buildingCode: null }, { buildingCode: "" }] },
        { OR: [{ floor: null }, { floor: "" }] },
        { OR: [{ room: null }, { room: "" }] },
      ],
    });
  } else if (locationCode) {
    andFilters.push({
      OR: [
        { locationCode: { equals: locationCode, mode: "insensitive" } },
        { locationDesc: { contains: locationCode, mode: "insensitive" } },
        { buildingCode: { contains: locationCode, mode: "insensitive" } },
        { floor: { contains: locationCode, mode: "insensitive" } },
        { room: { contains: locationCode, mode: "insensitive" } },
      ],
    });
  }
  if (locationQuery) {
    andFilters.push({
      OR: [
        { locationCode: { contains: locationQuery, mode: "insensitive" } },
        { locationDesc: { contains: locationQuery, mode: "insensitive" } },
        { buildingCode: { contains: locationQuery, mode: "insensitive" } },
        { floor: { contains: locationQuery, mode: "insensitive" } },
        { room: { contains: locationQuery, mode: "insensitive" } },
        { siteCode: { contains: locationQuery, mode: "insensitive" } },
      ],
    });
  }
  if (query) {
    andFilters.push({
      OR: [
        { tag: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
        { assetDescription: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
        { assetGroup: { contains: query, mode: "insensitive" } },
        { classCode: { contains: query, mode: "insensitive" } },
        { locationCode: { contains: query, mode: "insensitive" } },
        { locationDesc: { contains: query, mode: "insensitive" } },
        { serialNumber: { contains: query, mode: "insensitive" } },
        { manufacturer: { contains: query, mode: "insensitive" } },
        { model: { contains: query, mode: "insensitive" } },
      ],
    });
  }
  if (filterField && filterValue) {
    const mappedFilter = columnFilter(filterField, filterValue);
    if (mappedFilter) andFilters.push(mappedFilter);
    else if (searchableFields.has(filterField)) andFilters.push({ [filterField]: { contains: filterValue, mode: "insensitive" } });
  }
  url.searchParams.forEach((value, key) => {
    if (!key.startsWith("column_")) return;
    const filter = columnFilter(key.replace("column_", ""), value);
    if (filter) andFilters.push(filter);
  });
  if (classValue) {
    andFilters.push({ OR: [{ classCode: classValue }, { category: classValue }, { assetGroup: classValue }] });
  }
  if (andFilters.length) where.AND = andFilters;
  const locationCountWhere: any = {
    ...(role === "supervisor" || role === "technician" ? { departmentCode: user?.department || "__none__" } : {}),
  };
  const [allTotal, total, locationGroups, assets] = await Promise.all([
    prisma.asset.count({ where: locationCountWhere }),
    prisma.asset.count({ where }),
    prisma.asset.groupBy({
      by: ["locationCode"],
      where: locationCountWhere,
      _count: { _all: true },
    }),
    prisma.asset.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ locationCode: "asc" }, { tag: "asc" }],
      include: {
        site: { select: { name: true } },
        building: { select: { name: true, code: true } },
        workOrders: { take: 8, orderBy: { updatedAt: "desc" }, select: { woNo: true, title: true, status: true, updatedAt: true, inventoryUsed: true, workNotes: true } },
        history: { take: 8, orderBy: { createdAt: "desc" } },
      },
    }),
  ]);
  const locationCounts = locationGroups.reduce((counts: Record<string, number>, item) => {
    counts[item.locationCode || "Unassigned"] = item._count._all;
    return counts;
  }, {});
  return NextResponse.json({ assets, allTotal, total, locationCounts, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function HEAD() {
  return new Response(null, { status: 204 });
}
