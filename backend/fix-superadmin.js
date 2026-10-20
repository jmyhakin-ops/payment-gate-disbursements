const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get the Super Admin user and active org
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const acmeOrg = await prisma.organization.findFirst({ where: { status: 'ACTIVE' } });

  console.log('Super Admin:', superAdmin?.email, '| current orgId:', superAdmin?.organizationId);
  console.log('Active Org:', acmeOrg?.name, '| id:', acmeOrg?.id);

  if (superAdmin && acmeOrg && !superAdmin.organizationId) {
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: { organizationId: acmeOrg.id }
    });
    console.log('SUCCESS: Super Admin linked to:', acmeOrg.name);
  } else if (superAdmin && superAdmin.organizationId) {
    console.log('Super Admin already has orgId:', superAdmin.organizationId);
  } else {
    console.log('Nothing to update');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
