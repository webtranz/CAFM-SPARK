"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, UIEvent } from "react";
import Image from "next/image";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  CalendarCheck,
  Clock,
  ClipboardCheck,
  FileText,
  Gauge,
  HardHat,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  MapPinned,
  PackagePlus,
  Plus,
  Upload,
  Users,
  RadioTower,
  Search,
  ShieldCheck,
  Smartphone,
  TicketCheck,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { moduleStats } from "@/lib/demo-data";

type ConsoleData = {
  live: boolean;
  sites: any[];
  buildings: any[];
  spaces: any[];
  assets: any[];
  requests: any[];
  workOrders: any[];
  workOrdersTotal?: number;
  inventory: any[];
  inspections: any[];
  alerts: any[];
  teams: any[];
  services: any[];
  categories: any[];
  ppms: any[];
  ppmsTotal?: number;
  users: any[];
  permissions: any[];
  departments: any[];
  employees: any[];
  rolePermissions: any[];
  locations: any[];
  jobPlans: any[];
  jobPlansTotal?: number;
  roles: any[];
  auditLogs: any[];
  complianceCertificates: any[];
  documentUploads: any[];
  shiftRotation?: {
    shifts: any[];
    rotations: any[];
    roster: any[];
  };
  housing: {
    properties: any[];
    blocks: any[];
    rooms: any[];
    beds: any[];
    residents: any[];
    bookings: any[];
    inspections: any[];
    assets: any[];
    inventory: any[];
    approvals: any[];
    notifications: any[];
    notificationSettings: any[];
    history: any[];
  };
};

type AuditEntry = {
  row?: number;
  status?: string;
  module?: string;
  recordType?: string;
  recordId?: string;
  recordKey?: string;
  displayName?: string;
  action?: string;
  message?: string;
  [key: string]: any;
};

type BulkUploadProgressState = {
  jobId?: string;
  module: string;
  fileName: string;
  fileSize: number;
  totalRows: number;
  processedRows: number;
  createdRows?: number;
  failedRows?: number;
  completion: number;
  status: "UPLOADING" | "QUEUED" | "PROCESSING" | "FINALIZING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";
  startedAt: string;
  updatedAt?: string;
  message: string;
};

type ActionPermissions = {
  manageRequests: boolean;
  approveRequests: boolean;
  manageWork: boolean;
  executeWork: boolean;
  verifyWork: boolean;
};

type ModuleItem = { id: string; label: string; icon: LucideIcon; view?: string };
type ModuleGroup = { label: string; icon: LucideIcon; items: ModuleItem[]; flat?: boolean };

function BrandLogoMark({ size = "md" }: { size?: "sm" | "md" }) {
  const boxClass = size === "sm" ? "h-9 w-9 rounded-lg" : "h-12 w-12 rounded-xl";
  const imageSize = size === "sm" ? 36 : 48;

  return (
    <div className={`grid ${boxClass} place-items-center overflow-hidden border border-amber-200 bg-white p-1 shadow-sm`}>
      <Image src="/tafga.png" alt="Tamimi Global CAFM logo" width={imageSize} height={imageSize} className="h-full w-full object-contain" priority />
    </div>
  );
}

const moduleGroups: ModuleGroup[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [{ id: "command", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Tickets",
    icon: TicketCheck,
    items: [
      { id: "helpdesk", label: "Service Requests", icon: TicketCheck },
      { id: "work", label: "Work Orders", icon: Wrench },
      { id: "jobPlans", label: "Job Plans", icon: ClipboardCheck },
      { id: "ppm", label: "PPM Planner", icon: CalendarCheck },
    ],
  },
  {
    label: "Facility Bookings",
    icon: MapPinned,
    items: [
      { id: "command", label: "Facility Report", icon: Gauge, view: "facility-report" },
      { id: "locations", label: "Locations", icon: MapPinned, view: "locations" },
      { id: "reports", label: "Bookings Report", icon: ClipboardCheck, view: "bookings-report" },
    ],
  },
  {
    label: "Housing Operations",
    icon: Building2,
    items: [
      { id: "housing", label: "Housing Dashboard", icon: LayoutDashboard, view: "housing-dashboard" },
      { id: "housing", label: "Accommodation & Bookings", icon: CalendarCheck, view: "housing-bookings" },
      { id: "housing", label: "Room Inspections", icon: ClipboardCheck, view: "housing-inspections" },
      { id: "housing", label: "Housing Assets", icon: Building2, view: "housing-assets" },
      { id: "housing", label: "Housing Inventory", icon: Boxes, view: "housing-inventory" },
      { id: "housing", label: "Approvals & Alerts", icon: ShieldCheck, view: "housing-approvals" },
      { id: "housing", label: "Notification Settings", icon: AlertTriangle, view: "housing-notifications" },
      { id: "housing", label: "Housing Reports", icon: Gauge, view: "housing-reports" },
    ],
  },
  {
    label: "Assets Management",
    icon: Building2,
    items: [
      { id: "assets", label: "Assets Management", icon: Building2, view: "assets-register" },
      { id: "assetSetup", label: "Sites", icon: MapPinned, view: "asset-sites" },
      { id: "assetSetup", label: "Buildings", icon: Building2, view: "asset-buildings" },
      { id: "assetSetup", label: "Spaces", icon: Boxes, view: "asset-spaces" },
      { id: "assetSetup", label: "Departments", icon: Users, view: "asset-departments" },
      { id: "assetSetup", label: "Asset Categories", icon: PackagePlus, view: "asset-categories" },
      { id: "bulk", label: "Bulk Upload Assets", icon: Upload, view: "bulk-assets" },
      { id: "assets", label: "Asset Inventory Allocation", icon: ClipboardCheck, view: "asset-allocation" },
    ],
  },
  {
    label: "Inventory Management",
    icon: Boxes,
    items: [
      { id: "inventory", label: "Inventory", icon: Boxes, view: "inventory-register" },
      { id: "bulk", label: "Bulk Upload Inventory", icon: Upload, view: "bulk-inventory" },
      { id: "reports", label: "Inventory Reports", icon: ClipboardCheck, view: "inventory-report" },
    ],
  },
  {
    label: "Safety",
    icon: ShieldCheck,
    items: [
      { id: "hse", label: "HSE", icon: ShieldCheck },
      { id: "iot", label: "IoT / BMS", icon: RadioTower },
    ],
  },
  {
    label: "Compliance & Certification",
    icon: ShieldCheck,
    items: [
      { id: "compliance", label: "Compliance Dashboard", icon: Gauge, view: "compliance-dashboard" },
      { id: "compliance", label: "Certification Register", icon: ClipboardCheck, view: "certification-register" },
      { id: "compliance", label: "Non-Compliance Management", icon: AlertTriangle, view: "compliance-non-compliance" },
      { id: "compliance", label: "Audit Calendar", icon: CalendarCheck, view: "compliance-audits" },
      { id: "compliance", label: "Expiry Alerts", icon: AlertTriangle, view: "compliance-alerts" },
    ],
  },
  {
    label: "Document Management",
    icon: FileText,
    items: [
      { id: "documents", label: "Operation & Maintenance Manuals", icon: FileText, view: "documents-om-manuals" },
      { id: "documents", label: "Equipment Warranties and Guarantees", icon: ShieldCheck, view: "documents-warranties" },
      { id: "documents", label: "Support Contracts and SLAs", icon: ClipboardCheck, view: "documents-contracts-slas" },
    ],
  },
  {
    label: "Incident & Case Management",
    icon: AlertTriangle,
    flat: true,
    items: [{ id: "incidents", label: "Incident & Case Management", icon: AlertTriangle, view: "incidents" }],
  },
  {
    label: "Resource Management",
    icon: Users,
    items: [
      { id: "resource", label: "Employees", icon: Users, view: "resource-employees" },
      { id: "resource", label: "Shift & Rotation", icon: CalendarCheck, view: "resource-shift-rotation" },
      { id: "resource", label: "Time Sheets", icon: ClipboardCheck, view: "resource-timesheets" },
    ],
  },
  {
    label: "Services",
    icon: ClipboardCheck,
    items: [
      { id: "teams", label: "Department Codes", icon: MapPinned, view: "departments" },
      { id: "teams", label: "Create Team Code", icon: Users, view: "team-code" },
      { id: "teams", label: "Service Teams", icon: Users, view: "service-teams" },
      { id: "teams", label: "Services Catalog", icon: ClipboardCheck, view: "services-catalog" },
      { id: "bulk", label: "Bulk Upload Services", icon: Upload, view: "bulk-services" },
    ],
  },
  {
    label: "Users Management",
    icon: Users,
    items: [
      { id: "users", label: "Users Management", icon: Users, view: "users-management" },
      { id: "users", label: "Roles & Permissions", icon: ShieldCheck, view: "permissions" },
    ],
  },
  {
    label: "Utilities",
    icon: Upload,
    items: [
      { id: "bulk", label: "Bulk Upload Center", icon: Upload, view: "bulk-center" },
      { id: "templates", label: "Bulk Upload Templates", icon: ClipboardCheck, view: "templates" },
      { id: "reports", label: "CSV / Excel / PDF Reports", icon: ClipboardCheck, view: "reports-export" },
    ],
  },
  {
    label: "Activity Logs",
    icon: Activity,
    items: [
      { id: "audit", label: "Audit Logs", icon: Activity },
      { id: "audit", label: "Bulk Upload Progress", icon: Upload, view: "bulk-upload-progress" },
      { id: "reports", label: "Reports Preview", icon: ClipboardCheck },
    ],
  },
];

const healthColors = ["#35a852", "#0f8b8d", "#ffd166", "#f45d48"];
const dashboardColors = ["#0f8b8d", "#f45d48", "#06d6a0", "#ffd166", "#0b1f3a", "#7c3aed", "#2563eb", "#db2777", "#64748b", "#16a34a"];
const PAGE_SIZE = 100;
const HOUSING_FIELD_CLASS = "h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-lagoon";
const FACILITY_FIELD_CLASS = "h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-lagoon";
const RESOURCE_EMPLOYEE_FIELD_CLASS = "h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-lagoon";
const TICKET_PLAN_FIELD_CLASS = "h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-lagoon";
const TICKET_PLAN_TEXTAREA_CLASS = "w-full min-w-0 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon";
const assetRegisterColumns: [string, string][] = [
  ["equipmentNo", "EQUIPMENTNO"],
  ["equipmentDesc", "EQUIPMENTDESC"],
  ["assetStatusText", "ASSETSTATUS"],
  ["eqType", "EQTYPE"],
  ["organization", "ORGANIZATION"],
  ["commissionDate", "COMMISSIONDATE"],
  ["departmentCode", "DEPARTMENT"],
  ["departmentDesc", "DEPARTMENT_DESC"],
  ["classCode", "CLASS"],
  ["classDesc", "CLASS_DESC"],
  ["category", "CATEGORY"],
  ["categoryDesc", "CATEGORY_DESC"],
  ["serialNumber", "SERIALNUMBER"],
  ["model", "MODEL"],
  ["manufacturer", "MANUFACTURER"],
  ["gsrc", "GSRC"],
  ["endOfUsefulLife", "ENDOFUSEFULLIFE"],
  ["attribute", "ATTRIBUTE"],
  ["environment", "ENVIRONMENT"],
  ["pressureBar", "PRESSURE_BAR"],
  ["flowLps", "FLOW_LPS"],
  ["supplyVoltageVolt", "SUPPLY_VOLTAGE_Volt"],
  ["outOfServiceDisplay", "OUTOFSERVICE"],
  ["serviceLife", "SERVICELIFE"],
  ["locationCode", "LOCATION"],
  ["locationDesc", "LOCATION_DESC"],
  ["position", "POSITION"],
  ["classOrganization", "CLASSORGANIZATION"],
  ["equipmentValue", "EQUIPMENTVALUE"],
  ["primarySystem", "PRIMARYSYSTEM"],
  ["additionalNote", "ADDITIONAL_NOTE"],
];
const assetTemplateHeader = assetRegisterColumns.map(([, label]) => label).join(",");
const housingAssetTemplateHeader = "Asset Code,Asset Name,Category,Description,Brand,Model,Serial Number,Status,Room Code,Room Number,Building Location,Room Location,Custodian Name,Custodian Contact,Issued To,Issued At,Transferred From,Transferred To,Transferred At,Replacement Of,Replaced At,PM Schedule,Next PM Due,Purchase Date,Supplier Name,Asset Value,Depreciation Rate,Current Value,Last Inspection At,Warranty Expiry,QR Code,Photo URLs,Movement Action,Notes";
const SHIFT_ELIGIBILITY_OPTIONS = ["Day only", "Night only", "Day & Night", "Not eligible"];
const SHIFT_TYPE_OPTIONS = ["Day", "Night", "General", "Custom"];
const ROSTER_STATUS_OPTIONS = ["Draft", "Finalized"];
const modulePermissions: Record<string, string> = {
  assets: "assets.manage",
  assetSetup: "assets.manage",
  work: "work.execute",
  helpdesk: "requests.view",
  ppm: "ppm.manage",
  users: "users.manage",
  reports: "reports.view",
  bulk: "assets.manage",
  templates: "assets.manage",
  teams: "requests.manage",
  jobPlans: "work.manage",
  locations: "requests.manage",
  inventory: "assets.manage",
  hse: "reports.view",
  iot: "reports.view",
  documents: "",
  incidents: "requests.view",
  resource: "requests.manage",
  audit: "reports.view",
  housing: "housing.view",
  compliance: "compliance.view",
};
const actionPermissionCatalog = [
  { code: "assets.manage", name: "Manage Assets", module: "Assets Management", description: "Create, edit, import and view asset history" },
  { code: "work.manage", name: "Manage Work Orders", module: "Tickets", description: "Create and update work orders" },
  { code: "work.execute", name: "Execute Work Orders", module: "Tickets", description: "Update work order status, time, photos, assets and inventory used" },
  { code: "work.assign", name: "Assign Work Orders", module: "Tickets", description: "Assign work orders to technicians or teams" },
  { code: "work.verify", name: "Verify Completed Work", module: "Tickets", description: "Approve, reject, reopen or close completed work" },
  { code: "requests.manage", name: "Manage Service Requests", module: "Tickets", description: "Create, edit, assign and convert requests to work orders" },
  { code: "requests.approve", name: "Approve or Reject Requests", module: "Tickets", description: "Review, validate, approve or reject service requests" },
  { code: "requests.view", name: "View Service Requests", module: "Tickets", description: "View assigned service requests" },
  { code: "work.view", name: "View Work Orders", module: "Tickets", description: "View work order panels and completion history" },
  { code: "ppm.manage", name: "Manage PPM", module: "Tickets", description: "Create planned preventive maintenance schedules" },
  { code: "assets.view", name: "View Assets", module: "Assets Management", description: "View asset register, history and location drill-down" },
  { code: "documents.upload", name: "Upload Document Files", module: "Document Management", description: "Upload files to document management folders. Admin only.", adminOnly: true },
  { code: "users.manage", name: "Manage Users", module: "Users Management", description: "Create users and assign roles" },
  { code: "roles.manage", name: "Manage Roles", module: "Users Management", description: "Create custom roles and permission sets" },
  { code: "reports.view", name: "View Reports", module: "Utilities", description: "Preview and download reports" },
  { code: "reception.manage", name: "Reception Desk", module: "Reception", description: "Create resident requests and view front-desk queue" },
  { code: "resident.portal", name: "Resident Portal", module: "Resident", description: "Create and track own requests" },
  { code: "housing.manage", name: "Manage Housing Operations", module: "Housing Operations", description: "Create and manage accommodation, bookings, inspections, assets and inventory" },
  { code: "housing.approve", name: "Approve Housing Requests", module: "Housing Operations", description: "Approve or reject housing bookings and escalations" },
  { code: "housing.view", name: "View Housing", module: "Housing Operations", description: "View housing dashboards, room history, reports and alerts" },
  { code: "compliance.manage", name: "Manage Compliance & Certification", module: "Compliance & Certification", description: "Create and renew statutory certificates, permits and regulatory audits" },
  { code: "compliance.view", name: "View Compliance & Certification", module: "Compliance & Certification", description: "View compliance dashboard, certificate register, expiry alerts and reports" },
];
function permissionSlug(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
}
const sectionPermissionCatalog = moduleGroups.flatMap((group) => {
  return group.items.map((item) => ({
    code: `section.${permissionSlug(group.label)}.${permissionSlug(item.label)}.view`,
    name: item.label === group.label ? `View ${group.label}` : `View ${item.label}`,
    module: group.label,
    description: `Access ${item.label} under ${group.label}.`,
  }));
});
const permissionCatalog = [...sectionPermissionCatalog, ...actionPermissionCatalog];
const statToneClasses: Record<string, string> = {
  coral: "text-coral",
  leaf: "text-leaf",
  lagoon: "text-lagoon",
  sun: "text-amber-600",
};

function cleanMessage(message: string) {
  return message
    .replaceAll("\n", " ")
    .replaceAll("{", "")
    .replaceAll("}", "")
    .replaceAll('"', "")
    .slice(0, 260);
}

function bulkModuleFromView(view: string) {
  const map: Record<string, string> = {
    "bulk-assets": "assets",
    "bulk-inventory": "inventory",
    "bulk-services": "services",
  };
  return map[view] ?? "assets";
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isDateLikeString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}(?:T|\s|$)/.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

const currencyKeyPattern = /(cost|value|price|amount|repair|replacement|salvage|depreciation|budget|expense|revenue)/i;

function isCurrencyField(keyOrLabel: string) {
  return currencyKeyPattern.test(keyOrLabel);
}

function formatCurrencyValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const text = String(value).trim().replace(/^\$\s*/, "").replace(/^SAR\s*/i, "").replace(/^ر\.س\s*/, "");
  const numeric = Number(text.replaceAll(",", ""));
  if (Number.isFinite(numeric) && text !== "") {
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return text;
}

function SaudiRiyalLogo({ className = "h-[1em] w-[1.15em]" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current align-[-0.12em] ${className}`}
      style={{
        WebkitMask: "url('/saudi-riyal-symbol.svg') center / contain no-repeat",
        mask: "url('/saudi-riyal-symbol.svg') center / contain no-repeat",
      }}
    />
  );
}

function CurrencyAmount({ value, className = "" }: { value: unknown; className?: string }) {
  const formatted = formatCurrencyValue(value);
  if (formatted === "-") return <span className={className}>-</span>;
  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`} aria-label={`${formatted} Saudi Riyals`}>
      <SaudiRiyalLogo />
      <span>{formatted}</span>
    </span>
  );
}

function minutesBetween(start?: unknown, end?: unknown) {
  if (!start || !end) return "-";
  const startTime = new Date(String(start)).getTime();
  const endTime = new Date(String(end)).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return "-";
  const minutes = Math.max(0, Math.round((endTime - startTime) / 60000));
  return `${minutes} min`;
}

function metricMinutes(start?: unknown, end?: unknown) {
  if (!start || !end) return 0;
  const startTime = new Date(String(start)).getTime();
  const endTime = new Date(String(end)).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
  return Math.max(0, Math.round((endTime - startTime) / 60000));
}

function formatDuration(minutes: number) {
  if (!minutes) return "-";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function workTimingRows(work: any): [string, unknown][] {
  return [
    ["Response Time", work.responseAt],
    ["Resolution Time", work.resolutionAt],
    ["Finish Time", work.finishedAt],
    ["Response to Resolution", minutesBetween(work.responseAt, work.resolutionAt)],
    ["Resolution to Finish", minutesBetween(work.resolutionAt, work.finishedAt)],
    ["Total Response to Finish", minutesBetween(work.responseAt, work.finishedAt)],
  ];
}

function localWorkMetric(work: any) {
  return {
    response: minutesBetween(work.createdAt, work.responseAt),
    resolution: minutesBetween(work.responseAt, work.resolutionAt),
    finish: minutesBetween(work.resolutionAt, work.finishedAt),
    total: minutesBetween(work.responseAt, work.finishedAt),
  };
}

function workMetricRows(workOrders: any[], showOnlyDelayed: boolean) {
  return workOrders
    .map((work) => {
      const timing = localWorkMetric(work);
      const delayed = timing.response === "-" || timing.resolution === "-" || timing.finish === "-";
      return {
        ...work,
        assetTag: work.asset?.tag ?? work.assetTag ?? "",
        responseMetric: timing.response,
        resolutionMetric: timing.resolution,
        finishMetric: timing.finish,
        totalMetric: timing.total,
        delayed,
      };
    })
    .filter((work) => !showOnlyDelayed || work.delayed || work.status !== "CLOSED");
}

function DetailPanel({ title, rows }: { title: string; rows: [string, unknown][] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-base font-black text-ink">{title}</h4>
      <div className="mt-3 grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[140px_1fr] gap-3 rounded-lg bg-slate-50 p-2 text-sm">
            <span className="font-black text-slate-500">{label}</span>
            <span className="min-w-0 break-words font-bold text-slate-800">{displayValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function dashboardSubtitle(role: string, department?: string | null) {
  const lower = role.toLowerCase();
  if (lower === "admin" || lower.includes("super admin")) {
    return "Admin dashboard: full visibility for service requests, work orders, PPM, users, roles, reports and analytics.";
  }
  if (lower.includes("supervisor")) {
    return `Supervisor dashboard: department-specific requests, work orders and PPM for ${department || "your department"}.`;
  }
  if (lower.includes("technician") || lower.includes("service team")) {
    return "Technician dashboard: assigned work orders, assigned requests and assigned PPM task execution.";
  }
  if (lower.includes("read") || lower.includes("viewer") || lower.includes("view only")) {
    return "Read-only dashboard: view assets, work orders and history without editing records.";
  }
  return "Requester dashboard: create and track your service requests.";
}

function roleKindLabel(role: string) {
  const lower = role.toLowerCase();
  if (lower === "admin" || lower.includes("super admin")) return "admin";
  if (lower.includes("supervisor")) return "supervisor";
  if (lower.includes("technician") || lower.includes("service team")) return "technician";
  if (lower.includes("read") || lower.includes("viewer") || lower.includes("view only")) return "readonly";
  return "requester";
}

export function CafmConsole({ data, user, deferInitialData = false }: { data: ConsoleData; user: { id?: string; name: string; email: string; role: string; department?: string | null; team?: { code: string; name?: string } | null }; deferInitialData?: boolean }) {
  const [records, setRecords] = useState(data);
  const [fullDataLoaded, setFullDataLoaded] = useState(!deferInitialData);
  const [active, setActive] = useState("command");
  const [activeView, setActiveView] = useState("dashboard");
  const [activeMenuKey, setActiveMenuKey] = useState("Dashboard-Dashboard");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [health, setHealth] = useState<{ app: string; database: string; message?: string } | null>(null);
  const [initialDataLoading, setInitialDataLoading] = useState(deferInitialData);
  const [saving, setSaving] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<BulkUploadProgressState | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      if (!deferInitialData) {
        await checkHealth();
        return;
      }
      setInitialDataLoading(true);
      try {
        await loadDashboardData();
      } finally {
        if (!cancelled) setInitialDataLoading(false);
      }
    }
    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [deferInitialData]);

  useEffect(() => {
    const jobId = bulkUploadProgress?.jobId;
    if (!jobId) return;

    const terminalStatuses = new Set(["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"]);
    let cancelled = false;
    const pollJob = async () => {
      try {
        const response = await fetch(`/api/bulk-upload?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
        const result = await response.json();
        const job = result.job;
        if (!response.ok || !job || cancelled) return;
        if (terminalStatuses.has(job.status)) {
          setBulkUploadProgress(null);
          setToast(cleanMessage(job.message ?? (job.status === "FAILED" ? "Bulk upload failed." : "Bulk upload complete.")));
          await refreshData();
          return;
        }
        setBulkUploadProgress({
          jobId: job.id,
          module: job.module,
          fileName: job.fileName,
          fileSize: job.fileSize,
          totalRows: job.totalRows,
          processedRows: job.processedRows,
          createdRows: job.createdRows,
          failedRows: job.failedRows,
          completion: job.completion,
          status: job.status,
          startedAt: job.startedAt,
          updatedAt: job.updatedAt,
          message: job.message ?? "Bulk upload is processing in the background.",
        });
      } catch {
        // Keep the current progress visible; the next poll may recover.
      }
    };

    void pollJob();
    const interval = window.setInterval(pollJob, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [bulkUploadProgress?.jobId]);

  const permissionCodes = useMemo(() => {
    return new Set(records.rolePermissions.filter((item) => item.role === user.role).map((item) => item.permission.code));
  }, [records.rolePermissions, user.role]);
  const isReadOnlyUser = roleKindLabel(user.role) === "readonly";
  const readOnlyModules = new Set(["command", "dashboard", "assets", "work", "ppm", "requests", "reports", "housing", "compliance", "documents", "incidents"]);
  const can = (permission?: string) => user.role === "Admin" || !permission || (!isReadOnlyUser && permissionCodes.has(permission));
  const canOpenModule = (moduleId: string) => (isReadOnlyUser && readOnlyModules.has(moduleId)) || can(modulePermissions[moduleId]);
  const canViewActive = canOpenModule(active);
  const isAdmin = roleKindLabel(user.role) === "admin";
  const actionPermissions = {
    manageRequests: can("requests.manage"),
    approveRequests: can("requests.approve"),
    manageWork: can("work.manage"),
    executeWork: can("work.execute"),
    verifyWork: can("work.verify"),
  };

  function navigate(moduleId: string, menuKey: string, view = moduleId) {
    if (!canOpenModule(moduleId)) {
      setToast("You do not have permission to access this module.");
      return;
    }
    setActive(moduleId);
    setActiveView(view);
    setActiveMenuKey(menuKey);
    if (!fullDataLoaded && !["command", "documents"].includes(moduleId)) {
      setInitialDataLoading(true);
      void refreshData().finally(() => setInitialDataLoading(false));
    }
  }

  async function checkHealth() {
    const response = await fetch("/api/health", { cache: "no-store" });
    const result = await response.json();
    setHealth(result);
  }

  async function refreshData() {
    const response = await fetch("/api/operating-data", { cache: "no-store" });
    if (response.ok) {
      setRecords(await response.json());
      setFullDataLoaded(true);
    }
    await checkHealth();
  }

  async function loadDashboardData() {
    const response = await fetch("/api/dashboard-data", { cache: "no-store" });
    if (response.ok) {
      setRecords(await response.json());
      setFullDataLoaded(false);
    }
    await checkHealth();
  }

  async function submitRequest(formData: FormData) {
    setSaving(true);
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch("/api/service-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setToast(response.ok ? `Service request ${result.ticketNo} created and saved.` : cleanMessage(result.message ?? "Service request failed."));
    if (response.ok) await refreshData();
    setSaving(false);
  }

  async function submitWorkOrder(formData: FormData) {
    setSaving(true);
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch("/api/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setToast(response.ok ? `Work order ${result.woNo} created and saved.` : cleanMessage(result.message ?? "Work order failed."));
    if (response.ok) await refreshData();
    setSaving(false);
  }

  async function postRecord(path: string, formData: FormData, successLabel: string, refresh = true) {
    setSaving(true);
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setToast(response.ok ? `${successLabel} saved.` : cleanMessage(result.message ?? "Action failed."));
    if (response.ok && refresh) await refreshData();
    setSaving(false);
  }

  async function bulkUpload(formData: FormData) {
    setSaving(true);
    const module = String(formData.get("module") || "bulk upload");
    const file = formData.get("file");
    const startedAt = new Date().toISOString();
    let totalRows = 0;
    let fileName = "CSV upload";
    let fileSize = 0;

    if (file instanceof File) {
      fileName = file.name;
      fileSize = file.size;
      totalRows = countCsvDataRows(await file.text());
    }

    if (canOpenModule("audit")) {
      navigate("audit", "Activity Logs-Bulk Upload Progress", "bulk-upload-progress");
    }
    setBulkUploadProgress({
      module,
      fileName,
      fileSize,
      totalRows,
      processedRows: 0,
      completion: 10,
      status: "UPLOADING",
      startedAt,
      message: "Uploading CSV file to the server.",
    });

    try {
      const response = await fetch("/api/bulk-upload", {
        method: "POST",
        body: formData,
      });
      setBulkUploadProgress((current) => current ? { ...current, processedRows: Math.max(0, Math.floor(totalRows * 0.7)), completion: 70, status: "PROCESSING", message: "Server is validating rows and creating records." } : current);
      const result = await response.json();
      if (response.status === 202 && result.jobId) {
        setBulkUploadProgress({
          jobId: result.jobId,
          module: result.module ?? module,
          fileName: result.fileName ?? fileName,
          fileSize: result.fileSize ?? fileSize,
          totalRows: result.totalRows ?? totalRows,
          processedRows: result.processedRows ?? 0,
          createdRows: result.createdRows ?? 0,
          failedRows: result.failedRows ?? 0,
          completion: result.completion ?? 0,
          status: result.status ?? "QUEUED",
          startedAt: result.startedAt ?? startedAt,
          message: result.message ?? "Bulk upload is processing in the background.",
        });
        setToast(cleanMessage(result.message ?? "Bulk upload is processing in the background."));
        return;
      }
      setBulkUploadProgress((current) => current ? { ...current, processedRows: totalRows, completion: 95, status: "FINALIZING", message: "Finalizing upload and refreshing audit logs." } : current);
      setToast(cleanMessage(result.message ?? (response.ok ? "Bulk upload complete." : "Bulk upload failed.")));
      await refreshData();
      setBulkUploadProgress(null);
    } catch (error) {
      setToast(cleanMessage(error instanceof Error ? error.message : "Bulk upload failed."));
      setBulkUploadProgress(null);
    } finally {
      setSaving(false);
    }
  }

  async function patchRecord(path: string, body: Record<string, unknown>, successLabel: string, refresh = true) {
    setSaving(true);
    const response = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setToast(response.ok ? successLabel : cleanMessage(result.message ?? "Action failed."));
    if (response.ok && refresh) await refreshData();
    setSaving(false);
  }

  async function updateAsset(id: string, formData: FormData) {
    await patchRecord(`/api/assets/${id}`, Object.fromEntries(formData.entries()) as Record<string, string>, "Asset updated by admin.");
  }

  async function deleteRecord(path: string, successLabel: string, refresh = true) {
    setSaving(true);
    const response = await fetch(path, { method: "DELETE" });
    const result = await response.json();
    setToast(response.ok ? successLabel : cleanMessage(result.message ?? "Delete failed."));
    if (response.ok && refresh) await refreshData();
    setSaving(false);
  }

  async function deleteAssets(ids: string[]) {
    setSaving(true);
    const results = await Promise.all(
      ids.map(async (id) => {
        const response = await fetch(`/api/assets/${id}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        return { ok: response.ok, message: cleanMessage(result.message ?? "Delete failed.") };
      }),
    );
    const deleted = results.filter((result) => result.ok).length;
    const failed = results.length - deleted;
    setToast(failed ? `${deleted} assets deleted. ${failed} failed: ${results.find((result) => !result.ok)?.message}` : `${deleted} assets deleted.`);
    if (deleted) await refreshData();
    setSaving(false);
  }

  async function deleteWorkOrders(ids: string[]) {
    setSaving(true);
    const results = await Promise.all(
      ids.map(async (id) => {
        const response = await fetch(`/api/work-orders/${id}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        return { ok: response.ok, message: cleanMessage(result.message ?? "Delete failed.") };
      }),
    );
    const deleted = results.filter((result) => result.ok).length;
    const failed = results.length - deleted;
    setToast(failed ? `${deleted} work orders deleted. ${failed} failed: ${results.find((result) => !result.ok)?.message}` : `${deleted} work orders deleted.`);
    if (deleted) await refreshData();
    setSaving(false);
  }

  async function convertRequestToWorkOrder(id: string, assignment: { assignedTeamCode?: string; assignedToEmail?: string; assetTag?: string } = {}) {
    setSaving(true);
    const response = await fetch(`/api/service-requests/${id}/convert-work-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assignment),
    });
    const result = await response.json();
    setToast(response.ok ? `Work order ${result.woNo} created from request.` : cleanMessage(result.message ?? "Conversion failed."));
    if (response.ok) await refreshData();
    setSaving(false);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="cafm-shell h-screen overflow-hidden bg-slate-50 text-ink">
      <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-100 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <BrandLogoMark size="sm" />
          <div className="leading-tight">
            <span className="mb-1 hidden w-fit border border-coral px-2 py-0.5 text-[9px] font-medium uppercase leading-none tracking-normal text-coral sm:block">Production System</span>
            <span className="block text-sm font-bold text-slate-900">Tamimi Global</span>
            <span className="block text-[10px] text-slate-500">CAFM system</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((current) => !current)}
          className="grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100"
          aria-label="Open navigation"
        >
          <Menu size={21} />
        </button>
      </header>

      {mobileMenuOpen && <div className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <section className="h-screen min-w-0 overflow-hidden lg:pl-72">
        <aside className={`${mobileMenuOpen ? "fixed flex flex-col" : "hidden"} inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-slate-100 bg-white scrollbar-thin lg:fixed lg:flex lg:w-72 lg:flex-col`}>
          <div className="border-b border-slate-100 p-6">
            <div className="mb-3 ml-[60px] w-[122px] border border-coral py-1 text-center text-[10px] font-medium uppercase leading-none tracking-normal text-coral">Production System</div>
            <div className="flex items-center gap-3">
              <BrandLogoMark />
              <div>
                <h1 className="text-lg font-bold leading-tight text-slate-900">Tamimi Global</h1>
                <p className="text-xs text-slate-500">CAFM system</p>
              </div>
            </div>
            <div className="mt-3 pl-[60px] font-['Arial_Narrow','Aptos_Narrow','Arial',sans-serif] font-bold leading-tight tracking-normal text-slate-950">
              <p className="text-[9px] uppercase">FADHILI BACHELOR CAMP AND GSRC</p>
              <p className="text-[8px]">Contract # 6601019711</p>
            </div>
          </div>

          <div className="m-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-700">
              <Activity size={16} />
              {initialDataLoading ? "Loading data" : health?.database === "connected" || records.live ? "Database online" : "Database issue"}
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              {health ? `Status: ${health.database}` : "Checking database..."}
            </p>
            {health?.message && <p className="mt-1 break-words text-xs text-coral">{health.message}</p>}
            <button onClick={checkHealth} className="mt-3 h-9 rounded-lg bg-white px-3 text-xs font-medium text-emerald-700 shadow-sm">
              Check DB
            </button>
          </div>

          <nav className="grid flex-1 content-start gap-1 px-4 pb-4">
            {moduleGroups.map((group) => {
              const visibleItems = group.items.filter((item) => canOpenModule(item.id));
              if (!visibleItems.length) return null;
              if ("flat" in group && group.flat) {
                const item = visibleItems[0];
                const Icon = item.icon;
                const menuKey = group.label;
                return (
                  <button
                    key={group.label}
                    onClick={() => {
                      navigate(item.id, menuKey, String("view" in item ? item.view : item.id));
                      setMobileMenuOpen(false);
                    }}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                      activeMenuKey === menuKey ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={18} className={activeMenuKey === menuKey ? "shrink-0 text-emerald-600" : "shrink-0 text-slate-500"} />
                    <span className="min-w-0 truncate">{group.label}</span>
                  </button>
                );
              }

              return (
                <details key={group.label} open={visibleItems.some((item) => `${group.label}-${item.label}` === activeMenuKey)} className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
                    <span className="flex min-w-0 items-center gap-3">
                      <group.icon size={18} className="shrink-0 text-slate-500" />
                      <span className="min-w-0 truncate">{group.label}</span>
                    </span>
                    <ChevronDown size={15} className="shrink-0 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <div className="ml-8 mt-1 grid gap-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const menuKey = `${group.label}-${item.label}`;
                      return (
                        <button
                          key={menuKey}
                          onClick={() => {
                            navigate(item.id, menuKey, String("view" in item ? item.view : item.id));
                            setMobileMenuOpen(false);
                          }}
                          className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                            activeMenuKey === menuKey ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          <Icon size={15} className={activeMenuKey === menuKey ? "shrink-0 text-emerald-600" : "shrink-0"} />
                          <span className="min-w-0 truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{user.role} / {user.department || "All departments"}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <button onClick={logout} className="mt-3 flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </aside>

        <section className="cafm-content min-h-0 min-w-0 space-y-5 overflow-auto px-3 pb-6 pt-20 scrollbar-thin sm:px-5 lg:h-screen lg:p-6">
          {active !== "command" && (
            <header className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 text-slate-900 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold uppercase text-emerald-700">Complete CAFM Suite</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">One-stop facility operations system</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-500">
                    {dashboardSubtitle(user.role, user.department)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => navigate("work", "Tickets-Work Orders")} className="flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 font-medium text-white shadow-sm transition hover:bg-emerald-700">
                    Work Orders
                  </button>
                  <button onClick={() => navigate("helpdesk", "Tickets-Service Requests")} className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 font-medium text-slate-700 shadow-sm transition hover:bg-slate-100">
                    <Smartphone size={18} />
                    Dispatch
                  </button>
                </div>
              </div>
            </header>
          )}

          {toast && <div className="rounded-lg border border-emerald-100 bg-white p-3 font-medium text-emerald-700 shadow-sm">{toast}</div>}
          {initialDataLoading && <div className="rounded-lg border border-emerald-100 bg-white p-3 font-medium text-emerald-700 shadow-sm">Loading latest dashboard data...</div>}

          {active !== "command" && (
            <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {moduleStats.map((stat) => (
                <div key={stat.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{stat.currency ? <CurrencyAmount value={stat.value} /> : stat.value}</p>
                  <p className={`mt-1 text-sm font-medium ${statToneClasses[stat.tone]}`}>{stat.delta}</p>
                </div>
              ))}
            </section>
          )}

          {!canViewActive && <AccessDenied moduleId={active} />}
          {canViewActive && active === "command" && <CommandCenter data={records} />}
          {canViewActive && active === "assets" && (
            <Assets
              assets={records.assets}
              selectedAssetId={selectedAssetId}
              setSelectedAssetId={setSelectedAssetId}
              query={query}
              setQuery={setQuery}
              saving={saving}
              submitAsset={(formData) => postRecord("/api/assets", formData, "Asset")}
              updateAsset={updateAsset}
              submitWorkOrder={submitWorkOrder}
              data={records}
              teams={records.teams}
              users={records.users}
              locations={records.locations}
              canManageAssets={can("assets.manage")}
              isAdmin={isAdmin}
              deleteAsset={(id) => deleteRecord(`/api/assets/${id}`, "Asset deleted.")}
              deleteAssets={deleteAssets}
            />
          )}
          {canViewActive && active === "work" && (
            <WorkOrders
              data={records}
              submitWorkOrder={submitWorkOrder}
              saving={saving}
              permissions={actionPermissions}
              role={user.role}
              updateWorkOrder={(id, formData) => patchRecord(`/api/work-orders/${id}`, Object.fromEntries(formData.entries()) as Record<string, string>, "Work order updated by admin.")}
              updateWorkStatus={(id, status) => patchRecord(`/api/work-orders/${id}`, { status }, `Work order marked ${status}.`)}
              deleteWorkOrder={(id) => deleteRecord(`/api/work-orders/${id}`, "Work order deleted.")}
              deleteWorkOrders={deleteWorkOrders}
            />
          )}
          {canViewActive && active === "helpdesk" && (
            <Helpdesk
              requests={records.requests}
              assets={records.assets}
              services={records.services}
              assetCategories={records.categories}
              departments={records.departments}
              teams={records.teams}
              locations={records.locations}
              submitRequest={submitRequest}
              permissions={actionPermissions}
              role={user.role}
              updateRequest={(id, formData) => patchRecord(`/api/service-requests/${id}`, Object.fromEntries(formData.entries()) as Record<string, string>, "Service request updated by admin.")}
              deleteRequest={(id) => deleteRecord(`/api/service-requests/${id}`, "Service request deleted.")}
              convertRequest={convertRequestToWorkOrder}
              saving={saving}
            />
          )}
          {canViewActive && active === "jobPlans" && <JobPlans jobPlans={records.jobPlans} jobPlansTotal={records.jobPlansTotal} services={records.services} departments={records.departments} saving={saving} isAdmin={isAdmin} submitJobPlan={(formData) => postRecord("/api/job-plans", formData, "Job plan")} deleteJobPlan={(id) => deleteRecord(`/api/job-plans?id=${encodeURIComponent(id)}`, "Job plan deleted.")} />}
          {canViewActive && active === "locations" && <Locations locations={records.locations} saving={saving} isAdmin={isAdmin} submitLocation={(formData) => postRecord("/api/locations", formData, "Location")} deleteLocation={(id) => deleteRecord(`/api/locations/${id}`, "Location deleted.")} />}
          {canViewActive && active === "assetSetup" && (
            <AssetHierarchySetup
              view={activeView}
              sites={records.sites ?? []}
              buildings={records.buildings ?? []}
              spaces={records.spaces ?? []}
              departments={records.departments}
              categories={records.categories}
              saving={saving}
              submitSite={(formData) => postRecord("/api/sites", formData, "Site")}
              submitBuilding={(formData) => postRecord("/api/buildings", formData, "Building")}
              submitSpace={(formData) => postRecord("/api/spaces", formData, "Space")}
              submitDepartment={(formData) => postRecord("/api/departments", formData, "Department")}
              submitCategory={(formData) => postRecord("/api/asset-categories", formData, "Asset category")}
            />
          )}
          {canViewActive && active === "ppm" && <Ppm ppms={records.ppms} ppmsTotal={records.ppmsTotal} assets={records.assets} locations={records.locations} workOrders={records.workOrders} saving={saving} isAdmin={isAdmin} submitPpm={(formData) => postRecord("/api/ppm", formData, "PPM")} updatePpm={(body) => patchRecord("/api/ppm", body, "PPM updated.")} deletePpm={(id) => deleteRecord(`/api/ppm?id=${encodeURIComponent(id)}`, "PPM deleted.")} />}
          {canViewActive && active === "inventory" && <Inventory inventory={records.inventory} saving={saving} isAdmin={isAdmin} submitInventory={(formData) => postRecord("/api/inventory", formData, "Inventory item")} deleteInventory={(id) => deleteRecord(`/api/inventory?id=${encodeURIComponent(id)}`, "Inventory item deleted.")} />}
          {canViewActive && active === "hse" && <Hse inspections={records.inspections} saving={saving} isAdmin={isAdmin} submitInspection={(formData) => postRecord("/api/inspections", formData, "Inspection")} deleteInspection={(id) => deleteRecord(`/api/inspections?id=${encodeURIComponent(id)}`, "Inspection deleted.")} />}
          {canViewActive && active === "compliance" && (
            <ComplianceCertification
              records={records.complianceCertificates ?? []}
              requests={records.requests}
              workOrders={records.workOrders}
              inspections={records.inspections}
              view={activeView}
              saving={saving}
              navigate={navigate}
              submitCertificate={(formData) => postRecord("/api/compliance", formData, "Compliance certificate")}
              isAdmin={isAdmin}
              deleteCertificate={(id) => deleteRecord(`/api/compliance?id=${encodeURIComponent(id)}`, "Compliance certificate deleted.")}
            />
          )}
          {canViewActive && active === "documents" && (
            <DocumentManagement
              assets={records.assets}
              services={records.services}
              workOrders={records.workOrders}
              complianceCertificates={records.complianceCertificates ?? []}
              documentUploads={records.documentUploads ?? []}
              view={activeView}
              refreshData={refreshData}
              canUploadDocuments={roleKindLabel(user.role) === "admin"}
              isAdmin={isAdmin}
              deleteDocument={(id) => deleteRecord(`/api/document-uploads?id=${encodeURIComponent(id)}`, "Document deleted.")}
              setToast={(message) => setToast(cleanMessage(message))}
            />
          )}
          {canViewActive && active === "incidents" && (
            <IncidentCaseManagement
              requests={records.requests}
              workOrders={records.workOrders}
              navigate={navigate}
            />
          )}
          {canViewActive && active === "iot" && <Iot alerts={records.alerts} saving={saving} acknowledgeAlert={(id) => patchRecord(`/api/iot-alerts/${id}`, {}, "IoT alert acknowledged.")} />}
          {canViewActive && active === "teams" && (
            <TeamsServices
              teams={records.teams}
              services={records.services}
              categories={records.categories}
              departments={records.departments}
              saving={saving}
              submitTeam={(formData) => postRecord("/api/teams", formData, "Team")}
              submitService={(formData) => postRecord("/api/services", formData, "Service")}
              submitCategory={(formData) => postRecord("/api/asset-categories", formData, "Asset category")}
              submitDepartment={(formData) => postRecord("/api/departments", formData, "Department")}
              updateTeam={(id, formData) => patchRecord(`/api/teams/${id}`, Object.fromEntries(formData.entries()) as Record<string, string>, "Team updated.")}
              updateService={(id, formData) => patchRecord(`/api/services/${id}`, Object.fromEntries(formData.entries()) as Record<string, string>, "Service updated.")}
              updateDepartment={(id, formData) => patchRecord(`/api/departments/${id}`, Object.fromEntries(formData.entries()) as Record<string, string>, "Department updated.")}
              deleteTeam={(id) => deleteRecord(`/api/teams/${id}`, "Team deleted.")}
              deleteService={(id) => deleteRecord(`/api/services/${id}`, "Service deleted.")}
              deleteDepartment={(id) => deleteRecord(`/api/departments/${id}`, "Department deleted.")}
              deleteCategory={(id) => deleteRecord(`/api/asset-categories?id=${encodeURIComponent(id)}`, "Asset category deleted.")}
              isAdmin={isAdmin}
              view={activeView}
            />
          )}
          {canViewActive && active === "bulk" && <BulkUpload saving={saving} onSubmit={bulkUpload} initialModule={bulkModuleFromView(activeView)} />}
          {canViewActive && active === "templates" && <Templates />}
          {canViewActive && active === "users" && (
            <UsersRoles
              users={records.users}
              teams={records.teams}
              departments={records.departments}
              roles={records.roles}
              currentUser={user}
              permissions={records.permissions}
              rolePermissions={records.rolePermissions}
              saving={saving}
              submitUser={(formData) => postRecord("/api/users", formData, "User", false)}
              submitRole={(formData) => postRecord("/api/roles", formData, "Custom role")}
              updateUser={(id, formData) => patchRecord(`/api/users/${id}`, Object.fromEntries(formData.entries()) as Record<string, string>, "User updated.", false)}
              deleteUser={(id) => deleteRecord(`/api/users/${id}`, "User deleted.", false)}
              deleteRole={(roleName) => deleteRecord(`/api/roles?name=${encodeURIComponent(roleName)}`, "Role deleted.")}
              isAdmin={isAdmin}
              refreshData={refreshData}
              setToast={(message) => setToast(cleanMessage(message))}
              saveRolePermissions={async (role, permissionCodes) => {
                setSaving(true);
                const response = await fetch("/api/role-permissions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ role, permissionCodes }),
                });
                const result = await response.json();
                setToast(response.ok ? "Role permissions updated." : cleanMessage(result.message ?? "Permission update failed."));
                await refreshData();
                setSaving(false);
              }}
            />
          )}
          {canViewActive && active === "reports" && <Reports />}
          {canViewActive && active === "audit" && (activeView === "bulk-upload-progress" ? <BulkUploadProgress progress={bulkUploadProgress} /> : <AuditLogs logs={records.auditLogs ?? []} />)}
          {canViewActive && active === "resource" && (
            <ResourceManagement
              employees={records.employees}
              departments={records.departments}
              teams={records.teams}
              requests={records.requests}
              workOrders={records.workOrders}
              shiftRotation={records.shiftRotation ?? { shifts: [], rotations: [], roster: [] }}
              users={records.users}
              locations={records.locations}
              view={activeView}
              saving={saving}
              navigate={navigate}
              submitEmployee={(formData) => postRecord("/api/employees", formData, "Employee")}
              submitShiftRotation={(formData) => postRecord("/api/shift-rotation", formData, "Shift / rotation")}
              refreshData={refreshData}
              isAdmin={isAdmin}
            />
          )}
          {canViewActive && active === "housing" && (
            <HousingOperations
              housing={records.housing}
              view={activeView}
              saving={saving}
              canManage={can("housing.manage")}
              canApprove={can("housing.approve")}
              isAdmin={isAdmin}
              userRole={user.role}
              submitHousing={(formData) => postRecord("/api/housing", formData, "Housing record")}
              updateHousing={(type, id, body) => patchRecord(`/api/housing/${type}/${id}`, body, "Housing record updated.")}
              deleteHousing={(type, id) => deleteRecord(`/api/housing/${type}/${id}`, "Housing record deleted.")}
              refreshData={refreshData}
            />
          )}
        </section>
      </section>
    </main>
  );
}

type DashboardEvent = {
  id: string;
  module: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  occurredAt: Date;
};

function eventDate(record: any, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function pushDashboardEvent(events: DashboardEvent[], module: string, type: string, record: any, dateKeys: string[], titleKeys: string[], status = "Tracked", priority = "Normal") {
  const occurredAt = eventDate(record, dateKeys);
  if (!occurredAt) return;
  const title = titleKeys.map((key) => record?.[key]).find(Boolean) ?? `${module} activity`;
  events.push({
    id: String(record?.id ?? `${module}-${events.length}`),
    module,
    type,
    status: String(record?.status ?? status),
    priority: String(record?.priority ?? record?.risk ?? record?.severity ?? priority),
    title: String(title),
    occurredAt,
  });
}

function buildDashboardEvents(data: ConsoleData) {
  const events: DashboardEvent[] = [];
  data.requests.forEach((record) => pushDashboardEvent(events, "Service Requests", "Request", record, ["createdAt", "updatedAt", "dueAt"], ["ticketNo", "title"], "New", "Normal"));
  data.workOrders.forEach((record) => pushDashboardEvent(events, "Work Orders", "Work Order", record, ["createdAt", "updatedAt", "dueAt", "plannedStart"], ["woNo", "title"], "Open", "Normal"));
  data.assets.forEach((record) => pushDashboardEvent(events, "Assets", "Asset", record, ["createdAt", "updatedAt", "installDate", "warrantyExpiry"], ["tag", "assetDescription", "name"], "Active", "Normal"));
  data.inventory.forEach((record) => pushDashboardEvent(events, "Inventory", "Stock Item", record, ["createdAt", "updatedAt", "lastMovementAt", "expiryDate"], ["sku", "name"], "Tracked", "Normal"));
  data.inspections.forEach((record) => pushDashboardEvent(events, "HSE", "Inspection", record, ["createdAt", "updatedAt", "dueAt"], ["code", "title"], "Scheduled", "Normal"));
  data.alerts.forEach((record) => pushDashboardEvent(events, "IoT / BMS", "Alert", record, ["detectedAt", "createdAt", "updatedAt"], ["source", "message"], "New", "Normal"));
  data.ppms.forEach((record) => pushDashboardEvent(events, "PPM Planner", "PPM", record, ["nextDue", "createdAt", "updatedAt"], ["code", "name"], record.active ? "Active" : "Paused", "Normal"));
  data.jobPlans.forEach((record) => pushDashboardEvent(events, "Job Plans", "Job Plan", record, ["createdAt", "updatedAt"], ["code", "name"], record.active ? "Active" : "Inactive", "Normal"));
  data.locations.forEach((record) => pushDashboardEvent(events, "Locations", "Location", record, ["createdAt", "updatedAt"], ["code", "description"], record.active ? "Active" : "Inactive", "Normal"));
  data.complianceCertificates.forEach((record) => pushDashboardEvent(events, "Compliance", "Certificate", record, ["createdAt", "updatedAt", "expiryDate", "issueDate"], ["certificateNo", "title"], "Active", "Normal"));
  data.documentUploads.forEach((record) => pushDashboardEvent(events, "Documents", "Document", record, ["createdAt", "updatedAt"], ["fileName", "category"], "Uploaded", "Normal"));
  data.employees.forEach((record) => pushDashboardEvent(events, "Resource", "Employee", record, ["createdAt", "updatedAt"], ["companyId", "name"], record.active ? "Active" : "Inactive", "Normal"));
  data.users.forEach((record) => pushDashboardEvent(events, "Users", "User", record, ["createdAt", "updatedAt"], ["email", "name"], record.active ? "Active" : "Inactive", "Normal"));
  data.auditLogs.forEach((record) => pushDashboardEvent(events, "Activity Logs", "Audit", record, ["createdAt"], ["action", "entity"], "Logged", "Normal"));
  data.housing.bookings.forEach((record) => pushDashboardEvent(events, "Housing Bookings", "Booking", record, ["createdAt", "updatedAt", "checkIn", "checkOut"], ["bookingNo", "residentName"], "Requested", "Normal"));
  data.housing.inspections.forEach((record) => pushDashboardEvent(events, "Housing Inspections", "Inspection", record, ["createdAt", "updatedAt", "dueAt"], ["inspectionNo", "inspectionType"], "Scheduled", "Normal"));
  data.housing.assets.forEach((record) => pushDashboardEvent(events, "Housing Assets", "Asset", record, ["createdAt", "updatedAt", "nextPmDue", "lastInspectionAt"], ["tag", "name"], "Active", "Normal"));
  data.housing.inventory.forEach((record) => pushDashboardEvent(events, "Housing Inventory", "Inventory", record, ["createdAt", "updatedAt", "lastMovementAt", "expiryDate"], ["sku", "name"], "Tracked", "Normal"));
  data.housing.approvals.forEach((record) => pushDashboardEvent(events, "Housing Approvals", "Approval", record, ["createdAt", "updatedAt"], ["approvalNo", "level"], "Pending", "Normal"));
  data.housing.notifications.forEach((record) => pushDashboardEvent(events, "Housing Alerts", "Notification", record, ["createdAt", "sentAt", "updatedAt"], ["title", "alertType"], "Sent", "Normal"));
  data.housing.history.forEach((record) => pushDashboardEvent(events, "Housing History", "History", record, ["createdAt"], ["action", "entity"], "Logged", "Normal"));
  return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

function formatDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function parseDateTimeInput(value: string, fallback: Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = getKey(item) || "Unassigned";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from(counts.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function hourlyActivity(events: DashboardEvent[]) {
  const counts = new Map<string, number>();
  events.forEach((event) => {
    const key = `${String(event.occurredAt.getHours()).padStart(2, "0")}:00`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from({ length: 24 }, (_, hour) => {
    const name = `${String(hour).padStart(2, "0")}:00`;
    return { name, activity: counts.get(name) ?? 0 };
  });
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function compactNumber(value: number) {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function CommandCenter({ data }: { data: ConsoleData }) {
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const allEvents = useMemo(() => buildDashboardEvents(data), [data]);
  const moduleOptions = useMemo(() => ["All", ...Array.from(new Set(allEvents.map((event) => event.module))).sort()], [allEvents]);
  const fromDate = fromValue ? parseDateTimeInput(fromValue, new Date(0)) : new Date(0);
  const toDate = toValue ? parseDateTimeInput(toValue, new Date(8640000000000000)) : new Date(8640000000000000);

  useEffect(() => {
    const current = new Date();
    setFromValue(formatDateTimeInput(new Date(current.getTime() - 24 * 60 * 60 * 1000)));
    setToValue(formatDateTimeInput(current));
  }, []);
  const filteredEvents = allEvents.filter((event) => {
    const timestamp = event.occurredAt.getTime();
    return timestamp >= fromDate.getTime() && timestamp <= toDate.getTime() && (moduleFilter === "All" || event.module === moduleFilter);
  });
  const moduleBreakdown = countBy(filteredEvents, (event) => event.module);
  const statusBreakdown = countBy(filteredEvents, (event) => event.status);
  const priorityBreakdown = countBy(filteredEvents, (event) => event.priority);
  const hourlyRows = hourlyActivity(filteredEvents);
  const busiestModule = moduleBreakdown[0]?.name ?? "-";
  const activeStatuses = statusBreakdown.length;
  const workOrders = data.workOrders;
  const requests = data.requests;
  const housingBookings = data.housing.bookings;
  const assets = data.assets;
  const ppms = data.ppms;
  const inventory = data.inventory;
  const openWorkOrders = workOrders.filter((work) => !["CLOSED", "COMPLETED", "VERIFIED", "REJECTED", "CANCELLED"].includes(String(work.status || "").toUpperCase())).length;
  const inProgressWorkOrders = workOrders.filter((work) => ["IN_PROGRESS", "ASSIGNED", "ACCEPTED"].includes(String(work.status || "").toUpperCase())).length;
  const completedWorkOrders = workOrders.filter((work) => ["CLOSED", "COMPLETED", "VERIFIED"].includes(String(work.status || "").toUpperCase())).length;
  const currentGuests = housingBookings.filter((booking) => ["CHECKED_IN", "APPROVED"].includes(String(booking.status || "").toUpperCase())).length;
  const duePpms = ppms.filter((ppm) => ppm.nextDue && new Date(ppm.nextDue).getTime() <= toDate.getTime()).length;
  const criticalAssets = assets.filter((asset) => ["CRITICAL", "HIGH"].includes(String(asset.criticality || "").toUpperCase())).length;
  const inventoryOnHand = inventory.reduce((total, item) => total + Number(item.onHand || 0), 0);
  const overallProgress = percent(completedWorkOrders + currentGuests + ppms.filter((ppm) => ppm.active).length, Math.max(1, workOrders.length + housingBookings.length + ppms.length));
  const openWorkPercent = percent(openWorkOrders, Math.max(1, workOrders.length));
  const inProgressPercent = percent(inProgressWorkOrders, Math.max(1, workOrders.length));
  const ppmDuePercent = percent(duePpms, Math.max(1, ppms.length));
  const assetActivePercent = percent(assets.filter((asset) => String(asset.status || "").toUpperCase() === "ACTIVE").length, Math.max(1, assets.length));
  const hourlyChart = hourlyRows.map((row) => ({
    ...row,
    work: filteredEvents.filter((event) => event.module === "Work Orders" && `${String(event.occurredAt.getHours()).padStart(2, "0")}:00` === row.name).length,
    bookings: filteredEvents.filter((event) => event.module.includes("Housing") && `${String(event.occurredAt.getHours()).padStart(2, "0")}:00` === row.name).length,
    assets: filteredEvents.filter((event) => event.module.includes("Asset") && `${String(event.occurredAt.getHours()).padStart(2, "0")}:00` === row.name).length,
    ppm: filteredEvents.filter((event) => event.module === "PPM Planner" && `${String(event.occurredAt.getHours()).padStart(2, "0")}:00` === row.name).length,
  }));
  const topCards = [
    { label: "Work Orders", icon: Wrench, tone: "bg-lagoon text-white", value: openWorkOrders, detail: "Open", sideValue: completedWorkOrders, sideLabel: "Completed" },
    { label: "Booking & Reservations", icon: CalendarCheck, tone: "bg-emerald-600 text-white", value: housingBookings.length, detail: "Total bookings", sideValue: currentGuests, sideLabel: "Current guests" },
    { label: "Asset Inventory", icon: Building2, tone: "bg-coral text-white", value: assets.length, detail: "Total assets", sideValue: compactNumber(inventoryOnHand), sideLabel: "Inventory units" },
    { label: "Planned Maintenance", icon: ClipboardCheck, tone: "bg-amber-500 text-white", value: duePpms, detail: "Due PM assets", sideValue: ppms.length, sideLabel: "Scheduled" },
    { label: "Recent Progress", icon: Activity, tone: "bg-slate-700 text-white", value: `${overallProgress}%`, detail: "Overall progress", sideValue: activeStatuses, sideLabel: "Active statuses" },
  ];
  const progressData = [
    { name: "Completed", value: completedWorkOrders },
    { name: "In Progress", value: inProgressWorkOrders },
    { name: "PPM Due", value: duePpms },
    { name: "Requests", value: requests.length },
  ];
  const workOverview = [
    { name: "Open", value: openWorkOrders },
    { name: "In Progress", value: inProgressWorkOrders },
    { name: "Completed", value: completedWorkOrders },
    { name: "Pending PPM", value: duePpms },
  ];
  const bookingBars = [
    { name: "Bookings", value: housingBookings.length },
    { name: "Guests", value: currentGuests },
    { name: "Requests", value: requests.length },
    { name: "This Range", value: filteredEvents.filter((event) => event.module.includes("Housing") || event.module === "Service Requests").length },
  ];
  const assetStatusRows = countBy(assets, (asset) => String(asset.status || "Unknown")).slice(0, 5);
  const latestRows = filteredEvents.slice(0, 12).map((event) => ({
    id: event.id,
    module: event.module,
    item: event.title,
    type: event.type,
    status: event.status,
    priority: event.priority,
    occurredAt: formatDateCell(event.occurredAt.toISOString()),
  }));

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-emerald-700">Facility Management Summary</p>
          <h3 className="mt-1 text-2xl font-black text-slate-900">Dashboard overview</h3>
          <p className="mt-2 text-sm font-bold text-slate-500">Default range is the last 24 hours, with module-level filtering.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[660px]">
          <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
            From
            <input type="datetime-local" value={fromValue} onChange={(event) => setFromValue(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case text-slate-700 outline-none focus:border-lagoon" />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
            To
            <input type="datetime-local" value={toValue} onChange={(event) => setToValue(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case text-slate-700 outline-none focus:border-lagoon" />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
            Module
            <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case text-slate-700 outline-none focus:border-lagoon">
              {moduleOptions.map((module) => <option key={module} value={module}>{module}</option>)}
            </select>
          </label>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {topCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg ${card.tone}`}>
                  <Icon size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-800">{card.label}</p>
                  <div className="mt-2 flex items-baseline justify-between gap-3">
                    <p className="text-3xl font-black text-slate-950">{card.value}</p>
                    <p className="text-2xl font-black text-slate-800">{card.sideValue}</p>
                  </div>
                  <div className="mt-1 flex justify-between gap-3 text-xs font-bold text-slate-500">
                    <span>{card.detail}</span>
                    <span>{card.sideLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <Panel title="Facility Management Summary" icon={Gauge}>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Completed Work Orders", completedWorkOrders],
              ["Current Guests", currentGuests],
              ["Inventory Units", compactNumber(inventoryOnHand)],
              ["Completed From Range", filteredEvents.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-2xl font-black text-slate-950">{value}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={hourlyChart}>
                <defs>
                  <linearGradient id="dashWork" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0f8b8d" stopOpacity={0.42} /><stop offset="100%" stopColor="#0f8b8d" stopOpacity={0.04} /></linearGradient>
                  <linearGradient id="dashBookings" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#06d6a0" stopOpacity={0.36} /><stop offset="100%" stopColor="#06d6a0" stopOpacity={0.04} /></linearGradient>
                  <linearGradient id="dashAssets" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f45d48" stopOpacity={0.34} /><stop offset="100%" stopColor="#f45d48" stopOpacity={0.04} /></linearGradient>
                  <linearGradient id="dashPpm" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ffd166" stopOpacity={0.42} /><stop offset="100%" stopColor="#ffd166" stopOpacity={0.04} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9e6ee" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="work" stroke="#0f8b8d" fill="url(#dashWork)" strokeWidth={3} />
                <Area type="monotone" dataKey="bookings" stroke="#06d6a0" fill="url(#dashBookings)" strokeWidth={3} />
                <Area type="monotone" dataKey="assets" stroke="#f45d48" fill="url(#dashAssets)" strokeWidth={3} />
                <Area type="monotone" dataKey="ppm" stroke="#d99b00" fill="url(#dashPpm)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Overall Progress" icon={Activity}>
          <div className="grid h-full content-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-black text-slate-950">{overallProgress}%</p>
              <p className="text-xs font-black uppercase text-slate-500">Overall Progress</p>
            </div>
            <div className="h-52">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={progressData.length ? progressData : [{ name: "No activity", value: 1 }]} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={4}>
                    {(progressData.length ? progressData : [{ name: "No activity", value: 1 }]).map((entry, index) => (
                      <Cell key={entry.name} fill={progressData.length ? dashboardColors[index % dashboardColors.length] : "#cbd5e1"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Work Orders Overview" icon={Wrench}>
          <div className="grid gap-4 md:grid-cols-[170px_1fr]">
            <div className="h-44">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={workOverview} dataKey="value" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={4}>
                    {workOverview.map((entry, index) => <Cell key={entry.name} fill={dashboardColors[index % dashboardColors.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid content-center gap-3">
              {[
                ["Open", openWorkOrders, openWorkPercent, "bg-lagoon"],
                ["In Progress", inProgressWorkOrders, inProgressPercent, "bg-emerald-500"],
                ["Completed", completedWorkOrders, percent(completedWorkOrders, Math.max(1, workOrders.length)), "bg-slate-700"],
                ["Pending PPM", duePpms, ppmDuePercent, "bg-amber-500"],
              ].map(([label, value, width, color]) => (
                <div key={label} className="grid gap-1">
                  <div className="flex justify-between text-sm font-black text-slate-700"><span>{value} {label}</span><span>{width}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 h-28">
            <ResponsiveContainer>
              <BarChart data={workOverview}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0f8b8d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Bookings Overview" icon={CalendarCheck}>
          <div className="grid gap-3">
            {[
              ["Total Bookings", housingBookings.length],
              ["Current Guests", currentGuests],
              ["This Range", filteredEvents.filter((event) => event.module.includes("Housing")).length],
              ["Service Requests", requests.length],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-sm font-bold text-slate-500">{label}</span>
                <span className="text-xl font-black text-slate-950">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 h-40">
            <ResponsiveContainer>
              <BarChart data={bookingBars}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#06d6a0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Asset Inventory Status" icon={Building2}>
          <div className="grid gap-4 md:grid-cols-[1fr_150px]">
            <div className="grid content-center gap-3">
              <div><p className="text-3xl font-black text-slate-950">{assets.length}</p><p className="text-sm font-bold text-slate-500">Total Assets</p></div>
              <div><p className="text-2xl font-black text-slate-950">{criticalAssets}</p><p className="text-sm font-bold text-slate-500">Critical / High</p></div>
              <div><p className="text-2xl font-black text-slate-950">{duePpms}</p><p className="text-sm font-bold text-slate-500">Due This Week</p></div>
            </div>
            <div className="h-40">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={assetStatusRows.length ? assetStatusRows : [{ name: "No assets", value: 1 }]} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={3}>
                    {(assetStatusRows.length ? assetStatusRows : [{ name: "No assets", value: 1 }]).map((entry, index) => <Cell key={entry.name} fill={assetStatusRows.length ? dashboardColors[index % dashboardColors.length] : "#cbd5e1"} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {assetStatusRows.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm font-bold text-slate-600">
                <span><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: dashboardColors[index % dashboardColors.length] }} />{item.name}</span>
                <span>{percent(item.value, Math.max(1, assets.length))}%</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_0.8fr_1.1fr_0.9fr]">
        <Panel title="Module Share" icon={LayoutDashboard}>
          <div className="h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={moduleBreakdown.length ? moduleBreakdown : [{ name: "No activity", value: 1 }]} dataKey="value" nameKey="name" innerRadius={58} outerRadius={108} paddingAngle={4}>
                  {(moduleBreakdown.length ? moduleBreakdown : [{ name: "No activity", value: 1 }]).map((entry, index) => (
                    <Cell key={entry.name} fill={moduleBreakdown.length ? dashboardColors[index % dashboardColors.length] : "#cbd5e1"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2">
            {moduleBreakdown.slice(0, 6).map((item, index) => (
              <div key={item.name} className="rounded-lg bg-slate-50 p-2 text-sm font-bold">
                <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: dashboardColors[index % dashboardColors.length] }} />
                {item.name}: {item.value}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Status Breakdown" icon={Activity}>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={statusBreakdown.slice(0, 10)} layout="vertical" margin={{ left: 18, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9e6ee" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={132} />
                <Tooltip />
                <Bar dataKey="value" fill="#06d6a0" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Asset Inventory Status" icon={Building2}>
          <DataTable
            rows={assets.slice(0, 6).map((asset) => ({ id: asset.id, facility: asset.siteCode || asset.organization || "-", building: asset.buildingCode || "-", asset: asset.assetDescription || asset.name || asset.tag, priority: asset.criticality || "-", status: asset.status || "-" }))}
            columns={[["facility", "Facility"], ["building", "Building"], ["asset", "Asset"], ["priority", "Priority"], ["status", "Status"]]}
          />
        </Panel>
        <Panel title="Recent Work Orders" icon={HardHat}>
          <DataTable
            rows={latestRows.filter((row) => row.module === "Work Orders").slice(0, 6)}
            columns={[["item", "Work Order"], ["status", "Status"], ["priority", "Priority"], ["occurredAt", "When"]]}
          />
        </Panel>
      </section>
    </section>
  );
}

function AccessDenied({ moduleId }: { moduleId: string }) {
  return (
    <Panel title="Access Restricted" icon={ShieldCheck}>
      <p className="text-sm font-bold text-slate-600">
        Your role does not have permission for {moduleId}. Update this role in Users Management / Roles & Permissions to allow access.
      </p>
    </Panel>
  );
}

function ReportButtons({ type, label = "Report" }: { type: string; label?: string }) {
  const href = (format: string) => `/api/reports?type=${encodeURIComponent(type)}&format=${format}`;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <span className="rounded-lg bg-white px-3 py-2 text-xs font-black uppercase text-slate-500 shadow-sm">{label}</span>
      <a className="rounded-lg bg-white px-3 py-2 text-xs font-black text-ink shadow-sm hover:text-lagoon" href={href("html")} target="_blank" rel="noreferrer">Preview</a>
      <a className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white shadow-sm" href={href("csv")}>CSV</a>
      <a className="rounded-lg bg-leaf px-3 py-2 text-xs font-black text-white shadow-sm" href={href("excel")}>Excel</a>
      <a className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white shadow-sm" href={href("pdf")}>PDF</a>
    </div>
  );
}

function Assets({
  assets,
  selectedAssetId,
  setSelectedAssetId,
  query,
  setQuery,
  submitAsset,
  updateAsset,
  submitWorkOrder,
  data,
  teams,
  users,
  locations,
  canManageAssets,
  isAdmin,
  deleteAsset,
  deleteAssets,
  saving,
}: {
  assets: any[];
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string) => void;
  query: string;
  setQuery: (value: string) => void;
  submitAsset: (formData: FormData) => void;
  updateAsset: (id: string, formData: FormData) => void;
  submitWorkOrder: (formData: FormData) => void;
  data: ConsoleData;
  teams: any[];
  users: any[];
  locations: any[];
  canManageAssets: boolean;
  isAdmin: boolean;
  deleteAsset: (id: string) => void;
  deleteAssets: (ids: string[]) => Promise<void>;
  saving: boolean;
}) {
  const [previewAsset, setPreviewAsset] = useState<any | null>(null);
  const [assetWorkOrderDraft, setAssetWorkOrderDraft] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterField, setFilterField] = useState("equipmentDesc");
  const [filterValue, setFilterValue] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [assetRowsSource, setAssetRowsSource] = useState<any[]>(assets);
  const [assetTotal, setAssetTotal] = useState(assets.length);
  const [assetLoading, setAssetLoading] = useState(false);
  const assetScrollRef = useRef<HTMLDivElement | null>(null);
  const assetRows = assetRowsSource.map((asset) => ({
    ...asset,
    equipmentNo: asset.tag,
    equipmentDesc: asset.assetDescription ?? asset.name,
    assetStatusText: asset.assetStatusText ?? (asset.status === "ACTIVE" ? "INSTALLED" : asset.status),
    commissionDate: formatDateCell(asset.installDate),
    endOfUsefulLife: formatDateCell(asset.replacementDate),
    outOfServiceDisplay: asset.outOfService ? "YES" : "NO",
    locationCode: asset.locationCode || asset.room || "Unassigned",
    locationDesc: asset.locationDesc ?? asset.location?.description ?? "",
    equipmentValue: asset.equipmentValue ?? asset.purchaseCost,
    primarySystem: asset.primarySystem ?? asset.system,
    additionalNote: asset.additionalNote ?? asset.remarks,
  }));
  const hasMoreAssets = assetRowsSource.length < assetTotal;
  const visibleAssets = assetRows;
  const filterOptions = assetRegisterColumns;
  const activeColumnFilterCount = Object.values(columnFilters).filter((value) => value.trim()).length;
  const selectedVisibleAssets = visibleAssets.filter((asset) => selectedAssetIds.has(asset.id));
  const allVisibleSelected = Boolean(visibleAssets.length) && selectedVisibleAssets.length === visibleAssets.length;
  const someVisibleSelected = selectedVisibleAssets.length > 0 && !allVisibleSelected;
  const locationOptionEntries: [string, { value: string; label: string }][] = [
    ...locations
      .filter((location) => Boolean(location.code))
      .map((location) => [
        String(location.code),
        {
          value: String(location.code),
          label: `${location.code} - ${location.description || location.parentLocation || location.site || location.building || "Location"}`,
        },
      ] as [string, { value: string; label: string }]),
    ...assetRows
      .map((asset) => {
        const value = asset.locationCode || [asset.buildingCode, asset.floor, asset.room].filter(Boolean).join(" / ");
        if (!value || value === "Unassigned") return null;
        return [
          String(value),
          {
            value: String(value),
            label: [asset.locationCode, asset.locationDesc, asset.buildingCode, asset.floor, asset.room].filter(Boolean).join(" - "),
          },
        ] as [string, { value: string; label: string }];
      })
      .filter((entry): entry is [string, { value: string; label: string }] => Boolean(entry)),
  ];
  const locationOptions = Array.from(new Map(locationOptionEntries).values());
  const classOptions = Array.from(new Set([...assetRows.map((asset) => asset.classCode || asset.category).filter(Boolean)]));
  const statusOptions = Array.from(new Set(assetRows.map((asset) => asset.assetStatusText).filter(Boolean)));

  useEffect(() => {
    setPage(1);
    assetScrollRef.current?.scrollTo({ top: 0 });
  }, [query, filterField, filterValue, locationFilter, locationSearch, classFilter, statusFilter, columnFilters]);

  useEffect(() => {
    setAssetRowsSource(assets);
    setAssetTotal((current) => Math.max(current, assets.length));
  }, [assets]);

  useEffect(() => {
    setSelectedAssetIds((current) => new Set(Array.from(current).filter((id) => assetRowsSource.some((asset) => asset.id === id))));
  }, [assetRowsSource]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAssetLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          query,
          filterField,
          filterValue,
          locationCode: locationFilter,
          locationQuery: locationSearch,
          class: classFilter,
          status: statusFilter,
        });
        Object.entries(columnFilters).forEach(([field, value]) => {
          const trimmed = value.trim();
          if (trimmed) params.set(`column_${field}`, trimmed);
        });
        const response = await fetch(`/api/assets/filter?${params.toString()}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          setAssetRowsSource((current) => page === 1 ? result.assets ?? [] : [...current, ...(result.assets ?? [])]);
          setAssetTotal(Number(result.total ?? result.assets?.length ?? 0));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      } finally {
        if (!controller.signal.aborted) setAssetLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [page, query, filterField, filterValue, locationFilter, locationSearch, classFilter, statusFilter, columnFilters]);

  function handleAssetScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 240;
    if (nearBottom && hasMoreAssets && !assetLoading) {
      setAssetLoading(true);
      setPage((current) => current + 1);
    }
  }

  function updateColumnFilter(field: string, value: string) {
    setColumnFilters((current) => {
      const next = { ...current, [field]: value };
      if (!value.trim()) delete next[field];
      return next;
    });
  }

  function toggleAssetSelection(id: string, checked: boolean) {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisibleAssets(checked: boolean) {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      visibleAssets.forEach((asset) => {
        if (checked) next.add(asset.id);
        else next.delete(asset.id);
      });
      return next;
    });
  }

  async function bulkDeleteSelectedAssets() {
    const ids = Array.from(selectedAssetIds);
    if (!ids.length) return;
    await deleteAssets(ids);
    setSelectedAssetIds(new Set());
  }

  return (
    <section className="grid gap-5">
      <Panel title="Assets" icon={Building2}>
        <ReportButtons type="assets" label="Assets report" />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setFilterOpen((current) => !current)} className="rounded-lg bg-lagoon px-4 py-3 text-sm font-black text-white">Filters</button>
            {isAdmin && (
              <button
                type="button"
                disabled={saving || !selectedAssetIds.size}
                onClick={bulkDeleteSelectedAssets}
                className="rounded-lg bg-coral px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"
              >
                Delete All
              </button>
            )}
          </div>
          <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 lg:max-w-md">
            <Search size={18} className="text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all asset fields" className="h-11 w-full outline-none" />
          </div>
          {canManageAssets && <button type="button" onClick={() => setCreateOpen(true)} className="flex h-11 items-center gap-2 rounded-lg bg-lagoon px-4 text-sm font-black text-white"><Plus size={16} /> Asset</button>}
        </div>
        {filterOpen && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-lift">
            <p className="text-sm font-black">Filters</p>
            <p className="mt-3 text-sm font-bold text-slate-500">In this view, show assets</p>
            <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr_auto_auto]">
              <select value={filterField} onChange={(event) => setFilterField(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
                {filterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input value={filterValue} onChange={(event) => setFilterValue(event.target.value)} placeholder="Pick up a property to filter" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
              <button type="button" onClick={() => { setFilterValue(""); setFilterOpen(false); }} className="rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-600">Cancel</button>
              <button type="button" onClick={() => setFilterOpen(false)} className="rounded-lg bg-lagoon px-4 text-sm font-black text-white">Apply</button>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">Column filters</p>
                <button type="button" onClick={() => setColumnFilters({})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-lagoon">Clear Column Filters</button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                {assetRegisterColumns.map(([key, label]) => (
                  <label key={key} className="grid gap-1 text-xs font-black uppercase text-slate-500">
                    {label}
                    <input
                      value={columnFilters[key] ?? ""}
                      onChange={(event) => updateColumnFilter(key, event.target.value)}
                      placeholder={`Search ${label}`}
                      className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold normal-case text-slate-700 outline-none focus:border-lagoon"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="mb-4 grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-5">
          <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">LOCATION</option>
            <option value="__unassigned__">Unassigned</option>
            {locationOptions.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}
          </select>
          <input value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} placeholder="Search location code / description" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-lagoon" />
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">CLASS / CATEGORY</option>
            {classOptions.map((assetClass) => <option key={assetClass} value={assetClass}>{assetClass}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">ASSETSTATUS</option>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button type="button" onClick={() => { setLocationFilter(""); setLocationSearch(""); setClassFilter(""); setStatusFilter(""); setColumnFilters({}); setFilterValue(""); }} className="h-11 rounded-lg bg-white px-3 text-sm font-black text-lagoon">Clear Filters</button>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-black text-slate-600">
          <span>Showing {visibleAssets.length.toLocaleString()} of {assetTotal.toLocaleString()} assets / Selected {selectedAssetIds.size.toLocaleString()} / Column filters {activeColumnFilterCount}</span>
          {assetLoading && <span className="text-lagoon">Loading assets...</span>}
        </div>
        <div ref={assetScrollRef} onScroll={handleAssetScroll} className="cafm-scroll-x max-h-[70vh] overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
          <table className="cafm-data-table cafm-asset-table min-w-[3600px] border-collapse bg-white text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someVisibleSelected;
                    }}
                    onChange={(event) => toggleVisibleAssets(event.target.checked)}
                  />
                </th>
                {assetRegisterColumns.map(([, label]) => <th key={label} className="px-3 py-3">{label}</th>)}
                {isAdmin && <th className="px-3 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleAssets.map((asset) => (
                <tr key={asset.id} onClick={() => { setSelectedAssetId(asset.id); setPreviewAsset(asset); }} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedAssetIds.has(asset.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => toggleAssetSelection(asset.id, event.target.checked)}
                    />
                  </td>
                  {assetRegisterColumns.map(([key, label]) => (
                    <td key={`${asset.id}-${key}`} className={`px-3 py-3 ${label === "LOCATION" ? "font-black text-lagoon" : ""}`}>
                      {label === "EQUIPMENTVALUE" ? <CurrencyAmount value={asset[key]} /> : displayValue(asset[key])}
                    </td>
                  ))}
                  {isAdmin && (
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedAssetIds((current) => {
                            const next = new Set(current);
                            next.delete(asset.id);
                            return next;
                          });
                          deleteAsset(asset.id);
                        }}
                        className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-400"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-center text-sm font-black text-slate-500">
          {hasMoreAssets ? "Scroll down to load more assets" : "All matching assets loaded"}
        </div>
      </Panel>
      {canManageAssets && createOpen && <RequestModalShell title="Add Asset" onClose={() => setCreateOpen(false)}><AssetCreateForm teams={teams} users={users} locations={locations} onSubmit={async (formData) => { await submitAsset(formData); setCreateOpen(false); }} saving={saving} /></RequestModalShell>}
      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          canManageAssets={canManageAssets}
          onClose={() => setPreviewAsset(null)}
          onEdit={() => setPreviewAsset({ ...previewAsset, editing: true })}
          onCreateWorkOrder={() => {
            setAssetWorkOrderDraft(previewAsset);
            setPreviewAsset(null);
          }}
        >
          {canManageAssets && previewAsset.editing && <AssetEditForm asset={previewAsset} teams={teams} users={users} locations={locations} saving={saving} onSubmit={(formData) => updateAsset(previewAsset.id, formData)} />}
        </AssetPreviewModal>
      )}
      {assetWorkOrderDraft && (
        <RequestModalShell title={`Create Work Order - ${assetWorkOrderDraft.assetDescription || assetWorkOrderDraft.name}`} onClose={() => setAssetWorkOrderDraft(null)}>
          <WorkOrderForm
            title="Asset Work Order"
            data={data}
            work={{
              title: `Work Order - ${assetWorkOrderDraft.assetDescription || assetWorkOrderDraft.name}`,
              type: "Corrective",
              assetType: assetWorkOrderDraft.assetGroup || assetWorkOrderDraft.category || "",
              asset: { tag: assetWorkOrderDraft.tag },
              assetTag: assetWorkOrderDraft.tag,
              departmentCode: assetWorkOrderDraft.departmentCode || "",
              assignedTeamCode: assetWorkOrderDraft.assignedTeamCode || "",
              priority: "MEDIUM",
              jobPlan: `Inspect ${assetWorkOrderDraft.assetDescription || assetWorkOrderDraft.name} at ${[assetWorkOrderDraft.buildingCode, assetWorkOrderDraft.floor, assetWorkOrderDraft.room].filter(Boolean).join(" > ") || "selected location"}. Diagnose issue, record parts used, update asset history and attach proof.`,
              safetyNotes: "Follow site safety procedures, verify access, PPE and isolation requirements.",
              estimatedHours: 2,
              cost: 0,
            }}
            onSubmit={async (formData) => {
              await submitWorkOrder(formData);
              setAssetWorkOrderDraft(null);
            }}
            saving={saving}
          />
        </RequestModalShell>
      )}
    </section>
  );
}

function AssetCreateForm({ teams, users, locations, onSubmit, saving }: { teams: any[]; users: any[]; locations: any[]; onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const equipmentNo = String(formData.get("tag") ?? "").trim();
    const equipmentDesc = String(formData.get("equipmentDesc") ?? "").trim();
    const classCode = String(formData.get("classCode") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const primarySystem = String(formData.get("primarySystem") ?? "").trim();
    const locationCode = String(formData.get("locationCode") ?? "").trim();

    formData.set("name", equipmentDesc || equipmentNo);
    formData.set("assetDescription", equipmentDesc || equipmentNo);
    formData.set("assetGroup", classCode || category || "General");
    formData.set("category", category || String(formData.get("categoryDesc") || classCode || "General"));
    formData.set("system", primarySystem || classCode || category || "General");
    formData.set("criticality", "MEDIUM");
    formData.set("conditionScore", "85");
    formData.set("room", locationCode);
    formData.set("purchaseCost", String(formData.get("equipmentValue") || ""));
    formData.set("remarks", String(formData.get("additionalNote") || ""));

    await onSubmit(formData);
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sun/50 text-amber-700">
          <PackagePlus size={20} />
        </div>
        <div>
          <h3 className="text-xl font-black">Register Asset</h3>
          <p className="text-sm font-bold text-slate-500">Manual entry using the Empty-Assets workbook headings</p>
        </div>
      </div>
      <div className="grid gap-3">
        <AssetTextField label="EQUIPMENTNO" name="tag" required />
        <AssetTextField label="EQUIPMENTDESC" name="equipmentDesc" required />
        <div className="grid gap-3 sm:grid-cols-2">
          <AssetTextField label="ASSETSTATUS" name="assetStatusText" defaultValue="INSTALLED" />
          <AssetTextField label="EQTYPE" name="eqType" defaultValue="ASSET" />
        </div>
        <AssetTextField label="ORGANIZATION" name="organization" />
        <div className="grid gap-3 sm:grid-cols-2">
          <AssetTextField label="COMMISSIONDATE" name="installDate" type="date" />
          <AssetTextField label="DEPARTMENT" name="departmentCode" />
        </div>
        <AssetTextField label="DEPARTMENT_DESC" name="departmentDesc" />
        <div className="grid gap-3 sm:grid-cols-2">
          <AssetTextField label="CLASS" name="classCode" />
          <AssetTextField label="CLASS_DESC" name="classDesc" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <AssetTextField label="CATEGORY" name="category" />
          <AssetTextField label="CATEGORY_DESC" name="categoryDesc" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <AssetTextField label="SERIALNUMBER" name="serialNumber" />
          <AssetTextField label="MODEL" name="model" />
          <AssetTextField label="MANUFACTURER" name="manufacturer" />
        </div>
        <AssetTextField label="GSRC" name="gsrc" />
        <div className="grid gap-3 sm:grid-cols-2">
          <AssetTextField label="ENDOFUSEFULLIFE" name="replacementDate" type="date" />
          <AssetTextField label="SERVICELIFE" name="serviceLife" />
        </div>
        <AssetTextField label="ATTRIBUTE" name="attribute" />
        <AssetTextField label="ENVIRONMENT" name="environment" />
        <div className="grid gap-3 sm:grid-cols-3">
          <AssetTextField label="PRESSURE_BAR" name="pressureBar" />
          <AssetTextField label="FLOW_LPS" name="flowLps" />
          <AssetTextField label="SUPPLY_VOLTAGE_Volt" name="supplyVoltageVolt" />
        </div>
        <AssetOutOfServiceSelect />
        <AssetLocationCodeSelect locations={locations} />
        <AssetTextField label="LOCATION_DESC" name="locationDesc" />
        <AssetTextField label="POSITION" name="position" />
        <AssetTextField label="CLASSORGANIZATION" name="classOrganization" />
        <AssetTextField label="EQUIPMENTVALUE" name="equipmentValue" type="number" />
        <AssetTextField label="PRIMARYSYSTEM" name="primarySystem" />
        <AssetTextField label="ADDITIONAL_NOTE" name="additionalNote" />
        <AssetAssignmentFields teams={teams} users={users} />
        <button disabled={saving} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
          <Plus size={18} />
          {saving ? "Saving..." : "Save Asset"}
        </button>
      </div>
    </form>
  );
}

function AssetTextField({ label, name, required = false, defaultValue = "", type = "text" }: { label: string; name: string; required?: boolean; defaultValue?: string; type?: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-600">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon"
      />
    </label>
  );
}

function AssetOutOfServiceSelect({ defaultValue = "NO" }: { defaultValue?: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-600">
      OUTOFSERVICE
      <select name="outOfService" defaultValue={defaultValue} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-lagoon">
        <option value="NO">NO</option>
        <option value="YES">YES</option>
      </select>
    </label>
  );
}

function AssetLocationCodeSelect({
  locations,
  defaultValue = "",
}: {
  locations: any[];
  defaultValue?: string;
}) {
  const fieldClass = "h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-lagoon";
  const options = Array.from(new Map(locations.filter((location) => location.code).map((location) => [location.code, location])).values());

  return (
    <label className="grid gap-1 text-sm font-bold text-slate-600">
      LOCATION
      <input name="locationCode" defaultValue={defaultValue} list="asset-location-codes" placeholder="Type or select LOCATION code" className={fieldClass} />
      <datalist id="asset-location-codes">
        {options.map((location) => <option key={location.id ?? location.code} value={location.code}>{location.description || location.code}</option>)}
      </datalist>
    </label>
  );
}

function AssetAssignmentFields({
  teams,
  users,
  defaultTeam = "",
  defaultSupervisor = "",
}: {
  teams: any[];
  users: any[];
  defaultTeam?: string;
  defaultSupervisor?: string;
}) {
  const supervisors = users.filter((user) => String(user.role ?? "").toLowerCase().includes("supervisor") || String(user.role ?? "").toLowerCase().includes("admin"));
  const fieldClass = "h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-lagoon";

  return (
    <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-bold text-slate-600">
        Assigned Team
        <select name="assignedTeamCode" defaultValue={defaultTeam} className={fieldClass}>
          <option value="">Unassigned</option>
          {teams.map((team) => <option key={team.id ?? team.code} value={team.code}>{team.code} - {team.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-600">
        Assigned Supervisor
        <select name="assignedSupervisorEmail" defaultValue={defaultSupervisor} className={fieldClass}>
          <option value="">Unassigned</option>
          {supervisors.map((user) => <option key={user.id ?? user.email} value={user.email}>{user.name || user.email} / {user.department || "All departments"}</option>)}
        </select>
      </label>
    </div>
  );
}

function AssetHistoryPanel({ asset }: { asset: any }) {
  return (
    <Panel title="Asset History" icon={CalendarCheck}>
      <div className="grid gap-2">
        {(asset.history ?? []).length === 0 && <p className="text-sm text-slate-500">No history recorded yet.</p>}
        {(asset.history ?? []).map((event: any) => (
          <div key={event.id} className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-black">{event.title}</p>
              <span className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{event.details}</p>
            <p className="mt-1 text-xs font-bold text-lagoon">{event.eventType} / {event.actor}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AssetIdentity({ asset }: { asset: any }) {
  const bars = String(asset.tag)
    .split("")
    .slice(0, 22)
    .map((char: string, index: number) => ((char.charCodeAt(0) + index) % 4) + 1);
  const purchase = Number(asset.purchaseCost ?? 0);
  const salvage = Number(asset.salvageValue ?? 0);
  const annualRate = Number(asset.depreciationRate ?? 0) / 100;
  const ageYears = Math.max(0, (Date.now() - new Date(asset.installDate ?? Date.now()).getTime()) / (365 * 24 * 60 * 60 * 1000));
  const bookValue = Math.max(salvage, purchase - purchase * annualRate * ageYears);

  return (
    <Panel title="Asset Identification" icon={ClipboardCheck}>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase text-slate-500">QR / Barcode Payload</p>
        <p className="mt-1 break-words font-black text-lagoon">{asset.qrCode ?? `CAFM-ASSET:${asset.tag}`}</p>
        <div className="mt-4 flex h-20 items-end gap-1 rounded-lg bg-white p-3">
          {bars.map((width, index) => (
            <span key={`${asset.tag}-${index}`} className="h-full bg-ink" style={{ width }} />
          ))}
        </div>
        <div className="mt-4 grid gap-2 text-sm text-slate-700">
          <span>EQUIPMENTNO: {asset.tag ?? "-"}</span>
          <span>EQUIPMENTDESC: {asset.assetDescription ?? asset.name ?? "-"}</span>
          <span>ASSETSTATUS: {asset.assetStatusText ?? asset.status ?? "-"}</span>
          <span>EQTYPE: {asset.eqType ?? "-"}</span>
          <span>ORGANIZATION: {asset.organization ?? "-"}</span>
          <span>DEPARTMENT: {asset.departmentCode ?? "-"}</span>
          <span>DEPARTMENT_DESC: {asset.departmentDesc ?? "-"}</span>
          <span>CLASS: {asset.classCode ?? asset.assetGroup ?? "-"}</span>
          <span>CLASS_DESC: {asset.classDesc ?? "-"}</span>
          <span>CATEGORY: {asset.category ?? "-"}</span>
          <span>CATEGORY_DESC: {asset.categoryDesc ?? "-"}</span>
          <span>SERIALNUMBER: {asset.serialNumber ?? "-"}</span>
          <span>MODEL / MANUFACTURER: {asset.model ?? "-"} / {asset.manufacturer ?? "-"}</span>
          <span>LOCATION: {asset.locationCode ?? asset.room ?? "-"}</span>
          <span>LOCATION_DESC: {asset.locationDesc ?? "-"}</span>
          <span>PRIMARYSYSTEM: {asset.primarySystem ?? asset.system ?? "-"}</span>
          <span>ADDITIONAL_NOTE: {asset.additionalNote ?? asset.remarks ?? "-"}</span>
          <span>Warranty: {asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : "-"}</span>
          <span>Contract: {asset.contractRef ?? "-"}</span>
          <span>Book value: <CurrencyAmount value={bookValue} /></span>
        </div>
      </div>
    </Panel>
  );
}

function AssetEditForm({ asset, teams, users, locations, saving, onSubmit }: { asset: any; teams: any[]; users: any[]; locations: any[]; saving: boolean; onSubmit: (formData: FormData) => void }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const equipmentNo = String(formData.get("tag") ?? "").trim();
    const equipmentDesc = String(formData.get("equipmentDesc") ?? "").trim();
    const classCode = String(formData.get("classCode") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const primarySystem = String(formData.get("primarySystem") ?? "").trim();
    const locationCode = String(formData.get("locationCode") ?? "").trim();
    formData.set("name", equipmentDesc || equipmentNo);
    formData.set("assetDescription", equipmentDesc || equipmentNo);
    formData.set("assetGroup", classCode || category || "General");
    formData.set("category", category || String(formData.get("categoryDesc") || classCode || "General"));
    formData.set("system", primarySystem || classCode || category || "General");
    formData.set("room", locationCode);
    formData.set("purchaseCost", String(formData.get("equipmentValue") || ""));
    formData.set("remarks", String(formData.get("additionalNote") || ""));
    await onSubmit(formData);
  }

  const textValue = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  const dateValue = (value: unknown) => (value ? new Date(String(value)).toISOString().slice(0, 10) : "");

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <h3 className="text-xl font-black">Admin Edit Asset</h3>
      <p className="mt-1 text-sm font-bold text-slate-500">Same structure as the Empty-Assets workbook.</p>
      <div className="mt-4 grid gap-4">
        <div>
          <p className="mb-3 text-xs font-black uppercase text-lagoon">Asset Register Fields</p>
          <div className="grid gap-3">
            <EditField label="EQUIPMENTNO" name="tag" defaultValue={textValue(asset.tag)} required />
            <EditField label="EQUIPMENTDESC" name="equipmentDesc" defaultValue={textValue(asset.assetDescription ?? asset.name)} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="ASSETSTATUS" name="assetStatusText" defaultValue={textValue(asset.assetStatusText ?? (asset.status === "ACTIVE" ? "INSTALLED" : asset.status))} />
              <EditField label="EQTYPE" name="eqType" defaultValue={textValue(asset.eqType ?? "ASSET")} />
            </div>
            <EditField label="ORGANIZATION" name="organization" defaultValue={textValue(asset.organization)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="COMMISSIONDATE" name="installDate" type="date" defaultValue={dateValue(asset.installDate)} />
              <EditField label="DEPARTMENT" name="departmentCode" defaultValue={textValue(asset.departmentCode)} />
            </div>
            <EditField label="DEPARTMENT_DESC" name="departmentDesc" defaultValue={textValue(asset.departmentDesc)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="CLASS" name="classCode" defaultValue={textValue(asset.classCode ?? asset.assetGroup)} />
              <EditField label="CLASS_DESC" name="classDesc" defaultValue={textValue(asset.classDesc)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="CATEGORY" name="category" defaultValue={textValue(asset.category)} />
              <EditField label="CATEGORY_DESC" name="categoryDesc" defaultValue={textValue(asset.categoryDesc)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <EditField label="SERIALNUMBER" name="serialNumber" defaultValue={textValue(asset.serialNumber)} />
              <EditField label="MODEL" name="model" defaultValue={textValue(asset.model)} />
              <EditField label="MANUFACTURER" name="manufacturer" defaultValue={textValue(asset.manufacturer)} />
            </div>
            <EditField label="GSRC" name="gsrc" defaultValue={textValue(asset.gsrc)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="ENDOFUSEFULLIFE" name="replacementDate" type="date" defaultValue={dateValue(asset.replacementDate)} />
              <EditField label="SERVICELIFE" name="serviceLife" defaultValue={textValue(asset.serviceLife)} />
            </div>
            <EditField label="ATTRIBUTE" name="attribute" defaultValue={textValue(asset.attribute)} />
            <EditField label="ENVIRONMENT" name="environment" defaultValue={textValue(asset.environment)} />
            <div className="grid gap-3 sm:grid-cols-3">
              <EditField label="PRESSURE_BAR" name="pressureBar" defaultValue={textValue(asset.pressureBar)} />
              <EditField label="FLOW_LPS" name="flowLps" defaultValue={textValue(asset.flowLps)} />
              <EditField label="SUPPLY_VOLTAGE_Volt" name="supplyVoltageVolt" defaultValue={textValue(asset.supplyVoltageVolt)} />
            </div>
            <AssetOutOfServiceSelect defaultValue={asset.outOfService ? "YES" : "NO"} />
            <AssetLocationCodeSelect locations={locations} defaultValue={textValue(asset.locationCode ?? asset.room)} />
            <EditField label="LOCATION_DESC" name="locationDesc" defaultValue={textValue(asset.locationDesc)} />
            <EditField label="POSITION" name="position" defaultValue={textValue(asset.position)} />
            <EditField label="CLASSORGANIZATION" name="classOrganization" defaultValue={textValue(asset.classOrganization)} />
            <EditField label="EQUIPMENTVALUE" name="equipmentValue" type="number" defaultValue={textValue(asset.equipmentValue ?? asset.purchaseCost)} />
            <EditField label="PRIMARYSYSTEM" name="primarySystem" defaultValue={textValue(asset.primarySystem ?? asset.system)} />
            <EditField label="ADDITIONAL_NOTE" name="additionalNote" defaultValue={textValue(asset.additionalNote ?? asset.remarks)} />
            <AssetAssignmentFields teams={teams} users={users} defaultTeam={textValue(asset.assignedTeamCode)} defaultSupervisor={textValue(asset.assignedSupervisorEmail)} />
          </div>
        </div>
        <button disabled={saving} className="h-11 rounded-lg bg-coral font-black text-white disabled:bg-slate-400">Save Admin Changes</button>
      </div>
    </form>
  );
}

function EditField({ label, name, defaultValue, required = false, type = "text" }: { label: string; name: string; defaultValue: string; required?: boolean; type?: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-600">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        min={type === "number" && name === "conditionScore" ? 0 : undefined}
        max={type === "number" && name === "conditionScore" ? 100 : undefined}
        defaultValue={defaultValue}
        className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lagoon"
      />
    </label>
  );
}

function WorkOrders({
  data,
  submitWorkOrder,
  saving,
  permissions,
  role,
  updateWorkOrder,
  updateWorkStatus,
  deleteWorkOrder,
  deleteWorkOrders,
}: {
  data: ConsoleData;
  submitWorkOrder: (formData: FormData) => void;
  saving: boolean;
  permissions: ActionPermissions;
  role: string;
  updateWorkOrder: (id: string, formData: FormData) => Promise<void> | void;
  updateWorkStatus: (id: string, status: string) => Promise<void> | void;
  deleteWorkOrder: (id: string) => Promise<void> | void;
  deleteWorkOrders: (ids: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewWork, setPreviewWork] = useState<any | null>(null);
  const [reviewWork, setReviewWork] = useState<{ work: any; action: "close" | "reopen" } | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(data.workOrders[0]?.id ?? null);
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());
  const [workAction, setWorkAction] = useState<string | null>(null);
  const [showTimeMetrics, setShowTimeMetrics] = useState(false);
  const [showOnlyDelayed, setShowOnlyDelayed] = useState(false);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [assignedFilter, setAssignedFilter] = useState("All");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [page, setPage] = useState(1);
  const [workRowsSource, setWorkRowsSource] = useState<any[]>(data.workOrders);
  const [workTotal, setWorkTotal] = useState(data.workOrdersTotal ?? data.workOrders.length);
  const [workLoading, setWorkLoading] = useState(false);
  const workScrollRef = useRef<HTMLDivElement | null>(null);
  const isTechnician = roleKindLabel(role) === "technician";
  const isAdmin = roleKindLabel(role) === "admin";
  const canAssignOrEdit = permissions.manageWork && !isTechnician;
  const canExecute = permissions.executeWork;
  const canFinalReview = permissions.verifyWork && !isTechnician;
  const statuses = ["All", ...Array.from(new Set(workRowsSource.map((work) => work.status).filter(Boolean)))];
  const categories = ["All", ...Array.from(new Set(workRowsSource.map((work) => work.assetType).filter(Boolean)))];
  const departments = ["All", ...Array.from(new Set(workRowsSource.map((work) => work.departmentCode).filter(Boolean)))];
  const types = ["All", ...Array.from(new Set(workRowsSource.map((work) => work.type).filter(Boolean)))];
  const teams = ["All", ...Array.from(new Set(workRowsSource.map((work) => work.assignedTeamCode).filter(Boolean)))];
  const visibleWorks = useMemo(() => showTimeMetrics ? workMetricRows(workRowsSource, showOnlyDelayed) : workRowsSource, [workRowsSource, showTimeMetrics, showOnlyDelayed]);
  const selectedWork = visibleWorks.find((work) => work.id === selectedWorkId) ?? visibleWorks[0] ?? workRowsSource[0] ?? data.workOrders[0];
  const hasMoreWorks = workRowsSource.length < workTotal;
  const selectedVisibleWorks = visibleWorks.filter((work) => selectedWorkIds.has(work.id));
  const allVisibleWorksSelected = Boolean(visibleWorks.length) && selectedVisibleWorks.length === visibleWorks.length;
  const someVisibleWorksSelected = selectedVisibleWorks.length > 0 && !allVisibleWorksSelected;

  useEffect(() => {
    if (visibleWorks.length && !visibleWorks.some((work) => work.id === selectedWorkId)) {
      setSelectedWorkId(visibleWorks[0].id);
    }
  }, [visibleWorks, selectedWorkId]);

  useEffect(() => {
    setPage(1);
    workScrollRef.current?.scrollTo({ top: 0 });
  }, [search, statusFilter, priorityFilter, categoryFilter, departmentFilter, typeFilter, assignedFilter, overdueOnly, showTimeMetrics, showOnlyDelayed]);

  useEffect(() => {
    setWorkRowsSource(data.workOrders);
    setWorkTotal((current) => Math.max(current, data.workOrdersTotal ?? data.workOrders.length));
  }, [data.workOrders, data.workOrdersTotal]);

  useEffect(() => {
    setSelectedWorkIds((current) => new Set(Array.from(current).filter((id) => workRowsSource.some((work) => work.id === id))));
  }, [workRowsSource]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const defaultFilters = page === 1 && !search && statusFilter === "All" && priorityFilter === "All" && categoryFilter === "All" && departmentFilter === "All" && typeFilter === "All" && assignedFilter === "All" && !overdueOnly && !showOnlyDelayed;
      if (defaultFilters && data.workOrders.length) {
        setWorkRowsSource(data.workOrders);
        setWorkTotal(data.workOrdersTotal ?? data.workOrders.length);
        setWorkLoading(false);
        return;
      }
      setWorkLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          query: search,
          status: statusFilter,
          priority: priorityFilter,
          category: categoryFilter,
          department: departmentFilter,
          type: typeFilter,
          assigned: assignedFilter,
          overdueOnly: overdueOnly ? "true" : "false",
          delayedOnly: showTimeMetrics && showOnlyDelayed ? "true" : "false",
        });
        const response = await fetch(`/api/work-orders?${params.toString()}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          setWorkRowsSource((current) => page === 1 ? result.workOrders ?? [] : [...current, ...(result.workOrders ?? [])]);
          setWorkTotal(Number(result.total ?? result.workOrders?.length ?? 0));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      } finally {
        if (!controller.signal.aborted) setWorkLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [page, search, statusFilter, priorityFilter, categoryFilter, departmentFilter, typeFilter, assignedFilter, overdueOnly, showTimeMetrics, showOnlyDelayed]);

  function handleWorkScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 240;
    if (nearBottom && hasMoreWorks && !workLoading) {
      setWorkLoading(true);
      setPage((current) => current + 1);
    }
  }

  async function runWorkAction(key: string, work: any, action: () => Promise<void> | void) {
    setSelectedWorkId(work.id);
    setWorkAction(key);
    try {
      await action();
    } finally {
      setWorkAction(null);
    }
  }

  async function quickPatchWork(work: any, body: Record<string, string>) {
    const formData = new FormData();
    Object.entries(body).forEach(([key, value]) => formData.append(key, value));
    await updateWorkOrder(work.id, formData);
    const previewBody = Object.fromEntries(Object.entries(body).map(([key, value]) => [key, key === "isIncidentCase" ? value === "true" : value]));
    setPreviewWork((current: any) => current?.id === work.id ? { ...current, ...previewBody } : current);
  }

  async function toggleIncidentCase(work: any, checked: boolean) {
    await quickPatchWork(work, { isIncidentCase: checked ? "true" : "false" });
  }

  function toggleWorkSelection(id: string, checked: boolean) {
    setSelectedWorkIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisibleWorks(checked: boolean) {
    setSelectedWorkIds((current) => {
      const next = new Set(current);
      visibleWorks.forEach((work) => {
        if (checked) next.add(work.id);
        else next.delete(work.id);
      });
      return next;
    });
  }

  async function bulkDeleteSelectedWorks() {
    const ids = Array.from(selectedWorkIds);
    if (!ids.length) return;
    await deleteWorkOrders(ids);
    setSelectedWorkIds(new Set());
  }

  return (
    <section className="space-y-5">
      <Panel title="Work Orders" icon={Wrench}>
        <ReportButtons type="work-orders" label="Work orders report" />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setView("list")} className={`h-10 rounded-lg px-4 text-sm font-black ${view === "list" ? "bg-lagoon text-white" : "bg-slate-50 text-slate-600"}`}>List</button>
            <button type="button" onClick={() => setView("calendar")} className={`h-10 rounded-lg px-4 text-sm font-black ${view === "calendar" ? "bg-lagoon text-white" : "bg-slate-50 text-slate-600"}`}>Calendar</button>
            {isAdmin && view === "list" && (
              <button
                type="button"
                disabled={saving || !selectedWorkIds.size}
                onClick={bulkDeleteSelectedWorks}
                className="h-10 rounded-lg bg-coral px-4 text-sm font-black text-white disabled:bg-slate-300"
              >
                Delete All
              </button>
            )}
          </div>
          <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 lg:max-w-md">
            <Search size={16} className="text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Work Orders" className="h-11 w-full text-sm outline-none" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedWork && (
              <label className="flex h-10 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800">
                <input
                  type="checkbox"
                  checked={Boolean(selectedWork.isIncidentCase)}
                  onChange={(event) => toggleIncidentCase(selectedWork, event.target.checked)}
                />
                Incident / Case
              </label>
            )}
            <button type="button" onClick={() => setShowTimeMetrics((current) => !current)} className={`h-10 rounded-lg px-3 text-sm font-black ${showTimeMetrics ? "bg-lagoon text-white" : "bg-slate-50 text-lagoon"}`}>KPIs</button>
            {canAssignOrEdit && <button type="button" onClick={() => { setEditing(null); setCreateOpen(true); }} className="flex h-10 items-center gap-2 rounded-lg bg-lagoon px-4 text-sm font-black text-white"><Plus size={16} /> Work Order</button>}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3">
            {statuses.map((status) => <option key={status} value={status}>{status === "All" ? "Status" : status}</option>)}
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3">
            <option value="All">Priority</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3">
            {categories.map((category) => <option key={category} value={category}>{category === "All" ? "Category" : category}</option>)}
          </select>
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3">
            {departments.map((department) => <option key={department} value={department}>{department === "All" ? "DPT" : department}</option>)}
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3">
            {types.map((type) => <option key={type} value={type}>{type === "All" ? "Work Type" : type}</option>)}
          </select>
          <select value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3">
            <option value="All">Assigned to</option>
            <option value="Not Assigned">Not Assigned</option>
            {teams.filter((team) => team !== "All").map((team) => <option key={team} value={team}>{team}</option>)}
          </select>
          <button type="button" onClick={() => setAssignedFilter("Not Assigned")} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-lagoon">Not Assigned</button>
          <button type="button" onClick={() => setOverdueOnly((current) => !current)} className={`h-10 rounded-lg px-3 ${overdueOnly ? "bg-coral text-white" : "border border-slate-200 bg-white text-lagoon"}`}>Overdue & Due Today</button>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showTimeMetrics} onChange={(event) => setShowTimeMetrics(event.target.checked)} /> Show Time Metrics</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showOnlyDelayed} onChange={(event) => setShowOnlyDelayed(event.target.checked)} /> Show Only Delayed</label>
          <button type="button" onClick={() => { setSearch(""); setStatusFilter("All"); setPriorityFilter("All"); setCategoryFilter("All"); setDepartmentFilter("All"); setTypeFilter("All"); setAssignedFilter("All"); setOverdueOnly(false); }} className="ml-auto h-10 rounded-lg bg-white px-3 text-lagoon">Clear all</button>
        </div>
        {view === "list" ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-black text-slate-600">
              <span>Showing {visibleWorks.length.toLocaleString()} of {workTotal.toLocaleString()} work orders / Selected {selectedWorkIds.size.toLocaleString()}</span>
              {workLoading && <span className="text-lagoon">Loading work orders...</span>}
            </div>
            <div ref={workScrollRef} onScroll={handleWorkScroll} className="cafm-scroll-x max-h-[70vh] overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
              <table className="cafm-data-table min-w-[1880px] border-collapse bg-white text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleWorksSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someVisibleWorksSelected;
                        }}
                        onChange={(event) => toggleVisibleWorks(event.target.checked)}
                      />
                    </th>
                    <th className="px-3 py-3 font-black">#</th>
                    <th className="px-3 py-3 font-black">Title</th>
                    <th className="px-3 py-3 font-black">Status</th>
                    <th className="px-3 py-3 font-black">Priority</th>
                    <th className="px-3 py-3 font-black">Category</th>
                    <th className="px-3 py-3 font-black">DPT</th>
                    <th className="px-3 py-3 font-black">Due Date</th>
                    <th className="px-3 py-3 font-black">Asset</th>
                    <th className="px-3 py-3 font-black">Location</th>
                    <th className="px-3 py-3 font-black">Work Type</th>
                    <th className="px-3 py-3 font-black">Description</th>
                    <th className="px-3 py-3 font-black">Created when</th>
                    <th className="px-3 py-3 font-black">Assigned To</th>
                    <th className="px-3 py-3 font-black">Updated when</th>
                    <th className="px-3 py-3 font-black">Schedule</th>
                    <th className="px-3 py-3 font-black">Incident / Case</th>
                    <th className="px-3 py-3 font-black">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleWorks.map((work, index) => (
                    <tr key={work.id} onClick={() => { setSelectedWorkId(work.id); setPreviewWork(work); }} className={`cursor-pointer border-t border-slate-100 align-top ${selectedWork?.id === work.id ? "bg-lagoon/5" : "hover:bg-slate-50"}`}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedWorkIds.has(work.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => toggleWorkSelection(work.id, event.target.checked)}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-black text-slate-500">{index + 1}</td>
                      <td className="max-w-[280px] px-3 py-3"><div className="font-black">{work.title}</div><div className="mt-1 text-xs font-bold text-slate-500">{work.woNo}</div></td>
                      <td className="whitespace-nowrap px-3 py-3"><WorkOrderStatusBadge status={work.status} /></td>
                      <td className="whitespace-nowrap px-3 py-3"><RequestPriorityBadge priority={work.priority} /></td>
                      <td className="whitespace-nowrap px-3 py-3">{work.assetType || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3">{work.departmentCode || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatDateCell(work.dueAt)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-lagoon">{work.asset?.tag ?? work.assetTag ?? "-"}</td>
                      <td className="max-w-[260px] px-3 py-3 text-slate-600">{work.asset?.buildingCode || work.asset?.floor || work.location || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3">{work.type || "-"}</td>
                      <td className="max-w-[320px] px-3 py-3 text-slate-600"><div className="line-clamp-2">{work.jobPlan || work.workNotes || work.title}</div></td>
                      <td className="whitespace-nowrap px-3 py-3">{formatDateCell(work.createdAt)}</td>
                      <td className="whitespace-nowrap px-3 py-3">{work.assignedTo?.email ?? work.assignedTeamCode ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatDateCell(work.updatedAt)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-lagoon">{formatDateCell(work.plannedStart)}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <label className="flex items-center gap-2 text-xs font-black text-slate-600" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={Boolean(work.isIncidentCase)}
                            onChange={(event) => toggleIncidentCase(work, event.target.checked)}
                          />
                          Incident / Case
                        </label>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-[300px] flex-wrap gap-2">
                          <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedWorkId(work.id); setPreviewWork(work); }} className="rounded-lg bg-white px-3 py-2 text-xs font-black text-lagoon ring-1 ring-lagoon/30">Preview</button>
                          {canAssignOrEdit && work.status !== "CLOSED" && <button type="button" disabled={workAction === `${work.id}:edit`} onClick={(event) => { event.stopPropagation(); setSelectedWorkId(work.id); setEditing(work); }} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">Edit</button>}
                          {canExecute && work.status !== "CLOSED" && work.status !== "PENDING_SUPERVISOR_REVIEW" && <button type="button" disabled={workAction === `${work.id}:start`} onClick={(event) => { event.stopPropagation(); runWorkAction(`${work.id}:start`, work, () => updateWorkStatus(work.id, "IN_PROGRESS")); }} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">In Progress</button>}
                          {canExecute && work.status !== "CLOSED" && work.status !== "PENDING_SUPERVISOR_REVIEW" && <button type="button" disabled={workAction === `${work.id}:hold`} onClick={(event) => { event.stopPropagation(); runWorkAction(`${work.id}:hold`, work, () => updateWorkStatus(work.id, "ON_HOLD")); }} className="rounded-lg bg-slate-500 px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">On Hold</button>}
                          {canExecute && work.status !== "CLOSED" && work.status !== "PENDING_SUPERVISOR_REVIEW" && <button type="button" disabled={workAction === `${work.id}:complete`} onClick={(event) => { event.stopPropagation(); runWorkAction(`${work.id}:complete`, work, () => updateWorkStatus(work.id, "COMPLETED")); }} className="rounded-lg bg-leaf px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">Submit Review</button>}
                          {canFinalReview && ["PENDING_SUPERVISOR_REVIEW", "COMPLETED"].includes(work.status) && <button type="button" disabled={workAction === `${work.id}:close`} onClick={(event) => { event.stopPropagation(); setSelectedWorkId(work.id); setReviewWork({ work, action: "close" }); }} className="rounded-lg bg-ink px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">Close Work Order</button>}
                          {canFinalReview && ["PENDING_SUPERVISOR_REVIEW", "COMPLETED"].includes(work.status) && <button type="button" disabled={workAction === `${work.id}:reopen`} onClick={(event) => { event.stopPropagation(); setSelectedWorkId(work.id); setReviewWork({ work, action: "reopen" }); }} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">Reopen</button>}
                          {isAdmin && work.status !== "CLOSED" && <button type="button" disabled={workAction === `${work.id}:delete`} onClick={(event) => { event.stopPropagation(); runWorkAction(`${work.id}:delete`, work, () => deleteWorkOrder(work.id)); }} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-center text-sm font-black text-slate-500">
              {hasMoreWorks ? "Scroll down to load more work orders" : "All matching work orders loaded"}
            </div>
          </>
        ) : (
          <WorkOrderCalendar works={visibleWorks} monthDate={monthDate} setMonthDate={setMonthDate} setSelectedWorkId={setSelectedWorkId} />
        )}
        {selectedWork && (
          <div className="mt-5">
            <DetailPanel
              title={`Selected Work Order: ${selectedWork.woNo}`}
              rows={[
                ["Title", selectedWork.title],
                ["Status", selectedWork.status],
                ["Priority", selectedWork.priority],
                ["Department", selectedWork.departmentCode],
                ["Service", selectedWork.serviceCode],
                ["Team", selectedWork.assignedTeamCode],
                ["Assigned To", selectedWork.assignedTo?.email ?? selectedWork.assignedToEmail],
                ["Asset", selectedWork.asset?.tag ?? selectedWork.assetTag],
                ["Job Plan", selectedWork.jobPlanCode ?? selectedWork.jobPlan],
                ...workTimingRows(selectedWork),
                ["Work Notes", selectedWork.workNotes],
                ["Pictures", selectedWork.photoUrls],
                ["Inventory Used", selectedWork.inventoryUsed],
                ["Material Request", selectedWork.materialRequest],
              ]}
            />
          </div>
        )}
      </Panel>
      {canAssignOrEdit && createOpen && (
        <RequestModalShell title="New Work Order" onClose={() => setCreateOpen(false)}>
          <WorkOrderForm title="" data={data} onSubmit={async (formData) => { await submitWorkOrder(formData); setCreateOpen(false); }} saving={saving} />
        </RequestModalShell>
      )}
      {editing && canAssignOrEdit && (
        <RequestModalShell title={`Edit ${editing.woNo}`} onClose={() => setEditing(null)}>
          <WorkOrderForm title="" data={data} work={editing} onSubmit={async (formData) => { await updateWorkOrder(editing.id, formData); setEditing(null); }} saving={saving} />
        </RequestModalShell>
      )}
      {previewWork && (
        <WorkOrderPreviewModal
          work={previewWork}
          inventory={data.inventory}
          onClose={() => setPreviewWork(null)}
          onStatusChange={previewWork.status !== "CLOSED" ? (status) => runWorkAction(`${previewWork.id}:${status}`, previewWork, () => updateWorkStatus(previewWork.id, status)) : undefined}
          onPatch={(body) => quickPatchWork(previewWork, body)}
          onEdit={canAssignOrEdit && previewWork.status !== "CLOSED" ? () => { setEditing(previewWork); setPreviewWork(null); } : undefined}
          onCloseWork={canFinalReview && ["PENDING_SUPERVISOR_REVIEW", "COMPLETED"].includes(previewWork.status) ? () => { setReviewWork({ work: previewWork, action: "close" }); setPreviewWork(null); } : undefined}
          onReopenWork={canFinalReview && ["PENDING_SUPERVISOR_REVIEW", "COMPLETED"].includes(previewWork.status) ? () => { setReviewWork({ work: previewWork, action: "reopen" }); setPreviewWork(null); } : undefined}
        />
      )}
      {reviewWork && (
        <WorkOrderSupervisorReviewModal
          work={reviewWork.work}
          action={reviewWork.action}
          teams={data.teams}
          saving={saving}
          onClose={() => setReviewWork(null)}
          onSubmit={async (formData) => {
            await updateWorkOrder(reviewWork.work.id, formData);
            setReviewWork(null);
          }}
        />
      )}
      {selectedWork && canExecute && !canAssignOrEdit && selectedWork.status !== "CLOSED" && selectedWork.status !== "PENDING_SUPERVISOR_REVIEW" && <WorkExecutionForm work={selectedWork} inventory={data.inventory} saving={saving} onSubmit={(formData) => updateWorkOrder(selectedWork.id, formData)} />}
    </section>
  );
}

function AssetPreviewModal({ asset, canManageAssets, onClose, onEdit, onCreateWorkOrder, children }: { asset: any; canManageAssets: boolean; onClose: () => void; onEdit: () => void; onCreateWorkOrder: () => void; children?: React.ReactNode }) {
  const image = attachmentList(asset.documentationUrl).find(isImageUrl);
  const docs = attachmentList(asset.documentationUrl);
  const historyData = (asset.history ?? []).slice(0, 8).map((event: any) => ({
    name: new Date(event.createdAt).toLocaleDateString(),
    events: 1,
  }));
  const workHistory = asset.workOrders ?? [];
  const partsHistory = workHistory.flatMap((work: any) => String(work.inventoryUsed ?? "").split(/\r?\n|,/).map((part) => part.trim()).filter(Boolean).map((part) => ({ work: work.woNo, part, updatedAt: work.updatedAt })));

  return (
    <RequestModalShell title={`Asset | ${asset.assetDescription || asset.name}`} onClose={onClose}>
      <div className="grid gap-5">
        <div className="sticky top-0 z-10 -mx-5 -mt-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div className="flex gap-5 text-sm font-black">
            <span className="border-b-2 border-lagoon px-2 pb-3 text-ink">Details</span>
            <span className="px-2 pb-3 text-slate-500">Status (Beta) <span className="rounded-full bg-lime-100 px-2 py-1 text-xs text-lime-700">Online</span></span>
          </div>
          <div className="flex gap-2">
            {canManageAssets && <button type="button" onClick={onCreateWorkOrder} className="rounded-lg bg-lagoon px-4 py-3 text-sm font-black text-white"><Plus size={16} className="inline" /> Work Order</button>}
            {canManageAssets && <button type="button" onClick={onEdit} className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-black text-lagoon">Edit</button>}
          </div>
        </div>
        <div>
          <p className="text-xs font-black text-slate-500"># {asset.tag}</p>
          <h3 className="mt-1 text-2xl font-black">{asset.assetDescription || asset.name}</h3>
          <p className="mt-2 max-w-3xl text-sm font-bold text-slate-600">{asset.additionalDescription || asset.remarks || "-"}</p>
          <div className="mt-4 h-40 w-40 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {image ? <img src={image} alt="Asset" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm font-black text-slate-400">No Image</div>}
          </div>
        </div>
        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-black">Details</h4>
            <p className="text-xs font-bold text-slate-400">Last update on {formatDateCell(asset.updatedAt)}</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <PreviewField label="Location" value={[asset.buildingCode, asset.floor, asset.room].filter(Boolean).join(" > ")} />
            <PreviewField label="Asset type" value={asset.assetGroup || asset.category} />
            <PreviewField label="Model" value={asset.model} />
            <PreviewField label="Manufacturer" value={asset.manufacturer} />
            <PreviewField label="Serial No." value={asset.serialNumber} />
            <PreviewField label="Purchase date" value={formatDateCell(asset.installDate)} />
            <PreviewField label="URL" value={docs.join(" / ")} />
            <PreviewField label="Parent" value={asset.parentAsset} />
            <PreviewField label="QR Code" value={asset.qrCode} />
            <PreviewField label="Warranty" value={formatDateCell(asset.warrantyExpiry)} />
            <PreviewField label="Assigned Team" value={asset.assignedTeamCode} />
            <PreviewField label="Supervisor" value={asset.assignedSupervisorEmail} />
          </div>
        </div>
        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between">
            <h4 className="font-black">Asset Family</h4>
            <button type="button" className="text-sm font-black text-lagoon">Expand All</button>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-100 px-4 py-3 text-sm font-black">
            <span>{asset.assetDescription || asset.name}</span>
            <span className="rounded-full bg-lime-100 px-2 py-1 text-xs text-lime-700">Online</span>
          </div>
          {canManageAssets && <button type="button" onClick={onEdit} className="mt-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-black text-lagoon">+ Sub Asset</button>}
        </div>
        <div className="border-t border-slate-200 pt-5">
          <h4 className="font-black">Work Order History</h4>
          <div className="mt-3 grid gap-2">
            {workHistory.length ? workHistory.map((work: any) => (
              <div key={work.woNo} className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-ink">{work.woNo} / {work.title}</p>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-lagoon">{work.status}</span>
                </div>
                <p className="mt-1 text-slate-600">{work.workNotes || "No technician notes recorded."}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">Updated {formatDateCell(work.updatedAt)}</p>
              </div>
            )) : <p className="text-sm font-bold text-slate-500">No linked work orders yet.</p>}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-black">Parts Replaced / Used</p>
            <div className="mt-2 grid gap-2">
              {partsHistory.length ? partsHistory.map((part: any, index: number) => (
                <div key={`${part.work}-${part.part}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold">
                  <span>{part.part}</span>
                  <span className="text-xs text-slate-400">{part.work}</span>
                </div>
              )) : <span className="text-sm text-slate-500">No parts usage recorded.</span>}
            </div>
          </div>
          <div className="mt-3 h-52 rounded-lg bg-slate-50 p-3">
            {historyData.length ? (
              <ResponsiveContainer>
                <BarChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e6ee" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="events" fill="#0f8b8d" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="grid h-full place-items-center text-sm font-black text-slate-400">Not Enough Data</div>}
          </div>
        </div>
        <div className="border-t border-slate-200 pt-5">
          <h4 className="font-black">Asset History Timeline</h4>
          <div className="mt-3 grid gap-3">
            {(asset.history ?? []).length ? (asset.history ?? []).map((event: any) => (
              <div key={event.id} className="border-l-4 border-lagoon bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">{event.title}</p>
                  <span className="text-xs font-bold text-slate-400">{formatDateCell(event.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{event.details}</p>
                <p className="mt-1 text-xs font-black text-lagoon">{event.eventType} / {event.actor}</p>
              </div>
            )) : <p className="text-sm font-bold text-slate-500">No history recorded yet.</p>}
          </div>
        </div>
        {children}
      </div>
    </RequestModalShell>
  );
}

function Helpdesk({
  requests,
  assets,
  services,
  assetCategories,
  departments,
  teams,
  locations,
  submitRequest,
  permissions,
  role,
  updateRequest,
  deleteRequest,
  convertRequest,
  saving,
}: {
  requests: any[];
  assets: any[];
  services: any[];
  assetCategories: any[];
  departments: any[];
  teams: any[];
  locations: any[];
  submitRequest: (formData: FormData) => void;
  permissions: ActionPermissions;
  role: string;
  updateRequest: (id: string, formData: FormData) => Promise<void> | void;
  deleteRequest: (id: string) => Promise<void> | void;
  convertRequest: (id: string, assignment?: { assignedTeamCode?: string; assignedToEmail?: string; assetTag?: string }) => Promise<void> | void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewRequest, setPreviewRequest] = useState<any | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(requests[0]?.id ?? null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [requestAction, setRequestAction] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, { assignedTeamCode: string; assignedToEmail: string; assetTag: string }>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const isSupervisorView = roleKindLabel(role) === "admin" || roleKindLabel(role) === "supervisor";
  const isAdmin = roleKindLabel(role) === "admin";
  const requestCategories = ["All", ...Array.from(new Set(requests.map((request) => request.category).filter(Boolean)))];
  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const haystack = `${request.ticketNo} ${request.title} ${request.description} ${request.requester} ${request.location} ${request.category} ${request.departmentCode} ${request.serviceCode}`.toLowerCase();
      const queryMatch = !search || haystack.includes(search.toLowerCase());
      const statusMatch = statusFilter === "All" || request.status === statusFilter;
      const priorityMatch = priorityFilter === "All" || request.priority === priorityFilter;
      const categoryMatch = categoryFilter === "All" || request.category === categoryFilter;
      const overdueMatch = !overdueOnly || (request.dueAt ? new Date(request.dueAt).getTime() < Date.now() && request.status !== "CLOSED" : false);
      return queryMatch && statusMatch && priorityMatch && categoryMatch && overdueMatch;
    });
  }, [requests, search, statusFilter, priorityFilter, categoryFilter, overdueOnly]);
  const selectedRequest = filteredRequests.find((request) => request.id === selectedRequestId) ?? filteredRequests[0] ?? requests[0];
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleRequests = filteredRequests.slice(startIndex, startIndex + PAGE_SIZE);
  const selectedVisibleRequests = visibleRequests.filter((request) => selectedRequestIds.has(request.id));
  const allVisibleRequestsSelected = isAdmin && Boolean(visibleRequests.length) && selectedVisibleRequests.length === visibleRequests.length;
  const someVisibleRequestsSelected = isAdmin && selectedVisibleRequests.length > 0 && !allVisibleRequestsSelected;

  useEffect(() => {
    if (filteredRequests.length && !filteredRequests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(filteredRequests[0].id);
    }
  }, [filteredRequests, selectedRequestId]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter, categoryFilter, overdueOnly, filteredRequests.length]);

  useEffect(() => {
    setSelectedRequestIds((current) => new Set(Array.from(current).filter((id) => requests.some((request) => request.id === id))));
  }, [requests]);

  function toggleRequestSelection(id: string, checked: boolean) {
    setSelectedRequestIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisibleRequests(checked: boolean) {
    setSelectedRequestIds((current) => {
      const next = new Set(current);
      visibleRequests.forEach((request) => {
        if (checked) next.add(request.id);
        else next.delete(request.id);
      });
      return next;
    });
  }

  async function bulkDeleteSelectedRequests() {
    const ids = Array.from(selectedRequestIds);
    if (!ids.length) return;
    await Promise.all(ids.map((id) => deleteRequest(id)));
    setSelectedRequestIds(new Set());
  }

  async function runRequestAction(key: string, request: any, action: () => Promise<void> | void) {
    setSelectedRequestId(request.id);
    setRequestAction(key);
    try {
      await action();
    } finally {
      setRequestAction(null);
    }
  }

  function assignmentFor(request: any) {
    return assignments[request.id] ?? { assignedTeamCode: request.assignedTeamCode ?? "", assignedToEmail: "", assetTag: request.assetTag ?? "" };
  }

  function setAssignment(requestId: string, next: Partial<{ assignedTeamCode: string; assignedToEmail: string; assetTag: string }>) {
    setAssignments((current) => {
      const previous = current[requestId] ?? { assignedTeamCode: "", assignedToEmail: "", assetTag: "" };
      return { ...current, [requestId]: { ...previous, ...next } };
    });
  }

  async function toggleIncidentCase(request: any, checked: boolean) {
    const formData = requestFormData(request, request.status);
    formData.set("isIncidentCase", checked ? "true" : "false");
    await updateRequest(request.id, formData);
    setPreviewRequest((current: any) => current?.id === request.id ? { ...current, isIncidentCase: checked } : current);
  }

  return (
    <section className="space-y-5">
      <Panel title="Helpdesk & SLA Triage" icon={TicketCheck}>
        <ReportButtons type="requests" label="Service requests report" />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="flex h-11 min-w-[250px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <Search size={16} className="text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests" className="w-full text-sm outline-none" />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="All">Status</option>
              <option value="NEW">New</option>
              <option value="TRIAGED">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CLOSED">Closed</option>
            </select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="All">Priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
              {requestCategories.map((category) => <option key={category} value={category}>{category === "All" ? "Category" : category}</option>)}
            </select>
            <button type="button" onClick={() => setOverdueOnly((current) => !current)} className={`h-11 rounded-lg px-3 text-sm font-black ${overdueOnly ? "bg-coral text-white" : "border border-slate-200 bg-white text-slate-600"}`}>Overdue & Due Today</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedRequest && (
              <label className="flex h-11 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800">
                <input
                  type="checkbox"
                  checked={Boolean(selectedRequest.isIncidentCase)}
                  onChange={(event) => toggleIncidentCase(selectedRequest, event.target.checked)}
                />
                Incident / Case
              </label>
            )}
            {permissions.manageRequests && <button type="button" onClick={() => { setEditing(null); setCreateOpen(true); }} className="flex h-11 items-center gap-2 rounded-lg bg-lagoon px-4 text-sm font-black text-white shadow-sm"><Plus size={16} /> Request</button>}
          </div>
        </div>

        {isAdmin && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">
            <span>Selected {selectedRequestIds.size.toLocaleString()} service requests</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => toggleVisibleRequests(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-lagoon">Select Visible</button>
              <button type="button" disabled={!selectedRequestIds.size} onClick={bulkDeleteSelectedRequests} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Delete All</button>
              <button type="button" disabled={!selectedRequestIds.size} onClick={() => setSelectedRequestIds(new Set())} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">Clear Selection</button>
            </div>
          </div>
        )}
        <div className="cafm-scroll-x overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
          <table className="cafm-data-table min-w-[1680px] border-collapse bg-white text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {isAdmin && (
                  <th className="px-3 py-3 font-black">
                    <input
                      type="checkbox"
                      checked={allVisibleRequestsSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someVisibleRequestsSelected;
                      }}
                      onChange={(event) => toggleVisibleRequests(event.target.checked)}
                    />
                  </th>
                )}
                <th className="px-3 py-3 font-black">#</th>
                <th className="px-3 py-3 font-black">Title</th>
                <th className="px-3 py-3 font-black">Status</th>
                <th className="px-3 py-3 font-black">Priority</th>
                <th className="px-3 py-3 font-black">Category</th>
                <th className="px-3 py-3 font-black">Created when</th>
                <th className="px-3 py-3 font-black">Needed by</th>
                <th className="px-3 py-3 font-black">Location</th>
                <th className="px-3 py-3 font-black">Department</th>
                <th className="px-3 py-3 font-black">Service</th>
                <th className="px-3 py-3 font-black">Description</th>
                <th className="px-3 py-3 font-black">Created by</th>
                <th className="px-3 py-3 font-black">Supervisor</th>
                <th className="px-3 py-3 font-black">Incident / Case</th>
                <th className="px-3 py-3 font-black">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((request, index) => {
                const assignment = assignmentFor(request);
                return (
                  <tr
                    key={request.id}
                    onClick={() => setSelectedRequestId(request.id)}
                    className={`cursor-pointer border-t border-slate-100 align-top ${selectedRequest?.id === request.id ? "bg-lagoon/5" : "hover:bg-slate-50"}`}
                  >
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRequestIds.has(request.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => toggleRequestSelection(request.id, event.target.checked)}
                        />
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-3 font-black text-slate-500">{startIndex + index + 1}</td>
                    <td className="max-w-[280px] px-3 py-3">
                      <div className="font-black text-slate-800">{request.title}</div>
                      <div className="mt-1 text-xs font-bold text-slate-500">{request.ticketNo}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3"><RequestStatusBadge status={request.status} /></td>
                    <td className="whitespace-nowrap px-3 py-3"><RequestPriorityBadge priority={request.priority} /></td>
                    <td className="whitespace-nowrap px-3 py-3">{request.category || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateCell(request.createdAt)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateCell(request.dueAt)}</td>
                    <td className="max-w-[260px] px-3 py-3 text-slate-600">{request.location || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{request.departmentCode || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{request.serviceCode || "-"}</td>
                    <td className="max-w-[320px] px-3 py-3 text-slate-600"><div className="line-clamp-2">{request.description || "-"}</div></td>
                    <td className="whitespace-nowrap px-3 py-3">{request.requester || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{request.assignedSupervisorEmail || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <label className="flex items-center gap-2 text-xs font-black text-slate-600" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={Boolean(request.isIncidentCase)}
                          onChange={(event) => toggleIncidentCase(request, event.target.checked)}
                        />
                        Incident / Case
                      </label>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-[260px] flex-wrap gap-2">
                        {isSupervisorView && permissions.manageRequests && <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedRequestId(request.id); setEditing(request); }} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">Edit</button>}
                        <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedRequestId(request.id); setPreviewRequest(request); }} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-black text-white">Preview</button>
                        {isSupervisorView && permissions.manageRequests && <button type="button" disabled={Boolean(request.workOrder) || requestAction === `${request.id}:wo`} onClick={(event) => { event.stopPropagation(); runRequestAction(`${request.id}:wo`, request, () => convertRequest(request.id, { assignedTeamCode: assignment.assignedTeamCode })); }} className="rounded-lg bg-ink px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">{requestAction === `${request.id}:wo` ? "Creating..." : request.workOrder ? "WO Created" : "Create WO"}</button>}
                        {isSupervisorView && permissions.approveRequests && <button type="button" disabled={requestAction === `${request.id}:reject`} onClick={(event) => { event.stopPropagation(); runRequestAction(`${request.id}:reject`, request, () => updateRequest(request.id, requestFormData(request, "REJECTED", "Rejected by supervisor/helpdesk", { assignedTeamCode: assignment.assignedTeamCode }))); }} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">{requestAction === `${request.id}:reject` ? "Saving..." : "Reject"}</button>}
                        {isAdmin && permissions.manageRequests && <button type="button" disabled={requestAction === `${request.id}:delete`} onClick={(event) => { event.stopPropagation(); runRequestAction(`${request.id}:delete`, request, () => deleteRequest(request.id)); }} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">{requestAction === `${request.id}:delete` ? "Deleting..." : "Delete"}</button>}
                      </div>
                      {isSupervisorView && permissions.manageRequests && (
                        <select
                          value={assignment.assignedTeamCode}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => setAssignment(request.id, { assignedTeamCode: event.target.value, assignedToEmail: "" })}
                          className="mt-2 h-10 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-lagoon"
                        >
                          <option value="">Assign service team</option>
                          {teams.map((team) => <option key={team.id} value={team.code}>{team.code} - {team.name}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={filteredRequests.length} />
        </div>

        {selectedRequest && (
          <div className="mt-5">
            <DetailPanel
              title={`Selected Request: ${selectedRequest.ticketNo}`}
              rows={[
                ["Title", selectedRequest.title],
                ["Status", selectedRequest.status],
                ["Priority", selectedRequest.priority],
                ["Category", selectedRequest.category],
                ["Department", selectedRequest.departmentCode],
                ["Service", selectedRequest.serviceCode],
                ["Team", selectedRequest.assignedTeamCode],
                ["Supervisor", selectedRequest.assignedSupervisorEmail],
                ["Requester", selectedRequest.requester],
                ["Location", selectedRequest.location],
                ["Description", selectedRequest.description],
                ["Attachments", selectedRequest.attachmentUrls],
                ["Reject Reason", selectedRequest.rejectionReason],
                ["Linked Work Order", selectedRequest.workOrder?.woNo],
              ]}
            />
          </div>
        )}
      </Panel>
      {permissions.manageRequests && createOpen && (
        <RequestModalShell title="New Request" onClose={() => setCreateOpen(false)}>
          <ServiceRequestForm
            title=""
            services={services}
            categories={assetCategories}
            departments={departments}
            teams={teams}
            locations={locations}
            assets={assets}
            onSubmit={async (formData) => {
              await submitRequest(formData);
              setCreateOpen(false);
            }}
            saving={saving}
            mode="modal"
          />
        </RequestModalShell>
      )}
      {editing && permissions.manageRequests && (
        <RequestModalShell title={`Edit ${editing.ticketNo}`} onClose={() => setEditing(null)}>
          <ServiceRequestForm
            title=""
            request={editing}
            services={services}
            categories={assetCategories}
            departments={departments}
            teams={teams}
            locations={locations}
            assets={assets}
            onSubmit={async (formData) => {
              await updateRequest(editing.id, formData);
              setEditing(null);
            }}
            saving={saving}
            mode="modal"
          />
        </RequestModalShell>
      )}
      {previewRequest && (
        <RequestPreviewModal
          request={previewRequest}
          assets={assets}
          teams={teams}
          assignment={assignmentFor(previewRequest)}
          canManage={isSupervisorView && permissions.manageRequests}
          canApprove={isSupervisorView && permissions.approveRequests}
          savingKey={requestAction}
          onClose={() => setPreviewRequest(null)}
          onEdit={() => {
            setPreviewRequest(null);
            setEditing(previewRequest);
          }}
          onAssignTeam={(value) => setAssignment(previewRequest.id, { assignedTeamCode: value, assignedToEmail: "" })}
          onAssignAsset={(value) => setAssignment(previewRequest.id, { assetTag: value })}
          onReview={async () => {
            await runRequestAction(`${previewRequest.id}:review`, previewRequest, () => updateRequest(previewRequest.id, requestFormData(previewRequest, "TRIAGED", "", { assignedTeamCode: assignmentFor(previewRequest).assignedTeamCode })));
            setPreviewRequest((current: any) => current ? { ...current, status: "TRIAGED", reviewedAt: new Date().toISOString(), assignedTeamCode: assignmentFor(previewRequest).assignedTeamCode } : current);
          }}
          onCreateWorkOrder={async () => {
            await runRequestAction(`${previewRequest.id}:wo`, previewRequest, () => convertRequest(previewRequest.id, { assignedTeamCode: assignmentFor(previewRequest).assignedTeamCode, assetTag: assignmentFor(previewRequest).assetTag }));
            setPreviewRequest(null);
          }}
          onReject={() => runRequestAction(`${previewRequest.id}:reject`, previewRequest, () => updateRequest(previewRequest.id, requestFormData(previewRequest, "REJECTED", "Rejected by supervisor/helpdesk", { assignedTeamCode: assignmentFor(previewRequest).assignedTeamCode })))}
        />
      )}
    </section>
  );
}

function requestFormData(request: any, status: string, rejectionReason = "", overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("title", request.title ?? "");
  formData.set("category", request.category ?? "General");
  formData.set("departmentCode", request.departmentCode ?? "");
  formData.set("serviceCode", request.serviceCode ?? "");
  formData.set("assignedTeamCode", overrides.assignedTeamCode ?? request.assignedTeamCode ?? "");
  formData.set("requester", request.requester ?? "Requester");
  formData.set("priority", request.priority ?? "MEDIUM");
  formData.set("status", status);
  formData.set("location", request.location ?? "Unassigned");
  formData.set("attachmentUrls", request.attachmentUrls ?? "");
  formData.set("rejectionReason", rejectionReason || request.rejectionReason || "");
  formData.set("description", request.description ?? request.title ?? "Request reviewed.");
  return formData;
}

function requestLocationNeedles(location: string) {
  return String(location || "")
    .split("/")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 1 && !["unassigned", "-"].includes(part));
}

function assetMatchesLocation(asset: any, location: string) {
  const needles = requestLocationNeedles(location);
  if (!needles.length) return true;
  const assetLocationParts = [
    asset.locationCode,
    asset.locationDesc,
    asset.siteCode,
    asset.site?.name,
    asset.buildingCode,
    asset.building?.code,
    asset.building?.name,
    asset.floor,
    asset.room,
  ].filter(Boolean).map((part) => String(part).trim().toLowerCase());
  const haystack = assetLocationParts.join(" / ");
  const compactAssetParts = assetLocationParts.map((part) => part.replace(/[^a-z0-9]/g, "")).filter((part) => part.length > 2);

  return needles.some((needle) => {
    const compactNeedle = needle.replace(/[^a-z0-9]/g, "");
    return (
      haystack.includes(needle) ||
      compactAssetParts.some((part) => part.includes(compactNeedle) || compactNeedle.includes(part))
    );
  });
}

function assetMatchesDepartment(asset: any, departmentCode: string, assignedTeamCode = "") {
  const requestedCodes = [departmentCode, assignedTeamCode].filter(Boolean).map((code) => String(code).trim().toUpperCase());
  if (!requestedCodes.length) return true;
  const directCodes = [asset.departmentCode, asset.assignedTeamCode].filter(Boolean).map((code) => String(code).trim().toUpperCase());
  const combinedCodeSegments = [
    asset.tag,
    asset.assetNumber,
    asset.equipmentNo,
    asset.classCode,
    asset.category,
    asset.assetGroup,
    asset.primarySystem,
    asset.system,
  ]
    .filter(Boolean)
    .flatMap((code) => String(code).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));

  return requestedCodes.some((code) => directCodes.includes(code) || combinedCodeSegments.includes(code));
}

function serviceMatchesDepartment(service: any, departmentCode: string) {
  if (!departmentCode) return true;
  const scopeCodes = [service.code, service.departmentCode, service.team?.code, service.teamCode].filter(Boolean).map((code) => String(code).trim().toUpperCase());
  return scopeCodes.includes(String(departmentCode).trim().toUpperCase());
}

function serviceScopeCodes(service: any) {
  return [service.code, service.departmentCode, service.team?.code, service.teamCode]
    .filter(Boolean)
    .map((code) => String(code).trim().toUpperCase());
}

function categoryTokens(value: string) {
  return String(value || "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
}

function serviceMatchesCategory(service: any, categoryValue: string) {
  const selected = String(categoryValue || "").trim().toLowerCase();
  if (!selected) return false;
  const serviceText = [service.category, service.name, service.code, service.description].filter(Boolean).join(" ").toLowerCase();
  const selectedTokens = categoryTokens(categoryValue);
  return serviceText === selected || serviceText.includes(selected) || selectedTokens.some((token) => token.length > 2 && serviceScopeCodes(service).includes(token));
}

function inferServiceFromCategory(categoryValue: string, services: any[], departments: any[]) {
  const selectedTokens = categoryTokens(categoryValue);
  const departmentCode = departments
    .map((department) => String(department.code || "").trim().toUpperCase())
    .find((code) => selectedTokens.includes(code));
  const categoryService = services.find((service) => serviceMatchesCategory(service, categoryValue));
  const scopedService = departmentCode ? services.find((service) => serviceScopeCodes(service).includes(departmentCode)) : undefined;
  const service = categoryService || scopedService;
  const inferredDepartmentCode = departmentCode || service?.team?.code || service?.teamCode || service?.departmentCode || "";
  return { departmentCode: inferredDepartmentCode, serviceCode: service?.code || "" };
}

function scopedAssetOptions(assets: any[], departmentCode: string, assignedTeamCode: string, location: string) {
  if (!departmentCode && !assignedTeamCode) return [];
  const departmentAssets = assets.filter((asset) => assetMatchesDepartment(asset, departmentCode, assignedTeamCode));
  const locationAssets = departmentAssets.filter((asset) => assetMatchesLocation(asset, location));
  return location && locationAssets.length ? locationAssets : departmentAssets;
}

function serviceRequestLocationLabel(location: any) {
  const path = [location.site, location.building, location.floor, location.room]
    .map((part) => String(part || "").trim())
    .filter((part) => part && part.toLowerCase() !== "unassigned");
  const detail = location.description && !path.some((part) => part.toLowerCase() === String(location.description).trim().toLowerCase())
    ? ` - ${location.description}`
    : "";
  return [location.code, ...path].filter(Boolean).join(" / ") + detail;
}

function locationSelectLabel(location: any) {
  return [location.code, location.description || location.room || location.building, location.locationClass || location.type].filter(Boolean).join(" - ");
}

function locationOptionDetail(location: any) {
  return [location.description, location.locationClass, location.type].filter(Boolean).join(" / ");
}

type SearchableOption = { value: string; label: string };

function uniqueLocationOptions(rows: any[], valueFor: (location: any) => string, labelFor: (location: any, value: string) => string) {
  return Array.from<SearchableOption>(
    rows.reduce((map, location) => {
      const value = String(valueFor(location) || "").trim();
      if (!value || map.has(value)) return map;
      map.set(value, { value, label: labelFor(location, value) });
      return map;
    }, new Map<string, SearchableOption>()).values(),
  ).sort((first, second) => first.label.localeCompare(second.label, undefined, { numeric: true, sensitivity: "base" }));
}

function resolveLocationCode(locations: any[], value: string) {
  const saved = String(value || "");
  if (!saved) return "";
  return locations.find((location) => saved === location.code || saved.startsWith(`${location.code} /`) || saved.includes(location.code))?.code || "";
}

function findLocationBySearch(locations: any[], value: string) {
  const search = String(value || "").trim();
  if (!search) return undefined;
  return locations.find((location) => location.code === search || locationSelectLabel(location) === search || serviceRequestLocationLabel(location) === search);
}

function SearchableDropdownField({
  value,
  options,
  placeholder,
  disabled = false,
  className = "",
  onInput,
  onSelect,
}: {
  value: string;
  options: SearchableOption[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
  onInput: (value: string) => void;
  onSelect: (option: SearchableOption) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const search = String(value || "").trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    const rows = search
      ? options.filter((option) => `${option.value} ${option.label}`.toLowerCase().includes(search))
      : options;
    return rows.slice(0, 120);
  }, [options, search]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, options]);

  function choose(option: SearchableOption) {
    onSelect(option);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => !disabled && setOpen(true)}
        onClick={() => !disabled && setOpen(true)}
        onChange={(event) => {
          onInput(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (/^[a-z0-9]$/i.test(event.key)) setOpen(true);
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter" && open && filteredOptions[highlightedIndex]) {
            event.preventDefault();
            choose(filteredOptions[highlightedIndex]);
          }
          if (event.key === "Escape") setOpen(false);
        }}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-lagoon disabled:bg-slate-100"
      />
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl">
          {filteredOptions.length ? (
            filteredOptions.map((option, index) => (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                className={`block w-full px-3 py-2 text-left font-bold ${index === highlightedIndex ? "bg-lagoon/10 text-lagoon" : "text-slate-700 hover:bg-slate-50"}`}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm font-bold text-slate-500">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}

function ServiceRequestForm({ title, request, services, categories, departments, teams, locations, assets, onSubmit, saving, mode = "panel" }: { title: string; request?: any; services: any[]; categories: any[]; departments: any[]; teams: any[]; locations: any[]; assets: any[]; onSubmit: (formData: FormData) => void; saving: boolean; mode?: "panel" | "modal" }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(new FormData(form));
    if (!request) form.reset();
  }

  const activeLocations = useMemo(
    () => Array.from(new Map(locations.filter((location) => location.active !== false && location.code).map((location) => [location.code, location])).values()),
    [locations],
  );
  const initialLocationCode = useMemo(() => resolveLocationCode(activeLocations, request?.location ?? ""), [activeLocations, request?.location]);
  const initialLocation = activeLocations.find((location) => location.code === initialLocationCode);
  const formClass = mode === "modal" ? "" : "rounded-lg border border-white/80 bg-white p-5 shadow-lift";
  const [priority, setPriority] = useState(request?.priority ?? "MEDIUM");
  const [departmentCode, setDepartmentCode] = useState(request?.departmentCode ?? "");
  const [serviceCode, setServiceCode] = useState(request?.serviceCode ?? "");
  const [siteValue, setSiteValue] = useState(initialLocation?.site ?? "");
  const [parentLocationValue, setParentLocationValue] = useState(initialLocation?.parentLocation || initialLocation?.zone || "");
  const [buildingValue, setBuildingValue] = useState(initialLocation?.building ?? "");
  const [floorValue, setFloorValue] = useState(initialLocation?.floor ?? "");
  const [locationCodeValue, setLocationCodeValue] = useState(initialLocationCode);
  const [locationSearchValue, setLocationSearchValue] = useState(initialLocation ? locationSelectLabel(initialLocation) : "");
  const [assetTagValue, setAssetTagValue] = useState(request?.assetTag ?? "");
  const [categoryValue, setCategoryValue] = useState(request?.category ?? "");
  const [showCategoryCreate, setShowCategoryCreate] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [localCategories, setLocalCategories] = useState<any[]>(categories);
  const categoryOptions = Array.from(new Set([
    ...localCategories.map((category) => category.name || category.code).filter(Boolean),
    ...services.map((service) => service.category).filter(Boolean),
  ]));
  const filteredServices = useMemo(() => services.filter((service) => serviceMatchesDepartment(service, departmentCode)), [services, departmentCode]);
  const selectedService = services.find((service) => service.code === serviceCode);
  const selectedTeamCode = selectedService?.team?.code || selectedService?.teamCode || teams.find((team) => team.code === departmentCode)?.code || "";
  const siteDropdownOptions = useMemo(
    () => uniqueLocationOptions(activeLocations, (location) => location.site, (location, value) => [value, locationOptionDetail(location)].filter(Boolean).join(" - ")),
    [activeLocations],
  );
  const parentLocationRows = useMemo(() => activeLocations.filter((location) => !siteValue || location.site === siteValue), [activeLocations, siteValue]);
  const parentLocationDropdownOptions = useMemo(
    () => uniqueLocationOptions(parentLocationRows, (location) => location.parentLocation || location.zone || location.code, (location, value) => [value, location.description || location.building, location.locationClass].filter(Boolean).join(" - ")),
    [parentLocationRows],
  );
  const buildingRows = useMemo(
    () => activeLocations.filter((location) => (!siteValue || location.site === siteValue) && (!parentLocationValue || location.parentLocation === parentLocationValue || location.zone === parentLocationValue || location.code === parentLocationValue)),
    [activeLocations, siteValue, parentLocationValue],
  );
  const buildingDropdownOptions = useMemo(
    () => uniqueLocationOptions(buildingRows, (location) => location.building, (location, value) => [value, location.description, location.locationClass].filter(Boolean).join(" - ")),
    [buildingRows],
  );
  const floorRows = useMemo(
    () => activeLocations.filter((location) => (!siteValue || location.site === siteValue) && (!parentLocationValue || location.parentLocation === parentLocationValue || location.zone === parentLocationValue || location.code === parentLocationValue) && (!buildingValue || location.building === buildingValue)),
    [activeLocations, siteValue, parentLocationValue, buildingValue],
  );
  const floorDropdownOptions = useMemo(
    () => uniqueLocationOptions(floorRows, (location) => location.floor, (location, value) => [value, location.description, location.locationClass].filter(Boolean).join(" - ")),
    [floorRows],
  );
  const finalLocationOptions = useMemo(
    () => activeLocations
      .filter((location) =>
        (!siteValue || location.site === siteValue) &&
        (!parentLocationValue || location.parentLocation === parentLocationValue || location.zone === parentLocationValue || location.code === parentLocationValue) &&
        (!buildingValue || location.building === buildingValue) &&
        (!floorValue || location.floor === floorValue),
      )
      .sort((first, second) => serviceRequestLocationLabel(first).localeCompare(serviceRequestLocationLabel(second), undefined, { numeric: true, sensitivity: "base" })),
    [activeLocations, siteValue, parentLocationValue, buildingValue, floorValue],
  );
  const allLocationDropdownOptions = useMemo(() => activeLocations.map((location) => ({ value: location.code, label: locationSelectLabel(location) })), [activeLocations]);
  const selectedLocation = activeLocations.find((location) => location.code === locationCodeValue);
  const locationValue = selectedLocation ? serviceRequestLocationLabel(selectedLocation) : "";
  const filteredAssets = useMemo(() => scopedAssetOptions(assets, departmentCode, selectedTeamCode, locationValue), [assets, departmentCode, selectedTeamCode, locationValue]);

  useEffect(() => {
    if (serviceCode && !filteredServices.some((service) => service.code === serviceCode)) {
      setServiceCode("");
    }
  }, [departmentCode, filteredServices, serviceCode]);

  useEffect(() => {
    if (assetTagValue && !filteredAssets.some((asset) => asset.tag === assetTagValue)) {
      setAssetTagValue("");
    }
  }, [assetTagValue, filteredAssets]);

  useEffect(() => {
    if (locationCodeValue && !finalLocationOptions.some((location) => location.code === locationCodeValue)) {
      setLocationCodeValue("");
      setLocationSearchValue("");
    }
  }, [finalLocationOptions, locationCodeValue]);
  const priorities = [
    { value: "LOW", label: "Low", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { value: "MEDIUM", label: "Medium", tone: "bg-amber-50 text-amber-700 border-amber-200" },
    { value: "HIGH", label: "High", tone: "bg-orange-50 text-orange-700 border-orange-200" },
    { value: "CRITICAL", label: "Critical", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  ];
  function applyCategorySelection(value: string) {
    setCategoryValue(value);
    const inferred = inferServiceFromCategory(value, services, departments);
    if (inferred.departmentCode) setDepartmentCode(inferred.departmentCode);
    if (inferred.serviceCode) setServiceCode(inferred.serviceCode);
  }

  function applyLocationSelection(location: any) {
    if (!location) return;
    setLocationCodeValue(location.code);
    setLocationSearchValue(locationSelectLabel(location));
    setSiteValue(location.site || "");
    setParentLocationValue(location.parentLocation || location.zone || location.code || "");
    setBuildingValue(location.building || "");
    setFloorValue(location.floor || "");
  }

  async function createCategory() {
    const name = categoryName.trim();
    if (!name) return;
    setCategorySaving(true);
    const response = await fetch("/api/asset-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: categoryCode.trim(), name, type: "Service Request", defaultLifeYrs: 5, description: `Request category ${name}` }),
    });
    const result = await response.json();
    if (response.ok) {
      setLocalCategories((current) => [...current.filter((item) => item.code !== result.code), result]);
      applyCategorySelection(result.name);
      setCategoryName("");
      setCategoryCode("");
      setShowCategoryCreate(false);
    }
    setCategorySaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className={formClass}>
      {title ? <h3 className="text-xl font-black">{title}</h3> : null}
      <div className={`${title ? "mt-4" : ""} grid gap-4`}>
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">
          Upload images or files by drag and drop, or paste links below.
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-black text-amber-800">
          <span>Incident / Case</span>
          <input type="hidden" name="isIncidentCase" value="false" />
          <input type="checkbox" name="isIncidentCase" value="true" defaultChecked={Boolean(request?.isIncidentCase)} />
        </label>
        <input name="title" defaultValue={request?.title ?? ""} placeholder="Title" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <label className="grid gap-2 text-sm font-bold text-slate-600">
          Description
          <textarea name="description" defaultValue={request?.description ?? ""} placeholder="Describe the issue" className="min-h-24 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
        </label>
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
          <span className="text-sm font-black text-slate-600">Priority</span>
          {priorities.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPriority(item.value)}
              className={`rounded-lg border px-3 py-2 text-xs font-black ${priority === item.value ? item.tone : "border-slate-200 bg-white text-slate-500"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="priority" value={priority} />
        <input type="hidden" name="location" value={locationValue} />
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
          <SearchableDropdownField
            value={locationSearchValue}
            placeholder="1. Location"
            options={allLocationDropdownOptions}
            className="md:col-span-2"
            onInput={(nextValue) => {
              const selected = findLocationBySearch(activeLocations, nextValue);
              setLocationSearchValue(nextValue);
              setLocationCodeValue("");
              if (selected) applyLocationSelection(selected);
            }}
            onSelect={(option) => {
              const selected = activeLocations.find((location) => location.code === option.value);
              if (selected) applyLocationSelection(selected);
            }}
          />
          <SearchableDropdownField
            value={parentLocationValue}
            placeholder="2. Parent Location"
            options={parentLocationDropdownOptions}
            disabled={!locationCodeValue}
            onInput={(nextValue) => {
              setParentLocationValue(nextValue);
            }}
            onSelect={(option) => {
              setParentLocationValue(option.value);
            }}
          />
          <SearchableDropdownField
            value={siteValue}
            placeholder="3. Site"
            options={siteDropdownOptions}
            disabled={!locationCodeValue}
            onInput={(nextValue) => {
              setSiteValue(nextValue);
            }}
            onSelect={(option) => {
              setSiteValue(option.value);
            }}
          />
          <SearchableDropdownField
            value={buildingValue}
            placeholder="4. Building / Area"
            options={buildingDropdownOptions}
            disabled={!locationCodeValue}
            onInput={(nextValue) => {
              setBuildingValue(nextValue);
            }}
            onSelect={(option) => {
              setBuildingValue(option.value);
            }}
          />
          <SearchableDropdownField
            value={floorValue}
            placeholder="5. Floor / Level"
            options={floorDropdownOptions}
            disabled={!locationCodeValue}
            onInput={(nextValue) => {
              setFloorValue(nextValue);
            }}
            onSelect={(option) => {
              setFloorValue(option.value);
            }}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
          <select name="category" value={categoryValue} onChange={(event) => applyCategorySelection(event.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
            <option value="">Category</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <button type="button" onClick={() => setShowCategoryCreate((current) => !current)} className="h-9 rounded-lg border border-lagoon/30 bg-lagoon/5 px-3 text-xs font-black text-lagoon">
            {showCategoryCreate ? "Close Category Form" : "+ Add Category"}
          </button>
          {showCategoryCreate && (
            <div className="grid gap-2 rounded-lg bg-slate-50 p-3">
              <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New category name" className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lagoon" />
              <input value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)} placeholder="Category code optional" className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lagoon" />
              <button type="button" disabled={categorySaving || !categoryName.trim()} onClick={createCategory} className="h-10 rounded-lg bg-ink text-sm font-black text-white disabled:bg-slate-400">{categorySaving ? "Saving..." : "Save Category"}</button>
            </div>
          )}
          </div>
          <input name="requester" defaultValue={request?.requester ?? ""} placeholder="Created by / requester" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <select name="departmentCode" value={departmentCode} onChange={(event) => setDepartmentCode(event.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
            <option value="">Department</option>
            {departments.map((department) => <option key={department.id} value={department.code}>{department.code} - {department.name}</option>)}
          </select>
          <select name="serviceCode" value={serviceCode} onChange={(event) => setServiceCode(event.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
            <option value="">Service</option>
            {filteredServices.map((service) => <option key={service.id} value={service.code}>{service.code} - {service.name}</option>)}
          </select>
        </div>
        <label className="grid gap-2 text-sm font-bold text-slate-600">
          Related Asset
          <select name="assetTag" value={assetTagValue} onChange={(event) => setAssetTagValue(event.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
            <option value="">{departmentCode || selectedTeamCode ? `Matching assets (${filteredAssets.length})` : "Select department or service first"}</option>
            {filteredAssets.map((asset) => (
              <option key={asset.id ?? asset.tag} value={asset.tag}>
                {asset.tag} - {asset.assetDescription || asset.name} / {[asset.departmentCode, asset.buildingCode || asset.building?.name, asset.floor, asset.room].filter(Boolean).join(" > ")}
              </option>
            ))}
          </select>
          {!departmentCode && !selectedTeamCode && <span className="text-xs font-black text-slate-500">Select a department or service to load only relevant coded assets.</span>}
          {(departmentCode || selectedTeamCode) && !filteredAssets.length && <span className="text-xs font-black text-amber-700">No assets match the selected department/service code.</span>}
        </label>
        {request && (
          <select name="status" defaultValue={request.status} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
            <option>NEW</option><option>TRIAGED</option><option>APPROVED</option><option>REJECTED</option><option>ASSIGNED</option><option>CLOSED</option>
          </select>
        )}
        {!request && <input type="hidden" name="status" value="NEW" />}
        <input type="hidden" name="assignedTeamCode" value={selectedTeamCode || request?.assignedTeamCode || ""} />
        <ImageUploadField name="attachmentUrls" defaultValue={request?.attachmentUrls ?? ""} />
        {request && <textarea name="rejectionReason" defaultValue={request?.rejectionReason ?? ""} placeholder="Reject / close reason" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />}
        <div className="flex justify-end gap-3">
          <button type="submit" disabled={saving} className="h-11 rounded-lg bg-ink px-5 font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </form>
  );
}

function RequestModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/45 p-4 pt-20 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-ink px-4 py-3 text-white">
          <h3 className="text-sm font-black">{title}</h3>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-cyan-400 px-3 py-2 text-xs font-black text-cyan-300">Cancel</button>
          </div>
        </div>
        <div className="max-h-[calc(86vh-56px)] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function RequestPreviewModal({
  request,
  assets,
  teams,
  assignment,
  canManage,
  canApprove,
  savingKey,
  onClose,
  onEdit,
  onAssignTeam,
  onAssignAsset,
  onReview,
  onCreateWorkOrder,
  onReject,
}: {
  request: any;
  assets: any[];
  teams: any[];
  assignment: { assignedTeamCode: string; assignedToEmail: string; assetTag: string };
  canManage: boolean;
  canApprove: boolean;
  savingKey: string | null;
  onClose: () => void;
  onEdit: () => void;
  onAssignTeam: (value: string) => void;
  onAssignAsset: (value: string) => void;
  onReview: () => Promise<void> | void;
  onCreateWorkOrder: () => Promise<void> | void;
  onReject: () => Promise<void> | void;
}) {
  const images = attachmentList(request.attachmentUrls);
  const reviewedStatuses = ["TRIAGED", "APPROVED"];
  const isReviewed = reviewedStatuses.includes(request.status) || Boolean(request.workOrder);
  const canCreateWorkOrder = canManage && isReviewed && !request.workOrder;
  const [localAssets, setLocalAssets] = useState<any[]>(assets);
  const [showAssetCreate, setShowAssetCreate] = useState(false);
  const [assetSaving, setAssetSaving] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [assetTag, setAssetTag] = useState("");
  const requestedTeamCode = assignment.assignedTeamCode || request.assignedTeamCode || "";
  const assetOptions = useMemo(() => scopedAssetOptions(localAssets, request.departmentCode || "", requestedTeamCode, request.location || ""), [localAssets, request.departmentCode, requestedTeamCode, request.location]);
  const selectedAsset = localAssets.find((asset) => asset.tag === assignment.assetTag);
  const locationParts = String(request.location || "").split("/").map((part) => part.trim()).filter(Boolean);

  useEffect(() => {
    if (assignment.assetTag && !assetOptions.some((asset) => asset.tag === assignment.assetTag)) {
      onAssignAsset("");
    }
  }, [assignment.assetTag, assetOptions, onAssignAsset]);

  async function createAssetForRequest() {
    const name = assetName.trim() || request.title || "Request Asset";
    const tag = assetTag.trim() || `REQ-${request.ticketNo || Date.now()}`;
    setAssetSaving(true);
    const response = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag,
        name,
        assetDescription: name,
        additionalDescription: request.description || "",
        category: request.category || "General",
        assetGroup: request.category || "General",
        system: request.serviceCode || request.category || "General",
        criticality: request.priority || "MEDIUM",
        status: "ACTIVE",
        serialNumber: tag,
        manufacturer: "Unknown",
        model: "Request-created asset",
        purchaseCost: 0,
        salvageValue: 0,
        conditionScore: 80,
        departmentCode: request.departmentCode || assignment.assignedTeamCode || "",
        assignedTeamCode: assignment.assignedTeamCode || request.assignedTeamCode || "",
        assignedSupervisorEmail: request.assignedSupervisorEmail || "",
        siteCode: locationParts[0] || "",
        buildingCode: locationParts[1] || "",
        floor: locationParts[2] || "",
        room: locationParts[3] || request.location || "",
        remarks: `Created by supervisor from service request ${request.ticketNo}.`,
      }),
    });
    const result = await response.json();
    if (response.ok) {
      const created = { ...result, site: { name: result.siteCode }, building: { name: result.buildingCode, code: result.buildingCode } };
      setLocalAssets((current) => [created, ...current.filter((asset) => asset.tag !== created.tag)]);
      onAssignAsset(created.tag);
      if (created.assignedTeamCode && !assignment.assignedTeamCode) onAssignTeam(created.assignedTeamCode);
      setAssetName("");
      setAssetTag("");
      setShowAssetCreate(false);
    }
    setAssetSaving(false);
  }

  return (
    <RequestModalShell title={`Request Preview: ${request.ticketNo}`} onClose={onClose}>
      <div className="grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black">{request.title}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">{request.ticketNo} / {request.requester || "Requester"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RequestStatusBadge status={request.status} />
            <RequestPriorityBadge priority={request.priority} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PreviewField label="Category" value={request.category} />
          <PreviewField label="Department" value={request.departmentCode} />
          <PreviewField label="Service" value={request.serviceCode} />
          <PreviewField label="Location" value={request.location} />
          <PreviewField label="Created" value={formatDateCell(request.createdAt)} />
          <PreviewField label="Needed by" value={formatDateCell(request.dueAt)} />
          <PreviewField label="Supervisor" value={request.assignedSupervisorEmail} />
          <PreviewField label="Linked Work Order" value={request.workOrder?.woNo} />
        </div>

        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Description</p>
          <p className="mt-2 whitespace-pre-wrap text-sm font-bold text-slate-700">{request.description || "-"}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-black uppercase text-slate-500">Images / Attachments</p>
          {images.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {images.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {isImageUrl(url) ? <img src={url} alt="Request attachment" className="h-36 w-full object-cover" /> : <span className="block p-3 text-sm font-bold text-lagoon">{url}</span>}
                </a>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-500">No images attached.</p>
          )}
        </div>

        {canManage && (
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <label className="grid gap-2 text-sm font-black text-slate-600">
              Step 2: select related asset for this request
              <select
                value={assignment.assetTag}
                onChange={(event) => {
                  const tag = event.target.value;
                  const asset = localAssets.find((item) => item.tag === tag);
                  onAssignAsset(tag);
                  if (asset?.assignedTeamCode && !assignment.assignedTeamCode) onAssignTeam(asset.assignedTeamCode);
                }}
                disabled={!isReviewed}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-lagoon"
              >
                <option value="">Select asset by department / location</option>
                {assetOptions.map((asset) => (
                  <option key={asset.id} value={asset.tag}>
                    {asset.tag} - {asset.assetDescription || asset.name} / {[asset.buildingCode || asset.building?.name, asset.floor, asset.room].filter(Boolean).join(" > ") || "No location"}
                  </option>
                ))}
              </select>
              {isReviewed && !assetOptions.length && (
                <span className="text-xs font-black text-amber-700">
                  No assets match this request department/service team and location. Add an asset for this request or update the request hierarchy.
                </span>
              )}
            </label>
            <button type="button" disabled={!isReviewed} onClick={() => setShowAssetCreate((current) => !current)} className="h-10 rounded-lg border border-lagoon/30 bg-lagoon/5 px-3 text-xs font-black text-lagoon disabled:opacity-50">
              {showAssetCreate ? "Close Add Asset" : "+ Add Asset for this Request"}
            </button>
            {showAssetCreate && (
              <div className="grid gap-2 rounded-lg bg-slate-50 p-3">
                <input value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder="Asset name" className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lagoon" />
                <input value={assetTag} onChange={(event) => setAssetTag(event.target.value)} placeholder={`Asset code optional, default REQ-${request.ticketNo}`} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lagoon" />
                <div className="grid gap-1 rounded-lg bg-white p-3 text-xs font-bold text-slate-500">
                  <span>Department: {request.departmentCode || "-"}</span>
                  <span>Team: {assignment.assignedTeamCode || request.assignedTeamCode || "-"}</span>
                  <span>Location: {request.location || "-"}</span>
                  <span>Category: {request.category || "General"}</span>
                </div>
                <button type="button" disabled={assetSaving} onClick={createAssetForRequest} className="h-10 rounded-lg bg-ink text-sm font-black text-white disabled:bg-slate-400">{assetSaving ? "Saving..." : "Save Asset and Select"}</button>
              </div>
            )}
            {selectedAsset && (
              <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-600 md:grid-cols-2">
                <span>Asset type: {selectedAsset.assetGroup || selectedAsset.category || "-"}</span>
                <span>Department: {selectedAsset.departmentCode || "-"}</span>
                <span>Assigned team: {selectedAsset.assignedTeamCode || "-"}</span>
                <span>Location: {[selectedAsset.buildingCode || selectedAsset.building?.name, selectedAsset.floor, selectedAsset.room].filter(Boolean).join(" > ") || "-"}</span>
              </div>
            )}
            <label className="grid gap-2 text-sm font-black text-slate-600">
              Step 3: assign service team before creating work order
              <select
                value={assignment.assignedTeamCode}
                onChange={(event) => onAssignTeam(event.target.value)}
                disabled={!isReviewed}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-lagoon"
              >
                <option value="">Assign service team</option>
                {teams.map((team) => <option key={team.id} value={team.code}>{team.code} - {team.name}</option>)}
              </select>
              {!isReviewed && <span className="text-xs font-bold text-amber-700">First change status to Reviewed, then select asset/team and create work order.</span>}
            </label>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase text-slate-500">Workflow</p>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <div className={`rounded-lg p-3 text-sm font-black ${isReviewed ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-700"}`}>1. Change status to Reviewed</div>
            <div className={`rounded-lg p-3 text-sm font-black ${isReviewed ? "bg-white text-slate-700" : "bg-slate-100 text-slate-400"}`}>2. Select asset / location</div>
            <div className={`rounded-lg p-3 text-sm font-black ${isReviewed ? "bg-white text-slate-700" : "bg-slate-100 text-slate-400"}`}>3. Assign service team</div>
            <div className={`rounded-lg p-3 text-sm font-black ${canCreateWorkOrder ? "bg-white text-slate-700" : "bg-slate-100 text-slate-400"}`}>4. Create Work Order</div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          {canManage && <button type="button" onClick={onEdit} className="rounded-lg bg-lagoon px-4 py-3 text-sm font-black text-white">Edit</button>}
          {canApprove && <button type="button" disabled={isReviewed || savingKey === `${request.id}:review`} onClick={onReview} className="rounded-lg bg-slate-700 px-4 py-3 text-sm font-black text-white disabled:bg-slate-400">{savingKey === `${request.id}:review` ? "Saving..." : isReviewed ? "Status Reviewed" : "Change Status to Reviewed"}</button>}
          {canManage && <button type="button" disabled={!canCreateWorkOrder || savingKey === `${request.id}:wo`} onClick={onCreateWorkOrder} className="rounded-lg bg-ink px-4 py-3 text-sm font-black text-white disabled:bg-slate-400">{savingKey === `${request.id}:wo` ? "Creating..." : request.workOrder ? "WO Created" : isReviewed ? "Create Work Order" : "Create Work Order Locked"}</button>}
          {canApprove && <button type="button" disabled={savingKey === `${request.id}:reject`} onClick={onReject} className="rounded-lg bg-amber-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-400">Reject</button>}
        </div>
      </div>
    </RequestModalShell>
  );
}

function WorkOrderPreviewModal({
  work,
  inventory,
  onClose,
  onStatusChange,
  onPatch,
  onEdit,
  onCloseWork,
  onReopenWork,
}: {
  work: any;
  inventory: any[];
  onClose: () => void;
  onStatusChange?: (status: string) => Promise<void> | void;
  onPatch?: (body: Record<string, string>) => Promise<void> | void;
  onEdit?: () => void;
  onCloseWork?: () => void;
  onReopenWork?: () => void;
}) {
  const attachments = [...attachmentList(work.photoUrls), ...attachmentList(work.request?.attachmentUrls)];
  const images = attachments.filter(isImageUrl);
  const files = attachments.filter((item) => !isImageUrl(item));
  const [activeImage, setActiveImage] = useState(images[0] ?? "");
  const [zoom, setZoom] = useState(1);
  const [quickForm, setQuickForm] = useState<"" | "procedure" | "part">("");
  const [quickValue, setQuickValue] = useState("");
  const [quickPartSku, setQuickPartSku] = useState("");
  const [quickPartQty, setQuickPartQty] = useState(1);
  const [tab, setTab] = useState<"comments" | "history">("comments");
  const timelineRows: [string, unknown][] = [
    ["Created", work.createdAt],
    ["Assigned / Planned", work.plannedStart],
    ["First Response", work.responseAt],
    ["Completed by Team", work.resolutionAt],
    ["Supervisor Review", work.verifiedAt],
    ["Closed", work.finishedAt],
    ["Last Updated", work.updatedAt],
  ];
  const checklist = checklistItems(work.jobPlan || work.request?.description || work.title);
  const historyRows = [
    ["Created", work.createdAt, `Work order ${work.woNo} was created.`],
    ["Status", work.responseAt, `Moved to ${work.status?.replaceAll("_", " ") || "Open"}.`],
    ["Completed when", work.resolutionAt, "Service team submitted completion for supervisor review."],
    ["Closed", work.finishedAt, work.supervisorDecision || "Final supervisor review pending."],
  ].filter(([, date]) => Boolean(date));

  async function saveQuick(kind: "procedure" | "part") {
    const value = quickValue.trim();
    if (!value) return;
    if (kind === "procedure") await onPatch?.({ jobPlan: [work.jobPlan, value].filter(Boolean).join("\n") });
    if (kind === "part") await onPatch?.({ inventoryUsed: [work.inventoryUsed, value].filter(Boolean).join("\n") });
    setQuickValue("");
    setQuickForm("");
  }

  async function saveSelectedPart() {
    if (!quickPartSku) return;
    await onPatch?.({ inventoryUsed: [work.inventoryUsed, `${quickPartSku}:${quickPartQty}`].filter(Boolean).join("\n") });
    setQuickPartSku("");
    setQuickPartQty(1);
    setQuickForm("");
  }

  return (
    <RequestModalShell title={`Work Order Preview: ${work.woNo}`} onClose={onClose}>
      <div className="grid gap-5">
        <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <button type="button" disabled={!onStatusChange || work.status === "CLOSED"} onClick={() => onStatusChange?.("ASSIGNED")} className={`rounded-lg border px-3 py-3 text-xs font-black ${["OPEN", "NEW", "ASSIGNED", "REOPENED"].includes(work.status) ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"} disabled:opacity-50`}>Open</button>
            <button type="button" disabled={!onStatusChange || work.status === "CLOSED"} onClick={() => onStatusChange?.("ON_HOLD")} className={`rounded-lg border px-3 py-3 text-xs font-black ${work.status === "ON_HOLD" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"} disabled:opacity-50`}>On Hold</button>
            <button type="button" disabled={!onStatusChange || work.status === "CLOSED"} onClick={() => onStatusChange?.("IN_PROGRESS")} className={`rounded-lg border px-3 py-3 text-xs font-black ${work.status === "IN_PROGRESS" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"} disabled:opacity-50`}>In Progress</button>
            <button type="button" disabled={!onStatusChange || work.status === "CLOSED"} onClick={() => onStatusChange?.("COMPLETED")} className={`rounded-lg border px-3 py-3 text-xs font-black ${work.status === "PENDING_SUPERVISOR_REVIEW" ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-600"} disabled:opacity-50`}>In Review</button>
            <button type="button" disabled={!onStatusChange || work.status === "CLOSED"} onClick={() => onStatusChange?.("COMPLETED")} className={`rounded-lg border px-3 py-3 text-xs font-black ${["COMPLETED", "CLOSED"].includes(work.status) ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"} disabled:opacity-50`}>Completed</button>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black">{work.title}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">{work.woNo} / Linked request {work.request?.ticketNo || "-"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <WorkOrderStatusBadge status={work.status} />
            <RequestPriorityBadge priority={work.priority} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <PreviewField label="Department" value={work.departmentCode} />
          <PreviewField label="Location" value={work.request?.location || work.asset?.location || work.asset?.buildingCode || work.location} />
          <PreviewField label="Category / Service" value={work.serviceCode || work.type || work.request?.category} />
          <PreviewField label="Assigned Team" value={work.assignedTeamCode} />
          <PreviewField label="Assigned Member" value={work.assignedTo?.name || work.assignedTo?.email} />
          <PreviewField label="Due Date" value={formatDateCell(work.dueAt)} />
          <PreviewField label="Asset" value={work.asset?.tag || work.assetTag} />
          <PreviewField label="Work Type" value={work.type} />
          <PreviewField label="Schedule" value={work.jobPlanCode || work.frequency || work.plannedStart} />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-500">Request Details</p>
            <p className="mt-2 text-sm font-black text-slate-700">{work.request?.title || work.title}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-bold text-slate-600">{work.request?.description || work.jobPlan || "-"}</p>
            <p className="mt-3 text-xs font-black text-slate-500">Requester: {work.request?.requester || "-"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-500">Service Team Updates</p>
            <div className="mt-2 grid gap-2">
              <PreviewField label="Work Notes" value={work.workNotes} />
              <PreviewField label="Parts / Materials Requested" value={work.materialRequest} />
              <PreviewField label="Assets Used" value={work.assetsUsed} />
              <PreviewField label="Inventory Used" value={work.inventoryUsed} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase text-slate-500">Attachments & Image Gallery</p>
              {activeImage && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black">Zoom -</button>
                  <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black">Zoom +</button>
                  <a href={activeImage} download className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">Download</a>
                </div>
              )}
            </div>
            {activeImage ? (
              <div className="mt-3 grid place-items-center overflow-auto rounded-lg bg-slate-950/90 p-4 scrollbar-thin">
                <img src={activeImage} alt="Work order proof preview" style={{ transform: `scale(${zoom})` }} className="max-h-[420px] max-w-full origin-center rounded-lg object-contain transition-transform" />
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-500">No image proof uploaded.</p>
            )}
            {images.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-5">
                {images.map((url) => (
                  <button key={url} type="button" onClick={() => { setActiveImage(url); setZoom(1); }} className={`overflow-hidden rounded-lg border ${activeImage === url ? "border-lagoon ring-2 ring-lagoon/20" : "border-slate-200"}`}>
                    <img src={url} alt="Attachment thumbnail" className="h-20 w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {files.length > 0 && (
              <div className="mt-3 grid gap-2">
                {files.map((file) => (
                  <div key={file} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm font-bold">
                    <span className="break-all">{file}</span>
                    <a href={file} download className="text-lagoon">Download</a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-xs font-black uppercase text-amber-700">Supervisor Review</p>
              <PreviewField label="Reopen Reason" value={work.rejectionReason} />
              <div className="mt-2">
                <PreviewField label="Closing / Review Remarks" value={work.supervisorDecision} />
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Timeline</p>
              <div className="mt-2 grid gap-2">
                {timelineRows.map(([label, value]) => <PreviewField key={label} label={label} value={formatDateCell(value as string)} />)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-2 rounded-lg bg-slate-50 p-4 md:grid-cols-3">
          {workTimingRows(work).map(([label, value]) => <PreviewField key={label} label={label} value={label.includes("Time") ? formatDateCell(value as string) : value} />)}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-black">Procedures & Checklist</h4>
              <button type="button" onClick={() => setQuickForm(quickForm === "procedure" ? "" : "procedure")} disabled={!onPatch} className="rounded-lg border border-lagoon/30 px-3 py-2 text-xs font-black text-lagoon disabled:opacity-50">Add Procedure</button>
            </div>
            {quickForm === "procedure" && (
              <div className="mt-3 flex gap-2">
                <input value={quickValue} onChange={(event) => setQuickValue(event.target.value)} placeholder="Procedure / checklist step" className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lagoon" />
                <button type="button" onClick={() => saveQuick("procedure")} className="rounded-lg bg-lagoon px-4 text-sm font-black text-white">Save</button>
              </div>
            )}
            <div className="mt-3 grid gap-2">
              {checklist.map((item, index) => (
                <label key={`${item}-${index}`} className="flex gap-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
                  <input type="checkbox" defaultChecked={["COMPLETED", "PENDING_SUPERVISOR_REVIEW", "CLOSED"].includes(work.status)} className="mt-1" />
                  <span>{index + 1}. {item}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between"><h4 className="font-black">Time</h4><button type="button" onClick={() => onStatusChange?.("IN_PROGRESS")} disabled={!onStatusChange || work.status === "CLOSED"} className="rounded-lg border border-lagoon/30 px-3 py-2 text-xs font-black text-lagoon disabled:opacity-50">Start Timer</button></div>
              <div className="mt-3 grid gap-2">
                <PreviewField label="Response" value={minutesBetween(work.createdAt, work.responseAt)} />
                <PreviewField label="Resolution" value={minutesBetween(work.responseAt, work.resolutionAt)} />
                <PreviewField label="Finish" value={minutesBetween(work.resolutionAt, work.finishedAt)} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between"><h4 className="font-black">Parts</h4><button type="button" onClick={() => setQuickForm(quickForm === "part" ? "" : "part")} disabled={!onPatch} className="rounded-lg border border-lagoon/30 px-3 py-2 text-xs font-black text-lagoon disabled:opacity-50">Add Part</button></div>
              {quickForm === "part" && (
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_90px_auto]">
                  <select value={quickPartSku} onChange={(event) => setQuickPartSku(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-lagoon">
                    <option value="">Select part from stock</option>
                    {inventory.map((item) => <option key={item.id ?? item.sku} value={item.sku}>{item.sku} - {item.name} ({item.onHand ?? 0} {item.unit ?? ""})</option>)}
                  </select>
                  <input value={quickPartQty} onChange={(event) => setQuickPartQty(Math.max(1, Number(event.target.value) || 1))} type="number" min={1} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lagoon" />
                  <button type="button" onClick={saveSelectedPart} className="rounded-lg bg-lagoon px-4 text-sm font-black text-white">Save</button>
                </div>
              )}
              <div className="mt-2 grid gap-1 text-sm font-bold text-slate-600">
                {String(work.inventoryUsed || "").split(/\r?\n|,/).map((part) => part.trim()).filter(Boolean).map((part) => <span key={part} className="rounded-lg bg-slate-50 px-3 py-2">{part}</span>)}
                {!work.inventoryUsed && <span>No parts added.</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex gap-6 border-b border-slate-200 text-sm font-black">
            <button type="button" onClick={() => setTab("comments")} className={`px-2 pb-3 ${tab === "comments" ? "border-b-2 border-lagoon text-lagoon" : "text-slate-500"}`}>WO Comments</button>
            <button type="button" onClick={() => setTab("history")} className={`px-2 pb-3 ${tab === "history" ? "border-b-2 border-lagoon text-lagoon" : "text-slate-500"}`}>History</button>
          </div>
          <div className="mt-4 grid gap-4">
            {tab === "comments" ? (
              <>
                <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-600">{work.workNotes || "No additional comments yet."}</p>
                <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-600">{work.supervisorRequest || work.materialRequest || "No material or supervisor requests."}</p>
              </>
            ) : (
              <>
                {historyRows.map(([label, date, note]) => (
                  <div key={`${label}-${date}`} className="grid gap-1 rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-lagoon">{label}</p>
                      <p className="text-xs font-bold text-slate-500">{formatDateCell(date as string)}</p>
                    </div>
                    <p className="font-bold text-slate-700">{note}</p>
                  </div>
                ))}
                <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-black text-lagoon">Parts history</p>
                  <p className="font-bold text-slate-700">{work.inventoryUsed || "No parts used yet."}</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          {onEdit && <button type="button" onClick={onEdit} className="rounded-lg bg-lagoon px-4 py-3 text-sm font-black text-white">Edit</button>}
          {onReopenWork && <button type="button" onClick={onReopenWork} className="rounded-lg bg-amber-600 px-4 py-3 text-sm font-black text-white">Reopen Work Order</button>}
          {onCloseWork && <button type="button" onClick={onCloseWork} className="rounded-lg bg-ink px-4 py-3 text-sm font-black text-white">Close Work Order</button>}
        </div>
      </div>
    </RequestModalShell>
  );
}

function WorkOrderSupervisorReviewModal({
  work,
  action,
  teams,
  saving,
  onClose,
  onSubmit,
}: {
  work: any;
  action: "close" | "reopen";
  teams: any[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void> | void;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
  }
  const isReopen = action === "reopen";

  return (
    <RequestModalShell title={`${isReopen ? "Reopen" : "Close"} Work Order: ${work.woNo}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <input type="hidden" name="status" value={isReopen ? "REOPENED" : "CLOSED"} />
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-lg font-black">{work.title}</p>
          <p className="mt-1 text-sm font-bold text-slate-500">{work.departmentCode || "-"} / {work.assignedTeamCode || "No team assigned"}</p>
        </div>
        {isReopen ? (
          <>
            <label className="grid gap-2 text-sm font-black text-slate-600">
              Reopen Reason
              <input name="rejectionReason" required placeholder="Why completion is rejected" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-600">
              Remarks / Instructions
              <textarea name="supervisorDecision" required placeholder="Instructions for service team before resubmitting" className="min-h-28 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-600">
              Reassigned Service Team
              <select name="assignedTeamCode" defaultValue={work.assignedTeamCode ?? ""} className="h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-lagoon">
                <option value="">Keep unassigned</option>
                {teams.map((team) => <option key={team.id} value={team.code}>{team.code} - {team.name}</option>)}
              </select>
            </label>
          </>
        ) : (
          <label className="grid gap-2 text-sm font-black text-slate-600">
            Final Remarks
            <textarea name="supervisorDecision" placeholder="Final verification remarks. Closing time and supervisor are captured automatically." className="min-h-28 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
          </label>
        )}
        <button disabled={saving} className={`h-11 rounded-lg font-black text-white disabled:bg-slate-400 ${isReopen ? "bg-amber-600" : "bg-ink"}`}>
          {saving ? "Saving..." : isReopen ? "Reopen Work Order" : "Close Work Order"}
        </button>
      </form>
    </RequestModalShell>
  );
}

function PreviewField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-700">
        {isCurrencyField(label) ? <CurrencyAmount value={value} /> : String(value || "-")}
      </p>
    </div>
  );
}

function attachmentList(value: unknown) {
  return String(value || "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isImageUrl(value: string) {
  const pathOnly = value.split("?")[0];
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(pathOnly) || value.startsWith("/uploads/") || value.startsWith("/api/files/");
}

function checklistItems(value: unknown) {
  const items = String(value || "")
    .split(/\r?\n|(?:^|\s)\d+[.)]\s+/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter((item) => item.length > 3);
  return items.length ? items.slice(0, 12) : [
    "Check filters and replace if required",
    "Check fan blades for dust buildup and clean if necessary",
    "Check moving parts for cracks and excessive wear",
    "Verify safety isolation and lockout requirements",
    "Record completion notes, time, parts and proof photos",
  ];
}

function RequestStatusBadge({ status }: { status: string }) {
  const tone =
    status === "CLOSED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    status === "REJECTED" ? "bg-rose-50 text-rose-700 border-rose-200" :
    status === "APPROVED" ? "bg-cyan-50 text-cyan-700 border-cyan-200" :
    "bg-amber-50 text-amber-700 border-amber-200";
  return <span className={`rounded-full border px-2 py-1 text-xs font-black ${tone}`}>{status.replaceAll("_", " ")}</span>;
}

function RequestPriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "CRITICAL" ? "text-rose-700" :
    priority === "HIGH" ? "text-orange-700" :
    priority === "MEDIUM" ? "text-amber-700" :
    "text-emerald-700";
  return <span className={`text-xs font-black uppercase ${tone}`}>{priority}</span>;
}

function formatDateCell(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatFileSize(value: number | string | null | undefined) {
  const size = Number(value || 0);
  if (!size) return "-";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function WorkOrderStatusBadge({ status }: { status: string }) {
  const tone =
    status === "CLOSED" || status === "VERIFIED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    status === "IN_PROGRESS" || status === "ASSIGNED" ? "bg-cyan-50 text-cyan-700 border-cyan-200" :
    status === "PENDING_SUPERVISOR_REVIEW" ? "bg-violet-50 text-violet-700 border-violet-200" :
    status === "ON_HOLD" || status === "REOPENED" ? "bg-amber-50 text-amber-700 border-amber-200" :
    status === "REJECTED" ? "bg-rose-50 text-rose-700 border-rose-200" :
    "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`rounded-full border px-2 py-1 text-xs font-black ${tone}`}>{status?.replaceAll("_", " ") || "OPEN"}</span>;
}

function WorkOrderCalendar({ works, monthDate, setMonthDate, setSelectedWorkId }: { works: any[]; monthDate: Date; setMonthDate: (date: Date) => void; setSelectedWorkId: (id: string) => void }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
  const monthLabel = monthDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const worksByDay = works.reduce((acc: Record<string, any[]>, work) => {
    const value = work.dueAt || work.plannedStart || work.createdAt;
    if (!value) return acc;
    const key = new Date(value).toISOString().slice(0, 10);
    acc[key] = [...(acc[key] ?? []), work];
    return acc;
  }, {});

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setMonthDate(new Date(year, month - 1, 1))} className="h-9 rounded-lg border border-slate-200 px-3 text-lagoon">{"<"}</button>
          <button type="button" onClick={() => setMonthDate(new Date(year, month + 1, 1))} className="h-9 rounded-lg border border-slate-200 px-3 text-lagoon">{">"}</button>
          <h4 className="text-2xl font-black">{monthLabel}</h4>
        </div>
        <div className="flex rounded-lg border border-lagoon text-sm font-black text-lagoon">
          <span className="px-3 py-2">Week</span>
          <span className="bg-lagoon px-3 py-2 text-white">Month</span>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100 text-center text-xs font-black">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="border-r border-slate-200 p-2 last:border-r-0">{day}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const dayWorks = worksByDay[key] ?? [];
          const inMonth = day.getMonth() === month;
          const isToday = key === new Date().toISOString().slice(0, 10);
          return (
            <div key={key} className={`min-h-32 border-b border-r border-slate-200 p-2 last:border-r-0 ${inMonth ? "bg-white" : "bg-slate-100"} ${isToday ? "bg-lime-50" : ""}`}>
              <div className={`mb-2 grid h-6 w-6 place-items-center rounded-full text-xs font-black ${isToday ? "bg-lime-400 text-ink" : "text-slate-500"}`}>{day.getDate()}</div>
              <div className="grid gap-1">
                {dayWorks.slice(0, 4).map((work) => (
                  <button key={work.id} type="button" onClick={() => setSelectedWorkId(work.id)} className="truncate rounded bg-slate-50 px-2 py-1 text-left text-xs font-bold text-slate-700 hover:bg-lagoon/10">
                    {work.title} <span className="text-coral">{work.priority === "CRITICAL" ? "!" : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImageUploadField({ name, defaultValue = "" }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const urls = value.split(/\s+/).map((item) => item.trim()).filter(Boolean);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    setUploading(true);
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const result = await response.json();
    const next = [...urls, ...(result.urls ?? [])].join("\n");
    setValue(next);
    setUploading(false);
  }

  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <input type="hidden" name={name} value={value} />
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg bg-white p-4 text-center text-sm font-bold text-slate-600">
        <Upload size={18} className="text-lagoon" />
        {uploading ? "Uploading..." : "Upload images"}
        <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => upload(event.target.files)} />
      </label>
      <textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="Uploaded image URLs" className="min-h-20 rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-lagoon" />
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.slice(0, 6).map((url) => (
            <img key={url} src={url} alt="Uploaded proof" className="h-20 w-full rounded-lg object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkOrderForm({ title, work, data, onSubmit, saving }: { title: string; work?: any; data: ConsoleData; onSubmit: (formData: FormData) => void; saving: boolean }) {
  const initialAssetTag = work?.asset?.tag ?? work?.assetTag ?? "";
  const [selectedAssetTag, setSelectedAssetTag] = useState(initialAssetTag);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(new FormData(form));
    if (!work) form.reset();
  }

  const assetTypes = Array.from(new Set(data.assets.map((asset) => asset.assetGroup || asset.category).filter(Boolean)));
  const selectedAsset = data.assets.find((asset) => asset.tag === selectedAssetTag);
  const matchedService = selectedAsset ? data.services.find((service) => service.category === selectedAsset.category || service.category === selectedAsset.assetGroup || service.code === selectedAsset.serviceCode) : null;
  const selectedLocation = selectedAsset ? [selectedAsset.siteCode || selectedAsset.site?.name, selectedAsset.buildingCode || selectedAsset.building?.name, selectedAsset.floor, selectedAsset.room].filter(Boolean).join(" > ") : "";

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <h3 className="text-xl font-black">{title}</h3>
      <div className="mt-4 grid gap-3">
        <label className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-black text-amber-800">
          <span>Incident / Case</span>
          <input type="hidden" name="isIncidentCase" value="false" />
          <input type="checkbox" name="isIncidentCase" value="true" defaultChecked={Boolean(work?.isIncidentCase)} />
        </label>
        <input name="title" defaultValue={work?.title ?? ""} placeholder="Title" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <input name="type" defaultValue={work?.type ?? ""} placeholder="Work type" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <select key={`asset-type-${selectedAssetTag}`} name="assetType" defaultValue={work?.assetType ?? selectedAsset?.assetGroup ?? selectedAsset?.category ?? ""} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option value="">Select asset type</option>
          {assetTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <select name="assetTag" value={selectedAssetTag} onChange={(event) => setSelectedAssetTag(event.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option value="">Select asset</option>
          {data.assets.map((asset) => <option key={asset.id} value={asset.tag}>{asset.tag} - {asset.assetDescription ?? asset.name}</option>)}
        </select>
        {selectedLocation && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">Asset location: {selectedLocation}</div>}
        <select key={`dept-${selectedAssetTag}`} name="departmentCode" defaultValue={work?.departmentCode ?? selectedAsset?.departmentCode ?? ""} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option value="">Select department</option>
          {data.departments.map((department) => <option key={department.id} value={department.code}>{department.code} - {department.name}</option>)}
        </select>
        <select key={`service-${selectedAssetTag}`} name="serviceCode" defaultValue={work?.serviceCode ?? matchedService?.code ?? ""} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option value="">Select service</option>
          {data.services.map((service) => <option key={service.id} value={service.code}>{service.code} - {service.name}</option>)}
        </select>
        <select key={`team-${selectedAssetTag}`} name="assignedTeamCode" defaultValue={work?.assignedTeamCode ?? selectedAsset?.assignedTeamCode ?? ""} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option value="">Assign service team</option>
          {data.teams.map((team) => <option key={team.id} value={team.code}>{team.code} - {team.name}</option>)}
        </select>
        <select name="jobPlanCode" defaultValue={work?.jobPlanCode ?? ""} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option value="">Select job plan</option>
          {data.jobPlans.map((plan) => <option key={plan.id} value={plan.code}>{plan.code} - {plan.name}</option>)}
        </select>
        <select name="priority" defaultValue={work?.priority ?? "MEDIUM"} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
        </select>
        {work && <select name="status" defaultValue={work.status} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon"><option>PENDING_ASSIGNMENT</option><option>ASSIGNED</option><option>ACCEPTED</option><option>REJECTED</option><option>IN_PROGRESS</option><option>ON_HOLD</option><option>COMPLETED</option><option>PENDING_SUPERVISOR_REVIEW</option><option>VERIFIED</option><option>REOPENED</option><option>CLOSED</option></select>}
        <textarea key={`job-${selectedAssetTag}`} name="jobPlan" defaultValue={work?.jobPlan ?? (selectedAsset ? `Inspect ${selectedAsset.assetDescription || selectedAsset.name} at ${selectedLocation}. Review asset condition, diagnose issue, record parts used, update asset history and attach proof.` : "")} placeholder="Job plan / work steps" className="min-h-24 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
        <textarea name="safetyNotes" defaultValue={work?.safetyNotes ?? ""} placeholder="Safety notes" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
        <ImageUploadField name="photoUrls" defaultValue={work?.photoUrls ?? ""} />
        {work && (
          <div className="grid gap-3 rounded-lg bg-slate-50 p-3">
            <p className="text-sm font-black text-slate-700">Team Member Update</p>
            <input name="responseAt" type="datetime-local" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
            <input name="resolutionAt" type="datetime-local" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
            <input name="finishedAt" type="datetime-local" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
            <textarea name="assetsUsed" defaultValue={work.assetsUsed ?? ""} placeholder="Assets added or used" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
            <PartsSelector inventory={data.inventory} defaultValue={work.inventoryUsed ?? ""} />
            <textarea name="workNotes" defaultValue={work.workNotes ?? ""} placeholder="Work notes / execution log" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
            <textarea name="materialRequest" defaultValue={work.materialRequest ?? ""} placeholder="Material request to supervisor" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
            <textarea name="rejectionReason" defaultValue={work.rejectionReason ?? ""} placeholder="Technician reject reason, if rejected" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
            <textarea name="supervisorRequest" defaultValue={work.supervisorRequest ?? ""} placeholder="Request from supervisor / support needed" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
          </div>
        )}
        {work && (
          <div className="grid gap-3 rounded-lg bg-emerald-50 p-3">
            <p className="text-sm font-black text-emerald-800">Supervisor Verification</p>
            <textarea name="supervisorDecision" defaultValue={work.supervisorDecision ?? ""} placeholder="Approve, reject, reopen or reassign decision notes" className="min-h-20 rounded-lg border border-emerald-100 p-3 outline-none focus:border-lagoon" />
          </div>
        )}
        {work && <input name="estimatedHours" type="number" defaultValue={work.estimatedHours ?? ""} placeholder="Estimated hours" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />}
        <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Save Work Order"}</button>
      </div>
    </form>
  );
}

function PartsSelector({ inventory, defaultValue = "" }: { inventory: any[]; defaultValue?: string }) {
  const parseDefault = () => String(defaultValue || "")
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sku, qty] = line.split(":").map((part) => part.trim());
      return { sku, quantity: Math.max(1, Number.parseInt(qty || "1", 10) || 1) };
    });
  const [rows, setRows] = useState(parseDefault);
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState(1);
  const value = rows.map((row) => `${row.sku}:${row.quantity}`).join("\n");
  const selectedItem = inventory.find((item) => item.sku === sku);

  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <input type="hidden" name="inventoryUsed" value={value} />
      <p className="text-sm font-black text-slate-700">Parts Used</p>
      <div className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
        <select value={sku} onChange={(event) => setSku(event.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lagoon">
          <option value="">Select part from stock</option>
          {inventory.map((item) => <option key={item.id ?? item.sku} value={item.sku}>{item.sku} - {item.name} ({item.onHand ?? 0} {item.unit ?? ""})</option>)}
        </select>
        <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lagoon" />
        <button
          type="button"
          onClick={() => {
            if (!sku) return;
            setRows((current) => {
              const existing = current.find((row) => row.sku === sku);
              if (existing) return current.map((row) => row.sku === sku ? { ...row, quantity: row.quantity + quantity } : row);
              return [...current, { sku, quantity }];
            });
            setSku("");
            setQuantity(1);
          }}
          className="h-11 rounded-lg bg-lagoon px-4 text-sm font-black text-white"
        >
          Add Part
        </button>
      </div>
      {selectedItem && <p className="text-xs font-bold text-slate-500">Available stock: {selectedItem.onHand ?? 0} {selectedItem.unit ?? ""}</p>}
      <div className="grid gap-2">
        {rows.length ? rows.map((row) => {
          const item = inventory.find((stock) => stock.sku === row.sku);
          return (
            <div key={row.sku} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-bold">{row.sku} - {item?.name ?? "Part"}</span>
              <div className="flex items-center gap-3">
                <span className="font-black">Qty {row.quantity}</span>
                <button type="button" onClick={() => setRows((current) => current.filter((itemRow) => itemRow.sku !== row.sku))} className="text-xs font-black text-coral">Remove</button>
              </div>
            </div>
          );
        }) : <p className="text-xs font-bold text-slate-400">No parts selected.</p>}
      </div>
    </div>
  );
}

function WorkExecutionForm({ work, inventory, onSubmit, saving }: { work: any; inventory: any[]; onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <h3 className="text-xl font-black">Update Assigned Work</h3>
      <p className="mt-1 text-sm font-bold text-slate-500">{work.woNo} / {work.title}</p>
      <div className="mt-4 grid gap-3">
        <select name="status" defaultValue={work.status} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option value="IN_PROGRESS">In Progress</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="COMPLETED">Completed - Submit for Supervisor Review</option>
        </select>
        <textarea name="workNotes" defaultValue={work.workNotes ?? ""} placeholder="Work description / notes" className="min-h-24 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
        <ImageUploadField name="photoUrls" defaultValue={work.photoUrls ?? ""} />
        <textarea name="materialRequest" defaultValue={work.materialRequest ?? ""} placeholder="Parts request for supervisor approval" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
        <textarea name="assetsUsed" defaultValue={work.assetsUsed ?? ""} placeholder="Assets requested or used" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
        <PartsSelector inventory={inventory} defaultValue={work.inventoryUsed ?? ""} />
        <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Submit Update"}</button>
      </div>
    </form>
  );
}

function Ppm({
  ppms,
  ppmsTotal,
  assets,
  locations,
  workOrders,
  submitPpm,
  updatePpm,
  deletePpm,
  isAdmin,
  saving,
}: {
  ppms: any[];
  ppmsTotal?: number;
  assets: any[];
  locations: any[];
  workOrders: any[];
  submitPpm: (formData: FormData) => void;
  updatePpm: (body: Record<string, unknown>) => Promise<void> | void;
  deletePpm: (id: string) => void;
  isAdmin: boolean;
  saving: boolean;
}) {
  const [previewPpm, setPreviewPpm] = useState<any | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedPpmIds, setSelectedPpmIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [ppmRowsSource, setPpmRowsSource] = useState<any[]>(ppms);
  const [ppmTotal, setPpmTotal] = useState(ppmsTotal ?? ppms.length);
  const [ppmLoading, setPpmLoading] = useState(false);
  const ppmScrollRef = useRef<HTMLDivElement | null>(null);
  const grouped = ppmRowsSource.reduce((acc: Record<string, any[]>, ppm) => {
    const key = ppm.nextDue ? new Date(ppm.nextDue).toISOString().slice(0, 10) : "Unscheduled";
    acc[key] = [...(acc[key] ?? []), ppm];
    return acc;
  }, {});
  const hasMorePpms = ppmRowsSource.length < ppmTotal;
  const selectedVisiblePpms = ppmRowsSource.filter((ppm) => selectedPpmIds.has(ppm.id));
  const allVisiblePpmsSelected = isAdmin && Boolean(ppmRowsSource.length) && selectedVisiblePpms.length === ppmRowsSource.length;
  const someVisiblePpmsSelected = isAdmin && selectedVisiblePpms.length > 0 && !allVisiblePpmsSelected;

  useEffect(() => {
    setPage(1);
    ppmScrollRef.current?.scrollTo({ top: 0 });
  }, [search, statusFilter]);

  useEffect(() => {
    setPpmRowsSource(ppms);
    setPpmTotal((current) => Math.max(current, ppmsTotal ?? ppms.length));
  }, [ppms, ppmsTotal]);

  useEffect(() => {
    setSelectedPpmIds((current) => new Set(Array.from(current).filter((id) => ppmRowsSource.some((ppm) => ppm.id === id))));
  }, [ppmRowsSource]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const defaultFilters = page === 1 && !search && statusFilter === "All";
      if (defaultFilters && ppms.length) {
        setPpmRowsSource(ppms);
        setPpmTotal(ppmsTotal ?? ppms.length);
        setPpmLoading(false);
        return;
      }
      setPpmLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          query: search,
          status: statusFilter,
        });
        const response = await fetch(`/api/ppm?${params.toString()}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          setPpmRowsSource((current) => page === 1 ? result.ppms ?? [] : [...current, ...(result.ppms ?? [])]);
          setPpmTotal(Number(result.total ?? result.ppms?.length ?? 0));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      } finally {
        if (!controller.signal.aborted) setPpmLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [page, search, statusFilter]);

  function handlePpmScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 180;
    if (nearBottom && hasMorePpms && !ppmLoading) {
      setPpmLoading(true);
      setPage((current) => current + 1);
    }
  }

  function togglePpmSelection(id: string, checked: boolean) {
    setSelectedPpmIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisiblePpms(checked: boolean) {
    setSelectedPpmIds((current) => {
      const next = new Set(current);
      ppmRowsSource.forEach((ppm) => {
        if (checked) next.add(ppm.id);
        else next.delete(ppm.id);
      });
      return next;
    });
  }

  async function bulkDeleteSelectedPpms() {
    const ids = Array.from(selectedPpmIds);
    if (!ids.length) return;
    await Promise.all(ids.map((id) => deletePpm(id)));
    setSelectedPpmIds(new Set());
  }

  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <Panel title="Preventive Maintenance Planner" icon={CalendarCheck}>
        <ReportButtons type="ppm" label="PPM report" />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setView("list")} className={`h-10 rounded-lg px-4 text-sm font-black ${view === "list" ? "bg-lagoon text-white" : "bg-slate-50 text-slate-600"}`}>List</button>
            <button type="button" onClick={() => setView("calendar")} className={`h-10 rounded-lg px-4 text-sm font-black ${view === "calendar" ? "bg-lagoon text-white" : "bg-slate-50 text-slate-600"}`}>Calendar</button>
          </div>
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 lg:max-w-md">
            <Search size={16} className="text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PMs" className="h-11 w-full text-sm outline-none" />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="All">Status</option>
            <option value="Active">Active</option>
            <option value="Paused">Paused</option>
          </select>
        </div>
        {view === "list" ? (
          <>
            {isAdmin && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">
                <span>Selected {selectedPpmIds.size.toLocaleString()} PPM plans</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => toggleVisiblePpms(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-lagoon">Select Visible</button>
                  <button type="button" disabled={!selectedPpmIds.size} onClick={bulkDeleteSelectedPpms} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Delete All</button>
                  <button type="button" disabled={!selectedPpmIds.size} onClick={() => setSelectedPpmIds(new Set())} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">Clear Selection</button>
                </div>
              </div>
            )}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-black text-slate-600">
              <span>Showing {ppmRowsSource.length.toLocaleString()} of {ppmTotal.toLocaleString()} PPM plans</span>
              {ppmLoading && <span className="text-lagoon">Loading PPM plans...</span>}
            </div>
            <div ref={ppmScrollRef} onScroll={handlePpmScroll} className="cafm-scroll-x max-h-[70vh] overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
              <table className="cafm-data-table min-w-[1280px] border-collapse bg-white text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    {isAdmin && (
                      <th className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={allVisiblePpmsSelected}
                          ref={(input) => {
                            if (input) input.indeterminate = someVisiblePpmsSelected;
                          }}
                          onChange={(event) => toggleVisiblePpms(event.target.checked)}
                        />
                      </th>
                    )}
                    <th className="px-3 py-3">#</th><th className="px-3 py-3">Title</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Frequency</th><th className="px-3 py-3">Next Due</th><th className="px-3 py-3">Priority</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Asset</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ppmRowsSource.map((ppm, index) => {
                  const asset = assets.find((item) => item.tag === ppm.assetTag);
                  const location = locations.find((item) => item.code === ppm.locationCode);
                  return (
                    <tr key={ppm.id} onClick={() => setPreviewPpm(ppm)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                      {isAdmin && (
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedPpmIds.has(ppm.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => togglePpmSelection(ppm.id, event.target.checked)}
                          />
                        </td>
                      )}
                      <td className="px-3 py-3 font-black text-slate-500">{index + 1}</td>
                      <td className="px-3 py-3"><p className="font-black">{ppm.name}</p><p className="text-xs font-bold text-slate-500">{ppm.code}</p></td>
                      <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-black ${ppm.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{ppm.active ? "Planned" : "Paused"}</span></td>
                      <td className="px-3 py-3">{ppm.frequency}</td>
                      <td className="px-3 py-3">{formatDateCell(ppm.nextDue)}</td>
                      <td className="px-3 py-3"><RequestPriorityBadge priority={ppm.priority || "MEDIUM"} /></td>
                      <td className="px-3 py-3">{ppm.departmentCode || asset?.departmentCode || "-"}</td>
                      <td className="px-3 py-3 text-lagoon">{ppm.assetTag || "-"}</td>
                      <td className="px-3 py-3"><p className="font-bold">{ppm.locationCode || asset?.locationCode || "-"}</p><p className="text-xs text-slate-500">{location?.description || asset?.locationDesc || ""}</p></td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={(event) => { event.stopPropagation(); setPreviewPpm(ppm); }} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">Preview</button>
                          <button type="button" disabled={saving} onClick={(event) => { event.stopPropagation(); updatePpm({ id: ppm.id, active: !ppm.active }); }} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">{ppm.active ? "Pause" : "Activate"}</button>
                          {isAdmin && <button type="button" disabled={saving} onClick={(event) => { event.stopPropagation(); deletePpm(ppm.id); }} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">Delete</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <div className="mt-3 text-center text-sm font-black text-slate-500">
              {hasMorePpms ? "Scroll down to load more PPM plans" : "All matching PPM plans loaded"}
            </div>
          </>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-black text-lagoon">{date}</p>
                <div className="mt-2 grid gap-2">
                  {items.map((ppm) => (
                    <button key={ppm.id} type="button" onClick={() => setPreviewPpm(ppm)} className="rounded-lg bg-white p-2 text-left text-sm hover:bg-lagoon/10">
                      <p className="font-bold">{ppm.name}</p>
                      <p className="text-slate-500">{ppm.assetTag || ppm.locationCode} / {ppm.frequency}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <PpmCreateForm assets={assets} onSubmit={submitPpm} saving={saving} />
      {previewPpm && (
        <PmPreviewModal
          ppm={previewPpm}
          asset={assets.find((asset) => asset.tag === previewPpm.assetTag)}
          location={locations.find((location) => location.code === previewPpm.locationCode)}
          workOrders={workOrders.filter((work) => work.asset?.tag === previewPpm.assetTag || work.assetTag === previewPpm.assetTag)}
          saving={saving}
          onClose={() => setPreviewPpm(null)}
          onUpdate={(body) => {
            setPreviewPpm((current: any) => current ? { ...current, ...body } : current);
            return updatePpm({ id: previewPpm.id, ...body });
          }}
        />
      )}
    </section>
  );
}

function PpmCreateForm({ assets, onSubmit, saving }: { assets: any[]; onSubmit: (formData: FormData) => void; saving: boolean }) {
  const [selectedAssetTag, setSelectedAssetTag] = useState("");
  const selectedAsset = assets.find((asset) => asset.tag === selectedAssetTag);
  const selectedLocation = selectedAsset ? [selectedAsset.siteCode || selectedAsset.site?.name, selectedAsset.buildingCode || selectedAsset.building?.name, selectedAsset.floor, selectedAsset.room].filter(Boolean).join(" > ") : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(new FormData(form));
    form.reset();
    setSelectedAssetTag("");
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-sun/50 text-amber-700">
          <CalendarCheck size={20} />
        </div>
        <h3 className="text-xl font-black">Create PPM</h3>
      </div>
      <div className="grid min-w-0 gap-3">
        <input name="code" placeholder="PPM code" className={TICKET_PLAN_FIELD_CLASS} />
        <input name="name" placeholder="PPM title" className={TICKET_PLAN_FIELD_CLASS} />
        <select name="assetTag" value={selectedAssetTag} onChange={(event) => setSelectedAssetTag(event.target.value)} className={TICKET_PLAN_FIELD_CLASS}>
          <option value="">Select asset from register</option>
          {assets.map((asset) => (
            <option key={asset.id ?? asset.tag} value={asset.tag}>
              {asset.tag} - {asset.assetDescription || asset.name} / {asset.assetGroup || asset.category || "Asset"}
            </option>
          ))}
        </select>
        <input name="locationCode" value={selectedAsset?.locationCode || ""} readOnly placeholder="Linked location" className={`${TICKET_PLAN_FIELD_CLASS} bg-slate-50 text-slate-500`} />
        <input name="departmentCode" value={selectedAsset?.departmentCode || ""} readOnly placeholder="Department" className={`${TICKET_PLAN_FIELD_CLASS} bg-slate-50 text-slate-500`} />
        {selectedAsset && (
          <div className="grid gap-1 rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-600">
            <span>Location: {selectedLocation || "-"}</span>
            <span>Department: {selectedAsset.departmentCode || "-"}</span>
            <span>Team: {selectedAsset.assignedTeamCode || "-"}</span>
          </div>
        )}
        <select name="frequency" className={TICKET_PLAN_FIELD_CLASS}>
          <option value="">Select frequency</option>
          <option>Daily</option>
          <option>Weekly</option>
          <option>Monthly</option>
          <option>Quarterly</option>
          <option>Semi Annual</option>
          <option>Annual</option>
        </select>
        <input name="nextDue" type="date" className={TICKET_PLAN_FIELD_CLASS} />
        <select name="priority" className={TICKET_PLAN_FIELD_CLASS}>
          <option value="MEDIUM">Medium priority</option>
          <option value="LOW">Low priority</option>
          <option value="HIGH">High priority</option>
          <option value="CRITICAL">Critical priority</option>
        </select>
        <input name="durationHrs" type="number" min={0} step="0.5" placeholder="Duration hours" className={TICKET_PLAN_FIELD_CLASS} />
        <textarea name="checklist" placeholder="Checklist / preventive maintenance procedure" className={`${TICKET_PLAN_TEXTAREA_CLASS} min-h-28`} />
        <button disabled={saving} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
          <Plus size={18} />
          {saving ? "Saving..." : "Submit"}
        </button>
      </div>
    </form>
  );
}

function PmPreviewModal({
  ppm,
  asset,
  location,
  workOrders,
  saving,
  onClose,
  onUpdate,
}: {
  ppm: any;
  asset?: any;
  location?: any;
  workOrders: any[];
  saving: boolean;
  onClose: () => void;
  onUpdate: (body: Record<string, unknown>) => Promise<void> | void;
}) {
  const checklist = checklistItems(ppm.checklist);
  const [tab, setTab] = useState<"comments" | "history">("history");
  const [quickForm, setQuickForm] = useState<"" | "procedure" | "part">("");
  const [quickValue, setQuickValue] = useState("");
  const priority = ppm.priority || (ppm.durationHrs >= 8 ? "CRITICAL" : ppm.durationHrs >= 4 ? "HIGH" : "MEDIUM");
  const historyData = workOrders.slice(0, 8).map((work) => ({
    name: String(formatDateCell(work.createdAt)).slice(0, 10),
    created: 1,
    completed: ["CLOSED", "COMPLETED", "PENDING_SUPERVISOR_REVIEW"].includes(work.status) ? 1 : 0,
  }));

  async function savePpmQuick(kind: "procedure" | "part") {
    const value = quickValue.trim();
    if (!value) return;
    const line = kind === "procedure" ? value : `Part: ${value}`;
    await onUpdate({ checklist: [ppm.checklist, line].filter(Boolean).join("\n") });
    setQuickValue("");
    setQuickForm("");
  }

  return (
    <RequestModalShell title={`PM | ${ppm.name}`} onClose={onClose}>
      <div className="grid gap-5">
        <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <button type="button" disabled={saving} onClick={() => onUpdate({ active: true })} className={`rounded-lg border px-3 py-3 text-xs font-black ${ppm.active ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>Active</button>
            <button type="button" disabled={saving} onClick={() => onUpdate({ active: true })} className="rounded-lg border border-lime-300 bg-lime-100 px-3 py-3 text-xs font-black text-lime-800">Planned</button>
            <button type="button" disabled={saving} onClick={() => onUpdate({ active: false })} className={`rounded-lg border px-3 py-3 text-xs font-black ${!ppm.active ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600"}`}>Paused</button>
            <button type="button" disabled={saving} onClick={() => onUpdate({ nextDue: new Date().toISOString() })} className="rounded-lg border border-lagoon/30 px-3 py-3 text-xs font-black text-lagoon">Start Now</button>
          </div>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-500">{ppm.code} / Next due {formatDateCell(ppm.nextDue)}</p>
            <h3 className="mt-1 text-2xl font-black">{ppm.name}</h3>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm font-bold text-slate-600">{ppm.checklist}</p>
          </div>
          <RequestPriorityBadge priority={priority} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <PreviewField label="Starting From" value={formatDateCell(ppm.nextDue)} />
          <PreviewField label="Progression" value={ppm.active ? "Active" : "Paused"} />
          <PreviewField label="Time to Complete" value={`${ppm.durationHrs || 0} hrs`} />
          <PreviewField label="Work Type" value="Preventive" />
          <PreviewField label="Schedule" value={ppm.frequency} />
          <PreviewField label="Asset" value={ppm.assetTag} />
          <PreviewField label="Location Code" value={ppm.locationCode || asset?.locationCode} />
          <PreviewField label="Department" value={ppm.departmentCode || asset?.departmentCode} />
          <PreviewField label="Category" value={asset?.assetGroup || asset?.category} />
          <PreviewField label="Location" value={location?.description || asset?.locationDesc || [asset?.buildingCode, asset?.floor, asset?.room].filter(Boolean).join(" / ")} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-black">Procedures & Checklist</h4>
            <button type="button" onClick={() => setQuickForm(quickForm === "procedure" ? "" : "procedure")} className="rounded-lg border border-lagoon/30 px-3 py-2 text-xs font-black text-lagoon">Add Procedure</button>
          </div>
          {quickForm === "procedure" && (
            <div className="mt-3 flex gap-2">
              <input value={quickValue} onChange={(event) => setQuickValue(event.target.value)} placeholder="Procedure / checklist step" className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lagoon" />
              <button type="button" onClick={() => savePpmQuick("procedure")} className="rounded-lg bg-lagoon px-4 text-sm font-black text-white">Save</button>
            </div>
          )}
          <div className="mt-3 grid gap-2">
            {checklist.map((item, index) => (
              <label key={`${item}-${index}`} className="flex gap-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
                <input type="checkbox" className="mt-1" />
                <span>{index + 1}. {item}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[0.7fr_1fr]">
          <div className="grid gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between"><h4 className="font-black">Parts</h4><button type="button" onClick={() => setQuickForm(quickForm === "part" ? "" : "part")} className="rounded-lg border border-lagoon/30 px-3 py-2 text-xs font-black text-lagoon">Add Part</button></div>
              {quickForm === "part" && (
                <div className="mt-3 flex gap-2">
                  <input value={quickValue} onChange={(event) => setQuickValue(event.target.value)} placeholder="Part name / quantity" className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lagoon" />
                  <button type="button" onClick={() => savePpmQuick("part")} className="rounded-lg bg-lagoon px-4 text-sm font-black text-white">Save</button>
                </div>
              )}
              <p className="mt-2 text-sm font-bold text-slate-500">No parts reserved yet.</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h4 className="font-black">Work Order History</h4>
            <div className="mt-3 h-56">
              <ResponsiveContainer>
                <BarChart data={historyData.length ? historyData : [{ name: "No WO", created: 0, completed: 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e6ee" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="created" fill="#06d6a0" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="completed" fill="#0b1f3a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex gap-6 border-b border-slate-200 text-sm font-black">
            <button type="button" onClick={() => setTab("comments")} className={`px-2 pb-3 ${tab === "comments" ? "border-b-2 border-lagoon text-lagoon" : "text-slate-500"}`}>PM Comments</button>
            <button type="button" onClick={() => setTab("history")} className={`px-2 pb-3 ${tab === "history" ? "border-b-2 border-lagoon text-lagoon" : "text-slate-500"}`}>History</button>
          </div>
          <div className="mt-4 grid gap-3">
            {tab === "history" && workOrders.length ? workOrders.slice(0, 6).map((work) => (
              <div key={work.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-black">{work.woNo} / {work.title}</p>
                <p className="font-bold text-slate-500">{work.status?.replaceAll("_", " ")} / {formatDateCell(work.updatedAt)}</p>
              </div>
            )) : <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-600">{tab === "history" ? "No completed work orders for this PM yet." : "No PM comments yet."}</p>}
          </div>
        </div>
      </div>
    </RequestModalShell>
  );
}

function Inventory({ inventory, submitInventory, deleteInventory, isAdmin, saving }: { inventory: any[]; submitInventory: (formData: FormData) => void; deleteInventory: (id: string) => void; isAdmin: boolean; saving: boolean }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <Panel title="MRO Inventory & Stores" icon={Boxes}>
        <ReportButtons type="inventory" label="Inventory report" />
        <div className="grid gap-5 xl:grid-cols-[1fr_0.7fr]">
          <DataTable
            rows={inventory}
            columns={[
              ["sku", "SKU"],
              ["name", "Item"],
              ["category", "Category"],
              ["onHand", "On hand"],
              ["reorderPoint", "Reorder"],
              ["vendor", "Vendor"],
            ]}
            actions={isAdmin ? (row) => <DeleteRowButton saving={saving} onDelete={() => deleteInventory(row.id)} /> : undefined}
            bulkSelectable={isAdmin}
            bulkLabel="inventory items"
            onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteInventory(row.id))); }}
          />
          <div className="h-72 rounded-lg bg-slate-50 p-3">
            <ResponsiveContainer>
              <BarChart data={inventory.map((item) => ({ name: item.sku?.slice(0, 8), stock: item.onHand, reorder: item.reorderPoint }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9e6ee" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="stock" fill="#0f8b8d" radius={[6, 6, 0, 0]} />
                <Bar dataKey="reorder" fill="#ffd166" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>
      <ActionForm title="Add Stock Item" onSubmit={submitInventory} fields={["sku", "name", "category", "unit", "onHand", "reorderPoint", "unitCost", "vendor", "location"]} saving={saving} />
    </section>
  );
}

function Hse({ inspections, submitInspection, deleteInspection, isAdmin, saving }: { inspections: any[]; submitInspection: (formData: FormData) => void; deleteInspection: (id: string) => void; isAdmin: boolean; saving: boolean }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <Panel title="HSE, Compliance & Inspections" icon={ShieldCheck}>
        <ReportButtons type="inspections" label="HSE report" />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <DataTable
          rows={inspections}
          columns={[
            ["code", "Code"],
            ["title", "Inspection"],
            ["area", "Area"],
            ["risk", "Risk"],
            ["score", "Score"],
            ["status", "Status"],
          ]}
          actions={isAdmin ? (row) => <DeleteRowButton saving={saving} onDelete={() => deleteInspection(row.id)} /> : undefined}
          bulkSelectable={isAdmin}
          bulkLabel="inspections"
          onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteInspection(row.id))); }}
        />
        <div className="rounded-lg bg-coral/10 p-4">
          <AlertTriangle className="text-coral" />
          <p className="mt-3 font-black">Permit-to-work control</p>
          <p className="mt-2 text-sm text-slate-700">Link high-risk maintenance to RAMS, lockout-tagout, confined space, hot work and audit trails.</p>
        </div>
        </div>
      </Panel>
      <ActionForm title="Record Inspection" onSubmit={submitInspection} fields={["title", "area", "inspector", "risk", "score", "findings"]} saving={saving} />
    </section>
  );
}

function ComplianceCertification({
  records,
  requests,
  workOrders,
  inspections,
  view,
  submitCertificate,
  deleteCertificate,
  isAdmin,
  saving,
  navigate,
}: {
  records: any[];
  requests: any[];
  workOrders: any[];
  inspections: any[];
  view: string;
  submitCertificate: (formData: FormData) => void;
  deleteCertificate: (id: string) => void;
  isAdmin: boolean;
  saving: boolean;
  navigate: (moduleId: string, menuKey: string, view?: string) => void;
}) {
  const [tab, setTab] = useState(view || "compliance-dashboard");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");

  useEffect(() => {
    if (view?.startsWith("compliance") || view === "certification-register") setTab(view);
  }, [view]);

  const today = new Date();
  const enriched = records.map((record) => {
    const expiry = new Date(record.expiryDate);
    const daysToExpiry = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    const computedStatus = daysToExpiry < 0 ? "EXPIRED" : daysToExpiry <= Number(record.renewalLeadDays ?? 30) ? "EXPIRING_SOON" : record.status;
    return { ...record, daysToExpiry, computedStatus };
  });
  const filtered = enriched.filter((record) => {
    const haystack = [record.certificateNo, record.title, record.authority, record.category, record.assetTag, record.location, record.owner].join(" ").toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (status !== "all" && record.computedStatus !== status) return false;
    if (risk !== "all" && record.risk !== risk) return false;
    return true;
  });
  const activeCount = enriched.filter((record) => record.computedStatus === "ACTIVE").length;
  const expiringCount = enriched.filter((record) => record.computedStatus === "EXPIRING_SOON").length;
  const expiredCount = enriched.filter((record) => record.computedStatus === "EXPIRED").length;
  const statutoryCount = enriched.filter((record) => ["Life Safety", "Electrical", "Civil Defense"].includes(record.category)).length;
  const rows = filtered.map((record) => ({
    ...record,
    status: record.computedStatus,
    issueDate: formatDateCell(record.issueDate),
    expiryDate: formatDateCell(record.expiryDate),
    days: record.daysToExpiry < 0 ? `${Math.abs(record.daysToExpiry)} overdue` : `${record.daysToExpiry} days`,
  }));
  const auditRows = rows.filter((record) => record.risk === "HIGH" || record.risk === "EXTREME" || record.status !== "ACTIVE");
  const matchText = (item: any) => [item.title, item.category, item.assetTag, item.asset?.tag, item.location, item.description, item.serviceCode, item.departmentCode, item.type].filter(Boolean).join(" ").toLowerCase();
  const relatedTicketsFor = (record: any) => {
    const needles = [record.assetTag, record.title, record.category, record.location].filter(Boolean).map((item) => String(item).toLowerCase());
    return [
      ...requests.map((request) => ({ source: "Service Request", reference: request.ticketNo, title: request.title, status: request.status, priority: request.priority, owner: request.requester || request.assignedTeamCode || "Unassigned", moduleId: "helpdesk", menuKey: "Tickets-Service Requests", haystack: matchText(request) })),
      ...workOrders.map((work) => ({ source: "Work Order", reference: work.woNo, title: work.title, status: work.status, priority: work.priority, owner: work.assignedTo?.name || work.assignedTeamCode || "Unassigned", moduleId: "work", menuKey: "Tickets-Work Orders", haystack: matchText(work) })),
    ].filter((ticket) => needles.length === 0 || needles.some((needle) => needle && ticket.haystack.includes(needle)));
  };
  const nonComplianceRows = rows
    .filter((record) => record.status === "EXPIRED" || record.status === "SUSPENDED" || record.risk === "HIGH" || record.risk === "EXTREME")
    .map((record) => ({
      ...record,
      issue: record.status === "EXPIRED" ? "Expired certification" : record.status === "SUSPENDED" ? "Suspended control" : "High-risk compliance exposure",
      correctiveAction: record.notes || "Assign owner, collect evidence, and close corrective action.",
      owner: record.owner || "Unassigned",
      linkedTickets: relatedTicketsFor(record).length,
    }));
  const inspectionNonComplianceRows = inspections
    .filter((inspection) => inspection.status !== "COMPLETED" || Number(inspection.score || 100) < 90 || ["HIGH", "EXTREME"].includes(inspection.risk))
    .map((inspection) => ({
      id: inspection.id,
      certificateNo: inspection.code,
      title: inspection.title,
      issue: Number(inspection.score || 100) < 90 ? "Inspection score below threshold" : "Open inspection action",
      authority: inspection.inspector || "Internal audit",
      owner: inspection.inspector || "Unassigned",
      risk: inspection.risk,
      status: inspection.status,
      days: formatDateCell(inspection.dueAt),
      correctiveAction: inspection.findings || "Close inspection findings and attach evidence.",
      linkedTickets: relatedTicketsFor(inspection).length,
    }));
  const allNonComplianceRows = [...nonComplianceRows, ...inspectionNonComplianceRows];
  const ticketRows = [
    ...requests.map((request) => ({
      id: request.id,
      source: "Service Request",
      reference: request.ticketNo,
      title: request.title,
      linkedItem: allNonComplianceRows.find((item) => matchText(request).includes(String(item.title || "").toLowerCase()) || (item.certificateNo && matchText(request).includes(String(item.certificateNo).toLowerCase())))?.certificateNo || "General compliance",
      priority: request.priority,
      status: request.status,
      owner: request.requester || request.assignedTeamCode || "Unassigned",
      moduleId: "helpdesk",
      menuKey: "Tickets-Service Requests",
    })),
    ...workOrders.map((work) => ({
      id: work.id,
      source: "Work Order",
      reference: work.woNo,
      title: work.title,
      linkedItem: allNonComplianceRows.find((item) => matchText(work).includes(String(item.title || "").toLowerCase()) || (item.certificateNo && matchText(work).includes(String(item.certificateNo).toLowerCase())))?.certificateNo || "General compliance",
      priority: work.priority,
      status: work.status,
      owner: work.assignedTo?.name || work.assignedTeamCode || "Unassigned",
      moduleId: "work",
      menuKey: "Tickets-Work Orders",
    })),
  ];
  const openTicketRows = ticketRows.filter((ticket) => !["CLOSED", "COMPLETED", "VERIFIED", "REJECTED", "CANCELLED"].includes(String(ticket.status || "").toUpperCase()));
  const overdueNonCompliance = allNonComplianceRows.filter((record) => record.status === "EXPIRED").length;
  const highRiskNonCompliance = allNonComplianceRows.filter((record) => record.risk === "HIGH" || record.risk === "EXTREME").length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await submitCertificate(new FormData(form));
    form.reset();
  }

  const tabs = [
    ["compliance-dashboard", "Dashboard"],
    ["certification-register", "Certificates"],
    ["compliance-non-compliance", "Non-Compliance Management"],
    ["compliance-audits", "Audit Calendar"],
    ["compliance-alerts", "Expiry Alerts"],
  ] as const;

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <Panel title="Compliance & Certification" icon={ShieldCheck}>
          <ReportButtons type="compliance" label="Compliance report" />
          <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-3 py-2 text-sm font-black ${tab === id ? "bg-lagoon text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search certificate, authority, asset or location" className={HOUSING_FIELD_CLASS} />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={HOUSING_FIELD_CLASS}>
              <option value="all">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRING_SOON">Expiring soon</option>
              <option value="EXPIRED">Expired</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            <select value={risk} onChange={(event) => setRisk(event.target.value)} className={HOUSING_FIELD_CLASS}>
              <option value="all">All risk levels</option>
              <option>LOW</option>
              <option>MODERATE</option>
              <option>HIGH</option>
              <option>EXTREME</option>
            </select>
          </div>

          {tab === "compliance-dashboard" && (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["Active Certificates", activeCount, "text-leaf"],
                  ["Expiring Soon", expiringCount, "text-amber-600"],
                  ["Expired", expiredCount, "text-coral"],
                  ["Statutory Controls", statutoryCount, "text-lagoon"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase text-slate-500">{label}</p>
                    <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <DataTable rows={rows.slice(0, 8)} columns={[["certificateNo", "Certificate"], ["title", "Title"], ["authority", "Authority"], ["status", "Status"], ["days", "Expiry"]]} />
                <div className="rounded-lg bg-lagoon/10 p-4">
                  <ShieldCheck className="text-lagoon" />
                  <p className="mt-3 font-black">International compliance control</p>
                  <p className="mt-2 text-sm font-bold text-slate-600">Track statutory certificates, third-party inspections, renewal owners, evidence URLs, expiry alerts and audit-ready records.</p>
                </div>
              </div>
            </div>
          )}

          {tab === "certification-register" && <DataTable rows={rows} columns={[["certificateNo", "Certificate No"], ["title", "Title"], ["category", "Category"], ["authority", "Authority"], ["assetTag", "Asset"], ["location", "Location"], ["owner", "Owner"], ["status", "Status"], ["expiryDate", "Expiry"], ["days", "Days"]]} actions={isAdmin ? (row) => <DeleteRowButton saving={saving} onDelete={() => deleteCertificate(row.id)} /> : undefined} bulkSelectable={isAdmin} bulkLabel="certificates" onBulkDelete={async (selectedRows) => { await Promise.all(selectedRows.map((row) => deleteCertificate(row.id))); }} />}
          {tab === "compliance-non-compliance" && (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["Open Non-Compliances", allNonComplianceRows.length, "text-coral"],
                  ["Overdue Certifications", overdueNonCompliance, "text-amber-600"],
                  ["High-Risk Items", highRiskNonCompliance, "text-lagoon"],
                  ["Linked Tickets", ticketRows.length, "text-leaf"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase text-slate-500">{label}</p>
                    <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="font-black">Linked corrective-action workspace</p>
                  <p className="text-sm font-bold text-slate-500">Non-compliance items are tied to service requests and work orders for follow-up.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigate("helpdesk", "Tickets-Service Requests")} className="rounded-lg bg-lagoon px-4 py-2 text-sm font-black text-white">Open Tickets</button>
                  <button type="button" onClick={() => navigate("work", "Tickets-Work Orders")} className="rounded-lg bg-ink px-4 py-2 text-sm font-black text-white">Open Work Orders</button>
                </div>
              </div>
              <div className="grid gap-2">
                <h4 className="text-sm font-black uppercase text-slate-500">Non-Compliance Items</h4>
                <DataTable
                  rows={allNonComplianceRows}
                  columns={[
                    ["certificateNo", "Certificate"],
                    ["title", "Non-Compliance"],
                    ["issue", "Issue"],
                    ["authority", "Authority"],
                    ["owner", "Owner"],
                    ["risk", "Risk"],
                    ["status", "Status"],
                    ["days", "Age / Due"],
                    ["linkedTickets", "Linked Tickets"],
                    ["correctiveAction", "Corrective Action"],
                  ]}
                  bulkSelectable={isAdmin}
                  bulkLabel="non-compliance items"
                />
              </div>
              <div className="grid gap-2">
                <h4 className="text-sm font-black uppercase text-slate-500">All Linked Tickets & Work Orders</h4>
                <LinkedTicketsTable
                  rows={ticketRows}
                  navigate={navigate}
                />
              </div>
              <div className="grid gap-2">
                <h4 className="text-sm font-black uppercase text-slate-500">Open Corrective Actions</h4>
                <LinkedTicketsTable
                  rows={openTicketRows}
                  navigate={navigate}
                />
              </div>
            </div>
          )}
          {tab === "compliance-audits" && <DataTable rows={auditRows} columns={[["certificateNo", "Certificate"], ["title", "Audit Item"], ["authority", "Authority"], ["risk", "Risk"], ["owner", "Owner"], ["expiryDate", "Due / Expiry"], ["notes", "Action Notes"]]} bulkSelectable={isAdmin} bulkLabel="audit rows" />}
          {tab === "compliance-alerts" && <DataTable rows={rows.filter((record) => record.status !== "ACTIVE")} columns={[["certificateNo", "Certificate"], ["title", "Alert"], ["status", "Status"], ["risk", "Risk"], ["days", "Expiry"], ["owner", "Owner"], ["notes", "Required Action"]]} bulkSelectable={isAdmin} bulkLabel="alerts" />}
        </Panel>
      </div>
      <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white p-5 shadow-lift">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-sun/50 text-amber-700">
            <PackagePlus size={20} />
          </div>
          <h3 className="text-xl font-black">Add Certificate</h3>
        </div>
        <div className="grid gap-3">
          {["certificateNo", "title", "authority", "category", "assetTag", "location", "owner", "evidenceUrl"].map((field) => (
            <label key={field} className="grid gap-1 text-sm font-bold capitalize text-slate-600">
              {field.replace(/([A-Z])/g, " $1")}
              <input name={field} className={HOUSING_FIELD_CLASS} />
            </label>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-slate-600">
              Issue Date
              <input name="issueDate" type="date" className={HOUSING_FIELD_CLASS} />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-600">
              Expiry Date
              <input name="expiryDate" type="date" className={HOUSING_FIELD_CLASS} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-bold text-slate-600">
              Status
              <select name="status" className={HOUSING_FIELD_CLASS}>
                <option>ACTIVE</option>
                <option>EXPIRING_SOON</option>
                <option>EXPIRED</option>
                <option>SUSPENDED</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-600">
              Risk
              <select name="risk" className={HOUSING_FIELD_CLASS}>
                <option>LOW</option>
                <option>MODERATE</option>
                <option>HIGH</option>
                <option>EXTREME</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-600">
              Renewal Lead Days
              <input name="renewalLeadDays" type="number" min="0" defaultValue="30" className={HOUSING_FIELD_CLASS} />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-bold text-slate-600">
            Notes
            <textarea name="notes" className="min-h-24 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
          </label>
          <button disabled={saving} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
            <Plus size={18} />
            {saving ? "Saving..." : "Save Certificate"}
          </button>
        </div>
      </form>
    </section>
  );
}

function LinkedTicketsTable({ rows, navigate }: { rows: any[]; navigate: (moduleId: string, menuKey: string, view?: string) => void }) {
  if (!rows.length) return <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-500">No linked tickets or work orders found.</p>;
  return (
    <div className="cafm-scroll-x overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
      <table className="cafm-data-table min-w-[980px] border-collapse bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            {["Ticket Type", "Reference", "Ticket / Work Order", "Linked Non-Compliance", "Priority", "Status", "Owner", "Action"].map((label) => (
              <th key={label} className="whitespace-nowrap px-3 py-3 font-black">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.source}-${row.reference}`} className="border-t border-slate-100">
              <td className="whitespace-nowrap px-3 py-3 font-bold">{row.source}</td>
              <td className="whitespace-nowrap px-3 py-3 font-black text-lagoon">{row.reference}</td>
              <td className="max-w-[300px] px-3 py-3">{row.title}</td>
              <td className="whitespace-nowrap px-3 py-3">{row.linkedItem}</td>
              <td className="whitespace-nowrap px-3 py-3"><CellValue value={row.priority} /></td>
              <td className="whitespace-nowrap px-3 py-3"><CellValue value={row.status} /></td>
              <td className="whitespace-nowrap px-3 py-3">{row.owner}</td>
              <td className="whitespace-nowrap px-3 py-3">
                <button type="button" onClick={() => navigate(row.moduleId, row.menuKey)} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IncidentCaseManagement({ requests, workOrders, navigate }: { requests: any[]; workOrders: any[]; navigate: (moduleId: string, menuKey: string, view?: string) => void }) {
  const incidentRequests = requests.filter((request) => request.isIncidentCase);
  const incidentWorkOrders = workOrders.filter((work) => work.isIncidentCase);
  const rows = [
    ...incidentRequests.map((request) => ({
      id: request.id,
      source: "Service Request",
      reference: request.ticketNo,
      title: request.title,
      priority: request.priority,
      status: request.status,
      owner: request.requester || request.assignedTeamCode || "Unassigned",
      linkedRecord: request.workOrder?.woNo || "Awaiting work order",
      location: request.location,
      updatedAt: request.updatedAt,
      moduleId: "helpdesk",
      menuKey: "Tickets-Service Requests",
    })),
    ...incidentWorkOrders.map((work) => ({
      id: work.id,
      source: "Work Order",
      reference: work.woNo,
      title: work.title,
      priority: work.priority,
      status: work.status,
      owner: work.assignedTo?.name || work.assignedTo?.email || work.assignedTeamCode || "Unassigned",
      linkedRecord: work.request?.ticketNo || "Standalone work order",
      location: work.location || work.asset?.buildingCode || "-",
      updatedAt: work.updatedAt,
      moduleId: "work",
      menuKey: "Tickets-Work Orders",
    })),
  ].sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());
  const openRows = rows.filter((row) => !["CLOSED", "COMPLETED", "VERIFIED", "REJECTED", "CANCELLED"].includes(String(row.status || "").toUpperCase()));
  const criticalRows = rows.filter((row) => row.priority === "CRITICAL" || row.priority === "HIGH");

  return (
    <section className="grid gap-5">
      <Panel title="Incident & Case Management" icon={AlertTriangle}>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          {[
            ["Total Cases", rows.length],
            ["Open Cases", openRows.length],
            ["Service Requests", incidentRequests.length],
            ["Work Orders", incidentWorkOrders.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-ink">{value}</p>
            </div>
          ))}
        </div>
        {criticalRows.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
            {criticalRows.length} high priority incident/case record{criticalRows.length === 1 ? "" : "s"} require active follow-up.
          </div>
        )}
        <div className="cafm-scroll-x overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
          <table className="cafm-data-table min-w-[1120px] border-collapse bg-white text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {["Type", "Reference", "Incident / Case", "Linked Record", "Priority", "Status", "Owner", "Location", "Updated", "Action"].map((label) => (
                  <th key={label} className="whitespace-nowrap px-3 py-3 font-black">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={`${row.source}-${row.id}`} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{row.source}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-black text-lagoon">{row.reference}</td>
                  <td className="max-w-[320px] px-3 py-3">{row.title}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.linkedRecord}</td>
                  <td className="whitespace-nowrap px-3 py-3"><RequestPriorityBadge priority={row.priority} /></td>
                  <td className="whitespace-nowrap px-3 py-3"><CellValue value={row.status} /></td>
                  <td className="whitespace-nowrap px-3 py-3">{row.owner}</td>
                  <td className="max-w-[220px] px-3 py-3 text-slate-600">{row.location || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDateCell(row.updatedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <button type="button" onClick={() => navigate(row.moduleId, row.menuKey)} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">
                      Open
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-sm font-bold text-slate-500">No incident or case records have been marked yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}

function DocumentManagement({
  assets,
  services,
  workOrders,
  complianceCertificates,
  documentUploads,
  view,
  refreshData,
  canUploadDocuments,
  isAdmin,
  deleteDocument,
  setToast,
}: {
  assets: any[];
  services: any[];
  workOrders: any[];
  complianceCertificates: any[];
  documentUploads: any[];
  view: string;
  refreshData: () => Promise<void>;
  canUploadDocuments: boolean;
  isAdmin: boolean;
  deleteDocument: (id: string) => void;
  setToast: (message: string) => void;
}) {
  const [tab, setTab] = useState(view || "documents-om-manuals");
  const [documentPages, setDocumentPages] = useState<Record<string, { rows: any[]; total: number; page: number; loading: boolean }>>({});
  const [bulkDeletingCategory, setBulkDeletingCategory] = useState("");

  useEffect(() => {
    if (view?.startsWith("documents")) setTab(view);
  }, [view]);

  const tabs = [
    ["documents-om-manuals", "Operation & Maintenance Manuals", "OM_MANUAL"],
    ["documents-warranties", "Equipment Warranties and Guarantees", "WARRANTY_GUARANTEE"],
    ["documents-contracts-slas", "Support Contracts and SLAs", "SUPPORT_CONTRACT_SLA"],
  ] as const;
  const activeCategory = tabs.find(([id]) => id === tab)?.[2] ?? "OM_MANUAL";
  const activeLabel = tabs.find(([, , category]) => category === activeCategory)?.[1] ?? "Documents";
  const activeDocuments = documentPages[activeCategory] ?? { rows: [], total: 0, page: 0, loading: false };

  async function loadDocuments(category: string, reset = false) {
    const current = documentPages[category] ?? { rows: [], total: 0, page: 0, loading: false };
    if (current.loading) return;
    const nextPage = reset ? 1 : current.page + 1;
    setDocumentPages((pages) => ({ ...pages, [category]: { ...(pages[category] ?? current), loading: true } }));
    const response = await fetch(`/api/document-uploads?category=${encodeURIComponent(category)}&page=${nextPage}&pageSize=${PAGE_SIZE}`, { cache: "no-store" });
    if (!response.ok) {
      setDocumentPages((pages) => ({ ...pages, [category]: { ...(pages[category] ?? current), loading: false } }));
      return;
    }
    const result = await response.json();
    const rows = (result.rows ?? []).map((row: any) => ({
      ...row,
      uploadedAt: formatDateCell(row.uploadedAt),
      size: formatFileSize(row.size ?? row.fileSize),
      attachment: row.attachment || (row.missingFileUrl ? "Missing file" : "-"),
    }));
    setDocumentPages((pages) => ({
      ...pages,
      [category]: {
        rows: reset ? rows : [...(pages[category]?.rows ?? []), ...rows],
        total: Number(result.total ?? rows.length),
        page: Number(result.page ?? nextPage),
        loading: false,
      },
    }));
  }

  useEffect(() => {
    if (!documentPages[activeCategory]) void loadDocuments(activeCategory, true);
  }, [activeCategory]);

  async function deleteLoadedDocument(id: string) {
    await deleteDocument(id);
    await loadDocuments(activeCategory, true);
  }

  async function deleteAllActiveDocuments() {
    const expectedText = `DELETE ${activeLabel}`;
    const typed = window.prompt(`This will delete all ${activeDocuments.total.toLocaleString()} ${activeLabel} records from the database. Type "${expectedText}" to continue.`);
    if (typed !== expectedText) return;
    setBulkDeletingCategory(activeCategory);
    const response = await fetch(`/api/document-uploads?category=${encodeURIComponent(activeCategory)}&confirm=DELETE_ALL`, { method: "DELETE" });
    const result = await response.json();
    if (response.ok) {
      setToast(`${Number(result.deletedCount ?? 0).toLocaleString()} ${activeLabel} records deleted.`);
      setDocumentPages((pages) => ({ ...pages, [activeCategory]: { rows: [], total: 0, page: 0, loading: false } }));
    } else {
      setToast(cleanMessage(result.message ?? `Unable to delete ${activeLabel}.`));
    }
    setBulkDeletingCategory("");
  }

  return (
    <section className="grid gap-5">
      <Panel title="Document Management" icon={FileText}>
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {tabs.map(([id, label, category]) => {
            const count = documentPages[category]?.total ?? documentUploads.filter((document) => document.category === category).length;
            return (
            <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-3 py-2 text-sm font-black ${tab === id ? "bg-lagoon text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
              {label}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === id ? "bg-white/20 text-white" : "bg-white text-slate-500"}`}>{count}</span>
            </button>
          )})}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {tabs.map(([id, label, category]) => {
            const count = documentPages[category]?.total ?? documentUploads.filter((document) => document.category === category).length;
            return (
            <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg border p-4 text-left transition ${tab === id ? "border-lagoon bg-lagoon/5" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}>
              <p className="text-xs font-black uppercase text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black text-ink">{count}</p>
            </button>
          )})}
        </div>
        {isAdmin && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-coral/20 bg-coral/5 p-3">
            <div>
              <p className="text-sm font-black text-coral">Delete all {activeLabel} records</p>
              <p className="text-xs font-bold text-slate-500">Deletes all rows in this document category from the database. Stored files are not deleted.</p>
            </div>
            <button
              type="button"
              disabled={bulkDeletingCategory === activeCategory || activeDocuments.loading || activeDocuments.total === 0}
              onClick={deleteAllActiveDocuments}
              className="rounded-lg bg-coral px-4 py-2 text-xs font-black text-white disabled:bg-slate-300"
            >
              {bulkDeletingCategory === activeCategory ? "Deleting..." : "Delete All Records"}
            </button>
          </div>
        )}
        {canUploadDocuments && <DocumentUploadForm assets={assets} category={activeCategory} refreshData={async () => loadDocuments(activeCategory, true)} />}
        <div className="mt-5">
          {tab === "documents-om-manuals" && (
            <ScrollableRowsTable
              rows={activeDocuments.rows}
              columns={[
                ["documentType", "Document Type"],
                ["reference", "Asset Code"],
                ["title", "Manual Title"],
                ["assetType", "Asset Type"],
                ["location", "Location"],
                ["owner", "Owner"],
                ["status", "Status"],
                ["attachment", "Attachment"],
                ["uploadedAt", "Uploaded"],
                ["size", "Size"],
              ]}
              actions={isAdmin ? (row) => row.canDelete ? <DeleteRowButton saving={false} onDelete={() => deleteLoadedDocument(row.id)} /> : null : undefined}
              bulkSelectable={isAdmin}
              bulkLabel="documents"
              onBulkDelete={async (rows) => { await Promise.all(rows.filter((row) => row.canDelete).map((row) => deleteDocument(row.id))); await loadDocuments(activeCategory, true); }}
              totalRows={activeDocuments.total}
              loading={activeDocuments.loading}
              onLoadMore={() => loadDocuments(activeCategory)}
            />
          )}
          {tab === "documents-warranties" && (
            <ScrollableRowsTable
              rows={activeDocuments.rows}
              columns={[
                ["documentType", "Document Type"],
                ["reference", "Reference"],
                ["title", "Equipment / Guarantee"],
                ["assetType", "Asset Type"],
                ["provider", "Provider"],
                ["expiryDate", "Expiry"],
                ["status", "Status"],
                ["attachment", "Attachment"],
                ["uploadedAt", "Uploaded"],
                ["size", "Size"],
              ]}
              actions={isAdmin ? (row) => row.canDelete ? <DeleteRowButton saving={false} onDelete={() => deleteLoadedDocument(row.id)} /> : null : undefined}
              bulkSelectable={isAdmin}
              bulkLabel="documents"
              onBulkDelete={async (rows) => { await Promise.all(rows.filter((row) => row.canDelete).map((row) => deleteDocument(row.id))); await loadDocuments(activeCategory, true); }}
              totalRows={activeDocuments.total}
              loading={activeDocuments.loading}
              onLoadMore={() => loadDocuments(activeCategory)}
            />
          )}
          {tab === "documents-contracts-slas" && (
            <ScrollableRowsTable
              rows={activeDocuments.rows}
              columns={[
                ["documentType", "Document Type"],
                ["reference", "Reference"],
                ["title", "Contract / SLA"],
                ["provider", "Provider"],
                ["scope", "Scope"],
                ["sla", "SLA"],
                ["status", "Status"],
                ["attachment", "Attachment"],
                ["uploadedAt", "Uploaded"],
                ["size", "Size"],
              ]}
              actions={isAdmin ? (row) => row.canDelete ? <DeleteRowButton saving={false} onDelete={() => deleteLoadedDocument(row.id)} /> : null : undefined}
              bulkSelectable={isAdmin}
              bulkLabel="documents"
              onBulkDelete={async (rows) => { await Promise.all(rows.filter((row) => row.canDelete).map((row) => deleteDocument(row.id))); await loadDocuments(activeCategory, true); }}
              totalRows={activeDocuments.total}
              loading={activeDocuments.loading}
              onLoadMore={() => loadDocuments(activeCategory)}
            />
          )}
        </div>
      </Panel>
    </section>
  );
}

function ScrollableRowsTable({
  rows,
  columns,
  actions,
  bulkSelectable = false,
  bulkLabel = "documents",
  onBulkDelete,
  totalRows,
  loading = false,
  onLoadMore,
}: {
  rows: any[];
  columns: [string, string][];
  actions?: (row: any) => ReactNode;
  bulkSelectable?: boolean;
  bulkLabel?: string;
  onBulkDelete?: (rows: any[]) => Promise<void> | void;
  totalRows?: number;
  loading?: boolean;
  onLoadMore?: () => Promise<void> | void;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const visibleRows = rows.slice(0, visibleCount);
  const rowKey = (row: any, index: number) => String(row.id ?? row.reference ?? row.title ?? index);
  const visibleRowKeys = visibleRows.map((row, index) => rowKey(row, index));
  const selectedRows = rows.filter((row, index) => selectedRowKeys.has(rowKey(row, index)));
  const selectedVisibleKeys = visibleRowKeys.filter((key) => selectedRowKeys.has(key));
  const allVisibleSelected = bulkSelectable && Boolean(visibleRowKeys.length) && selectedVisibleKeys.length === visibleRowKeys.length;
  const someVisibleSelected = bulkSelectable && selectedVisibleKeys.length > 0 && !allVisibleSelected;
  const displayTotal = totalRows ?? rows.length;
  const hasMoreRows = onLoadMore ? rows.length < displayTotal : visibleRows.length < rows.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [rows.length]);

  useEffect(() => {
    const allKeys = new Set(rows.map((row, index) => rowKey(row, index)));
    setSelectedRowKeys((current) => new Set(Array.from(current).filter((key) => allKeys.has(key))));
  }, [rows]);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 180;
    if (nearBottom && hasMoreRows && !loading) {
      if (onLoadMore) {
        void onLoadMore();
        return;
      }
      setVisibleCount((current) => Math.min(rows.length, current + PAGE_SIZE));
    }
  }

  function toggleVisibleRows(checked: boolean) {
    setSelectedRowKeys((current) => {
      const next = new Set(current);
      visibleRows.forEach((row, index) => {
        const key = rowKey(row, index);
        if (checked) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  }

  function toggleRow(key: string, checked: boolean) {
    setSelectedRowKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function deleteSelectedRows() {
    if (!onBulkDelete || !selectedRows.length) return;
    await onBulkDelete(selectedRows);
    setSelectedRowKeys(new Set());
  }

  return (
    <div className="grid gap-3">
      {bulkSelectable && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">
          <span>Selected {selectedRowKeys.size.toLocaleString()} {bulkLabel}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => toggleVisibleRows(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-lagoon">Select Visible</button>
            <button type="button" disabled={!selectedRowKeys.size || !onBulkDelete} onClick={deleteSelectedRows} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Delete All</button>
            <button type="button" disabled={!selectedRowKeys.size} onClick={() => setSelectedRowKeys(new Set())} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">Clear Selection</button>
          </div>
        </div>
      )}
      <div onScroll={handleScroll} className="cafm-scroll-x max-h-[70vh] overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
        <table className="cafm-data-table min-w-[1500px] table-fixed border-collapse bg-white text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {bulkSelectable && (
                <th className="w-12 px-3 py-3 font-black">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someVisibleSelected;
                    }}
                    onChange={(event) => toggleVisibleRows(event.target.checked)}
                  />
                </th>
              )}
              <th className="w-14 px-3 py-3 font-black">#</th>
              {columns.map(([, label]) => (
                <th key={label} className="px-3 py-3 font-black">
                  {label}
                </th>
              ))}
              {actions && <th className="w-28 px-3 py-3 font-black">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => {
              const key = rowKey(row, index);
              return (
                <tr key={key} className="border-t border-slate-100 align-top">
                  {bulkSelectable && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRowKeys.has(key)}
                        onChange={(event) => toggleRow(key, event.target.checked)}
                      />
                    </td>
                  )}
                  <td className="px-3 py-3 font-black text-slate-500">{index + 1}</td>
                  {columns.map(([columnKey]) => (
                    <td key={columnKey} className="px-3 py-3">
                      <div className={`max-w-full leading-5 ${columnKey === "attachment" ? "break-all font-black text-lagoon" : "break-words"}`}>
                        <CellValue value={row[columnKey]} field={columnKey} />
                      </div>
                    </td>
                  ))}
                  {actions && <td className="px-3 py-3">{actions(row)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-center text-sm font-black text-slate-500">
        Showing {visibleRows.length.toLocaleString()} of {displayTotal.toLocaleString()} rows
        {loading ? " / loading..." : hasMoreRows ? " / scroll down to load more" : ""}
      </p>
    </div>
  );
}

function DocumentUploadForm({ assets, category, refreshData }: { assets: any[]; category: string; refreshData: () => Promise<void> }) {
  const [assetTag, setAssetTag] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  async function uploadDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!assetTag) {
      setMessage("Asset Number is required.");
      return;
    }
    if (!files?.length) {
      setMessage("Select at least one file.");
      return;
    }
    const tooLarge = Array.from(files).find((file) => file.size > 20 * 1024 * 1024);
    if (tooLarge) {
      setMessage(`${tooLarge.name} exceeds 20 MB.`);
      return;
    }
    const formData = new FormData();
    formData.set("category", category);
    formData.set("assetTag", assetTag);
    Array.from(files).forEach((file) => formData.append("files", file));
    setUploading(true);
    const response = await fetch("/api/document-uploads", { method: "POST", body: formData });
    const result = await response.json();
    setMessage(response.ok ? "File uploaded." : cleanMessage(result.message || "Upload failed."));
    if (response.ok) {
      await refreshData();
      setFiles(null);
      event.currentTarget.reset();
      setAssetTag("");
    }
    setUploading(false);
  }

  return (
    <form onSubmit={uploadDocuments} className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="grid gap-1 text-sm font-bold text-slate-600">
        Asset Number
        <input required list="document-upload-assets" value={assetTag} onChange={(event) => setAssetTag(event.target.value)} placeholder="Enter asset number" className={HOUSING_FIELD_CLASS} />
        <datalist id="document-upload-assets">
          {assets.map((asset) => <option key={asset.id} value={asset.tag}>{asset.assetDescription || asset.name}</option>)}
        </datalist>
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-600">
        File
        <input required type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.xlsx,.docx,.pptx" onChange={(event) => setFiles(event.target.files)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-lagoon" />
      </label>
      <button disabled={uploading} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-lagoon px-4 text-sm font-black text-white disabled:bg-slate-400">
        <Upload size={16} />
        {uploading ? "Uploading..." : "Upload File"}
      </button>
      {message && <p className="text-sm font-bold text-slate-600 md:col-span-3">{message}</p>}
    </form>
  );
}

function Iot({ alerts, acknowledgeAlert, saving }: { alerts: any[]; acknowledgeAlert: (id: string) => void; saving: boolean }) {
  return (
    <Panel title="BMS, IoT & Energy Intelligence" icon={RadioTower}>
      <ReportButtons type="iot-alerts" label="IoT alerts report" />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <DataTable
          rows={alerts}
          columns={[
            ["source", "Source"],
            ["assetTag", "Asset"],
            ["severity", "Severity"],
            ["message", "Message"],
            ["status", "Status"],
          ]}
        />
        <div className="grid gap-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-black">{alert.assetTag}</p>
              <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
              <button disabled={saving || alert.status === "TRIAGED"} onClick={() => acknowledgeAlert(alert.id)} className="mt-3 rounded-lg bg-ink px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">
                {alert.status === "TRIAGED" ? "Acknowledged" : "Acknowledge"}
              </button>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-lagoon/10 p-4">
          <ClipboardCheck className="text-lagoon" />
          <p className="mt-3 font-black">Condition-based maintenance</p>
          <p className="mt-2 text-sm text-slate-700">Convert BMS alarms, meter thresholds and vibration events into prioritized work with asset history.</p>
        </div>
      </div>
    </Panel>
  );
}

function TeamsServices({
  teams,
  services,
  categories,
  departments,
  saving,
  submitTeam,
  submitService,
  submitCategory,
  submitDepartment,
  updateTeam,
  updateService,
  updateDepartment,
  deleteTeam,
  deleteService,
  deleteDepartment,
  deleteCategory,
  isAdmin,
  view,
}: {
  teams: any[];
  services: any[];
  categories: any[];
  departments: any[];
  saving: boolean;
  submitTeam: (formData: FormData) => void;
  submitService: (formData: FormData) => void;
  submitCategory: (formData: FormData) => void;
  submitDepartment: (formData: FormData) => void;
  updateTeam: (id: string, formData: FormData) => Promise<void> | void;
  updateService: (id: string, formData: FormData) => Promise<void> | void;
  updateDepartment: (id: string, formData: FormData) => Promise<void> | void;
  deleteTeam: (id: string) => Promise<void> | void;
  deleteService: (id: string) => Promise<void> | void;
  deleteDepartment: (id: string) => Promise<void> | void;
  deleteCategory: (id: string) => Promise<void> | void;
  isAdmin: boolean;
  view: string;
}) {
  const [editingDepartment, setEditingDepartment] = useState<any | null>(null);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [editingService, setEditingService] = useState<any | null>(null);
  const showAll = !["departments", "team-code", "service-teams", "services-catalog"].includes(view);
  const showDepartments = showAll || view === "departments";
  const showTeamCode = showAll || view === "team-code";
  const showServiceTeams = showAll || view === "service-teams";
  const showServices = showAll || view === "services-catalog";
  const teamRows = teams.map((team) => ({
    ...team,
    companyIdNumber: team.supervisor,
    departmentCode: team.coverage,
    departmentName: departments.find((department) => department.code === team.coverage)?.name || team.coverage,
    service: team.type,
  }));
  const serviceRows = services.map((service) => ({
    ...service,
    departmentName: service.name,
    departmentCode: service.code,
    teamCode: service.team?.code || teams.find((team) => team.id === service.teamId)?.code || "",
  }));

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        {showDepartments && (
          <Panel title="Department Codes" icon={MapPinned}>
            <ReportButtons type="departments" label="Departments report" />
            <DataTable rows={departments} columns={[["code", "Code"], ["name", "Department"], ["siteLocation", "Site"], ["description", "Description"]]} bulkSelectable={isAdmin} bulkLabel="departments" onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteDepartment(row.id))); }} />
            <SetupActions rows={departments} labelKey="code" onEdit={setEditingDepartment} onDelete={deleteDepartment} saving={saving} isAdmin={isAdmin} />
          </Panel>
        )}
        {showTeamCode && (
          <Panel title="Team Codes" icon={Users}>
            <ReportButtons type="teams" label="Team codes report" />
            <DataTable rows={teamRows} columns={[["code", "Team Code"], ["name", "Team Name"], ["departmentName", "Department"], ["departmentCode", "Dept Code"], ["service", "Service"], ["shiftEligibility", "Shift Eligibility"], ["maxHoursPerDay", "Max hrs/day"]]} bulkSelectable={isAdmin} bulkLabel="teams" onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteTeam(row.id))); }} />
            <SetupActions rows={teamRows} labelKey="code" onEdit={setEditingTeam} onDelete={deleteTeam} saving={saving} isAdmin={isAdmin} />
          </Panel>
        )}
        {showServiceTeams && (
          <Panel title="Service Teams" icon={Users}>
            <ReportButtons type="teams" label="Service teams report" />
            <DataTable rows={teamRows} columns={[["code", "Code"], ["name", "Team"], ["companyIdNumber", "Company ID"], ["departmentCode", "Dept"], ["service", "Service"], ["shiftEligibility", "Shift Eligibility"], ["maxHoursPerDay", "Max hrs/day"], ["maxConsecutiveDays", "Max days"], ["minRestHours", "Rest hrs"], ["email", "Email"], ["phone", "Phone"]]} bulkSelectable={isAdmin} bulkLabel="teams" onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteTeam(row.id))); }} />
            <SetupActions rows={teamRows} labelKey="code" onEdit={setEditingTeam} onDelete={deleteTeam} saving={saving} isAdmin={isAdmin} />
          </Panel>
        )}
        {showServices && (
          <Panel title="Services Catalog" icon={ClipboardCheck}>
            <ReportButtons type="services" label="Services report" />
            <DataTable rows={serviceRows} columns={[["code", "Code"], ["name", "Service"], ["departmentName", "Department"], ["departmentCode", "Dept"], ["teamCode", "Team Code"], ["slaHours", "SLA hrs"]]} bulkSelectable={isAdmin} bulkLabel="services" onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteService(row.id))); }} />
            <SetupActions rows={serviceRows} labelKey="code" onEdit={setEditingService} onDelete={deleteService} saving={saving} isAdmin={isAdmin} />
          </Panel>
        )}
        {showAll && (
          <Panel title="Asset Categories" icon={Boxes}>
            <ReportButtons type="asset-categories" label="Categories report" />
            <ScrollableRowsTable rows={categories} columns={[["code", "Code"], ["name", "Category"], ["type", "Type"], ["defaultLifeYrs", "Life yrs"], ["statutory", "Statutory"]]} actions={isAdmin ? (row) => <DeleteRowButton saving={saving} onDelete={() => deleteCategory(row.id)} /> : undefined} bulkSelectable={isAdmin} bulkLabel="categories" onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteCategory(row.id))); }} />
          </Panel>
        )}
      </div>
      <div className="space-y-5">
        {showDepartments && <ActionForm title="Create Department Code" onSubmit={submitDepartment} fields={["code", "name", "siteLocation", "description"]} saving={saving} />}
        {showTeamCode && <TeamCodeForm departments={departments} onSubmit={submitTeam} saving={saving} />}
        {showServiceTeams && <TeamForm departments={departments} onSubmit={submitTeam} saving={saving} />}
        {showServices && <ServiceForm teams={teams} departments={departments} onSubmit={submitService} saving={saving} />}
        {showAll && <ActionForm title="Add Asset Category" onSubmit={submitCategory} fields={["code", "name", "type", "defaultLifeYrs", "statutory", "description"]} saving={saving} />}
      </div>
      {editingDepartment && (
        <RequestModalShell title={`Edit Department ${editingDepartment.code}`} onClose={() => setEditingDepartment(null)}>
          <DepartmentForm department={editingDepartment} onSubmit={async (formData) => { await updateDepartment(editingDepartment.id, formData); setEditingDepartment(null); }} saving={saving} />
        </RequestModalShell>
      )}
      {editingTeam && (
        <RequestModalShell title={`Edit Team ${editingTeam.code}`} onClose={() => setEditingTeam(null)}>
          <TeamForm team={editingTeam} departments={departments} onSubmit={async (formData) => { await updateTeam(editingTeam.id, formData); setEditingTeam(null); }} saving={saving} />
        </RequestModalShell>
      )}
      {editingService && (
        <RequestModalShell title={`Edit Service ${editingService.code}`} onClose={() => setEditingService(null)}>
          <ServiceForm service={editingService} teams={teams} departments={departments} onSubmit={async (formData) => { await updateService(editingService.id, formData); setEditingService(null); }} saving={saving} />
        </RequestModalShell>
      )}
    </section>
  );
}

function SetupActions({ rows, labelKey, onEdit, onDelete, saving, isAdmin }: { rows: any[]; labelKey: string; onEdit: (row: any) => void; onDelete: (id: string) => void; saving: boolean; isAdmin: boolean }) {
  if (!rows.length) return null;
  return (
    <div className="mt-4 grid gap-2">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-sm font-black">{row[labelKey]} / {row.name}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => onEdit(row)} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">Edit</button>
            {isAdmin && <button type="button" disabled={saving} onClick={() => onDelete(row.id)} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">Delete</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function AssetHierarchySetup({
  view,
  sites,
  buildings,
  spaces,
  departments,
  categories,
  saving,
  submitSite,
  submitBuilding,
  submitSpace,
  submitDepartment,
  submitCategory,
}: {
  view: string;
  sites: any[];
  buildings: any[];
  spaces: any[];
  departments: any[];
  categories: any[];
  saving: boolean;
  submitSite: (formData: FormData) => void;
  submitBuilding: (formData: FormData) => void;
  submitSpace: (formData: FormData) => void;
  submitDepartment: (formData: FormData) => void;
  submitCategory: (formData: FormData) => void;
}) {
  const [setupRows, setSetupRows] = useState({ sites, buildings, spaces, categories });
  const [setupTotals, setSetupTotals] = useState({ sites: sites.length, buildings: buildings.length, spaces: spaces.length, categories: categories.length });
  const [setupPages, setSetupPages] = useState({ sites: 1, buildings: 1, spaces: 1, categories: 1 });
  const [setupLoading, setSetupLoading] = useState("");
  const setupKey = view === "asset-sites" ? "sites" : view === "asset-buildings" ? "buildings" : view === "asset-spaces" ? "spaces" : view === "asset-categories" ? "categories" : "";
  const setupEndpoint = setupKey === "sites" ? "/api/sites" : setupKey === "buildings" ? "/api/buildings" : setupKey === "spaces" ? "/api/spaces" : setupKey === "categories" ? "/api/asset-categories" : "";
  const setupResponseKey = setupKey === "categories" ? "categories" : setupKey;

  useEffect(() => {
    setSetupRows({ sites, buildings, spaces, categories });
    setSetupTotals((current) => ({
      sites: Math.max(current.sites, sites.length),
      buildings: Math.max(current.buildings, buildings.length),
      spaces: Math.max(current.spaces, spaces.length),
      categories: Math.max(current.categories, categories.length),
    }));
  }, [sites, buildings, spaces, categories]);

  useEffect(() => {
    if (!setupEndpoint || !setupKey) return;
    const controller = new AbortController();
    async function loadFirstPage() {
      setSetupLoading(setupKey);
      try {
        const response = await fetch(`${setupEndpoint}?page=1&pageSize=${PAGE_SIZE}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          setSetupRows((current) => ({ ...current, [setupKey]: result[setupResponseKey] ?? [] }));
          setSetupTotals((current) => ({ ...current, [setupKey]: Number(result.total ?? result[setupResponseKey]?.length ?? 0) }));
          setSetupPages((current) => ({ ...current, [setupKey]: 1 }));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error);
      } finally {
        if (!controller.signal.aborted) setSetupLoading("");
      }
    }
    void loadFirstPage();
    return () => controller.abort();
  }, [setupEndpoint, setupKey, setupResponseKey]);

  async function loadMoreSetupRows() {
    if (!setupEndpoint || !setupKey || setupLoading) return;
    const currentRows = setupRows[setupKey as keyof typeof setupRows];
    const total = setupTotals[setupKey as keyof typeof setupTotals];
    if (currentRows.length >= total) return;
    const nextPage = setupPages[setupKey as keyof typeof setupPages] + 1;
    setSetupLoading(setupKey);
    try {
      const response = await fetch(`${setupEndpoint}?page=${nextPage}&pageSize=${PAGE_SIZE}`, { cache: "no-store" });
      if (response.ok) {
        const result = await response.json();
        const nextRows = result[setupResponseKey] ?? [];
        setSetupRows((current) => ({ ...current, [setupKey]: [...current[setupKey as keyof typeof setupRows], ...nextRows] }));
        setSetupTotals((current) => ({ ...current, [setupKey]: Number(result.total ?? total) }));
        setSetupPages((current) => ({ ...current, [setupKey]: nextPage }));
      }
    } finally {
      setSetupLoading("");
    }
  }

  const siteRows = setupRows.sites.map((site) => ({
    ...site,
    buildingCount: site.buildings?.length ?? setupRows.buildings.filter((building) => building.siteId === site.id).length,
  }));
  const buildingRows = setupRows.buildings.map((building) => ({
    ...building,
    siteName: building.site?.name || setupRows.sites.find((site) => site.id === building.siteId)?.name || "",
  }));
  const spaceRows = setupRows.spaces.map((space) => ({
    ...space,
    buildingCode: space.building?.code || setupRows.buildings.find((building) => building.id === space.buildingId)?.code || "",
    siteName: space.building?.site?.name || "",
  }));
  const showSites = view === "asset-sites";
  const showBuildings = view === "asset-buildings";
  const showSpaces = view === "asset-spaces";
  const showDepartments = view === "asset-departments";
  const showCategories = view === "asset-categories";

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        {showSites && (
          <Panel title="Sites" icon={MapPinned}>
            <ScrollableRowsTable rows={siteRows} totalRows={setupTotals.sites} loading={setupLoading === "sites"} onLoadMore={loadMoreSetupRows} columns={[["name", "Site"], ["city", "City"], ["country", "Country"], ["type", "Type"], ["areaSqm", "Area sqm"], ["buildingCount", "Buildings"]]} />
          </Panel>
        )}
        {showBuildings && (
          <Panel title="Buildings" icon={Building2}>
            <ScrollableRowsTable rows={buildingRows} totalRows={setupTotals.buildings} loading={setupLoading === "buildings"} onLoadMore={loadMoreSetupRows} columns={[["code", "Code"], ["name", "Building"], ["siteName", "Site"], ["floors", "Floors"], ["areaSqm", "Area sqm"]]} />
          </Panel>
        )}
        {showSpaces && (
          <Panel title="Spaces" icon={Boxes}>
            <ScrollableRowsTable rows={spaceRows} totalRows={setupTotals.spaces} loading={setupLoading === "spaces"} onLoadMore={loadMoreSetupRows} columns={[["name", "Space"], ["buildingCode", "Building"], ["floor", "Floor"], ["type", "Type"], ["capacity", "Capacity"], ["areaSqm", "Area sqm"], ["occupancy", "Occupancy"]]} />
          </Panel>
        )}
        {showDepartments && (
          <Panel title="Departments" icon={Users}>
            <DataTable rows={departments} columns={[["code", "Code"], ["name", "Department"], ["siteLocation", "Site"], ["description", "Description"]]} />
          </Panel>
        )}
        {showCategories && (
          <Panel title="Asset Categories" icon={PackagePlus}>
            <ScrollableRowsTable rows={setupRows.categories} totalRows={setupTotals.categories} loading={setupLoading === "categories"} onLoadMore={loadMoreSetupRows} columns={[["code", "Code"], ["name", "Category"], ["type", "Type"], ["defaultLifeYrs", "Life yrs"], ["statutory", "Statutory"], ["description", "Description"]]} />
          </Panel>
        )}
      </div>
      <div className="space-y-5">
        {showSites && <SiteForm onSubmit={submitSite} saving={saving} />}
        {showBuildings && <BuildingForm sites={sites} onSubmit={submitBuilding} saving={saving} />}
        {showSpaces && <SpaceForm buildings={buildings} onSubmit={submitSpace} saving={saving} />}
        {showDepartments && <DepartmentForm onSubmit={submitDepartment} saving={saving} />}
        {showCategories && <ActionForm title="Add Asset Category" onSubmit={submitCategory} fields={["code", "name", "type", "defaultLifeYrs", "statutory", "description"]} saving={saving} />}
      </div>
    </section>
  );
}

function SiteForm({ onSubmit, saving }: { onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(new FormData(form));
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <h3 className="text-xl font-black">Add Site</h3>
      <div className="mt-4 grid min-w-0 gap-3">
        <input name="name" placeholder="Site name" className={FACILITY_FIELD_CLASS} />
        <input name="city" placeholder="City" className={FACILITY_FIELD_CLASS} />
        <input name="country" defaultValue="Saudi Arabia" placeholder="Country" className={FACILITY_FIELD_CLASS} />
        <input name="type" placeholder="Site type" className={FACILITY_FIELD_CLASS} />
        <input name="areaSqm" type="number" min="0" placeholder="Area sqm" className={FACILITY_FIELD_CLASS} />
        <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Save Site"}</button>
      </div>
    </form>
  );
}

function BuildingForm({ sites, onSubmit, saving }: { sites: any[]; onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(new FormData(form));
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <h3 className="text-xl font-black">Add Building</h3>
      <div className="mt-4 grid min-w-0 gap-3">
        <input name="code" placeholder="Building code" className={FACILITY_FIELD_CLASS} />
        <input name="name" placeholder="Building name" className={FACILITY_FIELD_CLASS} />
        <select name="siteId" className={FACILITY_FIELD_CLASS}>
          <option value="">Select site</option>
          {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
        </select>
        <input name="site" placeholder="Or new site name" className={FACILITY_FIELD_CLASS} />
        <input name="floors" type="number" min="0" placeholder="Floors" className={FACILITY_FIELD_CLASS} />
        <input name="areaSqm" type="number" min="0" placeholder="Area sqm" className={FACILITY_FIELD_CLASS} />
        <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Save Building"}</button>
      </div>
    </form>
  );
}

function SpaceForm({ buildings, onSubmit, saving }: { buildings: any[]; onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(new FormData(form));
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <h3 className="text-xl font-black">Add Space</h3>
      <div className="mt-4 grid min-w-0 gap-3">
        <input name="name" placeholder="Space / room name" className={FACILITY_FIELD_CLASS} />
        <select name="buildingId" className={FACILITY_FIELD_CLASS}>
          <option value="">Select building</option>
          {buildings.map((building) => <option key={building.id} value={building.id}>{building.code} - {building.name}</option>)}
        </select>
        <input name="buildingCode" placeholder="Or building code" className={FACILITY_FIELD_CLASS} />
        <input name="floor" placeholder="Floor" className={FACILITY_FIELD_CLASS} />
        <input name="type" placeholder="Space type" className={FACILITY_FIELD_CLASS} />
        <input name="capacity" type="number" min="0" placeholder="Capacity" className={FACILITY_FIELD_CLASS} />
        <input name="areaSqm" type="number" min="0" placeholder="Area sqm" className={FACILITY_FIELD_CLASS} />
        <input name="occupancy" type="number" min="0" placeholder="Occupancy" className={FACILITY_FIELD_CLASS} />
        <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Save Space"}</button>
      </div>
    </form>
  );
}

function DepartmentForm({ department, onSubmit, saving }: { department?: any; onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <input name="code" defaultValue={department?.code ?? ""} placeholder="Department code" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
      <input name="name" defaultValue={department?.name ?? ""} placeholder="Department name" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
      <input name="siteLocation" defaultValue={department?.siteLocation ?? ""} placeholder="Site location" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
      <textarea name="description" defaultValue={department?.description ?? ""} placeholder="Description" className="min-h-24 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
      <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Save Department"}</button>
    </form>
  );
}

function TeamCodeForm({ departments, onSubmit, saving }: { departments: any[]; onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(new FormData(form));
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <h3 className="text-xl font-black">Create Team Code</h3>
      <div className="mt-4 grid gap-3">
        <input name="teamName" placeholder="Team name" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <select name="departmentCode" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option value="">Select department code</option>
          {departments.map((department) => (
            <option key={department.id} value={department.code}>{department.code} - {department.name}</option>
          ))}
        </select>
        <input name="departmentName" placeholder="Department name" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <input name="teamCode" placeholder="Team code manual entry" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Create Team Code"}</button>
      </div>
    </form>
  );
}

function TeamForm({ team, departments, onSubmit, saving }: { team?: any; departments: any[]; onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(new FormData(form));
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <h3 className="text-xl font-black">Add Service Team</h3>
      <div className="mt-4 grid gap-3">
        <input name="name" defaultValue={team?.name ?? ""} placeholder="Name" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <input name="teamCode" defaultValue={team?.code ?? ""} placeholder="Team code" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <input name="companyIdNumber" defaultValue={team?.companyIdNumber ?? team?.supervisor ?? ""} placeholder="Company ID number" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <select name="departmentCode" defaultValue={team?.departmentCode ?? team?.coverage ?? ""} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option value="">Select department code</option>
          {departments.map((department) => (
            <option key={department.id} value={department.code}>{department.code} - {department.name}</option>
          ))}
        </select>
        <input name="service" defaultValue={team?.service ?? team?.type ?? ""} placeholder="Service" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <RequiredLabel label="Shift Eligibility">
          <select name="shiftEligibility" defaultValue={team?.shiftEligibility ?? "Day & Night"} required className={HOUSING_FIELD_CLASS}>
            {SHIFT_ELIGIBILITY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
        </RequiredLabel>
        <RequiredLabel label="Maximum working hours per day">
          <input name="maxHoursPerDay" type="number" min="1" max="24" required defaultValue={team?.maxHoursPerDay ?? 8} className={HOUSING_FIELD_CLASS} />
        </RequiredLabel>
        <RequiredLabel label="Maximum consecutive working days">
          <input name="maxConsecutiveDays" type="number" min="1" max="31" required defaultValue={team?.maxConsecutiveDays ?? 6} className={HOUSING_FIELD_CLASS} />
        </RequiredLabel>
        <RequiredLabel label="Minimum rest hours between shifts">
          <input name="minRestHours" type="number" min="0" max="48" required defaultValue={team?.minRestHours ?? 12} className={HOUSING_FIELD_CLASS} />
        </RequiredLabel>
        <input name="email" type="email" defaultValue={team?.email ?? ""} placeholder="Email" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <input name="phone" defaultValue={team?.phone ?? ""} placeholder="Phone number" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Submit"}</button>
      </div>
    </form>
  );
}

function ServiceForm({ service, teams, departments, onSubmit, saving }: { service?: any; teams: any[]; departments: any[]; onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(new FormData(form));
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <h3 className="text-xl font-black">Add Service</h3>
      <div className="mt-4 grid gap-3">
        <input name="departmentName" defaultValue={service?.departmentName ?? service?.name ?? ""} placeholder="Department / service name" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <select name="departmentCode" defaultValue={service?.departmentCode ?? service?.code ?? ""} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option value="">Select department code</option>
          {departments.map((department) => (
            <option key={department.id} value={department.code}>{department.code} - {department.name}</option>
          ))}
        </select>
        <select name="teamCode" defaultValue={service?.teamCode ?? service?.team?.code ?? ""} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
          <option value="">Select team code</option>
          {teams.map((team) => (
            <option key={team.id} value={team.code}>{team.code} - {team.name}</option>
          ))}
        </select>
        <input name="slaHours" type="number" defaultValue={service?.slaHours ?? 24} placeholder="SLA hours" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Submit"}</button>
      </div>
    </form>
  );
}

function Locations({ locations, submitLocation, deleteLocation, isAdmin, saving }: { locations: any[]; submitLocation: (formData: FormData) => void; deleteLocation: (id: string) => void; isAdmin: boolean; saving: boolean }) {
  const [parentFilter, setParentFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [residentialFilter, setResidentialFilter] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [locationRowsSource, setLocationRowsSource] = useState<any[]>(locations);
  const [locationTotal, setLocationTotal] = useState(locations.length);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());
  const locationScrollRef = useRef<HTMLDivElement | null>(null);
  const locationRows = locationRowsSource.map((location) => ({
    ...location,
    locationCode: location.code,
    parentLocationDisplay: location.parentLocation || location.zone || "",
    classDisplay: location.locationClass || location.type || "",
    outOfServiceDisplay: location.outOfService ? "YES" : "NO",
    residentialDisplay: location.residential ? "YES" : "NO",
  }));
  const parentOptions = Array.from(new Set(locationRows.map((location) => location.parentLocationDisplay).filter(Boolean)));
  const classOptions = Array.from(new Set(locationRows.map((location) => location.classDisplay).filter(Boolean)));
  const hasMoreLocations = locationRowsSource.length < locationTotal;
  const selectedVisibleLocations = locationRows.filter((location) => selectedLocationIds.has(location.id));
  const allVisibleLocationsSelected = isAdmin && Boolean(locationRows.length) && selectedVisibleLocations.length === locationRows.length;
  const someVisibleLocationsSelected = isAdmin && selectedVisibleLocations.length > 0 && !allVisibleLocationsSelected;
  const hierarchyRows = parentOptions.map((parentLocation) => {
    const childRows = locationRows.filter((location) => location.parentLocationDisplay === parentLocation);
    return {
      id: parentLocation,
      parentLocation,
      locations: childRows.length,
      classes: new Set(childRows.map((location) => location.classDisplay).filter(Boolean)).size,
      residential: childRows.filter((location) => location.residential).length,
      outOfService: childRows.filter((location) => location.outOfService).length,
    };
  });

  useEffect(() => {
    setPage(1);
    locationScrollRef.current?.scrollTo({ top: 0 });
  }, [query, parentFilter, classFilter, residentialFilter]);

  useEffect(() => {
    setLocationRowsSource(locations);
    setLocationTotal((current) => Math.max(current, locations.length));
  }, [locations]);

  useEffect(() => {
    setSelectedLocationIds((current) => new Set(Array.from(current).filter((id) => locationRowsSource.some((location) => location.id === id))));
  }, [locationRowsSource]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLocationLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          query,
          parentLocation: parentFilter,
          locationClass: classFilter,
          residential: residentialFilter,
        });
        const response = await fetch(`/api/locations?${params.toString()}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          setLocationRowsSource((current) => page === 1 ? result.locations ?? [] : [...current, ...(result.locations ?? [])]);
          setLocationTotal(Number(result.total ?? result.locations?.length ?? 0));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      } finally {
        if (!controller.signal.aborted) setLocationLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [page, query, parentFilter, classFilter, residentialFilter]);

  function handleLocationScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 180;
    if (nearBottom && hasMoreLocations && !locationLoading) {
      setLocationLoading(true);
      setPage((current) => current + 1);
    }
  }

  function toggleLocationSelection(id: string, checked: boolean) {
    setSelectedLocationIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisibleLocations(checked: boolean) {
    setSelectedLocationIds((current) => {
      const next = new Set(current);
      locationRows.forEach((location) => {
        if (checked) next.add(location.id);
        else next.delete(location.id);
      });
      return next;
    });
  }

  async function bulkDeleteSelectedLocations() {
    const ids = Array.from(selectedLocationIds);
    if (!ids.length) return;
    await Promise.all(ids.map((id) => deleteLocation(id)));
    setSelectedLocationIds(new Set());
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <Panel title="Location Register" icon={MapPinned}>
        <ReportButtons type="locations" label="Locations report" />
        <div className="mb-4 grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_220px_180px_160px_auto]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search location, description, parent or class" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-lagoon" />
          <select value={parentFilter} onChange={(event) => setParentFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">All parents</option>
            {parentOptions.map((parentLocation) => <option key={parentLocation} value={parentLocation}>{parentLocation}</option>)}
          </select>
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">All classes</option>
            {classOptions.map((locationClass) => <option key={locationClass} value={locationClass}>{locationClass}</option>)}
          </select>
          <select value={residentialFilter} onChange={(event) => setResidentialFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">Residential</option>
            <option value="YES">YES</option>
            <option value="NO">NO</option>
          </select>
          <button type="button" onClick={() => { setQuery(""); setParentFilter(""); setClassFilter(""); setResidentialFilter(""); }} className="h-11 rounded-lg bg-white px-3 text-sm font-black text-lagoon">Clear</button>
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-lagoon/10 p-3"><p className="text-xs font-black uppercase text-lagoon">Locations</p><p className="text-2xl font-black">{locationTotal}</p></div>
          <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs font-black uppercase text-emerald-700">Parents</p><p className="text-2xl font-black">{parentOptions.length}</p></div>
          <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs font-black uppercase text-amber-700">Classes</p><p className="text-2xl font-black">{classOptions.length}</p></div>
          <div className="rounded-lg bg-rose-50 p-3"><p className="text-xs font-black uppercase text-rose-700">Out of Service</p><p className="text-2xl font-black">{locationRows.filter((location) => location.outOfService).length}</p></div>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-black text-slate-600">
          <span>Showing {locationRows.length.toLocaleString()} of {locationTotal.toLocaleString()} locations{isAdmin ? ` / Selected ${selectedLocationIds.size.toLocaleString()}` : ""}</span>
          {locationLoading && <span className="text-lagoon">Loading locations...</span>}
        </div>
        {isAdmin && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">
            <span>Selected {selectedLocationIds.size.toLocaleString()} locations</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => toggleVisibleLocations(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-lagoon">Select Visible</button>
              <button type="button" disabled={!selectedLocationIds.size} onClick={bulkDeleteSelectedLocations} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Delete All</button>
              <button type="button" disabled={!selectedLocationIds.size} onClick={() => setSelectedLocationIds(new Set())} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">Clear Selection</button>
            </div>
          </div>
        )}
        <div ref={locationScrollRef} onScroll={handleLocationScroll} className="cafm-scroll-x max-h-[70vh] overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
          <table className="cafm-data-table min-w-[1020px] border-collapse bg-white text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {isAdmin && (
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleLocationsSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someVisibleLocationsSelected;
                      }}
                      onChange={(event) => toggleVisibleLocations(event.target.checked)}
                    />
                  </th>
                )}
                {["Location", "Description", "Class", "Parent Location", "Out of Service", "Residential", ...(isAdmin ? ["Actions"] : [])].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {locationRows.map((location) => (
                <tr key={location.id} className="border-t border-slate-100">
                  {isAdmin && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedLocationIds.has(location.id)}
                        onChange={(event) => toggleLocationSelection(location.id, event.target.checked)}
                      />
                    </td>
                  )}
                  <td className="px-3 py-3 font-black text-lagoon">{location.locationCode}</td>
                  <td className="px-3 py-3">{displayValue(location.description)}</td>
                  <td className="px-3 py-3">{displayValue(location.classDisplay)}</td>
                  <td className="px-3 py-3">{displayValue(location.parentLocationDisplay)}</td>
                  <td className="px-3 py-3">{location.outOfServiceDisplay}</td>
                  <td className="px-3 py-3">{location.residentialDisplay}</td>
                  {isAdmin && <td className="px-3 py-3"><DeleteRowButton saving={saving} onDelete={() => deleteLocation(location.id)} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-center text-sm font-black text-slate-500">
          {hasMoreLocations ? "Scroll down to load more locations" : "All matching locations loaded"}
        </div>
      </Panel>
      <div className="grid gap-5">
        <Panel title="Location Hierarchy" icon={MapPinned}>
          <DataTable rows={hierarchyRows} columns={[["parentLocation", "Parent Location"], ["locations", "Locations"], ["classes", "Classes"], ["residential", "Residential"], ["outOfService", "Out of Service"]]} />
        </Panel>
        <ActionForm title="Add Location" onSubmit={submitLocation} fields={["location", "description", "locationClass", "parentLocation", "outOfService", "residential"]} saving={saving} />
      </div>
    </section>
  );
}

function JobPlans({ jobPlans, jobPlansTotal, services, departments, submitJobPlan, deleteJobPlan, isAdmin, saving }: { jobPlans: any[]; jobPlansTotal?: number; services: any[]; departments: any[]; submitJobPlan: (formData: FormData) => void; deleteJobPlan: (id: string) => void; isAdmin: boolean; saving: boolean }) {
  const [page, setPage] = useState(1);
  const [jobPlanRowsSource, setJobPlanRowsSource] = useState<any[]>(jobPlans);
  const [jobPlanTotal, setJobPlanTotal] = useState(jobPlansTotal ?? jobPlans.length);
  const [jobPlanLoading, setJobPlanLoading] = useState(false);
  const [selectedJobPlanIds, setSelectedJobPlanIds] = useState<Set<string>>(new Set());
  const jobPlanScrollRef = useRef<HTMLDivElement | null>(null);
  const hasMoreJobPlans = jobPlanRowsSource.length < jobPlanTotal;
  const selectedVisibleJobPlans = jobPlanRowsSource.filter((jobPlan) => selectedJobPlanIds.has(jobPlan.id));
  const allVisibleJobPlansSelected = isAdmin && Boolean(jobPlanRowsSource.length) && selectedVisibleJobPlans.length === jobPlanRowsSource.length;
  const someVisibleJobPlansSelected = isAdmin && selectedVisibleJobPlans.length > 0 && !allVisibleJobPlansSelected;

  useEffect(() => {
    setJobPlanRowsSource(jobPlans);
    setJobPlanTotal((current) => Math.max(current, jobPlansTotal ?? jobPlans.length));
  }, [jobPlans, jobPlansTotal]);

  useEffect(() => {
    setSelectedJobPlanIds((current) => new Set(Array.from(current).filter((id) => jobPlanRowsSource.some((jobPlan) => jobPlan.id === id))));
  }, [jobPlanRowsSource]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setJobPlanLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        const response = await fetch(`/api/job-plans?${params.toString()}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          setJobPlanRowsSource((current) => page === 1 ? result.jobPlans ?? [] : [...current, ...(result.jobPlans ?? [])]);
          setJobPlanTotal(Number(result.total ?? result.jobPlans?.length ?? 0));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      } finally {
        if (!controller.signal.aborted) setJobPlanLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [page]);

  function handleJobPlanScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 180;
    if (nearBottom && hasMoreJobPlans && !jobPlanLoading) {
      setJobPlanLoading(true);
      setPage((current) => current + 1);
    }
  }

  function toggleJobPlanSelection(id: string, checked: boolean) {
    setSelectedJobPlanIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisibleJobPlans(checked: boolean) {
    setSelectedJobPlanIds((current) => {
      const next = new Set(current);
      jobPlanRowsSource.forEach((jobPlan) => {
        if (checked) next.add(jobPlan.id);
        else next.delete(jobPlan.id);
      });
      return next;
    });
  }

  async function bulkDeleteSelectedJobPlans() {
    const ids = Array.from(selectedJobPlanIds);
    if (!ids.length) return;
    await Promise.all(ids.map((id) => deleteJobPlan(id)));
    setSelectedJobPlanIds(new Set());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await submitJobPlan(new FormData(form));
    form.reset();
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <Panel title="Job Plans" icon={ClipboardCheck}>
        <ReportButtons type="job-plans" label="Job plans report" />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-black text-slate-600">
          <span>Showing {jobPlanRowsSource.length.toLocaleString()} of {jobPlanTotal.toLocaleString()} job plans{isAdmin ? ` / Selected ${selectedJobPlanIds.size.toLocaleString()}` : ""}</span>
          {jobPlanLoading && <span className="text-lagoon">Loading job plans...</span>}
        </div>
        {isAdmin && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">
            <span>Selected {selectedJobPlanIds.size.toLocaleString()} job plans</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => toggleVisibleJobPlans(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-lagoon">Select Visible</button>
              <button type="button" disabled={!selectedJobPlanIds.size} onClick={bulkDeleteSelectedJobPlans} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Delete All</button>
              <button type="button" disabled={!selectedJobPlanIds.size} onClick={() => setSelectedJobPlanIds(new Set())} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">Clear Selection</button>
            </div>
          </div>
        )}
        <div ref={jobPlanScrollRef} onScroll={handleJobPlanScroll} className="cafm-scroll-x max-h-[70vh] overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
          <table className="cafm-data-table min-w-[1180px] border-collapse bg-white text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {isAdmin && (
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleJobPlansSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someVisibleJobPlansSelected;
                      }}
                      onChange={(event) => toggleVisibleJobPlans(event.target.checked)}
                    />
                  </th>
                )}
                {["#", "Code", "Name", "Asset Type", "Dept", "Service", "Hours", "Priority", "Active", ...(isAdmin ? ["Actions"] : [])].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {jobPlanRowsSource.map((jobPlan, index) => (
                <tr key={jobPlan.id} className="border-t border-slate-100">
                  {isAdmin && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedJobPlanIds.has(jobPlan.id)}
                        onChange={(event) => toggleJobPlanSelection(jobPlan.id, event.target.checked)}
                      />
                    </td>
                  )}
                  <td className="px-3 py-3 font-black text-slate-500">{index + 1}</td>
                  <td className="px-3 py-3 font-black text-lagoon">{displayValue(jobPlan.code)}</td>
                  <td className="px-3 py-3">{displayValue(jobPlan.name)}</td>
                  <td className="px-3 py-3">{displayValue(jobPlan.assetType)}</td>
                  <td className="px-3 py-3">{displayValue(jobPlan.departmentCode)}</td>
                  <td className="px-3 py-3">{displayValue(jobPlan.serviceCode)}</td>
                  <td className="px-3 py-3">{displayValue(jobPlan.estimatedHours)}</td>
                  <td className="px-3 py-3"><RequestPriorityBadge priority={jobPlan.priority || "MEDIUM"} /></td>
                  <td className="px-3 py-3">{displayValue(jobPlan.active)}</td>
                  {isAdmin && <td className="px-3 py-3"><DeleteRowButton saving={saving} onDelete={() => deleteJobPlan(jobPlan.id)} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-center text-sm font-black text-slate-500">
          {hasMoreJobPlans ? "Scroll down to load more job plans" : "All job plans loaded"}
        </div>
      </Panel>
      <form onSubmit={handleSubmit} className="min-w-0 rounded-lg border border-white/80 bg-white p-5 shadow-lift">
        <h3 className="text-xl font-black">Add Job Plan</h3>
        <div className="mt-4 grid min-w-0 gap-3">
          <input name="code" placeholder="Job plan code" className={TICKET_PLAN_FIELD_CLASS} />
          <input name="name" placeholder="Job plan name" className={TICKET_PLAN_FIELD_CLASS} />
          <input name="assetType" placeholder="Specific asset type" className={TICKET_PLAN_FIELD_CLASS} />
          <select name="departmentCode" className={TICKET_PLAN_FIELD_CLASS}>
            <option value="">Select department</option>
            {departments.map((department) => <option key={department.id} value={department.code}>{department.code} - {department.name}</option>)}
          </select>
          <select name="serviceCode" className={TICKET_PLAN_FIELD_CLASS}>
            <option value="">Select service</option>
            {services.map((service) => <option key={service.id} value={service.code}>{service.code} - {service.name}</option>)}
          </select>
          <input name="estimatedHours" type="number" placeholder="Estimated hours" className={TICKET_PLAN_FIELD_CLASS} />
          <select name="priority" defaultValue="MEDIUM" className={TICKET_PLAN_FIELD_CLASS}>
            <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
          </select>
          <textarea name="steps" placeholder="Job plan steps" className={`${TICKET_PLAN_TEXTAREA_CLASS} min-h-24`} />
          <textarea name="safetyNotes" placeholder="Safety notes" className={`${TICKET_PLAN_TEXTAREA_CLASS} min-h-20`} />
          <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Save Job Plan"}</button>
        </div>
      </form>
    </section>
  );
}

function BulkUpload({ saving, onSubmit, initialModule }: { saving: boolean; onSubmit: (formData: FormData) => void; initialModule: string }) {
  const [module, setModule] = useState(initialModule);
  const [manualProgress, setManualProgress] = useState("");
  const [manualUploading, setManualUploading] = useState(false);

  useEffect(() => {
    setModule(initialModule);
  }, [initialModule]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (module === "omManuals") {
      const manualInput = form.elements.namedItem("manualFiles") as HTMLInputElement | null;
      const manualFiles = Array.from(manualInput?.files ?? []);
      if (manualFiles.length) {
        setManualUploading(true);
        setManualProgress(`Uploading manual file 1 of ${manualFiles.length}...`);
        try {
          for (const [index, manualFile] of manualFiles.entries()) {
            const manualFormData = new FormData();
            manualFormData.set("files", manualFile);
            const response = await fetch("/api/manual-library", { method: "POST", body: manualFormData });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(cleanMessage(result.message ?? `${manualFile.name} failed to upload.`));
            setManualProgress(`Uploaded ${index + 1} of ${manualFiles.length} manual files.`);
          }
        } finally {
          setManualUploading(false);
        }
      }

      const csvFile = formData.get("file");
      const uploadData = new FormData();
      uploadData.set("module", module);
      if (csvFile instanceof File) uploadData.set("file", csvFile);
      await onSubmit(uploadData);
    } else {
      await onSubmit(formData);
    }
    event.currentTarget.reset();
    setManualProgress("");
    setModule(initialModule);
  }

  return (
    <section className="grid gap-5">
      <Panel title="Bulk Upload Center" icon={Upload}>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-1 text-sm font-bold text-slate-600">
            Module
            <select name="module" value={module} onChange={(event) => setModule(event.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
              <option value="sites">Sites</option>
              <option value="buildings">Buildings</option>
              <option value="spaces">Spaces</option>
              <option value="assets">Assets</option>
              <option value="housingAssets">Housing Assets</option>
              <option value="categories">Asset Categories</option>
              <option value="inventory">Inventory</option>
              <option value="requests">Service Requests</option>
              <option value="workOrders">Work Orders</option>
              <option value="ppm">PPM Schedule</option>
              <option value="omManuals">O&M Manual Index</option>
              <option value="jobPlans">Job Plans</option>
              <option value="locations">Locations</option>
              <option value="inspections">Inspections</option>
              <option value="teams">Teams</option>
              <option value="services">Services</option>
              <option value="departments">Departments</option>
              <option value="employees">Employees</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-600">
            CSV File
            <input name="file" type="file" accept=".csv,text/csv" className="rounded-lg border border-slate-200 bg-white p-3" />
          </label>
          {module === "omManuals" && (
            <label className="grid gap-1 text-sm font-bold text-slate-600">
              Manual PDF Files
              <input name="manualFiles" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.xlsx,.docx,.pptx" multiple className="rounded-lg border border-slate-200 bg-white p-3" />
              <span className="text-xs font-bold text-slate-500">Select all files from the O&M manual upload folder. Files upload one by one, then the CSV links them to assets.</span>
            </label>
          )}
          {manualProgress && <div className="rounded-lg border border-lagoon/20 bg-lagoon/5 p-3 text-sm font-black text-lagoon">{manualProgress}</div>}
          <button disabled={saving || manualUploading} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">
            {saving || manualUploading ? "Uploading..." : module === "omManuals" ? "Upload Manuals then CSV" : "Upload CSV"}
          </button>
        </form>
      </Panel>
    </section>
  );
}

function Templates() {
  const templates = [
    ["sites", "Sites", "name,city,country,type,areaSqm"],
    ["buildings", "Buildings", "code,name,site,city,country,floors,areaSqm"],
    ["spaces", "Spaces", "code,name,site,city,country,buildingCode,floor,type,capacity,areaSqm,occupancy"],
    ["assets", "Assets", assetTemplateHeader],
    ["housingAssets", "Housing Assets", housingAssetTemplateHeader],
    ["departments", "Departments", "code,name,siteLocation,description"],
    ["employees", "Employees", "name,email,companyId,nationalityType,departmentCode,siteLocation"],
    ["teams", "Teams", "name,companyIdNumber,departmentCode,service,email,phone"],
    ["services", "Services", "departmentName,departmentCode"],
    ["inventory", "Inventory", "sku,name,category,unit,onHand,reorderPoint,unitCost,vendor,location"],
    ["requests", "Requests", "ticketNo,title,category,departmentCode,serviceCode,assignedTeamCode,requester,channel,priority,status,location,attachmentUrls,rejectionReason,slaHours,description"],
    ["workOrders", "Work Orders", "woNo,title,type,assetType,departmentCode,serviceCode,assignedTeamCode,jobPlanCode,priority,status,assetTag,plannedStart,dueAt,finishedAt,resolutionAt,dateTimeCreated,estimatedHours,actualHours,cost,jobPlan,safetyNotes,workNotes,materialRequest,photoUrls,assetsUsed,inventoryUsed,supervisorDecision,sourceYear,sourceWorkOrder,sourceServiceRequest,sourceEquipmentLocation,sourceLocation,matchSource"],
    ["ppm", "PPM Schedule", "code,name,assetTag,locationCode,frequency,nextDue,durationHrs,departmentCode,priority,checklist,active"],
    ["omManuals", "O&M Manual Index", "category,assetTag,sourcePath,fileName,manualCode,manualTitle,matchField,assetClass,assetCategory,assetPrimarySystem,department"],
    ["jobPlans", "Job Plans", "code,name,assetType,departmentCode,serviceCode,estimatedHours,priority,steps,safetyNotes"],
    ["locations", "Locations", "Location,Description,Class,Parent Location,Out of Service,Residential"],
    ["inspections", "Inspections", "code,title,area,inspector,risk,score,status,dueAt,findings"],
  ];

  return (
    <Panel title="Bulk Upload Templates" icon={ClipboardCheck}>
      <div className="mb-4 rounded-lg border border-lagoon/20 bg-lagoon/5 p-4">
        <p className="font-black text-ink">Download CSV data templates</p>
        <p className="mt-1 text-sm font-bold text-slate-600">Use these files for bulk upload. Each download contains the correct column headers for that module.</p>
      </div>
      <div className="grid gap-3 text-sm lg:grid-cols-2">
        {templates.map(([type, title, value]) => (
          <Template key={type} type={type} title={title} value={value} />
        ))}
      </div>
    </Panel>
  );
}

function UsersRoles({
  users,
  teams,
  departments,
  roles,
  currentUser,
  permissions,
  rolePermissions,
  submitUser,
  submitRole,
  updateUser,
  deleteUser,
  deleteRole,
  isAdmin,
  saveRolePermissions,
  saving,
  setToast,
}: {
  users: any[];
  teams: any[];
  departments: any[];
  roles: any[];
  currentUser: { id?: string; email: string; name: string; role: string };
  permissions: any[];
  rolePermissions: any[];
  submitUser: (formData: FormData) => Promise<void> | void;
  submitRole: (formData: FormData) => void;
  updateUser: (id: string, formData: FormData) => Promise<void> | void;
  deleteUser: (id: string) => Promise<void> | void;
  deleteRole: (role: string) => void;
  isAdmin: boolean;
  saveRolePermissions: (role: string, permissionCodes: string[]) => void;
  refreshData: () => void;
  saving: boolean;
  setToast: (message: string) => void;
}) {
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [role, setRole] = useState("Admin");
  const [userRows, setUserRows] = useState<any[]>(users);
  const [userTotal, setUserTotal] = useState(users.length);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const userScrollRef = useRef<HTMLDivElement | null>(null);
  const permissionsByCode = useMemo(() => {
    const catalog = new Map(permissionCatalog.map((permission) => [permission.code, { ...permission, id: permission.code }]));
    permissions.forEach((permission) => {
      const existing = catalog.get(permission.code);
      catalog.set(permission.code, { ...existing, ...permission });
    });
    return Array.from(catalog.values()).sort((left, right) => `${left.module}-${left.name}`.localeCompare(`${right.module}-${right.name}`));
  }, [permissions]);
  const visiblePermissions = permissionsByCode.filter((permission) => role === "Admin" || !(permission as any).adminOnly);
  const groupedPermissions = visiblePermissions.reduce((groups: Record<string, any[]>, permission) => {
    groups[permission.module] = [...(groups[permission.module] ?? []), permission];
    return groups;
  }, {});
  const selectedRoleRecord = roles.find((item) => item.name === role);
  const roleAssignedUsers = users.filter((user) => user.role === role).length;
  const canDeleteRole = !defaultRoleNames.includes(role) && !selectedRoleRecord?.standard && roleAssignedUsers === 0;
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    rolePermissions.filter((item) => item.role === "Admin").map((item) => item.permission.code),
  );

  function changeRole(nextRole: string) {
    setRole(nextRole);
    const nextPermissions = rolePermissions.filter((item) => item.role === nextRole).map((item) => item.permission.code);
    setSelectedPermissions(nextRole === "Admin" ? nextPermissions : nextPermissions.filter((code) => code !== "documents.upload"));
  }

  useEffect(() => {
    setUserRows(users);
    setUserTotal((current) => Math.max(current, users.length));
  }, [users]);

  useEffect(() => {
    setUserPage(1);
    userScrollRef.current?.scrollTo({ top: 0 });
  }, [userSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setUserLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(userPage),
          pageSize: String(PAGE_SIZE),
          query: userSearch,
        });
        const response = await fetch(`/api/users?${params.toString()}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          setUserRows((current) => userPage === 1 ? result.users ?? [] : [...current, ...(result.users ?? [])]);
          setUserTotal(Number(result.total ?? result.users?.length ?? 0));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      } finally {
        if (!controller.signal.aborted) setUserLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [userPage, userSearch]);

  async function refreshUserRows() {
    setUserLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: String(Math.max(PAGE_SIZE, userRows.length || PAGE_SIZE)), query: userSearch });
      const response = await fetch(`/api/users?${params.toString()}`, { cache: "no-store" });
      if (response.ok) {
        const result = await response.json();
        setUserRows(result.users ?? []);
        setUserTotal(Number(result.total ?? result.users?.length ?? 0));
        setUserPage(1);
      }
    } finally {
      setUserLoading(false);
    }
  }

  function handleUserScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 160;
    if (nearBottom && userRows.length < userTotal && !userLoading) {
      setUserLoading(true);
      setUserPage((current) => current + 1);
    }
  }

  async function submitUserAndRefresh(formData: FormData) {
    await submitUser(formData);
    await refreshUserRows();
  }

  async function updateUserAndRefresh(id: string, formData: FormData) {
    await updateUser(id, formData);
    await refreshUserRows();
    setEditingUser(null);
  }

  async function deleteUserAndRefresh(id: string) {
    await deleteUser(id);
    await refreshUserRows();
  }

  function togglePermission(code: string) {
    setSelectedPermissions((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  function toggleModulePermissions(codes: string[], checked: boolean) {
    setSelectedPermissions((current) => {
      if (!checked) return current.filter((code) => !codes.includes(code));
      return Array.from(new Set([...current, ...codes]));
    });
  }

  function saveVisiblePermissions() {
    const allowedPermissions = role === "Admin" ? selectedPermissions : selectedPermissions.filter((code) => code !== "documents.upload");
    saveRolePermissions(role, allowedPermissions);
  }

  function deleteSelectedRole() {
    if (!canDeleteRole) {
      setToast(roleAssignedUsers > 0 ? "Assign users to another role before deleting this role." : "Standard roles cannot be deleted.");
      return;
    }
    if (!window.confirm(`Delete role "${role}"?`)) return;
    const deletedRole = role;
    changeRole("Admin");
    deleteRole(deletedRole);
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <Panel title="Users" icon={Users}>
          <ReportButtons type="users" label="Users report" />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 lg:max-w-md">
              <Search size={16} className="text-slate-400" />
              <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users" className="h-11 w-full text-sm outline-none" />
            </div>
            <div className="text-sm font-black text-slate-600">
              Showing {userRows.length.toLocaleString()} of {userTotal.toLocaleString()} users
              {userLoading && <span className="ml-2 text-lagoon">Loading...</span>}
            </div>
          </div>
          <div ref={userScrollRef} onScroll={handleUserScroll} className="grid max-h-[60vh] gap-2 overflow-auto pr-1 scrollbar-thin">
            {userRows.map((account) => (
              <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="font-black">{account.name}</p>
                  <p className="text-sm text-slate-600">{account.email} / {account.role} / {account.department}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingUser(account)} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">Edit</button>
                  {isAdmin && (
                    <button
                      disabled={account.id === currentUser.id || account.email === currentUser.email}
                      onClick={() => {
                        if (account.id === currentUser.id || account.email === currentUser.email) {
                          setToast("You cannot delete your own user account.");
                          return;
                        }
                        if (account.email === "admin@cafm.local") {
                          setToast("Initial admin user cannot be deleted.");
                          return;
                        }
                        void deleteUserAndRefresh(account.id);
                      }}
                      className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Permissions Matrix" icon={ShieldCheck}>
          <ReportButtons type="permissions" label="Permissions report" />
          <div className="mb-4 flex flex-wrap gap-3">
            <select value={role} onChange={(event) => changeRole(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3">
              {roleOptions(roles).map((item) => <option key={item}>{item}</option>)}
            </select>
            <button onClick={saveVisiblePermissions} className="rounded-lg bg-ink px-4 py-2 text-sm font-black text-white">Save Permissions</button>
            {isAdmin && (
              <button
                type="button"
                disabled={saving || !canDeleteRole}
                onClick={deleteSelectedRole}
                title={canDeleteRole ? "Delete selected role" : roleAssignedUsers > 0 ? "Assign users to another role before deleting" : "Standard roles cannot be deleted"}
                className="rounded-lg bg-coral px-4 py-2 text-sm font-black text-white disabled:bg-slate-300"
              >
                Delete Role
              </button>
            )}
          </div>
          <div className="grid gap-4">
            {Object.entries(groupedPermissions).map(([module, modulePermissions]) => {
              const moduleCodes = modulePermissions.map((permission) => permission.code);
              const allSelected = moduleCodes.every((code) => selectedPermissions.includes(code));
              const someSelected = !allSelected && moduleCodes.some((code) => selectedPermissions.includes(code));
              return (
              <div key={module} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-black text-ink">{module}</h4>
                  <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someSelected;
                      }}
                      onChange={(event) => toggleModulePermissions(moduleCodes, event.target.checked)}
                    />
                    Select All
                  </label>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {modulePermissions.map((permission) => (
                    <label key={permission.code} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <input type="checkbox" checked={selectedPermissions.includes(permission.code)} onChange={() => togglePermission(permission.code)} className="mt-1" />
                      <span>
                        <span className="block font-black">{permission.name}</span>
                        <span className="block text-slate-500">{permission.code}</span>
                        <span className="mt-1 block text-xs text-slate-500">{permission.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        </Panel>
      </div>
      <div className="space-y-5">
        <RoleForm onSubmit={submitRole} saving={saving} />
        <UserForm title="Create User" teams={teams} departments={departments} users={userRows} roles={roles} onSubmit={submitUserAndRefresh} saving={saving} />
        {editingUser && <UserForm title="Edit User" user={editingUser} teams={teams} departments={departments} users={userRows} roles={roles} onSubmit={(formData) => updateUserAndRefresh(editingUser.id, formData)} saving={saving} />}
      </div>
    </section>
  );
}

function RoleForm({ onSubmit, saving }: { onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <h3 className="text-xl font-black">Create Custom Role</h3>
      <div className="mt-4 grid gap-3">
        <input name="name" placeholder="Role name" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
        <textarea name="description" placeholder="Role purpose and access scope" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
        <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Create Role"}</button>
      </div>
    </form>
  );
}

const defaultRoleNames = ["Admin", "Department Supervisor", "Supervisor", "Service Team", "Technician", "Helpdesk", "Reception", "Resident", "Requester", "Read-only"];

function roleOptions(roles: any[]) {
  return Array.from(new Set([...defaultRoleNames, ...roles.map((role) => role.name)]));
}

function UserForm({ title, user, teams, departments, users, roles, onSubmit, saving }: { title: string; user?: any; teams: any[]; departments: any[]; users: any[]; roles: any[]; onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
    if (!user) event.currentTarget.reset();
  }

  const cls = "h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon";

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <h3 className="text-xl font-black">{title}</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold text-slate-600">User Name<input name="name" defaultValue={user?.name ?? ""} placeholder="Enter your Name" className={cls} /></label>
        <label className="grid gap-1 text-sm font-bold text-slate-600">Email<input name="email" defaultValue={user?.email ?? ""} type="email" placeholder="Enter Email" className={cls} /></label>
        <label className="grid gap-1 text-sm font-bold text-slate-600">Phone<input name="phone" defaultValue={user?.phone ?? ""} placeholder="Enter Phone Number" className={cls} /></label>
        <label className="grid gap-1 text-sm font-bold text-slate-600">Password<input name="password" type="password" placeholder={user ? "New password optional" : "Optional, auto-generated if blank"} className={cls} /></label>
        <label className="grid gap-1 text-sm font-bold text-slate-600">Select User Role<select name="role" defaultValue={user?.role ?? "Service Team"} className={cls}>
          {roleOptions(roles).map((role) => <option key={role}>{role}</option>)}
        </select></label>
        <label className="grid gap-1 text-sm font-bold text-slate-600">Select Department<select name="department" defaultValue={user?.department ?? ""} className={cls}>
          <option value="">Select Department</option>
          {departments.map((department) => <option key={department.id} value={department.code}>{department.code} - {department.name}</option>)}
        </select></label>
        <label className="grid gap-1 text-sm font-bold text-slate-600">Select Team
        <select name="teamCode" defaultValue={user?.team?.code ?? ""} className={cls}>
          <option value="">Select Team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.code}>{team.code} - {team.name}</option>
          ))}
        </select></label>
        <label className="grid gap-1 text-sm font-bold text-slate-600">Supervisor / Assigned User<select name="supervisorEmail" defaultValue={user?.supervisorEmail ?? ""} className={cls}>
          <option value="">Select user</option>
          {users.filter((item) => item.id !== user?.id).map((item) => <option key={item.id} value={item.email}>{item.name} - {item.role}</option>)}
        </select></label>
        <label className="grid gap-1 text-sm font-bold text-slate-600">Status
        <select name="active" defaultValue={String(user?.active ?? true)} className={cls}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select></label>
        <div className="rounded-lg bg-slate-50 p-3 md:col-span-2">
          <p className="text-sm font-black text-slate-700">Email Notification</p>
          <div className="mt-3 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input name="notifyWorkOrder" type="checkbox" defaultChecked={user?.notifyWorkOrder ?? false} /> Work Order</label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input name="notifyFacilityBooking" type="checkbox" defaultChecked={user?.notifyFacilityBooking ?? false} /> Facility Booking</label>
          </div>
        </div>
        <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400 md:col-span-2">{saving ? "Saving..." : "Create Now"}</button>
      </div>
    </form>
  );
}

function ResourceManagement({
  employees,
  departments,
  teams,
  requests,
  workOrders,
  shiftRotation,
  users,
  locations,
  view,
  submitEmployee,
  submitShiftRotation,
  refreshData,
  saving,
  navigate,
  isAdmin,
}: {
  employees: any[];
  departments: any[];
  teams: any[];
  requests: any[];
  workOrders: any[];
  shiftRotation: { shifts: any[]; rotations: any[]; roster: any[] };
  users: any[];
  locations: any[];
  view: string;
  submitEmployee: (formData: FormData) => void;
  submitShiftRotation: (formData: FormData) => void;
  refreshData: () => Promise<void>;
  saving: boolean;
  navigate: (moduleId: string, menuKey: string, view?: string) => void;
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState(view || "resource-employees");
  const [nationality, setNationality] = useState("All");

  useEffect(() => {
    if (view?.startsWith("resource")) setTab(view);
  }, [view]);

  const nationalities = ["All", ...Array.from(new Set(employees.map((employee) => employee.nationalityType).filter(Boolean)))];
  const filtered = nationality === "All" ? employees : employees.filter((employee) => employee.nationalityType === nationality);
  const workTimeRows = workOrders.map((work) => {
    const responseMinutes = metricMinutes(work.createdAt, work.responseAt);
    const resolutionMinutes = metricMinutes(work.responseAt, work.resolutionAt);
    const finishMinutes = metricMinutes(work.resolutionAt, work.finishedAt);
    const recordedMinutes = [responseMinutes, resolutionMinutes, finishMinutes].filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
    const estimatedMinutes = Number(work.estimatedHours || 0) * 60;
    const assignedMember = work.assignedTo?.email || work.assignedTo?.name || work.assignedToEmail || work.assignedTeamCode || "Unassigned";
    return {
      id: work.id,
      source: "Work Order",
      reference: work.woNo,
      title: work.title,
      assignedMember,
      team: work.assignedTeamCode || "-",
      status: work.status,
      priority: work.priority,
      estimatedTime: estimatedMinutes ? `${Math.round(estimatedMinutes / 60)} hrs` : "-",
      actualTime: recordedMinutes ? formatDuration(recordedMinutes) : "-",
      serviceRequest: work.request?.ticketNo || "-",
      moduleId: "work",
      menuKey: "Tickets-Work Orders",
    };
  });
  const requestTimeRows = requests.map((request) => {
    const linkedWork = workOrders.find((work) => work.request?.ticketNo === request.ticketNo || work.requestId === request.id || work.title === request.title);
    return {
      id: request.id,
      source: "Service Request",
      reference: request.ticketNo,
      title: request.title,
      assignedMember: request.assignedToEmail || request.assignedTeamCode || linkedWork?.assignedTo?.email || "Unassigned",
      team: request.assignedTeamCode || linkedWork?.assignedTeamCode || "-",
      status: request.status,
      priority: request.priority,
      estimatedTime: request.slaHours ? `${request.slaHours} SLA hrs` : "-",
      actualTime: linkedWork ? workTimeRows.find((row) => row.id === linkedWork.id)?.actualTime || "-" : "-",
      serviceRequest: request.ticketNo,
      moduleId: "helpdesk",
      menuKey: "Tickets-Service Requests",
    };
  });
  const timeSheetRows = [...workTimeRows, ...requestTimeRows];
  const shiftRows = teams.map((team) => {
    const teamWork = workOrders.filter((work) => work.assignedTeamCode === team.code);
    const teamRequests = requests.filter((request) => request.assignedTeamCode === team.code);
    const assignedEmployees = employees.filter((employee) => employee.departmentCode === team.code || employee.siteLocation === team.coverage);
    const totalMinutes = teamWork.reduce((sum, work) => sum + metricMinutes(work.responseAt, work.finishedAt), 0);
    return {
      id: team.id,
      teamCode: team.code,
      teamName: team.name,
      shift: team.shift || "Unassigned",
      rotation: team.coverage || "All sites",
      supervisor: team.supervisor || "Unassigned",
      employees: assignedEmployees.length,
      serviceRequests: teamRequests.length,
      workOrders: teamWork.length,
      timeSpent: totalMinutes ? formatDuration(totalMinutes) : "-",
    };
  });
  const tabs = [
    ["resource-employees", "Employees", filtered.length],
    ["resource-shift-rotation", "Shift & Rotation", shiftRotation.roster.length],
    ["resource-timesheets", "Time Sheets", timeSheetRows.length],
  ] as const;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await submitEmployee(new FormData(form));
    form.reset();
  }

  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <Panel title="Resource Management" icon={Users}>
        <ReportButtons type="employees" label="Employees report" />
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {tabs.map(([id, label, count]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-3 py-2 text-sm font-black ${tab === id ? "bg-lagoon text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
              {label}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === id ? "bg-white/20 text-white" : "bg-white text-slate-500"}`}>{count}</span>
            </button>
          ))}
        </div>
        {tab === "resource-employees" && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <select value={nationality} onChange={(event) => setNationality(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3">
                {nationalities.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <DataTable rows={filtered} columns={[["name", "Name"], ["email", "Email"], ["companyId", "Company ID"], ["nationalityType", "Nationality"], ["departmentCode", "Dept"], ["siteLocation", "Site"], ["shiftEligibility", "Shift Eligibility"], ["defaultShift", "Default Shift"], ["serviceTeamCode", "Service Team"], ["supervisor", "Supervisor"], ["workLocationZone", "Work Location / Zone"]]} bulkSelectable={isAdmin} bulkLabel="employees" />
          </>
        )}
        {tab === "resource-shift-rotation" && (
          <ShiftRotationModule shiftRotation={shiftRotation} employees={employees} teams={teams} users={users} locations={locations} saving={saving} submitShiftRotation={submitShiftRotation} refreshData={refreshData} />
        )}
        {tab === "resource-timesheets" && (
          <ResourceTimeSheetsTable rows={timeSheetRows} navigate={navigate} />
        )}
      </Panel>
      <form onSubmit={handleSubmit} className="min-w-0 rounded-lg border border-white/80 bg-white p-5 shadow-lift">
        <h3 className="text-xl font-black">Add Employee</h3>
        <div className="mt-4 grid min-w-0 gap-3">
          <input name="name" placeholder="Name" className={RESOURCE_EMPLOYEE_FIELD_CLASS} />
          <input name="email" type="email" placeholder="Email" className={RESOURCE_EMPLOYEE_FIELD_CLASS} />
          <input name="companyId" placeholder="Company ID" className={RESOURCE_EMPLOYEE_FIELD_CLASS} />
          <input name="nationalityType" placeholder="Nationality type" className={RESOURCE_EMPLOYEE_FIELD_CLASS} />
          <select name="departmentCode" className={RESOURCE_EMPLOYEE_FIELD_CLASS}>
            <option value="">Select department</option>
            {departments.map((department) => <option key={department.id} value={department.code}>{department.code} - {department.name}</option>)}
          </select>
          <input name="siteLocation" placeholder="Site location" className={RESOURCE_EMPLOYEE_FIELD_CLASS} />
          <RequiredLabel label="Shift Eligibility">
            <select name="shiftEligibility" required className={RESOURCE_EMPLOYEE_FIELD_CLASS}>
              {SHIFT_ELIGIBILITY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </RequiredLabel>
          <RequiredLabel label="Default Shift">
            <select name="defaultShift" required className={RESOURCE_EMPLOYEE_FIELD_CLASS}>
              <option value="">Select default shift</option>
              <option>General</option>
              {shiftRotation.shifts.map((shift) => <option key={shift.id} value={shift.name}>{shift.name}</option>)}
            </select>
          </RequiredLabel>
          <RequiredLabel label="Service Team">
            <select name="serviceTeamCode" required className={RESOURCE_EMPLOYEE_FIELD_CLASS}>
              <option value="">Select team</option>
              {teams.map((team) => <option key={team.id} value={team.code}>{team.code} - {team.name}</option>)}
            </select>
          </RequiredLabel>
          <RequiredLabel label="Supervisor">
            <select name="supervisor" required className={RESOURCE_EMPLOYEE_FIELD_CLASS}>
              <option value="">Select supervisor</option>
              {[...users.map((item) => item.name || item.email), ...teams.map((team) => team.supervisor)].filter(Boolean).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </RequiredLabel>
          <RequiredLabel label="Work Location / Zone">
            <select name="workLocationZone" required className={RESOURCE_EMPLOYEE_FIELD_CLASS}>
              <option value="">Select location / zone</option>
              {locations.map((location) => <option key={location.id} value={location.code}>{location.code} - {location.description || location.site}</option>)}
            </select>
          </RequiredLabel>
          <RequiredLabel label="Maximum working hours per day">
            <input name="maxHoursPerDay" type="number" min="1" defaultValue={8} required className={RESOURCE_EMPLOYEE_FIELD_CLASS} />
          </RequiredLabel>
          <RequiredLabel label="Maximum consecutive working days">
            <input name="maxConsecutiveDays" type="number" min="1" defaultValue={6} required className={RESOURCE_EMPLOYEE_FIELD_CLASS} />
          </RequiredLabel>
          <RequiredLabel label="Minimum rest hours between shifts">
            <input name="minRestHours" type="number" min="1" defaultValue={12} required className={RESOURCE_EMPLOYEE_FIELD_CLASS} />
          </RequiredLabel>
          <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Save Employee"}</button>
        </div>
      </form>
    </section>
  );
}

function ResourceTimeSheetsTable({ rows, navigate }: { rows: any[]; navigate: (moduleId: string, menuKey: string, view?: string) => void }) {
  if (!rows.length) return <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-500">No timesheet rows found.</p>;
  return (
    <div className="cafm-scroll-x overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
      <table className="cafm-data-table min-w-[1200px] border-collapse bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            {["Source", "Ticket / WO", "Work", "Technician / Team Member", "Team", "Priority", "Status", "Estimated / SLA", "Actual Time", "Linked Service Request", "Action"].map((label) => (
              <th key={label} className="whitespace-nowrap px-3 py-3 font-black">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.source}-${row.reference}`} className="border-t border-slate-100">
              <td className="whitespace-nowrap px-3 py-3 font-bold">{row.source}</td>
              <td className="whitespace-nowrap px-3 py-3 font-black text-lagoon">{row.reference}</td>
              <td className="max-w-[300px] px-3 py-3">{row.title}</td>
              <td className="whitespace-nowrap px-3 py-3">{row.assignedMember}</td>
              <td className="whitespace-nowrap px-3 py-3">{row.team}</td>
              <td className="whitespace-nowrap px-3 py-3"><CellValue value={row.priority} /></td>
              <td className="whitespace-nowrap px-3 py-3"><CellValue value={row.status} /></td>
              <td className="whitespace-nowrap px-3 py-3">{row.estimatedTime}</td>
              <td className="whitespace-nowrap px-3 py-3 font-black text-ink">{row.actualTime}</td>
              <td className="whitespace-nowrap px-3 py-3">{row.serviceRequest}</td>
              <td className="whitespace-nowrap px-3 py-3">
                <button type="button" onClick={() => navigate(row.moduleId, row.menuKey)} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequiredLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-bold text-slate-600">
      <span>{label} <span className="text-coral">*</span></span>
      {children}
    </label>
  );
}

function minutesFromClock(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function workedHoursBetween(startTime: string, endTime: string) {
  if (!startTime || !endTime) return 0;
  const start = minutesFromClock(startTime);
  let end = minutesFromClock(endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(0, Number(((end - start) / 60).toFixed(2)));
}

function ShiftRotationModule({
  shiftRotation,
  employees,
  teams,
  users,
  locations,
  saving,
  submitShiftRotation,
  refreshData,
}: {
  shiftRotation: { shifts: any[]; rotations: any[]; roster: any[] };
  employees: any[];
  teams: any[];
  users: any[];
  locations: any[];
  saving: boolean;
  submitShiftRotation: (formData: FormData) => void;
  refreshData: () => Promise<void>;
}) {
  const [assignmentType, setAssignmentType] = useState("Employee");
  const [generateAssignmentType, setGenerateAssignmentType] = useState("Employee");
  const [attendanceRosterId, setAttendanceRosterId] = useState("");
  const [localShiftRotation, setLocalShiftRotation] = useState(shiftRotation);
  const [attendanceStatus, setAttendanceStatus] = useState("Present");
  const [attendanceStartTime, setAttendanceStartTime] = useState("");
  const [attendanceEndTime, setAttendanceEndTime] = useState("");
  const [attendanceWorkingHours, setAttendanceWorkingHours] = useState("8");
  const [shiftMessage, setShiftMessage] = useState("");
  useEffect(() => {
    setLocalShiftRotation(shiftRotation);
  }, [shiftRotation]);
  const activeShiftRotation = localShiftRotation;
  const draftRoster = activeShiftRotation.roster.filter((row) => row.status !== "Finalized");
  const finalizedRoster = activeShiftRotation.roster.filter((row) => row.status === "Finalized");
  const supervisorOptions = [...users.map((item) => item.name || item.email), ...teams.map((team) => team.supervisor)].filter(Boolean);
  const locationOptions = locations.map((location) => ({ value: location.code, label: `${location.code} - ${location.description || location.site || location.building}` }));
  const selectedAttendanceRoster = activeShiftRotation.roster.find((row) => row.id === attendanceRosterId) || activeShiftRotation.roster[0];
  const selectedDefaultWorkingHours = selectedAttendanceRoster?.plannedWorkingHours || selectedAttendanceRoster?.employee?.maxHoursPerDay || selectedAttendanceRoster?.team?.maxHoursPerDay || 8;
  const previewWorkedHours = attendanceStatus === "Present" ? workedHoursBetween(attendanceStartTime, attendanceEndTime) : 0;
  const previewOvertimeHours = attendanceStatus === "Present" ? Math.max(0, Number((previewWorkedHours - Number(attendanceWorkingHours || selectedDefaultWorkingHours)).toFixed(2))) : 0;
  const rosterRows = activeShiftRotation.roster.map((row) => ({
    id: row.id,
    date: formatDateCell(row.date),
    assignment: row.assignmentType,
    assignee: row.employee?.name || row.team?.name || "-",
    shift: row.shift?.name || "-",
    type: row.shift?.shiftType || "-",
    locationZone: row.locationZone,
    supervisor: row.supervisor,
    status: row.status,
    attendanceStatus: row.attendanceStatus || "Not marked",
    plannedWorkingHours: row.plannedWorkingHours || "",
    workedHours: row.workedHours || "",
    overtimeHours: row.overtimeHours || "",
    source: row.source,
  }));
  const attendanceRows = activeShiftRotation.roster
    .filter((row) => row.attendanceStatus && row.attendanceStatus !== "Not marked")
    .map((row) => ({
      id: row.id,
      date: formatDateCell(row.date),
      assignee: row.employee?.name || row.team?.name || "-",
      assignment: row.assignmentType,
      shift: `${row.shift?.name || "-"} / ${row.shift?.shiftType || "-"}`,
      attendanceStatus: row.attendanceStatus,
      actualStartTime: row.actualStartTime,
      actualEndTime: row.actualEndTime,
      plannedWorkingHours: row.plannedWorkingHours,
      workedHours: row.workedHours,
      overtimeHours: row.overtimeHours,
      markedBy: row.markedBy,
      markedAt: row.markedAt ? formatDateCell(row.markedAt) : "",
      attendanceNotes: row.attendanceNotes,
    }));
  const totalWorkedHours = attendanceRows.reduce((sum, row) => sum + Number(row.workedHours || 0), 0);
  const totalOvertimeHours = attendanceRows.reduce((sum, row) => sum + Number(row.overtimeHours || 0), 0);

  useEffect(() => {
    if (!selectedAttendanceRoster) return;
    setAttendanceStatus(selectedAttendanceRoster.attendanceStatus && selectedAttendanceRoster.attendanceStatus !== "Not marked" ? selectedAttendanceRoster.attendanceStatus : "Present");
    setAttendanceStartTime(selectedAttendanceRoster.actualStartTime || selectedAttendanceRoster.shift?.startTime || "");
    setAttendanceEndTime(selectedAttendanceRoster.actualEndTime || selectedAttendanceRoster.shift?.endTime || "");
    setAttendanceWorkingHours(String(selectedDefaultWorkingHours));
  }, [selectedAttendanceRoster?.id, selectedDefaultWorkingHours]);

  function mergeRosterRows(rows: any[]) {
    setLocalShiftRotation((current) => ({
      ...current,
      roster: [
        ...rows,
        ...current.roster.filter((row) => !rows.some((updated) => updated.id === row.id)),
      ].sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime()),
    }));
  }

  async function handleFinalize() {
    setShiftMessage("");
    const response = await fetch("/api/shift-rotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: "finalize", ids: draftRoster.map((row) => row.id) }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      mergeRosterRows(result.roster ?? draftRoster.map((row) => ({ ...row, status: "Finalized" })));
      setShiftMessage("Roster finalized.");
      void refreshData();
    } else {
      setShiftMessage(cleanMessage(result.message ?? "Unable to finalize roster."));
    }
  }

  async function handleAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShiftMessage("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/shift-rotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result?.id) {
      mergeRosterRows([result]);
      setShiftMessage("Attendance saved.");
      void refreshData();
    } else {
      setShiftMessage(cleanMessage(result.message ?? "Unable to save attendance."));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await fetch("/api/shift-rotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setShiftMessage(cleanMessage(result.message ?? "Unable to save shift and rotation data."));
      return;
    }
    if (payload.module === "shift" && result?.id) {
      setLocalShiftRotation((current) => ({
        ...current,
        shifts: [result, ...current.shifts.filter((shift) => shift.id !== result.id && shift.name !== result.name)].sort((first, second) => String(first.name).localeCompare(String(second.name))),
      }));
    }
    if (payload.module === "rotation" && result?.id) {
      setLocalShiftRotation((current) => ({
        ...current,
        rotations: [result, ...current.rotations.filter((rotation) => rotation.id !== result.id && rotation.name !== result.name)].sort((first, second) => String(first.name).localeCompare(String(second.name))),
      }));
    }
    if (payload.module === "roster" && result?.id) {
      mergeRosterRows([result]);
    }
    if (payload.module === "generate" && Array.isArray(result?.created)) {
      mergeRosterRows(result.created);
    }
    setShiftMessage("Shift / rotation saved.");
    form.reset();
    void refreshData();
  }

  return (
    <div className="grid gap-5">
      {shiftMessage && <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{shiftMessage}</div>}
      <div className="grid gap-3 md:grid-cols-3">
        <a href="/api/shift-rotation?report=daily&format=excel" className="rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-lagoon shadow-sm">Daily roster Excel</a>
        <a href="/api/shift-rotation?report=weekly&format=pdf" className="rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-lagoon shadow-sm">Weekly roster PDF</a>
        <a href="/api/shift-rotation?report=employee-history&format=excel" className="rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-lagoon shadow-sm">Employee shift history</a>
        <a href="/api/shift-rotation?report=team-history&format=excel" className="rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-lagoon shadow-sm">Service team shift history</a>
        <a href="/api/shift-rotation?report=coverage&format=excel" className="rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-lagoon shadow-sm">Day/night coverage</a>
        <a href="/api/shift-rotation?report=monthly&format=pdf" className="rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-lagoon shadow-sm">Monthly roster PDF</a>
        <a href="/api/shift-rotation?report=worked-hours&format=excel" className="rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-lagoon shadow-sm">Worked hours Excel</a>
        <a href="/api/shift-rotation?report=overtime&format=pdf" className="rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-lagoon shadow-sm">Overtime PDF</a>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input type="hidden" name="module" value="shift" />
          <h3 className="text-lg font-black">Shift Master</h3>
          <RequiredLabel label="Shift name"><input name="name" required className={HOUSING_FIELD_CLASS} /></RequiredLabel>
          <RequiredLabel label="Shift type"><select name="shiftType" required className={HOUSING_FIELD_CLASS}>{SHIFT_TYPE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></RequiredLabel>
          <RequiredLabel label="Start time"><input name="startTime" type="time" required className={HOUSING_FIELD_CLASS} /></RequiredLabel>
          <RequiredLabel label="End time"><input name="endTime" type="time" required className={HOUSING_FIELD_CLASS} /></RequiredLabel>
          <input name="breakDuration" type="number" min="0" placeholder="Break duration minutes" className={HOUSING_FIELD_CLASS} />
          <RequiredLabel label="Active status"><select name="active" required className={HOUSING_FIELD_CLASS}><option value="true">Active</option><option value="false">Inactive</option></select></RequiredLabel>
          <button disabled={saving} className="h-10 rounded-lg bg-ink text-sm font-black text-white disabled:bg-slate-400">Save Shift</button>
        </form>

        <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input type="hidden" name="module" value="rotation" />
          <h3 className="text-lg font-black">Rotation Setup</h3>
          <RequiredLabel label="Rotation name"><input name="name" required className={HOUSING_FIELD_CLASS} /></RequiredLabel>
          <RequiredLabel label="Applies to"><select name="appliesTo" required className={HOUSING_FIELD_CLASS}><option>Employee</option><option>Service Team</option></select></RequiredLabel>
          <RequiredLabel label="Shift sequence"><input name="shiftSequence" required placeholder="Day Shift, Night Shift" className={HOUSING_FIELD_CLASS} /></RequiredLabel>
          <RequiredLabel label="Off days"><input name="offDays" required placeholder="Friday, Saturday" className={HOUSING_FIELD_CLASS} /></RequiredLabel>
          <RequiredLabel label="Start date"><input name="startDate" type="date" required className={HOUSING_FIELD_CLASS} /></RequiredLabel>
          <input name="endDate" type="date" className={HOUSING_FIELD_CLASS} />
          <RequiredLabel label="Repeat cycle"><input name="repeatCycle" required placeholder="Weekly / 14 days / Monthly" className={HOUSING_FIELD_CLASS} /></RequiredLabel>
          <button disabled={saving} className="h-10 rounded-lg bg-ink text-sm font-black text-white disabled:bg-slate-400">Save Rotation</button>
        </form>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <input type="hidden" name="module" value="roster" />
        <input type="hidden" name="assignmentType" value={assignmentType} />
        <h3 className="text-lg font-black">Roster</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <RequiredLabel label="Assign employee or service team">
            <select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value)} className={HOUSING_FIELD_CLASS}>
              <option>Employee</option><option>Service Team</option>
            </select>
          </RequiredLabel>
          {assignmentType === "Employee" ? (
            <RequiredLabel label="Employee"><select name="employeeId" required className={HOUSING_FIELD_CLASS}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.companyId} - {employee.name}</option>)}</select></RequiredLabel>
          ) : (
            <RequiredLabel label="Service Team"><select name="teamId" required className={HOUSING_FIELD_CLASS}>{teams.map((team) => <option key={team.id} value={team.id}>{team.code} - {team.name}</option>)}</select></RequiredLabel>
          )}
          <RequiredLabel label="Date"><input name="date" type="date" required className={HOUSING_FIELD_CLASS} /></RequiredLabel>
          <RequiredLabel label="Shift"><select name="shiftId" required className={HOUSING_FIELD_CLASS}>{activeShiftRotation.shifts.filter((shift) => shift.active).map((shift) => <option key={shift.id} value={shift.id}>{shift.name} - {shift.shiftType}</option>)}</select></RequiredLabel>
          <RequiredLabel label="Location / Zone"><select name="locationZone" required className={HOUSING_FIELD_CLASS}>{locationOptions.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}</select></RequiredLabel>
          <RequiredLabel label="Supervisor"><select name="supervisor" required className={HOUSING_FIELD_CLASS}>{supervisorOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></RequiredLabel>
          <select name="status" className={HOUSING_FIELD_CLASS}>{ROSTER_STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select>
        </div>
        <button disabled={saving} className="h-10 rounded-lg bg-lagoon text-sm font-black text-white disabled:bg-slate-400">Manually Add Roster Entry</button>
      </form>

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <input type="hidden" name="module" value="generate" />
        <input type="hidden" name="assignmentType" value={generateAssignmentType} />
        <h3 className="text-lg font-black">Generate Roster From Rotation</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <select name="rotationId" required className={HOUSING_FIELD_CLASS}>{activeShiftRotation.rotations.map((rotation) => <option key={rotation.id} value={rotation.id}>{rotation.name}</option>)}</select>
          <select value={generateAssignmentType} onChange={(event) => setGenerateAssignmentType(event.target.value)} className={HOUSING_FIELD_CLASS}><option>Employee</option><option>Service Team</option></select>
          {generateAssignmentType === "Employee" ? <select name="employeeId" required className={HOUSING_FIELD_CLASS}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select> : <select name="teamId" required className={HOUSING_FIELD_CLASS}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>}
          <input name="days" type="number" min="1" max="31" defaultValue={7} className={HOUSING_FIELD_CLASS} />
          <select name="locationZone" required className={HOUSING_FIELD_CLASS}>{locationOptions.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}</select>
          <select name="supervisor" required className={HOUSING_FIELD_CLASS}>{supervisorOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
        <button disabled={saving} className="h-10 rounded-lg bg-leaf text-sm font-black text-white disabled:bg-slate-400">Generate Roster From Rotation</button>
      </form>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving || !draftRoster.length} onClick={handleFinalize} className="rounded-lg bg-ink px-4 py-2 text-sm font-black text-white disabled:bg-slate-300">Finalize Draft Roster</button>
        <span className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">Draft {draftRoster.length} / Finalized {finalizedRoster.length}</span>
        <span className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">Worked {totalWorkedHours.toFixed(2)} hrs / Overtime {totalOvertimeHours.toFixed(2)} hrs</span>
      </div>

      <form key={selectedAttendanceRoster?.id ?? "attendance"} onSubmit={handleAttendance} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <input type="hidden" name="module" value="attendance" />
        <h3 className="text-lg font-black">Mark Shift Attendance</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <RequiredLabel label="Employee / service team roster">
            <select name="rosterId" required value={selectedAttendanceRoster?.id ?? ""} onChange={(event) => setAttendanceRosterId(event.target.value)} className={HOUSING_FIELD_CLASS}>
              {activeShiftRotation.roster.map((row) => (
                <option key={row.id} value={row.id}>{formatDateCell(row.date)} - {row.employee?.name || row.team?.name || "-"} - {row.shift?.shiftType || row.shift?.name}</option>
              ))}
            </select>
          </RequiredLabel>
          <RequiredLabel label="Attendance status">
            <select name="attendanceStatus" required value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value)} className={HOUSING_FIELD_CLASS}>
              <option>Present</option>
              <option>Absent</option>
            </select>
          </RequiredLabel>
          <RequiredLabel label="Working hours">
            <input name="plannedWorkingHours" type="number" min="0" max="24" step="0.25" value={attendanceWorkingHours} onChange={(event) => setAttendanceWorkingHours(event.target.value)} className={HOUSING_FIELD_CLASS} />
          </RequiredLabel>
          <RequiredLabel label="Actual start time">
            <input name="actualStartTime" type="time" value={attendanceStartTime} onChange={(event) => setAttendanceStartTime(event.target.value)} disabled={attendanceStatus === "Absent"} className={HOUSING_FIELD_CLASS} />
          </RequiredLabel>
          <RequiredLabel label="Actual end time">
            <input name="actualEndTime" type="time" value={attendanceEndTime} onChange={(event) => setAttendanceEndTime(event.target.value)} disabled={attendanceStatus === "Absent"} className={HOUSING_FIELD_CLASS} />
          </RequiredLabel>
          <input name="attendanceNotes" placeholder="Attendance notes" className={HOUSING_FIELD_CLASS} />
        </div>
        <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm font-black text-slate-600 md:grid-cols-3">
          <span>Live worked hours: {previewWorkedHours.toFixed(2)}</span>
          <span>Live overtime: {previewOvertimeHours.toFixed(2)}</span>
          <span>Status preview: {attendanceStatus}</span>
        </div>
        <button disabled={saving || !activeShiftRotation.roster.length} className="h-10 rounded-lg bg-lagoon text-sm font-black text-white disabled:bg-slate-400">Mark Present / Save Attendance</button>
      </form>

      <DataTable
        rows={rosterRows}
        columns={[["date", "Date"], ["assignment", "Assignment"], ["assignee", "Employee / Team"], ["shift", "Shift"], ["type", "Type"], ["locationZone", "Location / Zone"], ["supervisor", "Supervisor"], ["status", "Status"], ["attendanceStatus", "Attendance"], ["plannedWorkingHours", "Working hrs"], ["workedHours", "Worked"], ["overtimeHours", "Overtime"], ["source", "Source"]]}
        actions={(row) => <button type="button" onClick={() => setAttendanceRosterId(row.id)} className="rounded-lg bg-leaf px-3 py-2 text-xs font-black text-white">Mark Present</button>}
      />

      <Panel title="Worked Hours & Overtime Log" icon={Clock}>
        <DataTable rows={attendanceRows} columns={[["date", "Date"], ["assignee", "Employee / Team"], ["assignment", "Type"], ["shift", "Shift"], ["attendanceStatus", "Attendance"], ["actualStartTime", "Start"], ["actualEndTime", "End"], ["plannedWorkingHours", "Working hrs"], ["workedHours", "Worked hrs"], ["overtimeHours", "Overtime"], ["markedBy", "Marked by"], ["markedAt", "Marked at"], ["attendanceNotes", "Notes"]]} />
      </Panel>
    </div>
  );
}

function ResourceShiftsTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-500">No shifts or rotations found.</p>;
  return (
    <div className="cafm-scroll-x overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
      <table className="cafm-data-table min-w-[1280px] table-fixed border-collapse bg-white text-sm">
        <colgroup>
          <col className="w-12" />
          <col className="w-24" />
          <col className="w-52" />
          <col className="w-36" />
          <col className="w-[360px]" />
          <col className="w-44" />
          <col className="w-28" />
          <col className="w-28" />
          <col className="w-32" />
          <col className="w-32" />
        </colgroup>
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            {["#", "Team", "Team Name", "Shift", "Rotation / Coverage", "Supervisor", "Employees", "Requests", "Work Orders", "Time Spent"].map((label) => (
              <th key={label} className="px-3 py-3 font-black">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? row.teamCode} className="border-t border-slate-100">
              <td className="px-3 py-3 font-black text-slate-500">{index + 1}</td>
              <td className="px-3 py-3 font-black text-lagoon">{row.teamCode}</td>
              <td className="px-3 py-3 font-bold">{row.teamName}</td>
              <td className="px-3 py-3">{row.shift}</td>
              <td className="px-3 py-3">
                <div className="whitespace-normal break-words leading-5">{row.rotation}</div>
              </td>
              <td className="px-3 py-3">{row.supervisor}</td>
              <td className="px-3 py-3">{row.employees}</td>
              <td className="px-3 py-3">{row.serviceRequests}</td>
              <td className="px-3 py-3">{row.workOrders}</td>
              <td className="px-3 py-3 font-black text-ink">{row.timeSpent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HousingOperations({
  housing,
  view,
  saving,
  canManage,
  canApprove,
  isAdmin,
  userRole,
  submitHousing,
  updateHousing,
  deleteHousing,
  refreshData,
}: {
  housing: ConsoleData["housing"];
  view: string;
  saving: boolean;
  canManage: boolean;
  canApprove: boolean;
  isAdmin: boolean;
  userRole: string;
  submitHousing: (formData: FormData) => void;
  updateHousing: (type: string, id: string, body: Record<string, unknown>) => Promise<void> | void;
  deleteHousing: (type: string, id: string) => Promise<void> | void;
  refreshData: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [companyFilter, setCompanyFilter] = useState("All");
  const [buildingFilter, setBuildingFilter] = useState("All");
  const [floorFilter, setFloorFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<{ type: string; record: any } | null>(null);
  const [runningAlerts, setRunningAlerts] = useState(false);
  const rooms = housing?.rooms ?? [];
  const bookings = housing?.bookings ?? [];
  const inspections = housing?.inspections ?? [];
  const assets = housing?.assets ?? [];
  const inventory = housing?.inventory ?? [];
  const approvals = housing?.approvals ?? [];
  const notifications = housing?.notifications ?? [];
  const notificationSettings = housing?.notificationSettings ?? [];
  const history = housing?.history ?? [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const roomBuilding = (room: any) => room?.block?.name || room?.property?.name || "Unassigned";
  const roomMatchesLocationFilters = (room: any) => {
    if (buildingFilter !== "All" && roomBuilding(room) !== buildingFilter) return false;
    if (floorFilter !== "All" && String(room?.floor ?? "") !== floorFilter) return false;
    if (categoryFilter !== "All" && String(room?.roomType ?? "") !== categoryFilter) return false;
    return true;
  };
  const inDashboardDateRange = (value: unknown) => {
    if (!dateFrom && !dateTo) return true;
    if (!value) return false;
    const time = new Date(String(value)).getTime();
    if (Number.isNaN(time)) return false;
    if (dateFrom && time < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
    if (dateTo && time > new Date(`${dateTo}T23:59:59`).getTime()) return false;
    return true;
  };
  const activeBookingStatuses = new Set(["APPROVED", "CHECKED_IN", "PENDING_APPROVAL", "REQUESTED"]);
  const bookingCompany = (booking: any) => booking?.companyName || booking?.resident?.companyName || booking?.resident?.companyId || booking?.departmentCode || "Unassigned";
  const bookingMatchesFilters = (booking: any) => {
    if (!roomMatchesLocationFilters(booking.room)) return false;
    if (companyFilter !== "All" && bookingCompany(booking) !== companyFilter) return false;
    return inDashboardDateRange(booking.checkIn || booking.createdAt);
  };
  const filteredBookings = bookings.filter(bookingMatchesFilters);
  const companyRoomIds = new Set(filteredBookings.map((booking) => booking.roomId || booking.room?.id).filter(Boolean));
  const dashboardRooms = rooms.filter((room) => roomMatchesLocationFilters(room) && (companyFilter === "All" || companyRoomIds.has(room.id)));
  const dashboardRoomIds = new Set(dashboardRooms.map((room) => room.id));
  const dashboardInspections = inspections.filter((inspection) => dashboardRoomIds.has(inspection.roomId || inspection.room?.id) && inDashboardDateRange(inspection.dueAt || inspection.createdAt));
  const dashboardAssets = assets.filter((asset) => !asset.roomId || dashboardRoomIds.has(asset.roomId || asset.room?.id));
  const dashboardInventory = inventory.filter((item) => !item.roomId || dashboardRoomIds.has(item.roomId || item.room?.id));
  const dashboardApprovals = approvals.filter((approval) => inDashboardDateRange(approval.createdAt || approval.updatedAt));
  const occupancy = dashboardRooms.reduce((sum, room) => sum + Number(room.occupancy || 0), 0);
  const capacity = dashboardRooms.reduce((sum, room) => sum + Number(room.capacity || 0), 0);
  const availableRooms = dashboardRooms.filter((room) => room.status === "AVAILABLE").length;
  const occupiedRooms = dashboardRooms.filter((room) => room.status === "OCCUPIED" || Number(room.occupancy || 0) >= Number(room.capacity || 0)).length;
  const vacantRooms = dashboardRooms.filter((room) => room.status === "AVAILABLE" && Number(room.occupancy || 0) === 0).length;
  const blockedRooms = dashboardRooms.filter((room) => room.status === "BLOCKED").length;
  const maintenanceRooms = dashboardRooms.filter((room) => room.status === "MAINTENANCE").length;
  const checkInsToday = filteredBookings.filter((booking) => String(booking.checkIn || "").slice(0, 10) === todayKey).length;
  const checkOutsToday = filteredBookings.filter((booking) => String(booking.checkOut || "").slice(0, 10) === todayKey).length;
  const openApprovals = dashboardApprovals.filter((approval) => approval.status === "PENDING").length;
  const overdueInspections = dashboardInspections.filter((inspection) => new Date(inspection.dueAt).getTime() < Date.now() && !["PASSED", "CLOSED"].includes(inspection.status)).length;
  const safetyObservations = dashboardInspections.filter((inspection) => inspection.status === "FAILED" || Number(inspection.score || 100) < 80).length + notifications.filter((notification) => ["HIGH", "CRITICAL"].includes(notification.severity)).length;
  const housekeepingOpen = dashboardInspections.filter((inspection) => String(inspection.inspectionType || "").toLowerCase().includes("housekeeping") && !["PASSED", "CLOSED"].includes(inspection.status)).length;
  const dashboardCompanies = Array.from(new Set(bookings.map(bookingCompany))).filter(Boolean).sort();
  const dashboardBuildings = Array.from(new Set(rooms.map(roomBuilding))).filter(Boolean).sort();
  const dashboardFloors = Array.from(new Set(rooms.map((room) => String(room.floor ?? "")))).filter(Boolean).sort();
  const dashboardCategories = Array.from(new Set(rooms.map((room) => String(room.roomType ?? "")))).filter(Boolean).sort();
  const groupRooms = (rows: any[], keyFn: (row: any) => string) => {
    const map = new Map<string, { name: string; capacity: number; occupied: number; rooms: number }>();
    rows.forEach((room) => {
      const key = keyFn(room) || "Unassigned";
      const current = map.get(key) || { name: key, capacity: 0, occupied: 0, rooms: 0 };
      current.capacity += Number(room.capacity || 0);
      current.occupied += Number(room.occupancy || 0);
      current.rooms += 1;
      map.set(key, current);
    });
    return Array.from(map.values()).map((item) => ({ ...item, occupancy: item.capacity ? Math.round((item.occupied / item.capacity) * 100) : 0 }));
  };
  const groupCount = (rows: any[], keyFn: (row: any) => string) => {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const key = keyFn(row) || "Unassigned";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  };
  const companyOccupancyData = groupCount(filteredBookings.filter((booking) => activeBookingStatuses.has(booking.status)), bookingCompany);
  const buildingOccupancyData = groupRooms(dashboardRooms, roomBuilding);
  const categoryOccupancyData = groupRooms(dashboardRooms, (room) => room.roomType || "Unassigned");
  const ticketSummary = [
    { metric: "Open booking requests", value: filteredBookings.filter((booking) => ["REQUESTED", "PENDING_APPROVAL"].includes(booking.status)).length, status: "Open" },
    { metric: "Approved / checked-in", value: filteredBookings.filter((booking) => ["APPROVED", "CHECKED_IN"].includes(booking.status)).length, status: "Active" },
    { metric: "Inspection findings", value: overdueInspections, status: overdueInspections ? "Action" : "Clear" },
    { metric: "Safety observations", value: safetyObservations, status: safetyObservations ? "Action" : "Clear" },
  ];
  const assetStatusSummary = groupCount(dashboardAssets, (asset) => asset.status || "Unknown");
  const housekeepingSummary = [
    { metric: "Open housekeeping checks", value: housekeepingOpen, status: housekeepingOpen ? "Action" : "Clear" },
    { metric: "Completed inspections", value: dashboardInspections.filter((inspection) => ["PASSED", "CLOSED"].includes(inspection.status)).length, status: "Completed" },
    { metric: "Failed inspections", value: dashboardInspections.filter((inspection) => inspection.status === "FAILED").length, status: "Failed" },
  ];
  const todayMovements = filteredBookings
    .filter((booking) => String(booking.checkIn || "").slice(0, 10) === todayKey || String(booking.checkOut || "").slice(0, 10) === todayKey)
    .map((booking) => ({ ...booking, movement: String(booking.checkIn || "").slice(0, 10) === todayKey ? "Check-in" : "Check-out" }));
  const filterText = search.toLowerCase();
  const visibleBookings = bookings.filter((booking) => {
    const haystack = `${booking.bookingNo} ${booking.residentName} ${booking.departmentCode} ${booking.status} ${booking.room?.roomNumber} ${booking.bed?.label}`.toLowerCase();
    return (!search || haystack.includes(filterText)) && (status === "All" || booking.status === status);
  });
  const visibleRooms = rooms.filter((room) => {
    const haystack = `${room.code} ${room.roomNumber} ${room.property?.name} ${room.block?.name} ${room.floor} ${room.roomType} ${room.status}`.toLowerCase();
    return (!search || haystack.includes(filterText)) && (status === "All" || room.status === status);
  });
  const visibleInspections = inspections.filter((inspection) => {
    const haystack = `${inspection.inspectionNo} ${inspection.inspectionType} ${inspection.inspector} ${inspection.status} ${inspection.findings} ${inspection.room?.roomNumber}`.toLowerCase();
    return (!search || haystack.includes(filterText)) && (status === "All" || inspection.status === status);
  });
  const visibleAssets = assets.filter((asset) => {
    const haystack = `${asset.tag} ${asset.name} ${asset.category} ${asset.status} ${asset.serialNumber} ${asset.room?.roomNumber}`.toLowerCase();
    return (!search || haystack.includes(filterText)) && (status === "All" || asset.status === status);
  });
  const visibleInventory = inventory.filter((item) => {
    const haystack = `${item.sku} ${item.name} ${item.category} ${item.room?.roomNumber} ${item.qrCode}`.toLowerCase();
    return !search || haystack.includes(filterText);
  });
  const visibleApprovals = approvals.filter((approval) => {
    const haystack = `${approval.entity} ${approval.level} ${approval.approver} ${approval.status} ${approval.remarks}`.toLowerCase();
    return (!search || haystack.includes(filterText)) && (status === "All" || approval.status === status);
  });
  const visibleHistory = history.filter((item) => {
    const haystack = `${item.entity} ${item.action} ${item.actor} ${item.details}`.toLowerCase();
    return !search || haystack.includes(filterText);
  });
  const activePanel =
    view === "housing-bookings" ? "bookings" :
    view === "housing-inspections" ? "inspections" :
    view === "housing-assets" ? "assets" :
    view === "housing-inventory" ? "inventory" :
    view === "housing-approvals" ? "approvals" :
    view === "housing-notifications" ? "notifications" :
    view === "housing-reports" ? "reports" : "dashboard";
  const canReceptionAllocate = String(userRole || "").toLowerCase().includes("reception") || userRole === "Admin";
  const currentApprovalFor = (booking: any) => (booking.approvals || []).find((approval: any) => approval.status === "PENDING");
  const approvalAction = (approval: any, action: "APPROVED" | "REJECTED" | "RETURNED") => {
    const label = action === "RETURNED" ? "Return for correction" : action === "REJECTED" ? "Reject" : "Approve";
    const remarks = window.prompt(`${label} comments`, action === "APPROVED" ? "Reviewed and accepted" : "");
    if (remarks === null) return;
    updateHousing("approval", approval.id, { action, remarks, status: action });
  };
  const runAlertChecks = async () => {
    setRunningAlerts(true);
    await fetch("/api/housing/alerts", { method: "POST" });
    await refreshData();
    setRunningAlerts(false);
  };

  return (
    <section className="grid gap-5">
      <Panel title="Housing Operations Command" icon={Building2}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HousingKpi label="Available Rooms" value={String(availableRooms)} detail="ready for allocation" onClick={() => setStatus("AVAILABLE")} />
          <HousingKpi label="Occupied Rooms" value={String(occupiedRooms)} detail={`${capacity ? Math.round((occupancy / capacity) * 100) : 0}% bed occupancy`} onClick={() => setStatus("OCCUPIED")} />
          <HousingKpi label="Vacant Rooms" value={String(vacantRooms)} detail="empty and assignable" onClick={() => setStatus("AVAILABLE")} />
          <HousingKpi label="Blocked Rooms" value={String(blockedRooms)} detail="blocked for allocation" onClick={() => setStatus("BLOCKED")} />
          <HousingKpi label="Under Maintenance" value={String(maintenanceRooms)} detail="repair or shutdown" onClick={() => setStatus("MAINTENANCE")} />
          <HousingKpi label="Check-ins Today" value={String(checkInsToday)} detail="scheduled arrivals" onClick={() => setStatus("CHECKED_IN")} />
          <HousingKpi label="Check-outs Today" value={String(checkOutsToday)} detail="scheduled departures" onClick={() => setStatus("CHECKED_OUT")} />
          <HousingKpi label="Pending Approvals" value={String(openApprovals)} detail="requires action" onClick={() => setStatus("PENDING")} />
          <HousingKpi label="Ticket Summary" value={String(ticketSummary.reduce((sum, item) => sum + item.value, 0))} detail="requests and findings" />
          <HousingKpi label="Asset Status" value={String(dashboardAssets.length)} detail={`${assetStatusSummary.length} active statuses`} />
          <HousingKpi label="Housekeeping" value={String(housekeepingOpen)} detail="open housekeeping checks" />
          <HousingKpi label="Safety / Incidents" value={String(safetyObservations)} detail="observations requiring review" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
            <Search size={16} className="text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search housing rooms, residents, bookings" className="h-11 w-full text-sm outline-none" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option>All</option>
            <option>REQUESTED</option>
            <option>PENDING_APPROVAL</option>
            <option>APPROVED</option>
            <option>CHECKED_IN</option>
            <option>CHECKED_OUT</option>
            <option>REJECTED</option>
            <option>AVAILABLE</option>
            <option>RESERVED</option>
            <option>OCCUPIED</option>
            <option>MAINTENANCE</option>
            <option>SCHEDULED</option>
            <option>PASSED</option>
            <option>FAILED</option>
            <option>ACTIVE</option>
            <option>PENDING</option>
            <option>WAITING</option>
            <option>RETURNED</option>
          </select>
          <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option>All</option>
            {dashboardCompanies.map((company) => <option key={company}>{company}</option>)}
          </select>
          <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option>All</option>
            {dashboardBuildings.map((building) => <option key={building}>{building}</option>)}
          </select>
          <select value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option>All</option>
            {dashboardFloors.map((floor) => <option key={floor}>{floor}</option>)}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
            <option>All</option>
            {dashboardCategories.map((category) => <option key={category}>{category}</option>)}
          </select>
          <input value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} type="date" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" />
          <input value={dateTo} onChange={(event) => setDateTo(event.target.value)} type="date" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" />
          <ReportButtons type="housing-dashboard" label="Housing dashboard PDF" />
        </div>
      </Panel>

      {activePanel === "dashboard" && (
        <section className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-3">
            <HousingChart title="Company-wise Occupancy" data={companyOccupancyData} dataKey="value" />
            <HousingChart title="Building-wise Occupancy" data={buildingOccupancyData} dataKey="occupancy" suffix="%" />
            <HousingChart title="Room Category Occupancy" data={categoryOccupancyData} dataKey="occupancy" suffix="%" />
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
            <HousingTable
              title="Accommodation & Occupancy Drill-down"
              rows={dashboardRooms}
              columns={[["code", "Code"], ["roomNumber", "Room"], ["roomType", "Type"], ["floor", "Floor"], ["occupancy", "Occ"], ["capacity", "Cap"], ["status", "Status"], ["qrCode", "QR"]]}
              onSelect={(record) => setSelected({ type: "room", record })}
              reportType="housing-rooms"
              bulkSelectable={isAdmin}
              onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteHousing("room", row.id))); }}
            />
            <div className="grid gap-5">
              <HousingSummaryTable title="Ticket Summary" rows={ticketSummary} />
              <HousingSummaryTable title="Asset Status Summary" rows={assetStatusSummary.map((item) => ({ metric: item.name, value: item.value, status: "Assets" }))} />
              <HousingSummaryTable title="Housekeeping Status Summary" rows={housekeepingSummary} />
              <HousingSummaryTable title="Pending Approvals Summary" rows={[{ metric: "Pending approvals", value: openApprovals, status: "Pending" }]} />
              <HousingSummaryTable title="Safety Observations & Incidents" rows={[{ metric: "Open observations / incidents", value: safetyObservations, status: safetyObservations ? "Action" : "Clear" }]} />
            </div>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
            <HousingTable
              title="Today Check-in / Check-out Movement"
              rows={todayMovements}
              columns={[["movement", "Movement"], ["bookingNo", "Booking"], ["residentName", "Resident"], ["departmentCode", "Company / Dept"], ["status", "Status"], ["priority", "Priority"]]}
              onSelect={(record) => setSelected({ type: "booking", record })}
              reportType="housing-bookings"
              bulkSelectable={isAdmin}
              onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteHousing("booking", row.id))); }}
            />
            <HousingAlerts notifications={notifications} approvals={dashboardApprovals} onApprove={(approval, action) => approvalAction(approval, action as any)} canApprove={canApprove} />
          </div>
          {canManage && <HousingSetupForms properties={housing.properties ?? []} blocks={housing.blocks ?? []} rooms={rooms} saving={saving} onSubmit={submitHousing} />}
        </section>
      )}

      {activePanel === "bookings" && (
        <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="grid gap-3">
            {canManage && (
              <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <button type="button" onClick={() => visibleBookings.filter((booking) => booking.status === "APPROVED").forEach((booking) => updateHousing("booking", booking.id, { status: "CHECKED_IN", notes: "Bulk check-in completed" }))} className="rounded-lg bg-lagoon px-4 py-2 text-xs font-black text-white">Bulk Check-in Approved</button>
                <button type="button" onClick={() => visibleBookings.filter((booking) => booking.status === "CHECKED_IN").forEach((booking) => updateHousing("booking", booking.id, { status: "CHECKED_OUT", checkOut: new Date().toISOString(), notes: "Bulk check-out completed" }))} className="rounded-lg bg-ink px-4 py-2 text-xs font-black text-white">Bulk Check-out Active</button>
                <button type="button" onClick={() => visibleBookings.filter((booking) => booking.status === "PENDING_APPROVAL").forEach((booking) => updateHousing("booking", booking.id, { status: "NO_SHOW", noShowAt: new Date().toISOString(), notes: "Marked no-show in bulk review" }))} className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-black text-white">Mark Pending No-show</button>
              </div>
            )}
            <HousingTable
              title="Accommodation & Booking Management"
              rows={visibleBookings}
              columns={[["bookingNo", "Booking"], ["employeeId", "Employee ID"], ["residentName", "Employee"], ["companyName", "Company"], ["gender", "Gender"], ["buildingNumber", "Building"], ["floorNumber", "Floor"], ["roomNumber", "Room"], ["bedNumber", "Bed"], ["bookingType", "Type"], ["allocationType", "Allocation"], ["status", "Status"], ["priority", "Priority"]]}
              onSelect={(record) => setSelected({ type: "booking", record })}
              reportType="housing-bookings"
              bulkSelectable={isAdmin}
              onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteHousing("booking", row.id))); }}
              actions={(record) => canApprove && (
                <div className="flex flex-wrap gap-2">
                  {currentApprovalFor(record) && <button type="button" onClick={(event) => { event.stopPropagation(); approvalAction(currentApprovalFor(record), "APPROVED"); }} className="rounded-lg bg-leaf px-3 py-2 text-xs font-black text-white">Approve Step</button>}
                  {currentApprovalFor(record) && <button type="button" onClick={(event) => { event.stopPropagation(); approvalAction(currentApprovalFor(record), "RETURNED"); }} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white">Return</button>}
                  {canReceptionAllocate && record.status === "APPROVED" && <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("booking", record.id, { status: "CHECKED_IN", keyHandoverBy: "Reception Team", keyHandoverAt: new Date().toISOString() }); }} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">Allocate</button>}
                  <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("booking", record.id, { status: "CHECKED_OUT", checkOut: new Date().toISOString() }); }} className="rounded-lg bg-ink px-3 py-2 text-xs font-black text-white">Check-out</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("booking", record.id, { status: "CANCELLED", cancellationReason: "Cancelled by housing admin" }); }} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white">Cancel</button>
                </div>
              )}
            />
          </div>
          {canManage && <HousingBookingForm rooms={rooms} beds={housing.beds ?? []} residents={housing.residents ?? []} saving={saving} onSubmit={submitHousing} />}
        </section>
      )}

      {activePanel === "inspections" && (
        <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <HousingTable
            title="Room Inspection Management"
            rows={visibleInspections}
            columns={[["inspectionNo", "Inspection"], ["inspectionType", "Type"], ["occupantName", "Occupant"], ["assetId", "Asset"], ["damageFound", "Damage"], ["missingAssetFound", "Missing"], ["estimatedRepairCost", "Repair Cost"], ["maintenanceTicketNo", "Ticket"], ["status", "Status"], ["score", "Score"], ["dueAt", "Due"]]}
            onSelect={(record) => setSelected({ type: "inspection", record })}
            reportType="housing-inspections"
            bulkSelectable={isAdmin}
            onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteHousing("inspection", row.id))); }}
            actions={(record) => canManage && <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("inspection", record.id, { status: "CLOSED", completedAt: new Date().toISOString() }); }} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">Close</button>}
          />
          {canManage && <HousingInspectionForm rooms={rooms} beds={housing.beds ?? []} bookings={bookings} assets={assets} saving={saving} onSubmit={submitHousing} />}
        </section>
      )}

      {activePanel === "assets" && (
        <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <HousingTable
            title="Housing Asset Management"
            rows={visibleAssets}
            columns={[["tag", "Asset Code"], ["qrCode", "QR"], ["description", "Description"], ["category", "Category"], ["brand", "Brand"], ["model", "Model"], ["serialNumber", "Serial"], ["buildingLocation", "Building"], ["roomLocation", "Room"], ["status", "Status"], ["custodianName", "Custodian"], ["warrantyExpiry", "Warranty"], ["currentValue", "Current Value"]]}
            onSelect={(record) => setSelected({ type: "asset", record })}
            reportType="housing-assets"
            bulkSelectable={isAdmin}
            onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteHousing("asset", row.id))); }}
            actions={(record) => canManage && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("asset", record.id, { status: "INSTALLED", issuedAt: new Date().toISOString(), movementAction: "Asset issuance" }); }} className="rounded-lg bg-leaf px-3 py-2 text-xs font-black text-white">Issue</button>
                <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("asset", record.id, { status: "TRANSFERRED", transferredAt: new Date().toISOString(), transferredFrom: record.roomLocation || record.room?.roomNumber || "", transferredTo: "Transfer pending location", movementAction: "Asset transfer" }); }} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">Transfer</button>
                <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("asset", record.id, { status: "UNDER_REPAIR", replacementOf: record.tag, replacedAt: new Date().toISOString(), movementAction: "Asset replacement" }); }} className="rounded-lg bg-ink px-3 py-2 text-xs font-black text-white">Replace</button>
                <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("asset", record.id, { status: "MISSING", movementAction: "Missing asset tracking" }); }} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white">Missing</button>
              </div>
            )}
          />
          {canManage && <HousingAssetForm rooms={rooms} saving={saving} onSubmit={submitHousing} />}
        </section>
      )}

      {activePanel === "inventory" && (
        <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <HousingTable
            title="Housing Inventory Management"
            rows={visibleInventory}
            columns={[["sku", "SKU"], ["name", "Name"], ["category", "Category"], ["onHand", "On Hand"], ["minimumStock", "Minimum"], ["reorderPoint", "Reorder"], ["unit", "Unit"], ["supplierName", "Supplier"], ["expiryDate", "Expiry"], ["purchaseRequestStatus", "PR Status"], ["lastMovementType", "Last Move"]]}
            onSelect={(record) => setSelected({ type: "inventory", record })}
            reportType="housing-inventory"
            bulkSelectable={isAdmin}
            onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteHousing("inventory", row.id))); }}
            actions={(record) => canManage && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("inventory", record.id, { movementType: "RECEIPT", movementQty: 1 }); }} className="rounded-lg bg-leaf px-3 py-2 text-xs font-black text-white">Receipt +1</button>
                <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("inventory", record.id, { movementType: "ISSUE", movementQty: 1 }); }} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white">Issue -1</button>
                <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("inventory", record.id, { movementType: "TRANSFER", movementQty: 0, transferFrom: record.storeLocation || record.room?.roomNumber || "", transferTo: "Transfer pending location" }); }} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">Transfer</button>
                <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("inventory", record.id, { generatePurchaseRequest: true, purchaseRequestStatus: "REQUESTED" }); }} className="rounded-lg bg-ink px-3 py-2 text-xs font-black text-white">Create PR</button>
              </div>
            )}
          />
          {canManage && <HousingInventoryForm rooms={rooms} saving={saving} onSubmit={submitHousing} />}
        </section>
      )}

      {activePanel === "approvals" && (
        <section className="grid gap-5 xl:grid-cols-2">
          <HousingAlerts notifications={notifications} approvals={visibleApprovals} onApprove={(approval, action) => approvalAction(approval, action as any)} canApprove={canApprove} />
          <HousingTable title="Housing History & Audit Trail" rows={visibleHistory} columns={[["entity", "Entity"], ["action", "Action"], ["actor", "Actor"], ["details", "Details"], ["createdAt", "Time"]]} reportType="housing-history" bulkSelectable={isAdmin} />
        </section>
      )}

      {activePanel === "notifications" && (
        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="grid gap-5">
            <Panel title="Automatic Notifications & Alerts" icon={AlertTriangle}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">Daily scheduler endpoint</p>
                  <p className="font-black text-ink">POST /api/housing/alerts</p>
                </div>
                <button type="button" onClick={runAlertChecks} disabled={runningAlerts} className="rounded-lg bg-lagoon px-4 py-2 text-sm font-black text-white disabled:bg-slate-400">{runningAlerts ? "Running..." : "Run Alert Check"}</button>
              </div>
            </Panel>
            <HousingTable
              title="Notification History"
              rows={notifications}
              columns={[["alertType", "Alert"], ["channel", "Channel"], ["role", "Role"], ["title", "Title"], ["recipient", "Recipient"], ["severity", "Severity"], ["status", "Status"], ["sentAt", "Sent"], ["createdAt", "Created"]]}
              onSelect={(record) => setSelected({ type: "notification", record })}
              reportType="housing-notifications"
              bulkSelectable={isAdmin}
              onBulkDelete={async (rows) => { await Promise.all(rows.map((row) => deleteHousing("notification", row.id))); }}
              actions={(record) => canManage && <button type="button" onClick={(event) => { event.stopPropagation(); updateHousing("notification", record.id, { read: true, status: "SENT" }); }} className="rounded-lg bg-leaf px-3 py-2 text-xs font-black text-white">Mark Sent</button>}
            />
          </div>
          <HousingNotificationSettings settings={notificationSettings} saving={saving} canManage={canManage} onSubmit={submitHousing} onUpdate={(id, body) => updateHousing("notification-setting", id, body)} />
        </section>
      )}

      {activePanel === "reports" && (
        <HousingReportsWorkspace rooms={rooms} bookings={bookings} />
      )}

      {selected && (
        <HousingPreviewModal
          type={selected.type}
          record={selected.record}
          history={history.filter((item) => item.entityId === selected.record.id || item.roomId === selected.record.id || item.bookingId === selected.record.id)}
          canDelete={isAdmin}
          onClose={() => setSelected(null)}
          onDelete={() => {
            deleteHousing(selected.type, selected.record.id);
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}

function HousingKpi({ label, value, detail, onClick }: { label: string; value: string; detail: string; onClick?: () => void }) {
  const className = "rounded-lg border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-lagoon/40 hover:shadow-lift";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <p className="text-sm font-bold text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-black">{value}</p>
        <p className="mt-1 text-sm font-bold text-lagoon">{detail}</p>
      </button>
    );
  }
  return (
    <div className={className}>
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm font-bold text-lagoon">{detail}</p>
    </div>
  );
}

function HousingChart({ title, data, dataKey, suffix = "" }: { title: string; data: any[]; dataKey: string; suffix?: string }) {
  const chartData = data.length ? data.slice(0, 8) : [{ name: "No data", [dataKey]: 0 }];
  return (
    <Panel title={title} icon={Gauge}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -18, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} height={52} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [`${value}${suffix}`, title]} />
            <Bar dataKey={dataKey} radius={[6, 6, 0, 0]} fill="#0f8b8d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function HousingSummaryTable({ title, rows }: { title: string; rows: Array<{ metric: string; value: number; status: string }> }) {
  return (
    <Panel title={title} icon={TicketCheck}>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {rows.map((row) => (
          <div key={`${title}-${row.metric}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
            <span className="text-sm font-bold text-slate-700">{row.metric}</span>
            <span className="text-lg font-black text-ink">{row.value}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black uppercase text-slate-600">{row.status}</span>
          </div>
        ))}
        {!rows.length && <div className="px-3 py-6 text-center text-sm font-bold text-slate-500">No summary records found.</div>}
      </div>
    </Panel>
  );
}

function HousingTable({ title, rows, columns, onSelect, actions, reportType, bulkSelectable = false, onBulkDelete }: { title: string; rows: any[]; columns: [string, string][]; onSelect?: (record: any) => void; actions?: (record: any) => any; reportType: string; bulkSelectable?: boolean; onBulkDelete?: (rows: any[]) => Promise<void> | void }) {
  const [page, setPage] = useState(1);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedVisibleRows = visibleRows.filter((row) => selectedRowIds.has(row.id));
  const selectedRows = rows.filter((row) => selectedRowIds.has(row.id));
  const allVisibleSelected = bulkSelectable && Boolean(visibleRows.length) && selectedVisibleRows.length === visibleRows.length;
  const someVisibleSelected = bulkSelectable && selectedVisibleRows.length > 0 && !allVisibleSelected;

  useEffect(() => {
    setPage(1);
  }, [rows.length, reportType]);

  useEffect(() => {
    setSelectedRowIds((current) => new Set(Array.from(current).filter((id) => rows.some((row) => row.id === id))));
  }, [rows]);

  function toggleVisibleRows(checked: boolean) {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      visibleRows.forEach((row) => {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      });
      return next;
    });
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function deleteSelectedRows() {
    if (!onBulkDelete || !selectedRows.length) return;
    await onBulkDelete(selectedRows);
    setSelectedRowIds(new Set());
  }

  return (
    <Panel title={title} icon={Building2}>
      <ReportButtons type={reportType} label={`${title} report`} />
      {bulkSelectable && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">
          <span>Selected {selectedRowIds.size.toLocaleString()} records</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => toggleVisibleRows(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-lagoon">Select Visible</button>
            <button type="button" disabled={!selectedRowIds.size || !onBulkDelete} onClick={deleteSelectedRows} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Delete All</button>
            <button type="button" disabled={!selectedRowIds.size} onClick={() => setSelectedRowIds(new Set())} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">Clear Selection</button>
          </div>
        </div>
      )}
      <div className="cafm-scroll-x mt-4 overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
        <table className="cafm-data-table min-w-[900px] bg-white text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {bulkSelectable && (
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someVisibleSelected;
                    }}
                    onChange={(event) => toggleVisibleRows(event.target.checked)}
                  />
                </th>
              )}
              <th className="px-3 py-3">#</th>
              {columns.map(([, label]) => <th key={label} className="px-3 py-3">{label}</th>)}
              {actions && <th className="px-3 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={row.id ?? index} onClick={() => onSelect?.(row)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                {bulkSelectable && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRowIds.has(row.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => toggleRow(row.id, event.target.checked)}
                    />
                  </td>
                )}
                <td className="px-3 py-3 font-black text-slate-500">{(safePage - 1) * PAGE_SIZE + index + 1}</td>
                {columns.map(([key]) => <td key={key} className="max-w-[260px] px-3 py-3"><HousingCellValue field={key} value={key.includes("At") || key.includes("Date") || key === "dueAt" || key === "checkIn" ? formatDateCell(row[key]) : row[key]} /></td>)}
                {actions && <td className="px-3 py-3">{actions(row)}</td>}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={columns.length + (actions ? 2 : 1) + (bulkSelectable ? 1 : 0)} className="px-3 py-6 text-center font-bold text-slate-500">No housing records found.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-600">
        <span>Page {safePage} of {totalPages} / {rows.length} entries / {PAGE_SIZE} per page</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50">Previous</button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
            const pageNumber = Math.min(totalPages, Math.max(1, safePage - 2) + index);
            return (
              <button key={`${reportType}-${pageNumber}`} type="button" onClick={() => setPage(pageNumber)} className={`rounded-lg px-3 py-2 ${safePage === pageNumber ? "bg-lagoon text-white" : "border border-slate-200 bg-white"}`}>
                {pageNumber}
              </button>
            );
          })}
          <button type="button" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50">Next</button>
        </div>
      </div>
    </Panel>
  );
}

function HousingReportsWorkspace({ rooms, bookings }: { rooms: any[]; bookings: any[] }) {
  const reportGroups = [
    { group: "Occupancy Reports", reports: [["housing-occupancy-daily", "Daily occupancy report"], ["housing-occupancy-weekly", "Weekly occupancy report"], ["housing-occupancy-monthly", "Monthly occupancy report"], ["housing-company-occupancy", "Company-wise occupancy report"], ["housing-building-occupancy", "Building-wise occupancy report"], ["housing-bed-occupancy", "Bed-wise occupancy report"], ["housing-room-utilization", "Room utilization report"]] },
    { group: "Asset Reports", reports: [["housing-missing-assets", "Missing asset report"], ["housing-damaged-assets", "Damaged asset report"], ["housing-asset-transfers", "Asset transfer report"], ["housing-asset-depreciation", "Asset depreciation report"], ["housing-asset-audit", "Asset audit report"]] },
    { group: "Maintenance Reports", reports: [["housing-maintenance-open", "Open ticket report"], ["housing-maintenance-closed", "Closed ticket report"], ["housing-maintenance-delayed", "Delayed ticket report"], ["housing-preventive-maintenance", "Preventive maintenance report"], ["housing-technician-performance", "Technician performance report"]] },
    { group: "Housekeeping Reports", reports: [["housing-cleaning-daily", "Daily cleaning report"], ["housing-deep-cleaning", "Deep cleaning report"], ["housing-inspection-report", "Inspection report"], ["housing-room-readiness", "Room readiness report"]] },
  ];
  const flatReports = reportGroups.flatMap((group) => group.reports.map(([type, label]) => ({ type, label, group: group.group })));
  const [type, setType] = useState(flatReports[0].type);
  const [rows, setRows] = useState<any[]>([]);
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", company: "", building: "", floor: "", room: "", status: "" });
  const companies = Array.from(new Set(bookings.map((booking) => booking.companyName || booking.resident?.companyName || booking.departmentCode).filter(Boolean))).sort();
  const buildings = Array.from(new Set(rooms.map((room) => room.block?.name || room.property?.name).filter(Boolean))).sort();
  const floors = Array.from(new Set(rooms.map((room) => String(room.floor || "")).filter(Boolean))).sort();
  const roomNumbers = Array.from(new Set(rooms.map((room) => String(room.roomNumber || "")).filter(Boolean))).sort();
  const current = flatReports.find((report) => report.type === type) || flatReports[0];
  const columns = rows[0] ? Object.keys(rows[0]).slice(0, 12).map((key) => [key, key.replace(/([A-Z])/g, " $1")] as [string, string]) : [];
  const url = (format: string) => {
    const params = new URLSearchParams({ type, format });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return `/api/reports?${params.toString()}`;
  };
  async function preview(nextType = type) {
    const response = await fetch(urlFor(nextType, "preview", filters), { cache: "no-store" });
    const result = await response.json();
    setRows(result.rows ?? []);
  }
  function urlFor(nextType: string, format: string, nextFilters = filters) {
    const params = new URLSearchParams({ type: nextType, format });
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return `/api/reports?${params.toString()}`;
  }
  useEffect(() => {
    preview(type);
  }, []);
  return (
    <section className="grid gap-5">
      <Panel title="Housing Reports" icon={Gauge}>
        <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
          <div className="grid gap-3">
            {reportGroups.map((group) => (
              <div key={group.group} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-sm font-black text-slate-500">{group.group}</p>
                <div className="mt-2 grid gap-2">
                  {group.reports.map(([reportType, label]) => (
                    <button key={reportType} type="button" onClick={() => { setType(reportType); preview(reportType); }} className={`rounded-lg px-3 py-2 text-left text-sm font-black ${type === reportType ? "bg-lagoon text-white" : "bg-slate-50 text-ink hover:bg-slate-100"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-lagoon">{current.group}</p>
                  <h3 className="text-2xl font-black">{current.label}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a className="rounded-lg bg-lagoon px-4 py-2 text-sm font-black text-white" href={url("csv")}>CSV</a>
                  <a className="rounded-lg bg-coral px-4 py-2 text-sm font-black text-white" href={url("pdf")}>PDF</a>
                  <a className="rounded-lg bg-ink px-4 py-2 text-sm font-black text-white" href={url("html")} target="_blank" rel="noreferrer">Print</a>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
                <input value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} type="date" className={HOUSING_FIELD_CLASS} />
                <input value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} type="date" className={HOUSING_FIELD_CLASS} />
                <select value={filters.company} onChange={(event) => setFilters((current) => ({ ...current, company: event.target.value }))} className={HOUSING_FIELD_CLASS}><option value="">Company</option>{companies.map((item) => <option key={item}>{item}</option>)}</select>
                <select value={filters.building} onChange={(event) => setFilters((current) => ({ ...current, building: event.target.value }))} className={HOUSING_FIELD_CLASS}><option value="">Building</option>{buildings.map((item) => <option key={item}>{item}</option>)}</select>
                <select value={filters.floor} onChange={(event) => setFilters((current) => ({ ...current, floor: event.target.value }))} className={HOUSING_FIELD_CLASS}><option value="">Floor</option>{floors.map((item) => <option key={item}>{item}</option>)}</select>
                <select value={filters.room} onChange={(event) => setFilters((current) => ({ ...current, room: event.target.value }))} className={HOUSING_FIELD_CLASS}><option value="">Room</option>{roomNumbers.map((item) => <option key={item}>{item}</option>)}</select>
                <input value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} placeholder="Status" className={HOUSING_FIELD_CLASS} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => preview(type)} className="rounded-lg bg-ink px-4 py-2 text-sm font-black text-white">Apply Filters</button>
                <button type="button" onClick={() => { const empty = { dateFrom: "", dateTo: "", company: "", building: "", floor: "", room: "", status: "" }; setFilters(empty); preview(type); }} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black">Clear</button>
              </div>
            </div>
            <HousingTable title={`${current.label} Preview`} rows={rows} columns={columns} reportType={type} />
          </div>
        </div>
      </Panel>
    </section>
  );
}

function HousingCellValue({ value, field = "" }: { value: any; field?: string }) {
  if (isCurrencyField(field)) return <CurrencyAmount value={value} />;
  if (typeof value === "string") {
    const status = value.toUpperCase();
    if (["AVAILABLE", "APPROVED", "PASSED", "CHECKED_IN", "ACTIVE"].includes(status)) return <span className="rounded-lg bg-leaf/10 px-2 py-1 font-black text-leaf">{value}</span>;
    if (["REQUESTED", "PENDING", "WAITING", "PENDING_APPROVAL", "SCHEDULED", "RESERVED"].includes(status)) return <span className="rounded-lg bg-amber-100 px-2 py-1 font-black text-amber-700">{value}</span>;
    if (["OCCUPIED", "IN_PROGRESS", "CHECKED_OUT", "CLOSED"].includes(status)) return <span className="rounded-lg bg-lagoon/10 px-2 py-1 font-black text-lagoon">{value}</span>;
    if (["REJECTED", "RETURNED", "CANCELLED", "FAILED", "MAINTENANCE", "BLOCKED", "CRITICAL", "HIGH"].includes(status)) return <span className="rounded-lg bg-coral/10 px-2 py-1 font-black text-coral">{value}</span>;
  }
  return <CellValue value={value} />;
}

function HousingAlerts({ notifications, approvals, onApprove, canApprove }: { notifications: any[]; approvals: any[]; onApprove: (approval: any, action: string) => void; canApprove: boolean }) {
  return (
    <Panel title="Approval Workflow, Notifications & Alerts" icon={AlertTriangle}>
      <div className="grid gap-3">
        {approvals.slice(0, 6).map((approval) => (
          <div key={approval.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-black">{approval.level}</p>
                <p className="text-sm font-bold text-slate-500">Step {approval.step || 1} / {approval.entity} / {approval.status}</p>
                {approval.remarks && <p className="mt-1 text-xs font-bold text-slate-500">{approval.remarks}</p>}
              </div>
              {canApprove && approval.status === "PENDING" && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onApprove(approval, "APPROVED")} className="rounded-lg bg-leaf px-3 py-2 text-xs font-black text-white">Approve</button>
                  <button type="button" onClick={() => onApprove(approval, "RETURNED")} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white">Return</button>
                  <button type="button" onClick={() => onApprove(approval, "REJECTED")} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white">Reject</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {notifications.slice(0, 6).map((notification) => (
          <div key={notification.id} className="rounded-lg bg-amber-50 p-3 text-sm">
            <p className="font-black text-amber-800">{notification.title}</p>
            <p className="mt-1 font-bold text-amber-900/80">{notification.message}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function HousingNotificationSettings({ settings, saving, canManage, onSubmit, onUpdate }: { settings: any[]; saving: boolean; canManage: boolean; onSubmit: (formData: FormData) => void; onUpdate: (id: string, body: Record<string, unknown>) => void }) {
  return (
    <Panel title="Notification Settings" icon={ShieldCheck}>
      <div className="grid gap-3">
        {settings.map((setting) => (
          <div key={setting.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black">{setting.label}</p>
                <p className="text-xs font-bold text-slate-500">{setting.alertType}</p>
                <p className="mt-1 text-sm text-slate-600">{setting.description}</p>
              </div>
              <span className={`rounded-lg px-2 py-1 text-xs font-black ${setting.enabled ? "bg-leaf/10 text-leaf" : "bg-slate-100 text-slate-500"}`}>{setting.enabled ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600">
              <span>Roles: {setting.roles}</span>
              <span>Channels: {setting.channels}</span>
              <span>Lead days: {setting.leadDays} / Threshold days: {setting.thresholdDays}</span>
            </div>
            {canManage && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onUpdate(setting.id, { enabled: !setting.enabled })} className={`rounded-lg px-3 py-2 text-xs font-black text-white ${setting.enabled ? "bg-coral" : "bg-leaf"}`}>{setting.enabled ? "Disable" : "Enable"}</button>
                <button type="button" onClick={() => onUpdate(setting.id, { channels: "SYSTEM,EMAIL,SMS,WHATSAPP" })} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">All Channels</button>
                <button type="button" onClick={() => onUpdate(setting.id, { channels: "SYSTEM" })} className="rounded-lg bg-ink px-3 py-2 text-xs font-black text-white">System Only</button>
              </div>
            )}
          </div>
        ))}
        {canManage && (
          <HousingForm title="Create / Update Alert Setting" type="notification-setting" saving={saving} onSubmit={onSubmit}>
            <input name="alertType" placeholder="Alert type code" className={HOUSING_FIELD_CLASS} />
            <input name="label" placeholder="Alert label" className={HOUSING_FIELD_CLASS} />
            <textarea name="description" placeholder="Alert description" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
            <input name="roles" placeholder="Role-wise assignment, comma separated" className={HOUSING_FIELD_CLASS} />
            <input name="channels" placeholder="Channels: SYSTEM,EMAIL,SMS,WHATSAPP" className={HOUSING_FIELD_CLASS} />
            <div className="grid gap-3 md:grid-cols-2">
              <input name="leadDays" type="number" min="0" placeholder="Lead days" className={HOUSING_FIELD_CLASS} />
              <input name="thresholdDays" type="number" min="0" placeholder="Threshold days" className={HOUSING_FIELD_CLASS} />
            </div>
            <select name="severity" className={HOUSING_FIELD_CLASS}>
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>CRITICAL</option>
            </select>
            <label className="flex items-center gap-2 rounded-lg bg-leaf/10 p-3 text-sm font-black text-leaf">
              <input type="checkbox" name="enabled" defaultChecked />
              Enabled
            </label>
          </HousingForm>
        )}
      </div>
    </Panel>
  );
}

function HousingSetupForms({ properties, blocks, rooms, saving, onSubmit }: { properties: any[]; blocks: any[]; rooms: any[]; saving: boolean; onSubmit: (formData: FormData) => void }) {
  const [setupType, setSetupType] = useState("room");
  return (
    <Panel title="Housing Setup & Master Data" icon={Building2}>
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ["property", "Property / Camp"],
          ["block", "Building / Block"],
          ["room", "Room"],
          ["bed", "Bed"],
          ["resident", "Employee / Occupant"],
        ].map(([type, label]) => (
          <button key={type} type="button" onClick={() => setSetupType(type)} className={`rounded-lg px-3 py-2 text-sm font-black ${setupType === type ? "bg-lagoon text-white" : "bg-slate-50 text-slate-600"}`}>
            {label}
          </button>
        ))}
      </div>
      {setupType === "property" && (
        <HousingForm title="Create Housing Property / Camp" type="property" saving={saving} onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <input name="code" placeholder="Property code" className={HOUSING_FIELD_CLASS} />
            <input name="name" placeholder="Property / camp name" className={HOUSING_FIELD_CLASS} />
            <input name="site" placeholder="Site" className={HOUSING_FIELD_CLASS} />
            <input name="city" placeholder="City" className={HOUSING_FIELD_CLASS} />
            <input name="manager" placeholder="Housing manager" className={HOUSING_FIELD_CLASS} />
          </div>
        </HousingForm>
      )}
      {setupType === "block" && (
        <HousingForm title="Create Building / Block" type="block" saving={saving} onSubmit={onSubmit}>
          <select name="propertyId" className={HOUSING_FIELD_CLASS}>
            <option value="">Select property / camp</option>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.code} / {property.name}</option>)}
          </select>
          <div className="grid gap-3 md:grid-cols-3">
            <input name="code" placeholder="Block code" className={HOUSING_FIELD_CLASS} />
            <input name="name" placeholder="Building / block name" className={HOUSING_FIELD_CLASS} />
            <input name="capacity" type="number" min="1" placeholder="Floors" className={HOUSING_FIELD_CLASS} />
          </div>
        </HousingForm>
      )}
      {setupType === "room" && (
        <HousingForm title="Create Room & Auto Beds" type="room" saving={saving} onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <select name="propertyId" className={HOUSING_FIELD_CLASS}>
              <option value="">Select property / camp</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.code} / {property.name}</option>)}
            </select>
            <select name="blockId" className={HOUSING_FIELD_CLASS}>
              <option value="">Select building / block</option>
              {blocks.map((block) => <option key={block.id} value={block.id}>{block.code} / {block.name}</option>)}
            </select>
            <input name="code" placeholder="Room code" className={HOUSING_FIELD_CLASS} />
            <input name="roomNumber" placeholder="Room number" className={HOUSING_FIELD_CLASS} />
            <input name="floor" placeholder="Floor" className={HOUSING_FIELD_CLASS} />
            <select name="roomType" className={HOUSING_FIELD_CLASS}><option>Single</option><option>Shared</option><option>VIP</option><option>Visitor</option><option>Dormitory</option></select>
            <select name="genderRestriction" className={HOUSING_FIELD_CLASS}><option>MIXED</option><option>MALE</option><option>FEMALE</option></select>
            <input name="capacity" type="number" min="1" placeholder="Bed capacity" className={HOUSING_FIELD_CLASS} />
            <select name="status" className={HOUSING_FIELD_CLASS}><option value="AVAILABLE">Available</option><option value="MAINTENANCE">Under maintenance</option><option value="BLOCKED">Blocked</option></select>
          </div>
          <textarea name="remarks" placeholder="Room remarks / allocation notes" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
        </HousingForm>
      )}
      {setupType === "bed" && (
        <HousingForm title="Create Bed" type="bed" saving={saving} onSubmit={onSubmit}>
          <select name="roomId" className={HOUSING_FIELD_CLASS}>
            <option value="">Select room</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.property?.name} / {room.block?.name} / Floor {room.floor} / Room {room.roomNumber}</option>)}
          </select>
          <div className="grid gap-3 md:grid-cols-3">
            <input name="code" placeholder="Bed code" className={HOUSING_FIELD_CLASS} />
            <input name="label" placeholder="Bed label" className={HOUSING_FIELD_CLASS} />
            <select name="status" className={HOUSING_FIELD_CLASS}><option>AVAILABLE</option><option>RESERVED</option><option>OCCUPIED</option><option>MAINTENANCE</option><option>BLOCKED</option></select>
          </div>
        </HousingForm>
      )}
      {setupType === "resident" && (
        <HousingForm title="Create Employee / Occupant" type="resident" saving={saving} onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <input name="residentNo" placeholder="Employee / resident number" className={HOUSING_FIELD_CLASS} />
            <input name="residentName" placeholder="Employee / occupant name" className={HOUSING_FIELD_CLASS} />
            <input name="email" placeholder="Email" className={HOUSING_FIELD_CLASS} />
            <input name="phone" placeholder="Phone" className={HOUSING_FIELD_CLASS} />
            <input name="companyId" placeholder="Company ID" className={HOUSING_FIELD_CLASS} />
            <input name="companyName" placeholder="Company name" className={HOUSING_FIELD_CLASS} />
            <select name="gender" className={HOUSING_FIELD_CLASS}><option value="">Gender</option><option>MALE</option><option>FEMALE</option></select>
            <input name="nationality" placeholder="Nationality" className={HOUSING_FIELD_CLASS} />
            <input name="departmentCode" placeholder="Department code" className={HOUSING_FIELD_CLASS} />
            <select name="status" className={HOUSING_FIELD_CLASS}><option>ACTIVE</option><option>BLACKLISTED</option><option>INACTIVE</option></select>
          </div>
        </HousingForm>
      )}
    </Panel>
  );
}

function HousingBookingForm({ rooms, beds, residents, saving, onSubmit }: { rooms: any[]; beds: any[]; residents: any[]; saving: boolean; onSubmit: (formData: FormData) => void }) {
  const allocatableRooms = rooms.filter((room) => !["BLOCKED", "MAINTENANCE"].includes(room.status));
  const allocatableBeds = beds.filter((bed) => bed.status === "AVAILABLE");
  return (
    <HousingForm title="Accommodation & Booking Management" type="booking" saving={saving} onSubmit={onSubmit}>
      <select name="residentId" className={HOUSING_FIELD_CLASS}>
        <option value="">New employee / select existing</option>
        {residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.residentNo} - {resident.name} - {resident.companyName || resident.companyId || "Company"}</option>)}
      </select>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="employeeId" placeholder="Employee ID" className={HOUSING_FIELD_CLASS} />
        <input name="residentName" placeholder="Employee name" className={HOUSING_FIELD_CLASS} />
        <input name="companyName" placeholder="Company name" className={HOUSING_FIELD_CLASS} />
        <input name="departmentCode" placeholder="Department" className={HOUSING_FIELD_CLASS} />
        <input name="nationality" placeholder="Nationality" className={HOUSING_FIELD_CLASS} />
        <input name="contactNumber" placeholder="Contact number" className={HOUSING_FIELD_CLASS} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <select name="gender" className={HOUSING_FIELD_CLASS}>
          <option value="">Gender</option>
          <option>MALE</option>
          <option>FEMALE</option>
        </select>
        <select name="bookingType" className={HOUSING_FIELD_CLASS}>
          <option value="TEMPORARY">Temporary booking</option>
          <option value="PERMANENT">Permanent booking</option>
        </select>
        <select name="allocationType" className={HOUSING_FIELD_CLASS}>
          <option value="STANDARD">Standard allocation</option>
          <option value="VIP">VIP room allocation</option>
          <option value="VISITOR">Visitor room allocation</option>
        </select>
        <select name="status" className={HOUSING_FIELD_CLASS}>
          <option value="REQUESTED">Submit request</option>
          <option value="PENDING_APPROVAL">Pending approval</option>
          <option value="APPROVED">Approved / reserve bed</option>
          <option value="CHECKED_IN">Check-in now</option>
        </select>
      </div>
      <select name="roomId" className={HOUSING_FIELD_CLASS}>
        <option value="">Select room by company / building / floor</option>
        {allocatableRooms.map((room) => <option key={room.id} value={room.id}>{room.property?.name} / {room.block?.name} / Floor {room.floor} / Room {room.roomNumber} / {room.roomType} / {room.genderRestriction || "MIXED"} ({room.occupancy}/{room.capacity})</option>)}
      </select>
      <select name="bedId" className={HOUSING_FIELD_CLASS}>
        <option value="">Auto-assign available bed</option>
        {allocatableBeds.map((bed) => <option key={bed.id} value={bed.id}>{bed.room?.roomNumber || "Room"} / {bed.label} / available</option>)}
      </select>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="buildingNumber" placeholder="Building number / override" className={HOUSING_FIELD_CLASS} />
        <input name="floorNumber" placeholder="Floor / override" className={HOUSING_FIELD_CLASS} />
        <input name="roomNumber" placeholder="Room number / override" className={HOUSING_FIELD_CLASS} />
        <input name="bedNumber" placeholder="Bed number / override" className={HOUSING_FIELD_CLASS} />
        <input name="checkIn" type="datetime-local" className={HOUSING_FIELD_CLASS} />
        <input name="checkOut" type="datetime-local" className={HOUSING_FIELD_CLASS} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="keyHandoverBy" placeholder="Digital room key handed over by" className={HOUSING_FIELD_CLASS} />
        <input name="keyHandoverAt" type="datetime-local" className={HOUSING_FIELD_CLASS} />
        <input name="campIdNumber" placeholder="Camp ID number" className={HOUSING_FIELD_CLASS} />
        <input name="campIdIssuedAt" type="datetime-local" className={HOUSING_FIELD_CLASS} />
      </div>
      <select name="priority" className={HOUSING_FIELD_CLASS}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select>
      <ImageUploadField name="attachmentUrls" />
      <textarea name="notes" placeholder="Booking request, transfer reason, blacklist/no-show comments, approval justification" className="min-h-24 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
    </HousingForm>
  );
}

function HousingInspectionForm({ rooms, beds, bookings, assets, saving, onSubmit }: { rooms: any[]; beds: any[]; bookings: any[]; assets: any[]; saving: boolean; onSubmit: (formData: FormData) => void }) {
  const conditionOptions = ["Good", "Fair", "Damaged", "Missing", "Needs Repair", "Not Applicable"];
  const checklistFields = [
    ["furnitureCondition", "Furniture condition"],
    ["mattressCondition", "Mattress condition"],
    ["bedSheetCondition", "Bed sheet condition"],
    ["tvCondition", "TV condition"],
    ["refrigeratorCondition", "Refrigerator condition"],
    ["acCondition", "AC condition"],
    ["waterLeakageCheck", "Water leakage check"],
    ["lightingCondition", "Lighting condition"],
    ["curtainCondition", "Curtain condition"],
    ["doorLockCondition", "Door lock condition"],
    ["smokeDetectorCondition", "Smoke detector condition"],
    ["fireExtinguisherAvailability", "Fire extinguisher availability"],
    ["bathroomCleanliness", "Bathroom cleanliness"],
    ["generalRoomCleanliness", "General room cleanliness"],
    ["missingAssetVerification", "Missing asset verification"],
  ] as const;
  return (
    <HousingForm title="Room Inspection Management" type="inspection" saving={saving} onSubmit={onSubmit}>
      <select name="inspectionType" className={HOUSING_FIELD_CLASS}>
        <option>Pre-check-in inspection</option>
        <option>Occupied room inspection</option>
        <option>Check-out inspection</option>
        <option>Damage inspection</option>
        <option>Deep cleaning inspection</option>
        <option>Monthly inspection</option>
        <option>Safety inspection</option>
      </select>
      <select name="roomId" className={HOUSING_FIELD_CLASS}><option value="">Select building / room</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.property?.name} / {room.block?.name} / Floor {room.floor} / Room {room.roomNumber} / {room.roomType}</option>)}</select>
      <select name="bedId" className={HOUSING_FIELD_CLASS}><option value="">Link bed</option>{beds.map((bed) => <option key={bed.id} value={bed.id}>{bed.room?.roomNumber || "Room"} / {bed.label} / {bed.status}</option>)}</select>
      <select name="occupantId" className={HOUSING_FIELD_CLASS}><option value="">Link occupant / booking</option>{bookings.map((booking) => <option key={booking.id} value={booking.residentId || booking.id}>{booking.bookingNo} / {booking.residentName} / {booking.status}</option>)}</select>
      <input name="occupantName" placeholder="Occupant name" className={HOUSING_FIELD_CLASS} />
      <select name="assetId" className={HOUSING_FIELD_CLASS}><option value="">Link asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.tag} / {asset.name} / {asset.status}</option>)}</select>
      <input name="workOrderRef" placeholder="Linked work order / reference" className={HOUSING_FIELD_CLASS} />
      <input name="inspector" placeholder="Inspector" className={HOUSING_FIELD_CLASS} />
      <input name="dueAt" type="datetime-local" className={HOUSING_FIELD_CLASS} />
      <input name="score" type="number" placeholder="Score" className={HOUSING_FIELD_CLASS} />
      <div className="grid gap-3 md:grid-cols-2">
        {checklistFields.map(([name, label]) => (
          <label key={name} className="grid gap-1 text-xs font-black uppercase text-slate-500">
            {label}
            <select name={name} className={HOUSING_FIELD_CLASS}>
              {conditionOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
        <label className="flex items-center gap-2"><input type="checkbox" name="damageFound" /> Damage found, create damage record</label>
        <textarea name="damageReport" placeholder="Damage report" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
        <label className="flex items-center gap-2"><input type="checkbox" name="missingAssetFound" /> Missing asset found, mark selected asset missing</label>
        <textarea name="missingAssetReport" placeholder="Missing asset report" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
        <label className="flex items-center gap-2"><input type="checkbox" name="repairRequired" /> Repair required</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="createMaintenanceTicket" /> Convert into maintenance ticket</label>
        <input name="estimatedRepairCost" type="number" step="0.01" placeholder="Estimated repair cost" className={HOUSING_FIELD_CLASS} />
        <textarea name="occupantLiability" placeholder="Occupant liability record" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
      </div>
      <ImageUploadField name="beforePhotoUrls" />
      <ImageUploadField name="afterPhotoUrls" />
      <ImageUploadField name="photoUrls" />
      <textarea name="findings" placeholder="Inspection report, findings and corrective actions" className="min-h-24 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
    </HousingForm>
  );
}

function HousingAssetForm({ rooms, saving, onSubmit }: { rooms: any[]; saving: boolean; onSubmit: (formData: FormData) => void }) {
  const categories = ["Furniture", "Beds", "Mattresses", "TVs", "Refrigerators", "Air conditioners", "Curtains", "Water dispensers", "Fire extinguishers", "Smoke detectors", "Office equipment", "Housekeeping tools", "Electrical items"];
  const statuses = ["AVAILABLE", "INSTALLED", "UNDER_REPAIR", "MISSING", "DAMAGED", "SCRAPPED", "TRANSFERRED"];
  return (
    <HousingForm title="Housing Asset Management" type="asset" saving={saving} onSubmit={onSubmit}>
      <input name="tag" placeholder="Asset code" className={HOUSING_FIELD_CLASS} />
      <input name="qrCode" placeholder="Barcode / QR code" className={HOUSING_FIELD_CLASS} />
      <textarea name="description" placeholder="Asset description" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
      <select name="category" className={HOUSING_FIELD_CLASS}>{categories.map((category) => <option key={category}>{category}</option>)}</select>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="serialNumber" placeholder="Serial number" className={HOUSING_FIELD_CLASS} />
        <input name="brand" placeholder="Brand" className={HOUSING_FIELD_CLASS} />
        <input name="model" placeholder="Model" className={HOUSING_FIELD_CLASS} />
        <input name="supplierName" placeholder="Supplier name" className={HOUSING_FIELD_CLASS} />
        <input name="purchaseDate" type="date" className={HOUSING_FIELD_CLASS} />
        <input name="warrantyExpiry" type="date" className={HOUSING_FIELD_CLASS} />
        <input name="assetValue" type="number" step="0.01" placeholder="Asset value" className={HOUSING_FIELD_CLASS} />
        <input name="depreciationRate" type="number" step="0.01" placeholder="Depreciation % per year" className={HOUSING_FIELD_CLASS} />
        <input name="currentValue" type="number" step="0.01" placeholder="Current value / override" className={HOUSING_FIELD_CLASS} />
        <select name="status" className={HOUSING_FIELD_CLASS}>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
      </div>
      <select name="roomId" className={HOUSING_FIELD_CLASS}><option value="">Assign room / room profile</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.property?.name} / {room.block?.name} / Floor {room.floor} / Room {room.roomNumber}</option>)}</select>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="buildingLocation" placeholder="Building location" className={HOUSING_FIELD_CLASS} />
        <input name="roomLocation" placeholder="Room location" className={HOUSING_FIELD_CLASS} />
        <input name="custodianName" placeholder="Custodian name" className={HOUSING_FIELD_CLASS} />
        <input name="custodianContact" placeholder="Custodian contact" className={HOUSING_FIELD_CLASS} />
      </div>
      <div className="grid gap-3 rounded-lg bg-slate-50 p-3">
        <select name="movementAction" className={HOUSING_FIELD_CLASS}>
          <option>Asset saved</option>
          <option>Asset issuance</option>
          <option>Asset transfer</option>
          <option>Asset replacement</option>
          <option>Missing asset tracking</option>
          <option>Asset inspection</option>
          <option>Preventive maintenance schedule</option>
          <option>Warranty tracking</option>
          <option>Depreciation tracking</option>
        </select>
        <div className="grid gap-3 md:grid-cols-2">
          <input name="issuedTo" placeholder="Issued to" className={HOUSING_FIELD_CLASS} />
          <input name="issuedAt" type="datetime-local" className={HOUSING_FIELD_CLASS} />
          <input name="transferredFrom" placeholder="Transferred from" className={HOUSING_FIELD_CLASS} />
          <input name="transferredTo" placeholder="Transferred to" className={HOUSING_FIELD_CLASS} />
          <input name="transferredAt" type="datetime-local" className={HOUSING_FIELD_CLASS} />
          <input name="replacementOf" placeholder="Replacement of asset code" className={HOUSING_FIELD_CLASS} />
          <input name="replacedAt" type="datetime-local" className={HOUSING_FIELD_CLASS} />
          <input name="lastInspectionAt" type="datetime-local" className={HOUSING_FIELD_CLASS} />
          <input name="pmSchedule" placeholder="Preventive maintenance schedule" className={HOUSING_FIELD_CLASS} />
          <input name="nextPmDue" type="date" className={HOUSING_FIELD_CLASS} />
        </div>
      </div>
      <ImageUploadField name="photoUrls" />
      <textarea name="notes" placeholder="Asset audit notes / movement remarks" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
    </HousingForm>
  );
}

function HousingInventoryForm({ rooms, saving, onSubmit }: { rooms: any[]; saving: boolean; onSubmit: (formData: FormData) => void }) {
  const categories = ["Linen", "Pillows", "Blankets", "Cleaning materials", "Electrical spare parts", "Plumbing spare parts", "PPE items", "Office stationery", "Kitchen equipment", "Hygiene materials"];
  return (
    <HousingForm title="Add Housing Inventory" type="inventory" saving={saving} onSubmit={onSubmit}>
      <input name="sku" placeholder="SKU / barcode" className={HOUSING_FIELD_CLASS} />
      <input name="name" placeholder="Item name" className={HOUSING_FIELD_CLASS} />
      <select name="category" className={HOUSING_FIELD_CLASS}>
        <option value="">Inventory category</option>
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
      <textarea name="description" placeholder="Description / item specification" className="min-h-20 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
      <select name="roomId" className={HOUSING_FIELD_CLASS}><option value="">Room / store location</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber} / {room.roomType}</option>)}</select>
      <input name="storeLocation" placeholder="Store / shelf / bin location" className={HOUSING_FIELD_CLASS} />
      <div className="grid gap-3 md:grid-cols-3">
        <input name="onHand" type="number" min="0" placeholder="Opening / adjusted stock" className={HOUSING_FIELD_CLASS} />
        <input name="minimumStock" type="number" min="0" placeholder="Minimum stock" className={HOUSING_FIELD_CLASS} />
        <input name="reorderPoint" type="number" min="0" placeholder="Reorder level" className={HOUSING_FIELD_CLASS} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="unit" placeholder="Unit" className={HOUSING_FIELD_CLASS} />
        <input name="unitCost" type="number" min="0" step="0.01" placeholder="Unit cost" className={HOUSING_FIELD_CLASS} />
        <input name="supplierName" placeholder="Supplier name" className={HOUSING_FIELD_CLASS} />
        <input name="supplierContact" placeholder="Supplier contact" className={HOUSING_FIELD_CLASS} />
        <input name="preferredSupplier" placeholder="Preferred supplier" className={HOUSING_FIELD_CLASS} />
        <input name="expiryDate" type="date" className={HOUSING_FIELD_CLASS} />
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-black">Stock Movement</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select name="movementType" className={HOUSING_FIELD_CLASS}>
            <option value="ADJUSTMENT">Stock adjustment</option>
            <option value="RECEIPT">Stock receipt</option>
            <option value="ISSUE">Stock issue</option>
            <option value="TRANSFER">Stock transfer</option>
          </select>
          <input name="movementQty" type="number" min="0" placeholder="Movement quantity" className={HOUSING_FIELD_CLASS} />
          <input name="transferFrom" placeholder="Transfer from" className={HOUSING_FIELD_CLASS} />
          <input name="transferTo" placeholder="Transfer to" className={HOUSING_FIELD_CLASS} />
          <input name="movementBy" placeholder="Movement by" className={HOUSING_FIELD_CLASS} />
          <input name="adjustmentReason" placeholder="Adjustment reason" className={HOUSING_FIELD_CLASS} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="purchaseRequestNo" placeholder="Purchase request no." className={HOUSING_FIELD_CLASS} />
        <select name="purchaseRequestStatus" className={HOUSING_FIELD_CLASS}>
          <option value="">Purchase request status</option>
          <option>REQUESTED</option>
          <option>APPROVED</option>
          <option>ORDERED</option>
          <option>RECEIVED</option>
        </select>
      </div>
      <label className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-800">
        <input type="checkbox" name="generatePurchaseRequest" />
        Generate purchase request when saving
      </label>
    </HousingForm>
  );
}

function HousingForm({ title, type, saving, onSubmit, children }: { title: string; type: string; saving: boolean; onSubmit: (formData: FormData) => void; children: any }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(new FormData(form));
    form.reset();
  }
  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <input type="hidden" name="type" value={type} />
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-1 text-sm font-bold text-slate-500">Fields are flexible; fill what is available and the system completes IDs/status.</p>
      <div className="mt-4 grid gap-3">
        {children}
        <button disabled={saving} className="h-11 rounded-lg bg-ink font-black text-white disabled:bg-slate-400">{saving ? "Saving..." : "Save"}</button>
      </div>
    </form>
  );
}

function HousingPreviewModal({ type, record, history, canDelete, onClose, onDelete }: { type: string; record: any; history: any[]; canDelete: boolean; onClose: () => void; onDelete: () => void }) {
  const attachments = attachmentList(record.photoUrls || record.attachmentUrls);
  const images = attachments.filter(isImageUrl);
  return (
    <RequestModalShell title={`Housing ${type}: ${record.bookingNo || record.inspectionNo || record.code || record.tag || record.sku || record.name}`} onClose={onClose}>
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(record).filter(([key]) => !["property", "block", "room", "bed", "resident", "approvals", "beds"].includes(key)).slice(0, 18).map(([key, value]) => (
            <PreviewField key={key} label={key.replace(/([A-Z])/g, " $1")} value={key.includes("At") || key.includes("check") || key === "dueAt" ? formatDateCell(value as string) : displayValue(value)} />
          ))}
        </div>
        {record.room && <PreviewField label="Room" value={`${record.room.property?.name || ""} / ${record.room.block?.name || ""} / ${record.room.roomNumber || ""}`} />}
        {images.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-black">Photo Evidence</p>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {images.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Housing attachment" className="h-28 w-full rounded-lg object-cover" /></a>)}
            </div>
          </div>
        )}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-black">History Tracking</p>
          <div className="mt-3 grid gap-2">
            {history.length ? history.map((item) => (
              <div key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-black text-lagoon">{item.action}</p>
                <p className="font-bold text-slate-600">{item.actor} / {formatDateCell(item.createdAt)}</p>
                <p className="text-slate-600">{item.details}</p>
              </div>
            )) : <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-500">No history entries yet.</p>}
          </div>
        </div>
        {canDelete && <button type="button" onClick={onDelete} className="h-11 rounded-lg bg-coral font-black text-white">Delete {type}</button>}
      </div>
    </RequestModalShell>
  );
}

function Reports() {
  const [type, setType] = useState("assets");
  const [rows, setRows] = useState<any[]>([]);
  const [kpis, setKpis] = useState<Record<string, unknown> | null>(null);
  const [responseGreaterThan, setResponseGreaterThan] = useState("");
  const [resolutionGreaterThan, setResolutionGreaterThan] = useState("");
  const [slaBreach, setSlaBreach] = useState("");
  const [delayedOnly, setDelayedOnly] = useState(false);

  async function preview(nextType = type) {
    const response = await fetch(reportUrl(nextType, "preview"), { cache: "no-store" });
    const result = await response.json();
    setRows(result.rows ?? []);
    setKpis(result.kpis ?? null);
  }

  useEffect(() => {
    preview(type);
  }, []);

  const columns = rows[0] ? Object.keys(rows[0]).map((key) => [key, key] as [string, string]) : [];
  const exportUrl = (format: string) => reportUrl(type, format);
  function reportUrl(nextType: string, format: string) {
    const params = new URLSearchParams({ type: nextType, format });
    if (nextType === "work-orders") {
      if (responseGreaterThan) params.set("responseGreaterThan", responseGreaterThan);
      if (resolutionGreaterThan) params.set("resolutionGreaterThan", resolutionGreaterThan);
      if (slaBreach) params.set("slaBreach", slaBreach);
      if (delayedOnly) params.set("delayedOnly", "true");
    }
    return `/api/reports?${params.toString()}`;
  }

  return (
    <section className="space-y-5">
      <Panel title="Reports Preview & Download" icon={ClipboardCheck}>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              preview(event.target.value);
            }}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon"
          >
            <option value="assets">Assets</option>
            <option value="work-orders">Work Orders</option>
            <option value="requests">Service Requests</option>
            <option value="inventory">Inventory</option>
            <option value="ppm">PPM</option>
            <option value="housing-dashboard">Housing Dashboard</option>
            <option value="housing-rooms">Housing Rooms</option>
            <option value="housing-bookings">Housing Bookings</option>
            <option value="housing-inspections">Housing Inspections</option>
            <option value="housing-assets">Housing Assets</option>
            <option value="housing-inventory">Housing Inventory</option>
            <option value="housing-approvals">Housing Approvals</option>
            <option value="housing-notifications">Housing Notifications</option>
            <option value="housing-notification-settings">Housing Notification Settings</option>
            <option value="housing-history">Housing History</option>
          </select>
          <a className="rounded-lg bg-lagoon px-4 py-3 text-sm font-black text-white" href={exportUrl("csv")}>CSV</a>
          <a className="rounded-lg bg-leaf px-4 py-3 text-sm font-black text-white" href={exportUrl("excel")}>Excel</a>
          <a className="rounded-lg bg-coral px-4 py-3 text-sm font-black text-white" href={exportUrl("pdf")}>PDF</a>
          <button onClick={() => preview(type)} className="rounded-lg bg-ink px-4 py-3 text-sm font-black text-white">Apply Filters</button>
        </div>
        {type === "work-orders" && (
          <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-4">
            <input value={responseGreaterThan} onChange={(event) => setResponseGreaterThan(event.target.value)} placeholder="Response > mins" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
            <input value={resolutionGreaterThan} onChange={(event) => setResolutionGreaterThan(event.target.value)} placeholder="Resolution > mins" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
            <select value={slaBreach} onChange={(event) => setSlaBreach(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
              <option value="">SLA all</option>
              <option value="yes">SLA Breach</option>
              <option value="no">No SLA Breach</option>
            </select>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={delayedOnly} onChange={(event) => setDelayedOnly(event.target.checked)} /> Delayed only</label>
          </div>
        )}
        {kpis && (
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {Object.entries(kpis).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-500">{key.replaceAll("_", " ")}</p>
                <p className="mt-1 text-lg font-black">{String(value ?? "-")}</p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <DataTable rows={rows} columns={columns} />
        </div>
      </Panel>
    </section>
  );
}

function BulkUploadProgress({ progress }: { progress: BulkUploadProgressState | null }) {
  return (
    <Panel title="Bulk Upload Progress" icon={Upload}>
      {!progress ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="font-black text-ink">No bulk upload is currently in progress</p>
          <p className="mt-1 text-sm font-bold text-slate-500">This page only shows live upload progress. Completed upload details are available under Activity Logs &gt; Audit Logs.</p>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <ProgressStat label="Estimated Rows" value={progress.totalRows} />
            <ProgressStat label="Rows Processed" value={progress.processedRows} />
            <ProgressStat label="Completion" value={progress.completion} suffix="%" tone="leaf" />
            <ProgressStat label="Remaining" value={Math.max(progress.totalRows - progress.processedRows, 0)} />
          </div>
          {(progress.createdRows !== undefined || progress.failedRows !== undefined) && (
            <div className="grid gap-3 md:grid-cols-2">
              <ProgressStat label="Rows Created" value={progress.createdRows ?? 0} tone="leaf" />
              <ProgressStat label="Rows Failed" value={progress.failedRows ?? 0} tone="coral" />
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase text-slate-400">Current Upload</p>
                <h3 className="mt-1 text-xl font-black text-ink">{friendlyAuditLabel(progress.module)}</h3>
                <p className="mt-1 text-sm font-bold text-slate-600">{progress.fileName} - started {formatDateCell(progress.startedAt)}</p>
              </div>
              <span className="rounded-full bg-lagoon/10 px-3 py-1 text-xs font-black text-lagoon">
                {friendlyAuditLabel(progress.status)}
              </span>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-700">Completion</p>
                <p className="text-2xl font-black text-ink">{progress.completion}%</p>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${progress.completion}%` }} />
              </div>
              <p className="mt-2 text-sm font-bold text-slate-600">
                {progress.message}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="font-black text-ink">Live Upload Details</h4>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <PreviewField label="Module" value={friendlyAuditLabel(progress.module)} />
              <PreviewField label="File" value={progress.fileName} />
              <PreviewField label="File Size" value={formatBytes(progress.fileSize)} />
              <PreviewField label="Started At" value={formatDateCell(progress.startedAt)} />
              {progress.updatedAt && <PreviewField label="Last Updated" value={formatDateCell(progress.updatedAt)} />}
              <PreviewField label="Status" value={friendlyAuditLabel(progress.status)} />
              <PreviewField label="Completion" value={`${progress.completion}%`} />
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function ProgressStat({ label, value, suffix = "", tone = "slate" }: { label: string; value: number; suffix?: string; tone?: "slate" | "leaf" | "coral" }) {
  const color = tone === "leaf" ? "text-leaf" : tone === "coral" ? "text-coral" : "text-ink";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-black uppercase text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value}{suffix}</p>
    </div>
  );
}

function AuditLogs({ logs }: { logs: any[] }) {
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  return (
    <Panel title="Audit Logs" icon={Activity}>
      <ReportButtons type="audit-logs" label="Audit report" />
      <DataTable
        rows={logs}
        columns={[
          ["createdAt", "Time"],
          ["actorName", "User"],
          ["role", "Role"],
          ["action", "Action"],
          ["entity", "Record Type"],
          ["entityId", "Record ID"],
          ["details", "Details"],
        ]}
        renderCell={(row, key) => key === "details" ? <AuditDetailsButton log={row} onOpen={() => setSelectedLog(row)} /> : undefined}
      />
      {selectedLog && <AuditDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </Panel>
  );
}

function AuditDetailsButton({ log, onOpen }: { log: any; onOpen: () => void }) {
  const parsed = parseAuditDetails(log.details);
  const entries = auditDetailEntries(parsed);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex max-w-[320px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-black text-lagoon shadow-sm hover:border-lagoon hover:bg-lagoon/5"
    >
      <span>View details</span>
      {entries.length > 1 && <span className="rounded-full bg-leaf/10 px-2 py-0.5 text-[11px] text-leaf">{entries.length} rows</span>}
      <span className="truncate text-slate-500">{auditDetailSummary(parsed)}</span>
    </button>
  );
}

function AuditDetailsModal({ log, onClose }: { log: any; onClose: () => void }) {
  const parsed = parseAuditDetails(log.details);
  const entries = auditDetailEntries(parsed);
  const detailBody = auditDetailBody(parsed);

  return (
    <RequestModalShell title="Audit Log Details" onClose={onClose}>
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <PreviewField label="Time" value={formatDateCell(log.createdAt)} />
          <PreviewField label="User" value={log.actorName || "-"} />
          <PreviewField label="Role" value={log.role || "-"} />
          <PreviewField label="Action" value={String(log.action || "").replaceAll("_", " ")} />
          <PreviewField label="Record Type" value={log.entity || "-"} />
          <PreviewField label="Record ID" value={log.entityId || "-"} />
        </div>

        {entries.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lagoon/20 bg-lagoon/5 p-4">
            <div>
              <p className="font-black text-ink">Bulk task details</p>
              <p className="text-sm font-bold text-slate-600">{entries.length} row-level results are available for export.</p>
            </div>
            <button
              type="button"
              onClick={() => downloadAuditEntries(log, entries)}
              className="rounded-lg bg-leaf px-4 py-2 text-sm font-black text-white"
            >
              Export to Excel
            </button>
          </div>
        )}

        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-black text-ink">Readable Details</p>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            <AuditDetailValue label="Logged At" value={parsed?.at} />
            <AuditDetailValue label="Actor" value={parsed?.actor?.name || parsed?.actor?.email} />
            {Object.entries(detailBody).map(([key, value]) => (
              <AuditDetailValue key={key} label={friendlyAuditLabel(key)} value={value} />
            ))}
          </div>
        </div>

        {entries.length > 0 && (
          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-black text-ink">Row Results</p>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-black">Row</th>
                    <th className="px-3 py-2 font-black">Status</th>
                    <th className="px-3 py-2 font-black">Record</th>
                    <th className="px-3 py-2 font-black">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 200).map((entry, index) => (
                    <tr key={`${entry.row}-${index}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-bold text-slate-600">{entry.row ?? index + 1}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-black ${entry.status === "SUCCESS" ? "bg-leaf/10 text-leaf" : "bg-coral/10 text-coral"}`}>
                          {entry.status || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-700">{entry.recordKey || entry.displayName || entry.recordId || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{entry.message || entry.action || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {entries.length > 200 && <p className="border-t border-slate-100 p-3 text-sm font-bold text-slate-500">Showing first 200 rows. Export to Excel for the full list.</p>}
            </div>
          </div>
        )}
      </div>
    </RequestModalShell>
  );
}

function AuditDetailValue({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === "" || label === "Entries") return null;
  if (Array.isArray(value)) {
    return (
      <div className="rounded-lg bg-slate-50 p-3 md:col-span-2">
        <p className="text-xs font-black uppercase text-slate-500">{label}</p>
        <p className="mt-1 text-sm font-black text-slate-700">{value.length} item{value.length === 1 ? "" : "s"}</p>
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <div className="rounded-lg bg-slate-50 p-3 md:col-span-2">
        <p className="text-xs font-black uppercase text-slate-500">{label}</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {Object.entries(value).map(([key, item]) => (
            <div key={key} className="rounded-lg bg-white p-2">
              <p className="text-[11px] font-black uppercase text-slate-400">{friendlyAuditLabel(key)}</p>
              <p className="break-words text-sm font-bold text-slate-700">{formatAuditValue(item)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <PreviewField label={label} value={formatAuditValue(value)} />;
}

function parseAuditDetails(value: any) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return { details: String(value) };
  }
}

function auditDetailBody(details: any) {
  if (!details || typeof details !== "object") return {};
  if (details.details && typeof details.details === "object") return details.details;
  return details;
}

function auditDetailEntries(details: any): AuditEntry[] {
  const body = auditDetailBody(details);
  if (Array.isArray(body.entries)) return body.entries;
  if (Array.isArray(body.failed)) {
    return body.failed.map((item: any) => ({
      row: item.row,
      status: "FAILED",
      message: item.message,
      recordKey: item.recordKey,
      displayName: item.displayName,
    }));
  }
  return [];
}

function auditDetailSummary(details: any) {
  const body = auditDetailBody(details);
  if (!body || typeof body !== "object") return "-";
  if (body.module || body.totalRows !== undefined) {
    return `${body.module || "bulk task"}: ${body.created ?? 0}/${body.totalRows ?? 0} saved`;
  }
  const firstUseful = Object.entries(body).find(([key, value]) => !["entries", "failed", "result"].includes(key) && value !== undefined && value !== null && value !== "");
  return firstUseful ? `${friendlyAuditLabel(firstUseful[0])}: ${formatAuditValue(firstUseful[1])}` : "Open";
}

function friendlyAuditLabel(value: string) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAuditValue(value: any): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && isDateLikeString(value)) return formatDateCell(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return value.name || value.email || value.id || JSON.stringify(value);
  return String(value);
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function countCsvDataRows(value: string): number {
  const rows = value.split(/\r?\n/).filter((row) => row.trim().length > 0);
  return Math.max(rows.length - 1, 0);
}

function downloadAuditEntries(log: any, entries: AuditEntry[]) {
  const columns = ["row", "status", "module", "recordType", "recordId", "recordKey", "displayName", "action", "message"];
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(friendlyAuditLabel(column))}</th>`).join("")}</tr></thead><tbody>${entries.map((entry) => `<tr>${columns.map((column) => `<td>${escapeHtml(formatAuditValue(entry[column]))}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-${String(log.action || "details").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

function Template({ type, title, value }: { type: string; title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-black">{title}</p>
        <a href={`/api/templates/${type}`} download={`${type}-template.csv`} className="rounded-lg bg-lagoon px-3 py-2 text-xs font-black text-white">Download CSV</a>
      </div>
      <code className="mt-2 block break-words text-xs text-slate-600">{value}</code>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-white/80 bg-white p-5 shadow-lift">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-lagoon/10 text-lagoon">
          <Icon size={20} />
        </div>
        <h3 className="text-xl font-black">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function DeleteRowButton({ saving, onDelete }: { saving: boolean; onDelete: () => void }) {
  return (
    <button type="button" disabled={saving} onClick={onDelete} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-400">
      Delete
    </button>
  );
}

function DataTable({
  rows,
  columns,
  actions,
  renderCell,
  bulkSelectable = false,
  bulkLabel = "rows",
  onBulkDelete,
}: {
  rows: any[];
  columns: [string, string][];
  actions?: (row: any) => ReactNode;
  renderCell?: (row: any, key: string) => ReactNode | undefined;
  bulkSelectable?: boolean;
  bulkLabel?: string;
  onBulkDelete?: (rows: any[]) => Promise<void> | void;
}) {
  const [page, setPage] = useState(1);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = rows.slice(startIndex, startIndex + PAGE_SIZE);
  const rowKey = (row: any, index: number) => String(row.id ?? row.code ?? row.name ?? row.reference ?? row.ticketNo ?? row.woNo ?? index);
  const visibleRowKeys = visibleRows.map((row, index) => rowKey(row, startIndex + index));
  const selectedRows = rows.filter((row, index) => selectedRowKeys.has(rowKey(row, index)));
  const selectedVisibleKeys = visibleRowKeys.filter((key) => selectedRowKeys.has(key));
  const allVisibleSelected = bulkSelectable && Boolean(visibleRowKeys.length) && selectedVisibleKeys.length === visibleRowKeys.length;
  const someVisibleSelected = bulkSelectable && selectedVisibleKeys.length > 0 && !allVisibleSelected;

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  useEffect(() => {
    const allKeys = new Set(rows.map((row, index) => String(row.id ?? row.code ?? row.name ?? row.reference ?? row.ticketNo ?? row.woNo ?? index)));
    setSelectedRowKeys((current) => new Set(Array.from(current).filter((key) => allKeys.has(key))));
  }, [rows]);

  function toggleVisibleRows(checked: boolean) {
    setSelectedRowKeys((current) => {
      const next = new Set(current);
      visibleRows.forEach((row, index) => {
        const key = rowKey(row, startIndex + index);
        if (checked) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  }

  function toggleRow(key: string, checked: boolean) {
    setSelectedRowKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function deleteSelectedRows() {
    if (!onBulkDelete || !selectedRows.length) return;
    await onBulkDelete(selectedRows);
    setSelectedRowKeys(new Set());
  }

  return (
    <div className="grid gap-3">
      {bulkSelectable && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">
          <span>Selected {selectedRowKeys.size.toLocaleString()} {bulkLabel}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => toggleVisibleRows(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-lagoon">Select Visible</button>
            <button type="button" disabled={!selectedRowKeys.size || !onBulkDelete} onClick={deleteSelectedRows} className="rounded-lg bg-coral px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Delete All</button>
            <button type="button" disabled={!selectedRowKeys.size} onClick={() => setSelectedRowKeys(new Set())} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">Clear Selection</button>
          </div>
        </div>
      )}
      <div className="cafm-scroll-x overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
        <table className="cafm-data-table min-w-max border-collapse bg-white text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {bulkSelectable && (
                <th className="whitespace-nowrap px-3 py-3 font-black">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someVisibleSelected;
                    }}
                    onChange={(event) => toggleVisibleRows(event.target.checked)}
                  />
                </th>
              )}
              <th className="whitespace-nowrap px-3 py-3 font-black">#</th>
              {columns.map(([, label]) => (
                <th key={label} className="whitespace-nowrap px-3 py-3 font-black">
                  {label}
                </th>
              ))}
              {actions && <th className="whitespace-nowrap px-3 py-3 font-black">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={row.id ?? index} className="border-t border-slate-100">
                {bulkSelectable && (
                  <td className="whitespace-nowrap px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRowKeys.has(rowKey(row, startIndex + index))}
                      onChange={(event) => toggleRow(rowKey(row, startIndex + index), event.target.checked)}
                    />
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-3 font-black text-slate-500">{startIndex + index + 1}</td>
                {columns.map(([key]) => (
                  <td key={key} className="max-w-[360px] whitespace-nowrap px-3 py-3">
                    {renderCell?.(row, key) ?? <CellValue value={row[key]} field={key} />}
                  </td>
                ))}
                {actions && <td className="whitespace-nowrap px-3 py-3">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={rows.length} />
    </div>
  );
}

function PaginationControls({ page, totalPages, totalItems, onPageChange }: { page: number; totalPages: number; totalItems: number; onPageChange: (page: number) => void }) {
  if (totalItems === 0) return <p className="text-sm font-bold text-slate-500">No entries found.</p>;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
      <p className="text-sm font-bold text-slate-600">
        Page {page} of {totalPages} / {totalItems} entries / {PAGE_SIZE} per page
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => onPageChange(item)}
            className={`h-9 min-w-9 rounded-lg px-3 text-sm font-black ${item === page ? "bg-lagoon text-white" : "border border-slate-200 bg-white text-slate-700"}`}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function CellValue({ value, field = "" }: { value: any; field?: string }) {
  if (value === null || value === undefined) return <span className="text-slate-400">-</span>;
  if (isCurrencyField(field)) return <CurrencyAmount value={value} />;
  if (typeof value === "string" && (value.startsWith("/uploads/") || value.startsWith("/api/files/") || value.startsWith("http://") || value.startsWith("https://"))) {
    return <a href={value} target="_blank" rel="noreferrer" className="font-black text-lagoon underline-offset-2 hover:underline">{value.split("/").pop() || "Open file"}</a>;
  }
  if (typeof value === "string" && ["CRITICAL", "HIGH", "EXTREME"].includes(value)) return <span className="rounded-lg bg-coral/10 px-2 py-1 font-black text-coral">{value}</span>;
  if (typeof value === "string" && ["COMPLETED", "CLOSED", "ACTIVE"].includes(value)) return <span className="rounded-lg bg-leaf/10 px-2 py-1 font-black text-leaf">{value}</span>;
  if (typeof value === "string" && isDateLikeString(value)) return new Date(value).toLocaleDateString();
  if (typeof value === "object") return value.name ?? value.tag ?? JSON.stringify(value);
  return String(value);
}

function ActionForm({ title, fields, onSubmit, saving }: { title: string; fields: string[]; onSubmit: (formData: FormData) => void; saving: boolean }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(new FormData(form));
    form.reset();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-white/80 bg-white p-5 shadow-lift"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-sun/50 text-amber-700">
          <PackagePlus size={20} />
        </div>
        <h3 className="text-xl font-black">{title}</h3>
      </div>
      <div className="grid gap-3">
        {fields.map((field) => (
          <label key={field} className="grid gap-1 text-sm font-bold capitalize text-slate-600">
            {actionFieldLabel(field)}
            {field === "description" || field === "jobPlan" ? (
              <textarea name={field} className="min-h-24 rounded-lg border border-slate-200 p-3 outline-none focus:border-lagoon" />
            ) : field === "warrantyExpiry" ? (
              <input name={field} type="date" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
            ) : field === "statutory" ? (
              <select name={field} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            ) : field === "outOfService" || field === "residential" ? (
              <select name={field} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
                <option value="NO">NO</option>
                <option value="YES">YES</option>
              </select>
            ) : field === "priority" || field === "criticality" ? (
              <select name={field} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
                <option>CRITICAL</option>
              </select>
            ) : field === "risk" ? (
              <select name={field} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon">
                <option>LOW</option>
                <option>MODERATE</option>
                <option>HIGH</option>
                <option>EXTREME</option>
              </select>
            ) : (
              <input name={field} className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
            )}
          </label>
        ))}
        <button disabled={saving} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
          <Plus size={18} />
          {saving ? "Saving..." : "Submit"}
        </button>
      </div>
    </form>
  );
}

function actionFieldLabel(field: string) {
  const labels: Record<string, string> = {
    location: "Location",
    locationClass: "Class",
    parentLocation: "Parent Location",
    outOfService: "Out of Service",
    residential: "Residential",
  };
  return labels[field] || field.replace(/([A-Z])/g, " $1");
}
