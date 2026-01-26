require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { username: 'wp' }
  });
  
  if (user) {
    console.log('User found:', user.username, user.email);
    // Test common passwords
    const testPasswords = ['825', 'wp', 'password', 'admin', 'wp123'];
    for (const pwd of testPasswords) {
      const match = await bcrypt.compare(pwd, user.password);
      if (match) {
        console.log(`Password is: ${pwd}`);
        break;
      }
    }
  } else {
    console.log('User not found');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
