import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('123', 10);

  const user = await prisma.user.upsert({
    where: { username: 'MGoodman60' },
    update: { password: hash },
    create: {
      username: 'MGoodman60',
      email: 'mgoodman60@test.local',
      password: hash,
      role: 'admin',
      emailVerified: true,
      approved: true,
    },
  });

  console.log('✅ Test user created/updated:');
  console.log(`   Username: MGoodman60`);
  console.log(`   Password: 123`);
  console.log(`   Role: ${user.role}`);
  console.log(`   ID: ${user.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Error creating test user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
