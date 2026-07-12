import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAdmin, requirePermission } from "@/lib/api-auth";
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
  status: z.string().optional(),
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requirePermission("assets.manage");
    if (error) return error;
    const { id } = await params;
    const input = schema.parse(await request.json());
    const current = await prisma.asset.findUnique({ where: { id } });
    if (!current) throw new Error("Asset not found");
    const tag = input.tag || input.equipmentNo || current.tag;
    const location = input.locationCode ? await prisma.location.findUnique({ where: { code: input.locationCode } }) : null;
    const name = input.name || input.equipmentDesc || input.assetDescription || current.name;
    const category = input.category || input.categoryDesc || input.assetGroup || input.classCode || current.category;
    const criticality = input.criticality && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(input.criticality) ? input.criticality as any : current.criticality;
    const status = input.outOfService === true ? "RETIRED" as any : input.outOfService === false ? "ACTIVE" as any : input.status && ["ACTIVE", "STANDBY", "DOWN", "RETIRED"].includes(input.status) ? input.status as any : current.status;
    const updated = await prisma.asset.update({
      where: { id },
      data: {
        tag,
        name,
        category,
        system: input.primarySystem || input.system || current.system,
        eqType: input.eqType,
        organization: input.organization,
        criticality,
        status,
        assetStatusText: input.assetStatusText || input.assetStatus || current.assetStatusText,
        serialNumber: input.serialNumber || current.serialNumber,
        siteCode: input.siteCode || location?.site || null,
        zone: input.zone || location?.parentLocation || null,
        buildingCode: input.buildingCode || location?.building || null,
        assetGroup: input.assetGroup || input.classCode || category,
        assetDescription: input.assetDescription || input.equipmentDesc || name,
        additionalDescription: input.additionalDescription || input.additionalNote || null,
        departmentDesc: input.departmentDesc,
        classCode: input.classCode,
        classDesc: input.classDesc,
        categoryDesc: input.categoryDesc,
        gsrc: input.gsrc,
        attribute: input.attribute,
        environment: input.environment,
        pressureBar: input.pressureBar,
        flowLps: input.flowLps,
        supplyVoltageVolt: input.supplyVoltageVolt,
        outOfService: input.outOfService,
        serviceLife: input.serviceLife,
        locationCode: input.locationCode,
        locationDesc: input.locationDesc || location?.description,
        position: input.position,
        classOrganization: input.classOrganization,
        primarySystem: input.primarySystem,
        additionalNote: input.additionalNote,
        parentAsset: input.parentAsset || current.parentAsset,
        departmentCode: input.departmentCode || current.departmentCode,
        assignedTeamCode: input.assignedTeamCode || current.assignedTeamCode,
        assignedSupervisorEmail: input.assignedSupervisorEmail || current.assignedSupervisorEmail,
        remarks: input.remarks || current.remarks,
        manufacturer: input.manufacturer || current.manufacturer,
        model: input.model || current.model,
        installDate: input.installDate ? new Date(input.installDate) : current.installDate,
        replacementDate: input.replacementDate ? new Date(input.replacementDate) : current.replacementDate,
        floor: input.floor || location?.floor || null,
        room: input.room || location?.room || location?.code || input.locationCode || null,
        warrantyExpiry: input.warrantyExpiry ? new Date(input.warrantyExpiry) : current.warrantyExpiry,
        contractRef: input.contractRef || current.contractRef,
        documentationUrl: input.documentationUrl || current.documentationUrl,
        purchaseCost: input.equipmentValue ?? input.purchaseCost ?? current.purchaseCost,
        salvageValue: input.salvageValue ?? current.salvageValue,
        depreciationRate: input.depreciationRate ?? current.depreciationRate,
        conditionScore: input.conditionScore ?? current.conditionScore,
        qrCode: input.qrCode || `CAFM-ASSET:${tag}`,
      },
    });

    await prisma.assetHistory.create({
      data: {
        assetId: updated.id,
        eventType: "ASSET_UPDATE",
        title: "Asset master updated",
        details: `Updated asset ${updated.tag}. Status: ${updated.status}. Team: ${updated.assignedTeamCode || "Unassigned"}.`,
        actor: "Admin",
      },
    });
    await auditAction({ user, action: "ASSET_UPDATE", entity: "asset", entityId: id, details: { before: current, input, after: updated } });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, "Unable to update asset");
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requireAdmin();
    if (error) return error;
    const { id } = await params;
    const current = await prisma.asset.findUnique({ where: { id } });
    if (!current) throw new Error("Asset not found");
    await prisma.asset.delete({ where: { id } });
    await auditAction({ user, action: "ASSET_DELETE", entity: "asset", entityId: id, details: { deletedRecord: current } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to delete asset");
  }
}
