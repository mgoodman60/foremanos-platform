require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: 'wp', mode: 'insensitive' } },
        { email: { contains: 'wp', mode: 'insensitive' } }
      ]
    },
    select: {
      username: true,
      email: true,
      role: true,
      approved: true
    }
  });
  console.log('Users with "wp":', JSON.stringify(users, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
