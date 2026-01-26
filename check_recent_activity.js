const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkActivity() {
  console.log('Checking recent activity for Jan 5-6, 2026...\n');
  
  try {
    // Check messages
    const messages = await prisma.message.findMany({
      where: {
        createdAt: {
          gte: new Date('2026-01-05T00:00:00Z'),
          lte: new Date('2026-01-06T23:59:59Z')
        }
      },
      select: {
        id: true,
        createdAt: true,
        role: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Found ${messages.length} messages on Jan 5-6`);
    if (messages.length > 0) {
      console.log('\nRecent messages:');
      messages.slice(0, 10).forEach(msg => {
        console.log(`- ${msg.createdAt.toISOString()}: ${msg.role} message`);
      });
    }
    
    // Check document processing
    const docs = await prisma.document.findMany({
      where: {
        updatedAt: {
          gte: new Date('2026-01-05T00:00:00Z'),
          lte: new Date('2026-01-06T23:59:59Z')
        }
      },
      select: {
        id: true,
        name: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    console.log(`\nFound ${docs.length} documents processed/updated on Jan 5-6`);
    if (docs.length > 0) {
      console.log('\nProcessed documents:');
      docs.slice(0, 10).forEach(doc => {
        console.log(`- ${doc.updatedAt.toISOString()}: "${doc.name}"`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkActivity().catch(console.error);
