import { NextResponse } from "next/server";
import { addHours } from "date-fns";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const dueHours = { LOW: 120, MEDIUM: 72, HIGH: 24, CRITICAL: 6 };

export async function POST(requestBody: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await requestBody.json().catch(() => ({}));
    const request = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!request) throw new Error("Service request not found");
    const { error: permissionError, user } = await requirePermission("servicerequests.assign");
    if (permissionError) return permissionError;
    const existingWorkOrder = await prisma.workOrder.findUnique({ where: { requestId: id } });
    if (existingWorkOrder) {
      return NextResponse.json(existingWorkOrder);
    }

    const selectedAsset = body.assetTag ? await prisma.asset.findUnique({ where: { tag: String(body.assetTag) } }) : null;
    const assignedTeamCode = body.assignedTeamCode || request.assignedTeamCode || selectedAsset?.assignedTeamCode || null;
    const [count] = await Promise.all([
      prisma.workOrder.count(),
    ]);

    const workOrder = await prisma.workOrder.create({
      data: {
        woNo: `WO-${String(count + 81001).padStart(5, "0")}`,
        title: request.title,
        type: "Reactive",
        assetType: selectedAsset?.assetGroup || selectedAsset?.category || request.category,
        departmentCode: request.departmentCode || selectedAsset?.departmentCode,
        serviceCode: request.serviceCode,
        assignedTeamCode,
        priority: request.priority,
        status: assignedTeamCode ? "ASSIGNED" : "PENDING_ASSIGNMENT",
        assetId: selectedAsset?.id,
        requestId: request.id,
        assignedToId: null,
        plannedStart: new Date(),
        dueAt: addHours(new Date(), dueHours[request.priority]),
        estimatedHours: request.priority === "CRITICAL" ? 2 : 4,
        cost: 0,
        jobPlan: [
          request.description,
          selectedAsset ? `Asset: ${selectedAsset.tag} - ${selectedAsset.assetDescription || selectedAsset.name}` : "",
          selectedAsset ? `Location: ${[selectedAsset.buildingCode, selectedAsset.floor, selectedAsset.room].filter(Boolean).join(" > ")}` : `Location: ${request.location}`,
        ].filter(Boolean).join("\n"),
        safetyNotes: "Supervisor to verify access, PPE, isolation and permits before dispatch.",
        isIncidentCase: request.isIncidentCase,
      },
    });

    if (selectedAsset) {
      await prisma.assetHistory.create({
        data: {
          assetId: selectedAsset.id,
          eventType: "SERVICE_REQUEST_CONVERTED",
          title: `${workOrder.woNo} created from ${request.ticketNo}`,
          details: `${request.title} assigned to ${assignedTeamCode || "unassigned team"} from supervisor review.`,
          actor: user?.name || user?.email || "Supervisor",
        },
      });
    }

    const updatedRequest = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        assignedTeamCode,
        approvedAt: new Date(),
        reviewedAt: new Date(),
      },
    });
    await auditAction({
      user,
      action: "SERVICE_REQUEST_CONVERT_TO_WORK_ORDER",
      entity: "service_request",
      entityId: id,
      details: { input: body, sourceRequest: request, selectedAsset, createdWorkOrder: workOrder, updatedRequest },
    });
    return NextResponse.json(workOrder, { status: 201 });
  } catch (error) {
    return apiError(error, "Unable to convert request to work order");
  }
}

