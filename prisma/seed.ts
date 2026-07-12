import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import rolePermissionProfile from "../src/lib/default-role-permissions";

const { ACTION_PERMISSION_SEED, DEFAULT_ROLE_NAMES, defaultPermissionGrantsForRole } = rolePermissionProfile;

const prisma = new PrismaClient();

const defaultAdmins = [
  {
    name: "System Administrator",
    email: "admin@cafm.local",
    password: "Admin@12345",
  },
];

async function clearSeedData() {
  await prisma.housingHistory.deleteMany({});
  await prisma.housingNotification.deleteMany({});
  await prisma.housingApproval.deleteMany({});
  await prisma.housingInventory.deleteMany({});
  await prisma.housingAsset.deleteMany({});
  await prisma.housingInspection.deleteMany({});
  await prisma.housingBooking.deleteMany({});
  await prisma.housingResident.deleteMany({});
  await prisma.housingBed.deleteMany({});
  await prisma.housingRoom.deleteMany({});
  await prisma.housingBlock.deleteMany({});
  await prisma.housingProperty.deleteMany({});
  await prisma.housingNotificationSetting.deleteMany({});

  await prisma.inventoryIssue.deleteMany({});
  await prisma.meter.deleteMany({});
  await prisma.iotAlert.deleteMany({});
  await prisma.hseIncident.deleteMany({});
  await prisma.inspection.deleteMany({});
  await prisma.complianceCertificate.deleteMany({});
  await prisma.preventiveMaintenance.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.serviceRequest.deleteMany({});
  await prisma.assetHistory.deleteMany({});
  await prisma.documentUpload.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.space.deleteMany({});
  await prisma.building.deleteMany({});
  await prisma.site.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.jobPlan.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.contract.deleteMany({});
  await prisma.vendor.deleteMany({});
  await prisma.serviceCatalog.deleteMany({});
  await prisma.assetCategory.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.auditLog.deleteMany({});

  await prisma.rosterEntry.deleteMany({});
  await prisma.rotationSetup.deleteMany({});
  await prisma.shiftMaster.deleteMany({});

  await prisma.rolePermission.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.role.deleteMany({});

  await prisma.user.updateMany({ data: { teamId: null } });
  await prisma.user.deleteMany({ where: { email: { notIn: defaultAdmins.map((admin) => admin.email) } } });
  await prisma.team.deleteMany({});
}

async function seedRolesAndPermissions() {
  for (const permission of ACTION_PERMISSION_SEED) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { name: permission.name, module: permission.module, description: permission.description },
      create: { code: permission.code, name: permission.name, module: permission.module, description: permission.description },
    });
  }

  for (const roleName of DEFAULT_ROLE_NAMES) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: { standard: true },
      create: { name: roleName, description: `${roleName} standard CAFM role`, standard: true },
    });

    const defaultGrants = defaultPermissionGrantsForRole(roleName);
    const permissions = await prisma.permission.findMany({ where: { code: { in: defaultGrants.map((grant) => grant.code) } } });
    const grantByCode = new Map(defaultGrants.map((grant) => [grant.code, grant]));
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ role: roleName, permissionId: permission.id, scope: grantByCode.get(permission.code)?.scope || "Department" })),
      skipDuplicates: true,
    });
  }
}
async function main() {
  await clearSeedData();

  for (const admin of defaultAdmins) {
    const passwordHash = await bcrypt.hash(admin.password, 10);
    await prisma.user.upsert({
      where: { email: admin.email },
      update: {
        name: admin.name,
        role: "Admin",
        department: "Administration",
        passwordHash,
        active: true,
        teamId: null,
      },
      create: {
        name: admin.name,
        email: admin.email,
        role: "Admin",
        department: "Administration",
        passwordHash,
        active: true,
      },
    });
  }

  await seedRolesAndPermissions();

  console.log(`Database seed complete. Admin logins: ${defaultAdmins.map((admin) => admin.email).join(", ")}`);
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
