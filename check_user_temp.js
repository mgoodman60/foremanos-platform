require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: 'internal' },
          { email: 'internal@construction.local' }
        ]
      }
    });
    
    console.log('User found:', user ? 'YES' : 'NO');
    if (user) {
      console.log('Username:', user.username);
      console.log('Email:', user.email);
      console.log('Role:', user.role);
      console.log('Approved:', user.approved);
      console.log('Has password:', user.password ? 'YES' : 'NO');
      
      // Test password
      if (user.password) {
        const isValid = await bcrypt.compare('825', user.password);
        console.log('Password "825" is valid:', isValid);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
