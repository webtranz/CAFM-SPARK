import { ACTION_PERMISSION_SEED, DEFAULT_ROLE_NAMES, defaultPermissionGrantsForRole } from "@/lib/default-role-permissions";
import { prisma } from "@/lib/prisma";

let defaultRbacSeed: Promise<void> | null = null;

async function upsertPermissionCatalog() {
  for (const permission of ACTION_PERMISSION_SEED) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        module: permission.module,
        description: permission.description,
      },
      create: {
        code: permission.code,
        name: permission.name,
        module: permission.module,
        description: permission.description,
      },
    });
  }
}

export async function ensureRoleDefaultPermissions(roleName: string) {
  const existingPermissions = await prisma.rolePermission.count({ where: { role: roleName } });
  if (existingPermissions > 0) return;

  const defaultGrants = defaultPermissionGrantsForRole(roleName);
  if (!defaultGrants.length) return;

  const permissions = await prisma.permission.findMany({
    where: { code: { in: defaultGrants.map((grant) => grant.code) } },
  });
  const grantByCode = new Map(defaultGrants.map((grant) => [grant.code, grant]));

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      role: roleName,
      permissionId: permission.id,
      scope: grantByCode.get(permission.code)?.scope || "Department",
    })),
    skipDuplicates: true,
  });
}

async function seedDefaultRbac() {
  await upsertPermissionCatalog();

  for (const roleName of DEFAULT_ROLE_NAMES) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {
        standard: true,
        description: `${roleName} standard CAFM role`,
      },
      create: {
        name: roleName,
        description: `${roleName} standard CAFM role`,
        standard: true,
      },
    });

    await ensureRoleDefaultPermissions(roleName);
  }
}

export function ensureDefaultRbac() {
  if (!defaultRbacSeed) {
    defaultRbacSeed = seedDefaultRbac().finally(() => {
      defaultRbacSeed = null;
    });
  }
  return defaultRbacSeed;
}
