require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           FINAL STATUS UPDATE - DECEMBER 18, 2024             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    // Regulatory Documents Status
    console.log('━━━ REGULATORY DOCUMENTS PROCESSING ━━━\n');
    
    const regDocs = await prisma.regulatoryDocument.findMany({
      select: {
        standard: true,
        pagesProcessed: true,
        processingCost: true,
        processed: true,
        _count: { select: { chunks: true } }
      }
    });
    
    let regTotal = { pages: 0, cost: 0, chunks: 0 };
    
    regDocs.forEach(doc => {
      const totalPages = doc.standard === 'ADA 2010' ? 279 : doc.standard === 'NFPA 101' ? 505 : 833;
      const percent = ((doc.pagesProcessed / totalPages) * 100).toFixed(1);
      const status = doc.processed ? '✅ Complete' : '⏳ In Progress';
      
      console.log(`${doc.standard}:`);
      console.log(`  Status: ${status}`);
      console.log(`  Progress: ${doc.pagesProcessed}/${totalPages} pages (${percent}%)`);
      console.log(`  Chunks: ${doc._count.chunks}`);
      console.log(`  Cost: $${doc.processingCost.toFixed(2)}`);
      console.log('');
      
      regTotal.pages += doc.pagesProcessed;
      regTotal.cost += parseFloat(doc.processingCost);
      regTotal.chunks += doc._count.chunks;
    });
    
    console.log('REGULATORY TOTALS:');
    console.log(`  Total Pages: ${regTotal.pages}/1617 (${((regTotal.pages/1617)*100).toFixed(1)}%)`);
    console.log(`  Total Chunks: ${regTotal.chunks}`);
    console.log(`  Total Cost: $${regTotal.cost.toFixed(2)}`);
    console.log('');
    
    // Project Documents Status
    console.log('━━━ PROJECT DOCUMENTS REPROCESSING ━━━\n');
    
    const projDocs = await prisma.document.findMany({
      where: {
        project: { slug: 'one-senior-care' },
        fileName: { endsWith: '.pdf' }
      },
      select: {
        name: true,
        pagesProcessed: true,
        processingCost: true,
        _count: { select: { chunks: true } }
      },
      orderBy: { name: 'asc' }
    });
    
    let projTotal = { pages: 0, cost: 0, chunks: 0, complete: 0 };
    
    projDocs.forEach(doc => {
      const status = doc._count.chunks > 0 ? '✅' : '❌';
      console.log(`${status} ${doc.name}`);
      console.log(`   Chunks: ${doc._count.chunks} | Pages: ${doc.pagesProcessed || 0} | Cost: $${(doc.processingCost || 0).toFixed(4)}`);
      
      projTotal.pages += doc.pagesProcessed || 0;
      projTotal.cost += doc.processingCost || 0;
      projTotal.chunks += doc._count.chunks;
      if (doc._count.chunks > 0) projTotal.complete++;
    });
    
    console.log('');
    console.log('PROJECT TOTALS:');
    console.log(`  Documents: ${projTotal.complete}/${projDocs.length} complete`);
    console.log(`  Total Pages: ${projTotal.pages}`);
    console.log(`  Total Chunks: ${projTotal.chunks}`);
    console.log(`  Total Cost: $${projTotal.cost.toFixed(4)}`);
    console.log('');
    
    // Grand Totals
    console.log('━━━ GRAND TOTALS ━━━\n');
    console.log(`Total Pages Processed: ${regTotal.pages + projTotal.pages}`);
    console.log(`Total Chunks Created: ${regTotal.chunks + projTotal.chunks}`);
    console.log(`Total Cost: $${(regTotal.cost + projTotal.cost).toFixed(4)}`);
    console.log('');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
