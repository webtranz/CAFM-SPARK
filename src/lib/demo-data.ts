export const moduleStats = [
  { label: "Open Work Orders", value: "428", delta: "+18 today", tone: "coral" },
  { label: "SLA Compliance", value: "94.7%", delta: "+3.2% vs last month", tone: "leaf" },
  { label: "Critical Assets Online", value: "98.9%", delta: "7 assets at risk", tone: "lagoon" },
  { label: "Inventory Value", value: "2.8M", delta: "16 low-stock SKUs", tone: "sun", currency: true },
];

export const chartData = [
  { name: "Jan", ppm: 420, reactive: 180, inspections: 112 },
  { name: "Feb", ppm: 470, reactive: 154, inspections: 140 },
  { name: "Mar", ppm: 510, reactive: 132, inspections: 156 },
  { name: "Apr", ppm: 548, reactive: 121, inspections: 169 },
  { name: "May", ppm: 590, reactive: 118, inspections: 182 },
  { name: "Jun", ppm: 626, reactive: 96, inspections: 201 },
];

export const assetHealth = [
  { name: "Excellent", value: 42 },
  { name: "Good", value: 31 },
  { name: "Monitor", value: 18 },
  { name: "Risk", value: 9 },
];

export const fallbackData = {
  sites: [
    { id: "demo-site", name: "King Abdullah Financial District", city: "Riyadh", country: "Saudi Arabia", type: "Mixed Use", areaSqm: 284000 },
  ],
  buildings: [
    { id: "demo-building", code: "TWA", name: "Tower A", siteId: "demo-site", floors: 40, areaSqm: 120000, site: { name: "King Abdullah Financial District" } },
  ],
  spaces: [
    { id: "demo-space", name: "Executive Offices", floor: "18", type: "Office", capacity: 60, areaSqm: 1200, occupancy: 42, buildingId: "demo-building", building: { code: "TWA", name: "Tower A", site: { name: "King Abdullah Financial District" } } },
  ],
  assets: [
    { id: "a1", tag: "AHU-RYD-01-004", name: "Air Handling Unit 4", category: "HVAC", system: "Cooling", criticality: "HIGH", status: "ACTIVE", conditionScore: 88 },
    { id: "a2", tag: "GEN-RYD-02-001", name: "Emergency Generator 1", category: "Power", system: "Electrical", criticality: "CRITICAL", status: "STANDBY", conditionScore: 91 },
    { id: "a3", tag: "FLS-RYD-01-221", name: "Fire Pump Controller", category: "Life Safety", system: "Fire", criticality: "CRITICAL", status: "ACTIVE", conditionScore: 76 },
  ],
  requests: [
    { id: "r1", ticketNo: "SR-24001", title: "Lobby temperature above comfort range", category: "HVAC", requester: "Tenant Services", priority: "HIGH", status: "ASSIGNED", location: "Tower A Lobby", dueAt: new Date() },
    { id: "r2", ticketNo: "SR-24002", title: "Water leak near pantry", category: "Plumbing", requester: "Floor Warden", priority: "CRITICAL", status: "IN_PROGRESS", location: "Tower B L18", dueAt: new Date() },
  ],
  workOrders: [
    { id: "w1", woNo: "WO-81024", title: "Replace AHU filters and rebalance", type: "PPM", priority: "HIGH", status: "IN_PROGRESS", dueAt: new Date(), cost: 2200, assignedTo: { name: "Adeel Khan" }, asset: { tag: "AHU-RYD-01-004" } },
    { id: "w2", woNo: "WO-81025", title: "Fire pump weekly test", type: "Inspection", priority: "CRITICAL", status: "ASSIGNED", dueAt: new Date(), cost: 780, assignedTo: { name: "Sara Malik" }, asset: { tag: "FLS-RYD-01-221" } },
  ],
  inventory: [
    { id: "i1", sku: "FLT-24X24-MERV13", name: "MERV 13 Filter", category: "HVAC", onHand: 34, reorderPoint: 50, unit: "pcs", vendor: "Gulf MEP Supplies" },
    { id: "i2", sku: "LED-PNL-60W", name: "LED Panel 60W", category: "Electrical", onHand: 122, reorderPoint: 80, unit: "pcs", vendor: "BrightLine Trading" },
  ],
  inspections: [
    { id: "ins1", code: "INS-FLS-144", title: "Fire life safety weekly audit", area: "All Towers", risk: "HIGH", score: 91, status: "COMPLETED", dueAt: new Date() },
    { id: "ins2", code: "INS-HSE-033", title: "Contractor permit compliance", area: "Basement Plant", risk: "MODERATE", score: 84, status: "IN_PROGRESS", dueAt: new Date() },
  ],
  complianceCertificates: [
    { id: "cc1", certificateNo: "CERT-FLS-2026-001", title: "Fire Alarm Civil Defense Certificate", authority: "Civil Defense", category: "Life Safety", assetTag: "FLS-RYD-01-221", location: "Tower A", owner: "HSE Manager", issueDate: new Date(), expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45), status: "ACTIVE", risk: "HIGH", renewalLeadDays: 30, evidenceUrl: "", notes: "Annual renewal required before expiry." },
    { id: "cc2", certificateNo: "CERT-LIFT-2026-004", title: "Elevator Third Party Inspection", authority: "TUV", category: "Vertical Transport", assetTag: "LIFT-TWA-04", location: "Tower A", owner: "Facilities Supervisor", issueDate: new Date(), expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12), status: "EXPIRING_SOON", risk: "MODERATE", renewalLeadDays: 30, evidenceUrl: "", notes: "Book inspector and attach new certificate." },
  ],
  documentUploads: [],
  alerts: [
    { id: "al1", source: "BMS", assetTag: "CHL-RYD-01-002", severity: "HIGH", message: "Chiller vibration exceeds baseline by 18%", status: "TRIAGED", detectedAt: new Date() },
    { id: "al2", source: "Energy Meter", assetTag: "MDB-RYD-03-001", severity: "MEDIUM", message: "Peak demand forecast breach in 48 hours", status: "NEW", detectedAt: new Date() },
  ],
  teams: [
    { id: "t1", code: "MEP", name: "MEP Response Team", type: "Hard Services", supervisor: "Adeel Khan", phone: "+966 500000001", email: "mep@example.com", shift: "24/7", coverage: "All towers", services: [] },
  ],
  services: [
    { id: "s1", code: "HVAC-REQ", name: "HVAC Complaint", category: "HVAC", type: "Reactive", priority: "HIGH", slaHours: 12, team: { name: "MEP Response Team" } },
  ],
  categories: [
    { id: "c1", code: "HVAC", name: "HVAC Equipment", type: "MEP", defaultLifeYrs: 15, statutory: false, description: "Cooling and ventilation assets" },
  ],
  ppms: [
    { id: "p1", code: "PM-HVAC-001", name: "Monthly AHU Service", assetTag: "AHU-RYD-01-004", frequency: "Monthly", nextDue: new Date(), durationHrs: 2, active: true },
  ],
  users: [
    { id: "admin-local", name: "System Administrator", email: "admin@cafm.local", role: "Admin", department: "Administration", active: true, team: null },
  ],
  permissions: [
    { id: "perm1", code: "assets.manage", name: "Manage Assets", module: "Assets", description: "Create and edit assets" },
  ],
  departments: [
    { id: "d1", code: "MEP", name: "MEP Department", siteLocation: "Tower A", description: "Mechanical electrical plumbing" },
  ],
  employees: [
    { id: "e1", name: "Adeel Khan", email: "adeel@brightworks.local", companyId: "EMP-001", nationalityType: "Resident", departmentCode: "MEP", siteLocation: "Tower A", shiftEligibility: "Day & Night", defaultShift: "General", serviceTeamCode: "MEP", supervisor: "Adeel Khan", workLocationZone: "Tower A", maxHoursPerDay: 8, maxConsecutiveDays: 6, minRestHours: 12, active: true },
  ],
  rolePermissions: [],
  roles: [
    { id: "role-admin", name: "Admin", description: "Full system administration", standard: true },
    { id: "role-supervisor", name: "Supervisor", description: "Assign and supervise work", standard: true },
    { id: "role-technician", name: "Technician", description: "Execute and update assigned work", standard: true },
  ],
  locations: [],
  shiftRotation: {
    shifts: [{ id: "shift-day", name: "Day Shift", shiftType: "Day", startTime: "07:00", endTime: "15:00", breakDuration: 60, active: true }],
    rotations: [{ id: "rot-demo", name: "MEP Weekly Rotation", appliesTo: "Service Team", shiftSequence: "Day Shift", offDays: "Friday", startDate: new Date(), endDate: null, repeatCycle: "Weekly", active: true }],
    roster: [],
  },
  jobPlans: [
    { id: "jp1", code: "JP-HVAC-FILTER", name: "AHU Filter Replacement", assetType: "HVAC", departmentCode: "MEP", serviceCode: "HVAC-REQ", estimatedHours: 2, priority: "MEDIUM", active: true },
  ],
  housing: {
    properties: [{ id: "hp1", code: "HSP-001", name: "Tamimi Housing Village", site: "Jazan", city: "Jazan", manager: "Housing Supervisor", totalRooms: 2, active: true }],
    blocks: [{ id: "hb1", code: "HSB-A", name: "Block A", propertyId: "hp1", floors: 3, property: { name: "Tamimi Housing Village" } }],
    rooms: [
      { id: "hr1", code: "HSR-A101", roomNumber: "A101", propertyId: "hp1", blockId: "hb1", floor: "1", roomType: "Single", capacity: 1, occupancy: 1, status: "OCCUPIED", qrCode: "QR:HSR-A101", property: { name: "Tamimi Housing Village" }, block: { name: "Block A" }, beds: [] },
      { id: "hr2", code: "HSR-A102", roomNumber: "A102", propertyId: "hp1", blockId: "hb1", floor: "1", roomType: "Shared", capacity: 2, occupancy: 1, status: "RESERVED", qrCode: "QR:HSR-A102", property: { name: "Tamimi Housing Village" }, block: { name: "Block A" }, beds: [] },
    ],
    beds: [{ id: "bed1", code: "HSR-A101-B1", label: "Bed 1", roomId: "hr1", status: "OCCUPIED", occupant: "Hamayun Ali" }],
    residents: [{ id: "res1", residentNo: "RES-00001", name: "Hamayun Ali", email: "resident@example.com", phone: "+966500000000", companyId: "TG-001", nationality: "Pakistan", departmentCode: "MEP", status: "ACTIVE" }],
    bookings: [{ id: "bk1", bookingNo: "HBK-00001", residentName: "Hamayun Ali", departmentCode: "MEP", roomId: "hr1", bedId: "bed1", checkIn: new Date(), status: "CHECKED_IN", priority: "MEDIUM", requestedBy: "Admin", room: { roomNumber: "A101", property: { name: "Tamimi Housing Village" }, block: { name: "Block A" } }, bed: { label: "Bed 1" }, approvals: [] }],
    inspections: [{ id: "hin1", inspectionNo: "HIN-00001", roomId: "hr1", inspector: "Housing Supervisor", inspectionType: "Check-in", status: "PASSED", score: 96, findings: "Room ready", dueAt: new Date(), room: { roomNumber: "A101", property: { name: "Tamimi Housing Village" } } }],
    assets: [{ id: "ha1", tag: "HSA-00001", name: "Bed Frame", category: "Furniture", roomId: "hr1", status: "ACTIVE", qrCode: "QR:HSA-00001" }],
    inventory: [{ id: "hi1", sku: "HSI-LINEN-001", name: "Linen Set", category: "Linen", roomId: "hr1", storeLocation: "Housing Store / Linen Rack A", onHand: 24, minimumStock: 12, reorderPoint: 10, unit: "Set", supplierName: "Tamimi Housekeeping Supplies", expiryDate: new Date(), purchaseRequestStatus: "NOT_REQUIRED", lastMovementType: "RECEIPT", qrCode: "QR:HSI-LINEN-001" }],
    approvals: [],
    notifications: [{ id: "hn1", alertType: "MAINTENANCE_DUE", channel: "SYSTEM", role: "Housing Supervisor", title: "Inspection due", message: "Room A102 inspection is due.", severity: "MEDIUM", recipient: "Housing Supervisor", status: "SENT", read: false, sentAt: new Date(), createdAt: new Date() }],
    notificationSettings: [{ id: "hns1", alertType: "UPCOMING_CHECKOUT", label: "Upcoming check-out", enabled: true, roles: "Housing Supervisor,Reception Team", channels: "SYSTEM,EMAIL", leadDays: 3, thresholdDays: 0, severity: "MEDIUM", description: "Residents scheduled to check out soon." }],
    holds: [],
    history: [],
  },
  auditLogs: [],
};
