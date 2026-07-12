import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireAdmin, requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRbac, ensureRoleDefaultPermissions } from "@/lib/rbac-seed";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

export async function GET() {
  await ensureDefaultRbac();
  const { error } = await requirePermission("roles.manage");
  if (error) return error;
  return NextResponse.json(await prisma.role.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(request: Request) {
  try {
    await ensureDefaultRbac();
    const { error, user } = await requirePermission("roles.manage");
    if (error) return error;
    const input = schema.parse(await request.json());
    const role = await prisma.role.upsert({
      where: { name: input.name },
      update: { description: input.description || "" },
      create: { name: input.name, description: input.description || "", standard: false },
    });
    await ensureRoleDefaultPermissions(role.name);
    await auditAction({ user, action: "ROLE_SAVE", entity: "role", entityId: role.id, details: { input, savedRecord: role } });
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return apiError(error, "Unable to save role");
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, user } = await requireAdmin();
    if (error) return error;

    const name = new URL(request.url).searchParams.get("name")?.trim();
    if (!name) {
      return NextResponse.json({ message: "Role name is required." }, { status: 400 });
    }

    const role = await prisma.role.findUnique({ where: { name } });
    if (!role) {
      return NextResponse.json({ message: "Role not found." }, { status: 404 });
    }

    if (role.standard || role.name === "Admin") {
      return NextResponse.json({ message: "Standard roles cannot be deleted." }, { status: 400 });
    }

    const assignedUsers = await prisma.user.count({ where: { role: role.name } });
    if (assignedUsers > 0) {
      return NextResponse.json({ message: "Assign users to another role before deleting this role." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { role: role.name } }),
      prisma.role.delete({ where: { name: role.name } }),
    ]);
    await auditAction({ user, action: "ROLE_DELETE", entity: "role", entityId: role.id, details: { deletedRecord: role } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to delete role");
  }
}
