import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().optional(),
  role: z.string().min(2),
  department: z.string().optional(),
  supervisorEmail: z.string().optional(),
  notifyWorkOrder: z.coerce.boolean().optional(),
  notifyFacilityBooking: z.coerce.boolean().optional(),
  teamCode: z.string().optional(),
  active: z.coerce.boolean().optional(),
});

export async function GET(request: Request) {
  const { error } = await requirePermission("users.manage");
  if (error) return error;
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() || "";
  const pageInput = Number(url.searchParams.get("page") || 1);
  const pageSizeInput = Number(url.searchParams.get("pageSize") || 100);
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const pageSize = Number.isFinite(pageSizeInput) ? Math.min(200, Math.max(25, Math.floor(pageSizeInput))) : 100;
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { role: { contains: query, mode: "insensitive" as const } },
          { department: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { team: true },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return NextResponse.json({ users, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requirePermission("users.manage");
    if (error) return error;
    const input = schema.parse(await request.json());
    const team = input.teamCode ? await prisma.team.findUnique({ where: { code: input.teamCode } }) : null;
    const created = await prisma.user.upsert({
      where: { email: input.email },
      update: {
        name: input.name,
        phone: input.phone || null,
        role: input.role,
        department: input.department || "General",
        supervisorEmail: input.supervisorEmail || null,
        notifyWorkOrder: input.notifyWorkOrder ?? false,
        notifyFacilityBooking: input.notifyFacilityBooking ?? false,
        teamId: team?.id,
        active: input.active ?? true,
      },
      create: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        role: input.role,
        department: input.department || "General",
        supervisorEmail: input.supervisorEmail || null,
        notifyWorkOrder: input.notifyWorkOrder ?? false,
        notifyFacilityBooking: input.notifyFacilityBooking ?? false,
        teamId: team?.id,
        active: input.active ?? true,
        passwordHash: await bcrypt.hash(input.password || randomUUID(), 10),
      },
    });
    const sanitizedInput = { ...input, password: input.password ? "[redacted]" : undefined };
    const sanitizedUser = { ...created, passwordHash: "[redacted]" };
    await auditAction({ user, action: "USER_SAVE", entity: "user", entityId: created.id, details: { input: sanitizedInput, savedRecord: sanitizedUser } });
    return NextResponse.json({ ...created, passwordHash: undefined }, { status: 201 });
  } catch (error) {
    return apiError(error, "Unable to save user");
  }
}
