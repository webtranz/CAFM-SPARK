import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { defaultPermissionCodesForRole } from "@/lib/default-role-permissions";

const schema = z.object({
  role: z.string().min(2),
  permissionCodes: z.array(z.string()),
});

export async function POST(request: Request) {
  try {
    const { error, user } = await requirePermission("roles.manage");
    if (error) return error;
    const input = schema.parse(await request.json());
    const requestedCodes = input.permissionCodes.length ? input.permissionCodes : defaultPermissionCodesForRole(input.role);
    const permissionCodes = input.role === "Admin" ? requestedCodes : requestedCodes.filter((code) => code !== "documents.upload");
    const permissions = await prisma.permission.findMany({ where: { code: { in: permissionCodes } } });
    await prisma.rolePermission.deleteMany({ where: { role: input.role } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ role: input.role, permissionId: permission.id })),
      skipDuplicates: true,
    });
    await auditAction({
      user,
      action: "ROLE_PERMISSIONS_UPDATE",
      entity: "role_permissions",
      entityId: input.role,
      details: {
        role: input.role,
        requestedPermissionCodes: input.permissionCodes,
        appliedPermissionCodes: permissions.map((permission) => permission.code),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to update role permissions");
  }
}
