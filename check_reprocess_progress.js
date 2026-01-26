require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const documents = await prisma.document.findMany({
      where: {
        project: { slug: 'one-senior-care' },
        fileName: { endsWith: '.pdf' }
      },
      select: {
        name: true,
        processed: true,
        pagesProcessed: true,
        processingCost: true,
        _count: { select: { chunks: true } }
      },
      orderBy: { name: 'asc' }
    });
    
    console.log('=== Document Reprocessing Progress ===\n');
    
    let totalChunks = 0;
    let totalCost = 0;
    
    documents.forEach(doc => {
      const status = doc._count.chunks > 0 ? '✅' : '⏳';
      console.log(`${status} ${doc.name}`);
      console.log(`   Chunks: ${doc._count.chunks}`);
      console.log(`   Pages: ${doc.pagesProcessed || 0}`);
      console.log(`   Cost: $${(doc.processingCost || 0).toFixed(4)}`);
      console.log('');
      
      totalChunks += doc._count.chunks;
      totalCost += (doc.processingCost || 0);
    });
    
    console.log('=== TOTALS ===');
    console.log(`Total Chunks: ${totalChunks}`);
    console.log(`Total Cost: $${totalCost.toFixed(4)}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
