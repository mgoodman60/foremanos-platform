require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function triggerProcessing() {
  try {
    const unprocessed = await prisma.document.findMany({
      where: { 
        processed: false,
        fileType: { in: ['pdf', 'docx'] }
      },
      select: {
        id: true,
        name: true,
        fileName: true,
        processorType: true,
        project: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    });

    console.log(`\n🔧 Found ${unprocessed.length} unprocessed documents\n`);

    if (unprocessed.length === 0) {
      console.log('✅ No documents need processing!');
      return;
    }

    console.log('Documents that need processing:');
    for (const doc of unprocessed) {
      console.log(`\n📄 ${doc.name} (${doc.fileName})`);
      console.log(`   Project: ${doc.project.name}`);
      console.log(`   Processor: ${doc.processorType}`);
      console.log(`   Document ID: ${doc.id}`);
    }

    console.log(`\n\n⚠️  PROCESSING MUST BE TRIGGERED MANUALLY`);
    console.log('The vision processing runs in the background when documents are uploaded.');
    console.log('To manually trigger processing, you can:');
    console.log('1. Check server logs for processing errors');
    console.log('2. Re-upload the documents (they will be detected as duplicates unless you rename them)');
    console.log('3. Use the document processor API endpoint directly\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

triggerProcessing();
