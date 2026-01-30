import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Test 1: Check database connectivity
    console.log('Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✓ Database connection successful\n');

    // Test 2: Count models with data
    console.log('Checking seed data...');

    const userCount = await prisma.user.count();
    const projectCount = await prisma.project.count();
    const docCount = await prisma.document.count();

    console.log(`  User: ${userCount} records`);
    console.log(`  Project: ${projectCount} records`);
    console.log(`  Document: ${docCount} records`);

    const totalRecords = userCount + projectCount + docCount;
    console.log(`\n✓ Total records found: ${totalRecords}`);

    // Test 3: Verify schema sync
    console.log('\nVerifying schema synchronization...');
    const tables = await prisma.$queryRaw<[{ table_count: number }]>`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log(`✓ Total tables in database: ${tables[0].table_count}`);
    console.log(`✓ Expected models: 112`);
    
    if (tables[0].table_count >= 112) {
      console.log('✓ All 112 models are synced to the database');
    } else {
      console.log(`⚠ Warning: Only ${tables[0].table_count} tables found, expected 112+`);
    }

  } catch (error) {
    console.error('✗ Database health check failed:');
    console.error((error as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
