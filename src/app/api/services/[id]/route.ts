import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAdmin, requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  code: z.string().optional(),
  serviceCode: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  type: z.string().optional(),
  priority: z.string().optional(),
  departmentName: z.string().optional(),
  departmentCode: z.string().optional(),
  teamCode: z.string().optional(),
  slaHours: z.coerce.number().optional(),
});

type ServiceInput = z.infer<typeof schema>;

function normalizePriority(value?: string) {
  const normalized = String(value || "MEDIUM").trim().toUpperCase();
  if (["URGENT", "EMERGENCY", "CRITICAL", "P1"].includes(normalized)) return "CRITICAL" as const;
  if (["IMPORTANT", "HIGH", "P2"].includes(normalized)) return "HIGH" as const;
  if (["LOW", "P4"].includes(normalized)) return "LOW" as const;
  return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(normalized)
    ? normalized as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    : "MEDIUM";
}

function cleanCode(value?: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inputCode(input: ServiceInput, currentCode: string) {
  const departmentCode = cleanCode(input.departmentCode || input.category || input.departmentName);
  const sourceCode = cleanCode(input.code || input.serviceCode);
  if (sourceCode) return sourceCode.startsWith(`${departmentCode}-`) || !departmentCode ? sourceCode : `${departmentCode}-${sourceCode}`;
  return departmentCode || currentCode;
}

async function serviceData(input: ServiceInput, currentCode: string) {
  const team = input.teamCode ? await prisma.team.findUnique({ where: { code: input.teamCode } }) : null;
  const departmentCode = cleanCode(input.departmentCode || input.category || input.departmentName);
  const name = input.name || input.departmentName || input.description || input.serviceCode || input.code || "General Service";
  return {
    code: inputCode(input, currentCode),
    name,
    category: departmentCode || input.category || name,
    type: input.type || "Service Code",
    priority: normalizePriority(input.priority),
    slaHours: input.slaHours || 24,
    teamId: team?.id,
    description: input.description || name,
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requirePermission("requests.manage");
    if (error) return error;
    const { id } = await params;
    const input = schema.parse(await request.json());
    const current = await prisma.serviceCatalog.findUnique({ where: { id } });
    if (!current) throw new Error("Service code not found");
    const service = await prisma.serviceCatalog.update({
      where: { id },
      data: await serviceData(input, current.code),
      include: { team: true },
    });
    await auditAction({ user, action: "SERVICE_UPDATE", entity: "service_catalog", entityId: id, details: { before: current, input, after: service } });
    return NextResponse.json(service);
  } catch (error) {
    return apiError(error, "Unable to update service code");
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requireAdmin();
    if (error) return error;
    const { id } = await params;
    const current = await prisma.serviceCatalog.findUnique({ where: { id } });
    if (!current) throw new Error("Service code not found");
    await prisma.serviceCatalog.delete({ where: { id } });
    await auditAction({ user, action: "SERVICE_DELETE", entity: "service_catalog", entityId: id, details: { deletedRecord: current } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to delete service code");
  }
}
