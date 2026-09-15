export function compactHousekeepingRequestText(...values: unknown[]) {
  return values
    .map((value) => String(value ?? ""))
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function isHousekeepingRole(user: { role?: string | null; department?: string | null } | null) {
  const text = compactHousekeepingRequestText(user?.role, user?.department);
  return text.includes("housekeeping") || text.includes("hsk");
}

export function isHskHousekeepingReactiveRequest(record: Record<string, unknown>) {
  const departmentText = compactHousekeepingRequestText(
    record.departmentCode,
    record.serviceCode,
    record.assignedTeamCode,
    record.category,
    record.title,
  );
  const typeText = compactHousekeepingRequestText(
    record.category,
    record.title,
    record.description,
  );
  const isHousekeeping =
    departmentText.includes("hsk") || departmentText.includes("housekeeping");
  const isPreventive =
    typeText.includes("ppm") || typeText.includes("preventive");
  return isHousekeeping && !isPreventive;
}

export function housekeepingServiceRequestWhere() {
  return {
    OR: [
      { departmentCode: { contains: "HSK", mode: "insensitive" } },
      { serviceCode: { contains: "HOUSEKEEPING", mode: "insensitive" } },
      { assignedTeamCode: { contains: "HSK", mode: "insensitive" } },
      { category: { contains: "Housekeeping", mode: "insensitive" } },
      { title: { contains: "Housekeeping", mode: "insensitive" } },
    ],
    NOT: [
      { category: { contains: "preventive", mode: "insensitive" } },
      { title: { contains: "preventive", mode: "insensitive" } },
      { category: { contains: "ppm", mode: "insensitive" } },
      { title: { contains: "ppm", mode: "insensitive" } },
    ],
  };
}
