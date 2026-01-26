require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const docs = await prisma.regulatoryDocument.findMany({
      select: {
        standard: true,
        pagesProcessed: true,
        processingCost: true,
        processed: true,
        _count: { select: { chunks: true } }
      }
    });
    
    console.log("=== REGULATORY DOCUMENT PROCESSING STATUS ===\n");
    
    let totalPages = 0;
    let totalProcessed = 0;
    let totalCost = 0;
    let totalChunks = 0;
    
    docs.forEach(doc => {
      const pages = doc.standard === 'ADA 2010' ? 279 : doc.standard === 'NFPA 101' ? 505 : 833;
      const percent = ((doc.pagesProcessed / pages) * 100).toFixed(1);
      const status = doc.processed ? '✅ Complete' : '⏳ In Progress';
      
      console.log(`${doc.standard}:`);
      console.log(`  Progress: ${doc.pagesProcessed}/${pages} pages (${percent}%)`);
      console.log(`  Chunks: ${doc._count.chunks}`);
      console.log(`  Cost: $${doc.processingCost.toFixed(2)}`);
      console.log(`  Status: ${status}\n`);
      
      totalPages += pages;
      totalProcessed += doc.pagesProcessed;
      totalCost += parseFloat(doc.processingCost);
      totalChunks += doc._count.chunks;
    });
    
    const overallPercent = ((totalProcessed / totalPages) * 100).toFixed(1);
    console.log("=== TOTALS ===");
    console.log(`Pages: ${totalProcessed}/${totalPages} (${overallPercent}%)`);
    console.log(`Chunks: ${totalChunks}`);
    console.log(`Cost: $${totalCost.toFixed(2)}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
})();
