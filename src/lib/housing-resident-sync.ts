type HousingResidentSnapshot = {
  id: string;
  residentNo: string;
  name: string;
  phone?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  gender?: string | null;
  nationality?: string | null;
  departmentCode?: string | null;
};

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  );
}

export async function syncHousingResidentToBookings(
  client: any,
  resident: HousingResidentSnapshot,
  previous?: Partial<HousingResidentSnapshot> | null,
) {
  const badgeNumbers = uniqueText([resident.residentNo, previous?.residentNo]);
  const bookingOr = [
    { residentId: resident.id },
    ...badgeNumbers.map((employeeId) => ({ employeeId })),
  ];
  const bookingUpdate = await client.housingBooking.updateMany({
    where: { OR: bookingOr },
    data: {
      residentId: resident.id,
      residentName: resident.name,
      employeeId: resident.residentNo,
      departmentCode: resident.departmentCode || "",
      companyName: resident.companyName || resident.companyId || "",
      nationality: resident.nationality || "",
      contactNumber: resident.phone || "",
      gender: resident.gender || "",
    },
  });

  const bedUpdate = await client.housingBed.updateMany({
    where: {
      status: { in: ["RESERVED", "OCCUPIED"] as any },
      OR: [
        { occupantId: resident.id },
        ...badgeNumbers.map((occupantId) => ({ occupantId })),
      ],
    },
    data: {
      occupant: resident.name,
      occupantId: resident.id,
    },
  });

  return {
    bookingsUpdated: bookingUpdate.count,
    bedsUpdated: bedUpdate.count,
  };
}
