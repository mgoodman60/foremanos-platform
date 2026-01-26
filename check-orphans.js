const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const unprocessedDocs = await prisma.document.findMany({
      where: {
        processed: false,
        createdAt: { lt: fiveMinutesAgo },
        deletedAt: null,
        cloud_storage_path: { not: null },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { DocumentChunk: true } },
      },
    });
    
    const docsWithNoChunks = unprocessedDocs.filter(d => d._count.DocumentChunk === 0);
    
    console.log(`\n📊 Status Report:`);
    console.log(`   Total unprocessed docs: ${unprocessedDocs.length}`);
    console.log(`   Docs with 0 chunks: ${docsWithNoChunks.length}`);
    
    if (docsWithNoChunks.length > 0) {
      console.log(`\n⚠️  Potential orphans:`);
      docsWithNoChunks.forEach(doc => {
        console.log(`   - ${doc.name} (${doc.id}) - Created: ${doc.createdAt}`);
      });
    } else {
      console.log(`\n✅ No orphaned documents found!`);
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();
