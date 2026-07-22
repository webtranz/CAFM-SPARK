import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAdmin, requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().optional(),
  role: z.string().min(2),
  department: z.string().optional(),
  departmentCodes: z.union([z.string(), z.array(z.string())]).optional(),
  supervisorEmail: z.string().optional(),
  notifyWorkOrder: z.coerce.boolean().optional(),
  notifyFacilityBooking: z.coerce.boolean().optional(),
  teamCode: z.string().optional(),
  active: z.coerce.boolean().optional(),
});

function normalizedDepartments(input: z.infer<typeof schema>) {
  const source = input.departmentCodes ?? input.department ?? "";
  const values = Array.isArray(source) ? source : String(source).split(/[;,|]/);
  const departments = Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
  return departments.length ? departments.join(",") : "General";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requirePermission("users.manage");
    if (error) return error;
    const { id } = await params;
    const input = schema.parse(await request.json());
    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) return apiError(new Error("User not found."), "Unable to update user", 404);
    const team = input.teamCode ? await prisma.team.findUnique({ where: { code: input.teamCode } }) : null;
    const department = normalizedDepartments(input);
    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        role: input.role,
        department,
        supervisorEmail: input.supervisorEmail || null,
        notifyWorkOrder: input.notifyWorkOrder ?? false,
        notifyFacilityBooking: input.notifyFacilityBooking ?? false,
        teamId: team?.id,
        active: input.active ?? true,
        passwordHash: input.password ? await bcrypt.hash(input.password, 10) : undefined,
      },
    });
    await auditAction({
      user,
      action: "USER_UPDATE",
      entity: "user",
      entityId: id,
      details: {
        before: { ...current, passwordHash: "[redacted]" },
        input: { ...input, password: input.password ? "[redacted]" : undefined },
        after: { ...updated, passwordHash: "[redacted]" },
      },
    });
    return NextResponse.json({ ...updated, passwordHash: undefined });
  } catch (error) {
    return apiError(error, "Unable to update user");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, user: currentUser } = await requireAdmin();
    if (error) return error;
    const { id } = await params;
    if (currentUser?.id === id) {
      return apiError(new Error("You cannot delete your own user account."), "Unable to delete user", 400);
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.email === currentUser?.email) {
      return apiError(new Error("You cannot delete your own user account."), "Unable to delete user", 400);
    }
    if (user?.email === "admin@cafm.local") {
      return apiError(new Error("Initial admin user cannot be deleted."), "Unable to delete user", 400);
    }
    await prisma.user.delete({ where: { id } });
    await auditAction({ user: currentUser, action: "USER_DELETE", entity: "user", entityId: id, details: { deletedRecord: user ? { ...user, passwordHash: "[redacted]" } : null } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to delete user");
  }
}
