import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { accessRole, canManageDepartmentRecord, scopeAllows } from "@/lib/access-control";
import { requireAdmin, requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { defaultPermissionScopeForRole, expandPermissionCode } from "@/lib/default-role-permissions";
import { prisma } from "@/lib/prisma";

const booleanInput = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean()).optional();

const schema = z.object({
  title: z.string().optional(),
  type: z.string().optional(),
  assetType: z.string().optional(),
  departmentCode: z.string().optional(),
  serviceCode: z.string().optional(),
  assignedTeamCode: z.string().optional(),
  assignedToEmail: z.string().optional(),
  jobPlanCode: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  assetTag: z.string().optional(),
  jobPlan: z.string().optional(),
  safetyNotes: z.string().optional(),
  estimatedHours: z.coerce.number().optional(),
  cost: z.coerce.number().optional(),
  responseAt: z.string().optional(),
  resolutionAt: z.string().optional(),
  finishedAt: z.string().optional(),
  photoUrls: z.string().optional(),
  assetsUsed: z.string().optional(),
  inventoryUsed: z.string().optional(),
  supervisorRequest: z.string().optional(),
  workNotes: z.string().optional(),
  materialRequest: z.string().optional(),
  rejectionReason: z.string().optional(),
  supervisorDecision: z.string().optional(),
  isIncidentCase: booleanInput,
});

function parseParts(value?: string) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sku, qty] = line.split(":").map((part) => part.trim());
      return { sku, quantity: Math.max(1, Number.parseInt(qty || "1", 10) || 1) };
    })
    .filter((item) => item.sku);
}

async function workOrderPermissionScope(role: string | null | undefined, code: string) {
  const roleName = role || "";
  const assigned = await prisma.rolePermission.findFirst({
    where: { role: roleName, permission: { code: { in: expandPermissionCode(code) } } },
    select: { scope: true },
  });
  return assigned?.scope ?? defaultPermissionScopeForRole(roleName, code);
}
function partQuantities(value?: string) {
  return parseParts(value).reduce((acc, part) => {
    acc.set(part.sku, (acc.get(part.sku) ?? 0) + part.quantity);
    return acc;
  }, new Map<string, number>());
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = schema.parse(await request.json());
    const current = await prisma.workOrder.findUnique({ where: { id }, include: { asset: true } });
    if (!current) throw new Error("Work order not found");
    const priority = input.priority && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(input.priority) ? input.priority as any : undefined;
    const status = input.status && ["OPEN", "NEW", "TRIAGED", "APPROVED", "REJECTED", "PENDING_ASSIGNMENT", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "PENDING_SUPERVISOR_REVIEW", "VERIFIED", "REOPENED", "CLOSED"].includes(input.status) ? input.status as any : undefined;
    const reviewStatus = status && ["CLOSED", "REOPENED", "VERIFIED"].includes(status);
    const permissionCode = reviewStatus ? "workorders.approve" : "workorders.edit";
    const { error: permissionError, user } = await requirePermission(permissionCode);
    if (permissionError) return permissionError;
    const role = accessRole(user);
    const isAssignedTechnician = role === "technician" && (current.assignedToId === user?.id || Boolean(current.assignedTeamCode && current.assignedTeamCode === user?.team?.code));
    const reviewScope = reviewStatus ? await workOrderPermissionScope(user?.role, "workorders.approve") : null;
    const supervisorDepartment = String(user?.department ?? "").trim().toLowerCase();
    const isGenericSupervisor = role === "supervisor" && (!supervisorDepartment || ["general", "all", "fbc"].includes(supervisorDepartment));
    const isSupervisorTeamOwner = role === "supervisor" && (current.assignedToId === user?.id || Boolean(current.assignedTeamCode && current.assignedTeamCode === user?.team?.code));
    const isSupervisorOrAdmin = canManageDepartmentRecord(user, current.departmentCode) || isGenericSupervisor || isSupervisorTeamOwner || Boolean(reviewStatus && scopeAllows(reviewScope, "Facility"));
    if (!isSupervisorOrAdmin && !isAssignedTechnician) {
      return apiError(new Error("You do not have permission for this work order."), "Access denied", 403);
    }
    if (current.status === "CLOSED") {
      return apiError(new Error("Closed work orders are read-only."), "Closed work order is read-only", 403);
    }
    const nextStatus = status === "COMPLETED" ? "PENDING_SUPERVISOR_REVIEW" as any : status;
    const [asset] = await Promise.all([
      input.assetTag ? prisma.asset.findUnique({ where: { tag: input.assetTag } }) : null,
    ]);
    if (isAssignedTechnician && status && !["IN_PROGRESS", "ON_HOLD", "COMPLETED"].includes(status)) {
      return apiError(new Error("Service Team can only update status to In Progress, On Hold, or Completed."), "Access denied", 403);
    }
    if (isAssignedTechnician && (input.assignedTeamCode || input.assignedToEmail || input.departmentCode || input.priority || input.cost || input.supervisorDecision)) {
      return apiError(new Error("Service Team cannot assign, reassign, change priority, cost, or approve requests."), "Access denied", 403);
    }
    if (isSupervisorOrAdmin && status === "REOPENED" && (!input.rejectionReason?.trim() || !input.supervisorDecision?.trim())) {
      return apiError(new Error("Reopen reason and remarks are required."), "Reopen reason and remarks are required", 400);
    }
    const updateData = isAssignedTechnician
      ? {
          status: nextStatus,
          responseAt: input.responseAt ? new Date(input.responseAt) : status === "IN_PROGRESS" && !current.responseAt ? new Date() : undefined,
          resolutionAt: input.resolutionAt ? new Date(input.resolutionAt) : status === "COMPLETED" ? new Date() : undefined,
          photoUrls: input.photoUrls,
          assetsUsed: input.assetsUsed,
          inventoryUsed: input.inventoryUsed,
          supervisorRequest: input.supervisorRequest,
          workNotes: input.workNotes,
          materialRequest: input.materialRequest,
          isIncidentCase: input.isIncidentCase,
          actualHours: status === "COMPLETED" ? 4 : undefined,
        }
      : {
          title: input.title,
          type: input.type,
          assetType: input.assetType,
          departmentCode: input.departmentCode,
          serviceCode: input.serviceCode,
          assignedTeamCode: input.assignedTeamCode,
          jobPlanCode: input.jobPlanCode,
          priority,
          status: nextStatus,
          assetId: asset?.id,
          assignedToId: input.assignedTeamCode ? null : undefined,
          jobPlan: input.jobPlan,
          safetyNotes: input.safetyNotes,
          estimatedHours: input.estimatedHours,
          cost: input.cost,
          responseAt: input.responseAt ? new Date(input.responseAt) : status === "IN_PROGRESS" && !current.responseAt ? new Date() : undefined,
          resolutionAt: input.resolutionAt ? new Date(input.resolutionAt) : (status === "COMPLETED" || status === "PENDING_SUPERVISOR_REVIEW") ? new Date() : undefined,
          finishedAt: input.finishedAt ? new Date(input.finishedAt) : status === "CLOSED" ? new Date() : undefined,
          photoUrls: input.photoUrls,
          assetsUsed: input.assetsUsed,
          inventoryUsed: input.inventoryUsed,
          supervisorRequest: input.supervisorRequest,
          workNotes: input.workNotes,
          materialRequest: input.materialRequest,
          rejectionReason: input.rejectionReason,
          supervisorDecision: status === "CLOSED"
            ? `${input.supervisorDecision?.trim() || "Closed after supervisor verification."}\nClosed by: ${user?.name || user?.email || "Supervisor"}`
            : input.supervisorDecision,
          verifiedAt: status === "VERIFIED" || status === "CLOSED" ? new Date() : undefined,
          isIncidentCase: input.isIncidentCase,
          actualHours: status && ["COMPLETED", "PENDING_SUPERVISOR_REVIEW", "VERIFIED", "CLOSED"].includes(status) ? 4 : undefined,
        };
    if (!isSupervisorOrAdmin && (status === "CLOSED" || status === "REOPENED")) {
      return apiError(new Error("Only Supervisor or Admin can close or reopen work orders."), "Access denied", 403);
    }
    const updated = await prisma.workOrder.update({
      where: { id },
      data: updateData,
    });

    if (input.inventoryUsed !== undefined && input.inventoryUsed !== current.inventoryUsed) {
      const previous = partQuantities(current.inventoryUsed ?? "");
      const next = partQuantities(input.inventoryUsed);
      for (const [sku, quantity] of next.entries()) {
        const delta = quantity - (previous.get(sku) ?? 0);
        if (delta <= 0) continue;
        const item = await prisma.inventoryItem.findUnique({ where: { sku } });
        if (!item) continue;
        await prisma.$transaction([
          prisma.inventoryIssue.create({ data: { itemId: item.id, workId: id, quantity: delta } }),
          prisma.inventoryItem.update({ where: { id: item.id }, data: { onHand: Math.max(0, item.onHand - delta) } }),
        ]);
      }
    }

    if (current.assetId && (status || input.inventoryUsed || input.workNotes)) {
      await prisma.assetHistory.create({
        data: {
          assetId: current.assetId,
          eventType: status ? "WORK_ORDER_STATUS" : "WORK_ORDER_UPDATE",
          title: `${updated.woNo} ${status ? `moved to ${String(nextStatus).replaceAll("_", " ")}` : "updated"}`,
          details: [
            input.workNotes ? `Notes: ${input.workNotes}` : "",
            input.inventoryUsed ? `Parts used: ${input.inventoryUsed}` : "",
            input.materialRequest ? `Material request: ${input.materialRequest}` : "",
          ].filter(Boolean).join("\n") || `Work order ${updated.woNo} updated.`,
          actor: user?.name || user?.email || "System",
        },
      });
    }

    if (updated.requestId && status === "CLOSED") {
      await prisma.serviceRequest.update({ where: { id: updated.requestId }, data: { status: "CLOSED" } });
    }
    await auditAction({ user, action: `WORK_ORDER_${nextStatus || "UPDATE"}`, entity: "work_order", entityId: id, details: { before: current, input, after: updated } });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, "Unable to update work order");
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requireAdmin();
    if (error) return error;
    const { id } = await params;
    const current = await prisma.workOrder.findUnique({ where: { id } });
    if (!current) throw new Error("Work order not found");
    await prisma.workOrder.delete({ where: { id } });
    await auditAction({ user, action: "WORK_ORDER_DELETE", entity: "work_order", entityId: id, details: { deletedRecord: current } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to delete work order");
  }
}


