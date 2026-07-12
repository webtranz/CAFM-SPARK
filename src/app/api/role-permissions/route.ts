import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { defaultPermissionCodesForRole, defaultPermissionScopeForRole } from "@/lib/default-role-permissions";
import { ensureDefaultRbac } from "@/lib/rbac-seed";

const schema = z.object({
  role: z.string().min(2),
  permissionCodes: z.array(z.string()),
  permissionScopes: z.record(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    await ensureDefaultRbac();
    const { error, user } = await requirePermission("roles.manage");
    if (error) return error;
    const input = schema.parse(await request.json());
    const requestedCodes = input.permissionCodes.length ? input.permissionCodes : defaultPermissionCodesForRole(input.role);
    const permissionCodes = requestedCodes;
    const permissions = await prisma.permission.findMany({ where: { code: { in: permissionCodes } } });
    const foundCodes = new Set(permissions.map((permission) => permission.code));
    const missingCodes = permissionCodes.filter((code) => !foundCodes.has(code));
    if (missingCodes.length) {
      return NextResponse.json({ message: `Unknown permissions: ${missingCodes.join(", ")}` }, { status: 400 });
    }
    await prisma.rolePermission.deleteMany({ where: { role: input.role } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ role: input.role, permissionId: permission.id, scope: input.permissionScopes?.[permission.code] || defaultPermissionScopeForRole(input.role, permission.code) })),
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
