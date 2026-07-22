import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const roleNames = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'OPERATING_TEAM',
  'AML_TEAM',
  'AML_SUPERVISOR',
  'SEF',
  'MLRO',
  'DMLRO',
  'ACCOUNTING_TEAM',
  'HR_TEAM'
];

const modules = [
  ['KYC & Engagement Workflow', 'kyc-engagement-workflow'],
  ['Client Management', 'client-management'],
  ['Document Management', 'document-management'],
  ['Approval Workflow', 'approval-workflow'],
  ['Notifications', 'notifications'],
  ['Accounting', 'accounting'],
  ['Payroll', 'payroll'],
  ['Document Expiry Tracking', 'document-expiry-tracking'],
  ['Reports', 'reports']
];

async function main() {
  for (const name of roleNames) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name.replaceAll('_', ' ')} role` }
    });
  }

  for (const [name, key] of modules) {
    await prisma.module.upsert({
      where: { key },
      update: { name },
      create: { name, key, isSystem: true }
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'newoon' },
    update: {},
    create: { name: 'Newoon', slug: 'newoon' }
  });

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'SUPER_ADMIN' }
  });
  const companyAdminRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'COMPANY_ADMIN' }
  });
  const operatingTeamRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'OPERATING_TEAM' }
  });
  const amlSupervisorRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'AML_SUPERVISOR' }
  });
  const dmlroRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'DMLRO' }
  });
  const mlroRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'MLRO' }
  });
  const sefRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'SEF' }
  });

  const passwordHash = await bcrypt.hash('Admin@12345', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@newoon.com' },
    update: {},
    create: {
      tenantId: null,
      email: 'admin@newoon.com',
      passwordHash,
      firstName: 'Newoon',
      lastName: 'Admin',
      roles: {
        create: {
          roleId: superAdminRole.id
        }
      }
    }
  });

  const companyAdmin = await prisma.user.upsert({
    where: { email: 'company.admin@newoon.com' },
    update: {
      tenantId: tenant.id,
      status: 'ACTIVE'
    },
    create: {
      tenantId: tenant.id,
      email: 'company.admin@newoon.com',
      passwordHash,
      firstName: 'Company',
      lastName: 'Admin',
      roles: {
        create: {
          roleId: companyAdminRole.id
        }
      }
    }
  });

  const operatingUser = await prisma.user.upsert({
    where: { email: 'operations@newoon.com' },
    update: {
      tenantId: tenant.id,
      status: 'ACTIVE'
    },
    create: {
      tenantId: tenant.id,
      email: 'operations@newoon.com',
      passwordHash,
      firstName: 'Operating',
      lastName: 'Team',
      roles: {
        create: {
          roleId: operatingTeamRole.id
        }
      }
    }
  });

  const amlSupervisorUser = await prisma.user.upsert({
    where: { email: 'aml.supervisor@newoon.com' },
    update: {
      tenantId: tenant.id,
      status: 'ACTIVE'
    },
    create: {
      tenantId: tenant.id,
      email: 'aml.supervisor@newoon.com',
      passwordHash,
      firstName: 'AML',
      lastName: 'Supervisor',
      roles: {
        create: {
          roleId: amlSupervisorRole.id
        }
      }
    }
  });

  const dmlroUser = await prisma.user.upsert({
    where: { email: 'dmlro@newoon.com' },
    update: {
      tenantId: tenant.id,
      status: 'ACTIVE'
    },
    create: {
      tenantId: tenant.id,
      email: 'dmlro@newoon.com',
      passwordHash,
      firstName: 'DMLRO',
      lastName: 'Reviewer',
      roles: {
        create: {
          roleId: dmlroRole.id
        }
      }
    }
  });

  const mlroUser = await prisma.user.upsert({
    where: { email: 'mlro@newoon.com' },
    update: {
      tenantId: tenant.id,
      status: 'ACTIVE'
    },
    create: {
      tenantId: tenant.id,
      email: 'mlro@newoon.com',
      passwordHash,
      firstName: 'MLRO',
      lastName: 'Approver',
      roles: {
        create: {
          roleId: mlroRole.id
        }
      }
    }
  });

  const sefUser = await prisma.user.upsert({
    where: { email: 'sef@newoon.com' },
    update: {
      tenantId: tenant.id,
      status: 'ACTIVE'
    },
    create: {
      tenantId: tenant.id,
      email: 'sef@newoon.com',
      passwordHash,
      firstName: 'SEF',
      lastName: 'Management',
      roles: {
        create: {
          roleId: sefRole.id
        }
      }
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: companyAdmin.id, roleId: companyAdminRole.id } },
    update: {},
    create: { userId: companyAdmin.id, roleId: companyAdminRole.id }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: operatingUser.id, roleId: operatingTeamRole.id } },
    update: {},
    create: { userId: operatingUser.id, roleId: operatingTeamRole.id }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: amlSupervisorUser.id, roleId: amlSupervisorRole.id } },
    update: {},
    create: { userId: amlSupervisorUser.id, roleId: amlSupervisorRole.id }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: dmlroUser.id, roleId: dmlroRole.id } },
    update: {},
    create: { userId: dmlroUser.id, roleId: dmlroRole.id }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: mlroUser.id, roleId: mlroRole.id } },
    update: {},
    create: { userId: mlroUser.id, roleId: mlroRole.id }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: sefUser.id, roleId: sefRole.id } },
    update: {},
    create: { userId: sefUser.id, roleId: sefRole.id }
  });

  const allModules = await prisma.module.findMany();
  for (const moduleRecord of allModules) {
    await prisma.tenantModule.upsert({
      where: {
        tenantId_moduleId: {
          tenantId: tenant.id,
          moduleId: moduleRecord.id
        }
      },
      update: { isEnabled: true },
      create: {
        tenantId: tenant.id,
        moduleId: moduleRecord.id,
        isEnabled: true
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'CREATE',
      entityType: 'Seed',
      metadata: { roles: roleNames.length, modules: modules.length }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
