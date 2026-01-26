const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing case-insensitive user lookup...');
    
    // Test 1: Find with exact case
    const user1 = await prisma.user.findFirst({
      where: { username: 'Admin' }
    });
    console.log('Test 1 (exact case "Admin"):', user1 ? `Found: ${user1.username}` : 'Not found');
    
    // Test 2: Find with different case
    const user2 = await prisma.user.findFirst({
      where: { username: { equals: 'ADMIN', mode: 'insensitive' } }
    });
    console.log('Test 2 (case-insensitive "ADMIN"):', user2 ? `Found: ${user2.username}` : 'Not found');
    
    // Test 3: Find with lowercase
    const user3 = await prisma.user.findFirst({
      where: { username: { equals: 'admin', mode: 'insensitive' } }
    });
    console.log('Test 3 (case-insensitive "admin"):', user3 ? `Found: ${user3.username}` : 'Not found');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
