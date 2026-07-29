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

function compactUnique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter((value) => value && value.toLowerCase() !== "unassigned"),
    ),
  );
}

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

function normalizedHierarchyCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function parseHierarchyCode(...values: unknown[]) {
  const parsed = { site: "", building: "", floor: "", room: "", roomCode: "" };
  const normalizedTexts = values
    .flatMap((value) => String(value || "").split(/[>/|,;\s]+/))
    .concat(values.map((value) => String(value || "")).join(" "))
    .map(normalizedHierarchyCode)
    .filter((value) => value.length > 1);

  for (const text of normalizedTexts) {
    if (!parsed.site && /L?FBC/.test(text)) parsed.site = "L-FBC";
    if (!parsed.building) {
      const buildingMatch =
        text.match(/L?FBC([A-Z]\d+)/) ||
        text.match(/\b([A-Z]\d+)(?=F\d|R\d|ER\d|MR\d|FR\d|$)/);
      if (buildingMatch?.[1]) parsed.building = buildingMatch[1];
    }
    if (!parsed.floor) {
      const floorMatch = text.match(/(F\d+)(?=[A-Z]*R?\d|ER\d|MR\d|FR\d|$)/);
      if (floorMatch?.[1]) parsed.floor = floorMatch[1];
    }
    if (!parsed.room) {
      const roomMatch =
        text.match(/((?:ER|MR|FR|OR|CR|KIT|LUG)\d+[A-Z]?)(?![A-Z0-9])/) ||
        text.match(/(R\d+[A-Z]?)(?![A-Z0-9])/);
      if (roomMatch?.[1]) parsed.room = roomMatch[1];
    }
    if (!parsed.roomCode) {
      const compactRoomMatch = text.match(/((?:FBC)?[A-Z]\d+F\d+(?:[A-Z]{0,3})?R?\d+[A-Z]?)/);
      if (compactRoomMatch?.[1]) parsed.roomCode = compactRoomMatch[1];
    }
  }
  return parsed;
}

function insensitiveEquals(field: string, value: string) {
  return { [field]: { equals: value, mode: "insensitive" } };
}

function insensitiveContains(field: string, value: string) {
  return { [field]: { contains: value, mode: "insensitive" } };
}

function hierarchyLocationFilter(values: {
  locationCode?: string;
  locationQuery?: string;
  site?: string;
  building?: string;
  floor?: string;
  room?: string;
  description?: string;
  parentLocation?: string;
  zone?: string;
  strict?: boolean;
}) {
  const parsed = parseHierarchyCode(
    values.locationCode,
    values.locationQuery,
    values.site,
    values.building,
    values.floor,
    values.room,
    values.description,
    values.parentLocation,
    values.zone,
  );
  const site = values.site || parsed.site;
  const building = values.building || parsed.building;
  const floor = values.floor || parsed.floor;
  const room = values.room || parsed.room || parsed.roomCode;

  if (values.strict) {
    const strictMatches: any[] = [];
    const exactCodes = compactUnique([values.locationCode, values.locationQuery, parsed.roomCode]);
    exactCodes.forEach((code) => {
      strictMatches.push(insensitiveEquals("locationCode", code));
      strictMatches.push(insensitiveEquals("room", code));
      strictMatches.push(insensitiveContains("locationCode", code));
      strictMatches.push(insensitiveContains("room", code));
    });
    if (room) {
      strictMatches.push({
        AND: [
          { OR: [insensitiveEquals("room", room), insensitiveContains("locationCode", room)] },
          ...(floor ? [{ OR: [insensitiveEquals("floor", floor), insensitiveContains("locationCode", floor)] }] : []),
          ...(building ? [{ OR: [insensitiveEquals("buildingCode", building), insensitiveContains("locationCode", building)] }] : []),
        ],
      });
    } else if (floor) {
      strictMatches.push({
        AND: [
          { OR: [insensitiveEquals("floor", floor), insensitiveContains("locationCode", floor)] },
          ...(building ? [{ OR: [insensitiveEquals("buildingCode", building), insensitiveContains("locationCode", building)] }] : []),
        ],
      });
    } else if (building) {
      strictMatches.push({ OR: [insensitiveEquals("buildingCode", building), insensitiveContains("locationCode", building)] });
    } else if (site) {
      strictMatches.push({ OR: [insensitiveEquals("siteCode", site), insensitiveContains("locationCode", site)] });
    }
    return { OR: strictMatches.length ? strictMatches : [insensitiveEquals("locationCode", values.locationCode || "__none__")] };
  }

  const codes = compactUnique([
    values.locationCode,
    values.locationQuery,
    room,
    floor,
    building,
    site,
    values.parentLocation,
    values.zone,
  ]);
  const descriptions = compactUnique([values.description, values.locationQuery]);
  const directMatches = codes.flatMap((code) => [
    insensitiveEquals("locationCode", code),
    insensitiveEquals("room", code),
    insensitiveEquals("floor", code),
    insensitiveEquals("buildingCode", code),
    insensitiveEquals("siteCode", code),
    insensitiveContains("locationDesc", code),
  ]);
  const descriptionMatches = descriptions.flatMap((description) => [
    insensitiveContains("locationDesc", description),
    insensitiveContains("room", description),
  ]);
  return { OR: [...directMatches, ...descriptionMatches] };
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
  const strictLocation = url.searchParams.get("strictLocation") === "true";
  const hierarchySite = url.searchParams.get("hierarchySite")?.trim() || "";
  const hierarchyBuilding = url.searchParams.get("hierarchyBuilding")?.trim() || "";
  const hierarchyFloor = url.searchParams.get("hierarchyFloor")?.trim() || "";
  const hierarchyRoom = url.searchParams.get("hierarchyRoom")?.trim() || "";
  const classValue = url.searchParams.get("class")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "";
  const pageInput = Number(url.searchParams.get("page") || 1);
  const pageSizeParam = url.searchParams.get("pageSize") || "100";
  const pageSizeInput = pageSizeParam === "all" ? Number.MAX_SAFE_INTEGER : Number(pageSizeParam);
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const pageSize = pageSizeParam === "all" ? 20000 : Number.isFinite(pageSizeInput) ? Math.min(500, Math.max(25, Math.floor(pageSizeInput))) : 100;
  const user = await getCurrentUser();
  const role = accessRole(user);
  const userDepartments = departmentValues(user);
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
  const selectedLocation = locationCode
    ? await prisma.location.findUnique({ where: { code: locationCode } })
    : null;
  const where: any = {
    ...(site ? { siteCode: site } : {}),
    ...(building ? { buildingCode: building } : {}),
    ...(floor ? { floor } : {}),
    ...(room ? { room } : {}),
    ...(status ? { assetStatusText: status } : {}),
    ...(role === "supervisor" || role === "technician" ? { departmentCode: { in: userDepartments.length ? userDepartments : ["__none__"] } } : {}),
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
    andFilters.push(
      hierarchyLocationFilter({
        locationCode,
        locationQuery,
        site: selectedLocation?.site || hierarchySite,
        building: selectedLocation?.building || hierarchyBuilding,
        floor: selectedLocation?.floor || hierarchyFloor,
        room: selectedLocation?.room || hierarchyRoom,
        description: selectedLocation?.description,
        parentLocation: selectedLocation?.parentLocation,
        zone: selectedLocation?.zone,
        strict: strictLocation,
      }),
    );
  }
  if (locationQuery && !strictLocation) {
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
    ...(role === "supervisor" || role === "technician" ? { departmentCode: { in: userDepartments.length ? userDepartments : ["__none__"] } } : {}),
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
