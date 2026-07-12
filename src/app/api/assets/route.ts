import { NextResponse } from "next/server";
import { addYears } from "date-fns";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const boolInput = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["yes", "true", "1", "y"].includes(normalized)) return true;
    if (["no", "false", "0", "n", ""].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const schema = z.object({
  tag: z.string().optional(),
  equipmentNo: z.string().optional(),
  name: z.string().optional(),
  equipmentDesc: z.string().optional(),
  category: z.string().optional(),
  system: z.string().optional(),
  eqType: z.string().optional(),
  organization: z.string().optional(),
  criticality: z.string().optional(),
  assetStatusText: z.string().optional(),
  assetStatus: z.string().optional(),
  serialNumber: z.string().optional(),
  siteCode: z.string().optional(),
  zone: z.string().optional(),
  buildingCode: z.string().optional(),
  assetGroup: z.string().optional(),
  assetDescription: z.string().optional(),
  additionalDescription: z.string().optional(),
  departmentDesc: z.string().optional(),
  classCode: z.string().optional(),
  classDesc: z.string().optional(),
  categoryDesc: z.string().optional(),
  gsrc: z.string().optional(),
  attribute: z.string().optional(),
  environment: z.string().optional(),
  pressureBar: z.string().optional(),
  flowLps: z.string().optional(),
  supplyVoltageVolt: z.string().optional(),
  outOfService: boolInput.optional(),
  serviceLife: z.string().optional(),
  locationCode: z.string().optional(),
  locationDesc: z.string().optional(),
  position: z.string().optional(),
  classOrganization: z.string().optional(),
  equipmentValue: z.coerce.number().min(0).optional(),
  primarySystem: z.string().optional(),
  additionalNote: z.string().optional(),
  parentAsset: z.string().optional(),
  departmentCode: z.string().optional(),
  assignedTeamCode: z.string().optional(),
  assignedSupervisorEmail: z.string().optional(),
  remarks: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  installDate: z.string().optional(),
  replacementDate: z.string().optional(),
  floor: z.string().optional(),
  room: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  qrCode: z.string().optional(),
  contractRef: z.string().optional(),
  documentationUrl: z.string().optional(),
  purchaseCost: z.coerce.number().min(0).optional(),
  salvageValue: z.coerce.number().min(0).optional(),
  depreciationRate: z.coerce.number().min(0).max(100).optional(),
  conditionScore: z.coerce.number().min(0).max(100).optional(),
});

export async function POST(request: Request) {
  try {
    const { error, user } = await requirePermission("assets.manage");
    if (error) return error;
    const input = schema.parse(await request.json());
    const count = await prisma.asset.count();
    const tag = input.tag || input.equipmentNo || `AST-${String(count + 1).padStart(5, "0")}`;
    const location = input.locationCode ? await prisma.location.findUnique({ where: { code: input.locationCode } }) : null;
    const name = input.name || input.equipmentDesc || input.assetDescription || `Asset ${count + 1}`;
    const category = input.category || input.categoryDesc || input.assetGroup || input.classCode || "General";
    const criticality = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(input.criticality || "") ? input.criticality as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" : "MEDIUM";
    const outOfService = input.outOfService ?? false;
    const status = outOfService ? "RETIRED" : "ACTIVE";
    const site = await prisma.site.findFirst({ include: { buildings: { take: 1 } } });

    if (!site) {
      return apiError(new Error("Create or seed a site before adding assets."), "No site available", 400);
    }

    const created = await prisma.asset.create({
      data: {
        tag,
        name,
        category,
        system: input.primarySystem || input.system || "General",
        eqType: input.eqType || "ASSET",
        organization: input.organization || null,
        criticality,
        status,
        assetStatusText: input.assetStatusText || input.assetStatus || (outOfService ? "OUT OF SERVICE" : "INSTALLED"),
        serialNumber: input.serialNumber || `${tag}-SN`,
        siteCode: input.siteCode || location?.site || null,
        zone: input.zone || location?.parentLocation || null,
        buildingCode: input.buildingCode || location?.building || null,
        assetGroup: input.assetGroup || input.classCode || category,
        assetDescription: input.assetDescription || input.equipmentDesc || name,
        additionalDescription: input.additionalDescription || input.additionalNote || null,
        departmentDesc: input.departmentDesc || null,
        classCode: input.classCode || null,
        classDesc: input.classDesc || null,
        categoryDesc: input.categoryDesc || null,
        gsrc: input.gsrc || null,
        attribute: input.attribute || null,
        environment: input.environment || null,
        pressureBar: input.pressureBar || null,
        flowLps: input.flowLps || null,
        supplyVoltageVolt: input.supplyVoltageVolt || null,
        outOfService,
        serviceLife: input.serviceLife || null,
        locationCode: input.locationCode || null,
        locationDesc: input.locationDesc || location?.description || null,
        position: input.position || null,
        classOrganization: input.classOrganization || null,
        primarySystem: input.primarySystem || null,
        additionalNote: input.additionalNote || null,
        parentAsset: input.parentAsset || "TOP LEVEL",
        departmentCode: input.departmentCode || null,
        assignedTeamCode: input.assignedTeamCode || null,
        assignedSupervisorEmail: input.assignedSupervisorEmail || null,
        remarks: input.remarks || null,
        manufacturer: input.manufacturer || "Not specified",
        model: input.model || "Not specified",
        installDate: input.installDate ? new Date(input.installDate) : new Date(),
        replacementDate: input.replacementDate ? new Date(input.replacementDate) : addYears(new Date(), 8),
        warrantyExpiry: input.warrantyExpiry ? new Date(input.warrantyExpiry) : addYears(new Date(), 1),
        contractRef: input.contractRef || "Not assigned",
        documentationUrl: input.documentationUrl || null,
        purchaseCost: input.equipmentValue ?? input.purchaseCost ?? 0,
        salvageValue: input.salvageValue ?? 0,
        depreciationRate: input.depreciationRate ?? 10,
        conditionScore: input.conditionScore ?? 85,
        floor: input.floor || location?.floor || "Unassigned",
        room: input.room || location?.room || location?.code || input.locationCode || "Unassigned",
        qrCode: input.qrCode || `CAFM-ASSET:${tag}`,
        siteId: site.id,
        buildingId: site.buildings[0]?.id,
      },
    });

    await auditAction({ user, action: "ASSET_CREATE", entity: "asset", entityId: created.id, details: { input, createdRecord: created } });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error, "Unable to create asset");
  }
}
