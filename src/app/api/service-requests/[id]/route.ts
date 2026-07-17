import { NextResponse } from "next/server";
import { z } from "zod";
import { addHours } from "date-fns";
import { apiError } from "@/lib/api-response";
import { requireAdmin, requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const booleanInput = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean()).optional();

const schema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  departmentCode: z.string().optional(),
  serviceCode: z.string().optional(),
  assignedTeamCode: z.string().optional(),
  requester: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  location: z.string().optional(),
  attachmentUrls: z.string().optional(),
  rejectionReason: z.string().optional(),
  description: z.string().optional(),
  isIncidentCase: booleanInput,
});

const slaByPriority = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 12,
  CRITICAL: 4,
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = schema.parse(await request.json());
    const permissionCode = ["APPROVED", "REJECTED", "VERIFIED", "CLOSED"].includes(String(input.status || "")) ? "servicerequests.approve" : "servicerequests.edit";
    const { error: permissionError } = await requirePermission(permissionCode);
    if (permissionError) return permissionError;
    const current = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!current) throw new Error("Service request not found");
    const user = await getCurrentUser();
    const priority = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(input.priority || "") ? input.priority as keyof typeof slaByPriority : current.priority;
    const status = input.status && ["OPEN", "NEW", "TRIAGED", "APPROVED", "REJECTED", "PENDING_ASSIGNMENT", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "VERIFIED", "REOPENED", "CLOSED"].includes(input.status) ? input.status as any : current.status;
    const slaHours = slaByPriority[priority];
    const department = input.departmentCode ? await prisma.department.findUnique({ where: { code: input.departmentCode } }) : null;
    const supervisor = input.departmentCode
      ? await prisma.user.findFirst({
          where: {
            role: { contains: "Supervisor", mode: "insensitive" },
            department: { in: [input.departmentCode, department?.name ?? input.departmentCode] },
          },
        })
      : null;
    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: {
        title: input.title || current.title,
        category: input.category || current.category || "General",
        departmentCode: input.departmentCode || null,
        serviceCode: input.serviceCode || null,
        assignedTeamCode: input.assignedTeamCode || null,
        requester: input.requester || current.requester || "Requester",
        priority,
        status,
        location: input.location || current.location || "Unassigned",
        attachmentUrls: input.attachmentUrls || null,
        rejectionReason: input.rejectionReason || null,
        description: input.description || current.description || "No description provided.",
        isIncidentCase: input.isIncidentCase ?? current.isIncidentCase,
        assignedSupervisorEmail: supervisor?.email || null,
        slaHours,
        dueAt: addHours(new Date(), slaHours),
        reviewedAt: ["TRIAGED", "APPROVED", "REJECTED"].includes(status) ? new Date() : undefined,
        approvedAt: status === "APPROVED" ? new Date() : undefined,
      },
    });
    await auditAction({ user, action: `SERVICE_REQUEST_${status}`, entity: "service_request", entityId: id, details: { before: current, input, after: updated } });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, "Unable to update service request");
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requireAdmin();
    if (error) return error;
    const { id } = await params;
    const current = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!current) throw new Error("Service request not found");
    await prisma.serviceRequest.delete({ where: { id } });
    await auditAction({ user, action: "SERVICE_REQUEST_DELETE", entity: "service_request", entityId: id, details: { deletedRecord: current } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to delete service request");
  }
}

