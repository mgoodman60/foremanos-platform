import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create admin user (Admin / 123)
  const adminPassword = await bcrypt.hash('123', 10);
  const adminUser = await prisma.user.upsert({
    where: { username: 'Admin' },
    update: {
      password: adminPassword,
      role: 'admin',
      approved: true,
    },
    create: {
      email: 'admin@foremanos.site',
      username: 'Admin',
      password: adminPassword,
      role: 'admin',
      approved: true,
    },
  });
  console.log('Admin user created:', adminUser.username);

  // Create test account (john@doe.com / johndoe123) with client privileges
  const testUserPassword = await bcrypt.hash('johndoe123', 10);
  const testUser = await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      username: 'john',
      password: testUserPassword,
      role: 'client',
      approved: true,
    },
  });
  console.log('Test user created:', testUser.email);

  // Create client user for testing tool (internal@construction.local / 825)
  const clientPassword = await bcrypt.hash('825', 10);
  const clientUser = await prisma.user.upsert({
    where: { username: 'internal' },
    update: {
      password: clientPassword,
      email: 'internal@construction.local',
      role: 'client',
      approved: true,
    },
    create: {
      email: 'internal@construction.local',
      username: 'internal',
      password: clientPassword,
      role: 'client',
      approved: true,
    },
  });
  console.log('Client user created:', clientUser.username);

  // Initialize maintenance mode
  const maintenance = await prisma.maintenanceMode.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      isActive: false,
      message: 'Updating documents... Please check back in a few minutes',
    },
  });
  console.log('Maintenance mode initialized:', maintenance.isActive);

  // Create document metadata for expected documents
  const documents = [
    { name: 'Budget.pdf', accessLevel: 'admin', fileType: 'pdf' },
    { name: 'Critical Path Plan.docx', accessLevel: 'admin', fileType: 'docx' },
    { name: 'Project Overview.docx', accessLevel: 'admin', fileType: 'docx' },
    { name: 'Geotech.pdf', accessLevel: 'guest', fileType: 'pdf' },
    { name: 'Plans.pdf', accessLevel: 'guest', fileType: 'pdf' },
    { name: 'Schedule.pdf', accessLevel: 'guest', fileType: 'pdf' },
    { name: 'Site Survey.pdf', accessLevel: 'guest', fileType: 'pdf' },
  ];

  for (const doc of documents) {
    // Check if document already exists
    const existingDoc = await prisma.document.findFirst({
      where: { fileName: doc.name },
    });

    if (!existingDoc) {
      const document = await prisma.document.create({
        data: {
          name: doc.name,
          fileName: doc.name,
          fileType: doc.fileType,
          accessLevel: doc.accessLevel,
          processed: false,
        },
      });
      console.log('Document created:', document.name);
    } else {
      console.log('Document already exists:', existingDoc.name);
    }
  }

  console.log('Database seed completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
