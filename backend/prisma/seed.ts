import { PrismaClient, UserRole, OrgStatus, WalletType, PaymentRail } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Super Admin ─────────────────────────────────────────────────────────────
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@kenyapay.co.ke';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2024!';

  const existingSuperAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } });
  if (!existingSuperAdmin) {
    await prisma.user.create({
      data: {
        email: superAdminEmail,
        firstName: 'Super',
        lastName: 'Admin',
        passwordHash: await bcrypt.hash(superAdminPassword, 12),
        role: UserRole.SUPER_ADMIN,
        status: 'ACTIVE',
        emailVerified: true,
      },
    });
    console.log(`✅ Super admin created: ${superAdminEmail}`);
  } else {
    console.log(`ℹ️  Super admin already exists: ${superAdminEmail}`);
  }

  // ─── Demo Organization ────────────────────────────────────────────────────────
  let demoOrg = await prisma.organization.findFirst({ where: { email: 'demo@acmecorp.co.ke' } });
  if (!demoOrg) {
    demoOrg = await prisma.organization.create({
      data: {
        name: 'ACME Corporation',
        legalName: 'ACME Corporation Limited',
        registrationNumber: 'CPR/2023/001234',
        kraPin: 'P051234567A',
        industry: 'Technology',
        address: 'Westlands Business Park, 4th Floor',
        city: 'Nairobi',
        phone: '+254700123456',
        email: 'demo@acmecorp.co.ke',
        website: 'https://acmecorp.co.ke',
        status: OrgStatus.ACTIVE,
        activationCode: 'DEMO-ACME-2024',
        activatedAt: new Date(),
        requiresDirectorApproval: true,
        makerCheckerEnabled: true,
        minApprovalAmount: 10000,
        maxTransactionLimit: 5000000,
        dailyTransactionLimit: 10000000,
        monthlyTransactionLimit: 100000000,
        allowedRails: [
          PaymentRail.MPESA_B2C,
          PaymentRail.MPESA_B2B_PAYBILL,
          PaymentRail.MPESA_B2B_TILL,
          PaymentRail.PESALINK,
          PaymentRail.EQUITY_JENGA,
        ],
        directorCount: 1,
      },
    });
    console.log(`✅ Demo org created: ${demoOrg.name}`);
  }

  // ─── Demo Users ───────────────────────────────────────────────────────────────
  const demoUsers = [
    { email: 'admin@acmecorp.co.ke', firstName: 'Alice', lastName: 'Kamau', role: UserRole.ORG_ADMIN, password: 'Admin@2024!' },
    { email: 'finance@acmecorp.co.ke', firstName: 'Brian', lastName: 'Omondi', role: UserRole.FINANCE_MANAGER, password: 'Finance@2024!' },
    { email: 'maker@acmecorp.co.ke', firstName: 'Carol', lastName: 'Wanjiku', role: UserRole.MAKER, password: 'Maker@2024!' },
    { email: 'checker@acmecorp.co.ke', firstName: 'David', lastName: 'Mutua', role: UserRole.CHECKER, password: 'Checker@2024!' },
    { email: 'director@acmecorp.co.ke', firstName: 'Eve', lastName: 'Njoroge', role: UserRole.DIRECTOR, password: 'Director@2024!' },
    { email: 'viewer@acmecorp.co.ke', firstName: 'Frank', lastName: 'Otieno', role: UserRole.VIEWER, password: 'Viewer@2024!' },
  ];

  for (const u of demoUsers) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      const user = await prisma.user.create({
        data: {
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          passwordHash: await bcrypt.hash(u.password, 12),
          role: u.role,
          status: 'ACTIVE',
          emailVerified: true,
          organizationId: demoOrg.id,
        },
      });

      // Make director
      if (u.role === UserRole.DIRECTOR) {
        await prisma.organizationDirector.upsert({
          where: { organizationId_userId: { organizationId: demoOrg.id, userId: user.id } },
          create: {
            organizationId: demoOrg.id,
            userId: user.id,
            name: `${u.firstName} ${u.lastName}`,
            email: u.email,
            phone: '+254700000001',
            nationalId: '12345678',
          },
          update: {},
        });
      }

      console.log(`✅ User created: ${u.email} (${u.role})`);
    }
  }

  // ─── Demo Wallets ─────────────────────────────────────────────────────────────
  const existingWallet = await prisma.wallet.findFirst({ where: { organizationId: demoOrg.id } });
  if (!existingWallet) {
    await prisma.wallet.createMany({
      data: [
        { organizationId: demoOrg.id, type: WalletType.MPESA, name: 'M-Pesa Business Wallet', currency: 'KES', balance: 5000000, accountNumber: '174379', isDefault: true },
        { organizationId: demoOrg.id, type: WalletType.BANK, name: 'Equity Bank Account', currency: 'KES', balance: 10000000, accountNumber: '0170283431238', bankName: 'Equity Bank Kenya', bankCode: '49' },
        { organizationId: demoOrg.id, type: WalletType.VIRTUAL, name: 'Internal Ledger', currency: 'KES', balance: 0 },
      ],
    });
    console.log('✅ Demo wallets created');
  }

  console.log(`
╔══════════════════════════════════════════════════════╗
║              ✅ SEED COMPLETED                        ║
╠══════════════════════════════════════════════════════╣
║  Super Admin : ${(process.env.SUPER_ADMIN_EMAIL || 'superadmin@kenyapay.co.ke').padEnd(37)}║
║  Password    : ${(process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2024!').padEnd(37)}║
╠══════════════════════════════════════════════════════╣
║  Demo Org Admin : admin@acmecorp.co.ke               ║
║  Demo Maker     : maker@acmecorp.co.ke               ║
║  Demo Checker   : checker@acmecorp.co.ke             ║
║  Demo Director  : director@acmecorp.co.ke            ║
║  All passwords  : [Role]@2024!                       ║
╚══════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
