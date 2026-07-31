import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
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

function inputCode(input: ServiceInput, fallbackIndex: number) {
  const departmentCode = cleanCode(input.departmentCode || input.category || input.departmentName);
  const sourceCode = cleanCode(input.code || input.serviceCode);
  if (sourceCode) return sourceCode.startsWith(`${departmentCode}-`) || !departmentCode ? sourceCode : `${departmentCode}-${sourceCode}`;
  return departmentCode || `SRV-${String(fallbackIndex).padStart(4, "0")}`;
}

async function servicePayload(input: ServiceInput) {
  const team = input.teamCode ? await prisma.team.findUnique({ where: { code: input.teamCode } }) : null;
  const departmentCode = cleanCode(input.departmentCode || input.category || input.departmentName);
  const name = input.name || input.departmentName || input.description || input.serviceCode || input.code || "General Service";
  return {
    name,
    category: departmentCode || input.category || name,
    type: input.type || "Service Code",
    priority: normalizePriority(input.priority),
    slaHours: input.slaHours || 24,
    teamId: team?.id,
    description: input.description || name,
  };
}

export async function GET() {
  return NextResponse.json(await prisma.serviceCatalog.findMany({ include: { team: true }, orderBy: [{ category: "asc" }, { code: "asc" }, { name: "asc" }] }));
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requirePermission("requests.manage");
    if (error) return error;
    const input = schema.parse(await request.json());
    const count = await prisma.serviceCatalog.count();
    const code = inputCode(input, count + 1);
    const payload = await servicePayload(input);
    const created = await prisma.serviceCatalog.upsert({
      where: { code },
      update: payload,
      create: { code, ...payload },
      include: { team: true },
    });
    await auditAction({ user, action: "SERVICE_SAVE", entity: "service_catalog", entityId: created.id, details: { input, savedRecord: created } });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error, "Unable to save service code");
  }
}
