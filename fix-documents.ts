import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Fix Plans.pdf - mark as processed since it has good chunks
    const plansDoc = await prisma.document.update({
      where: { id: 'cmk633er50001n508fpe1licm' },
      data: {
        processed: true,
        pagesProcessed: 8,
        processingCost: 0.08 // 8 pages * $0.01/page for gpt-4o-vision
      }
    });
    
    console.log('✅ Marked Plans.pdf as processed (8 pages)');
    
    // Check Budget.pdf chunks
    const budgetChunks = await prisma.documentChunk.count({
      where: { documentId: 'cmk5hyqms0005p2075yxs6opc' }
    });
    
    console.log(`\n📄 Budget.pdf has ${budgetChunks} chunks`);
    
    if (budgetChunks > 0) {
      // Mark Budget as processed too
      const budgetDoc = await prisma.document.update({
        where: { id: 'cmk5hyqms0005p2075yxs6opc' },
        data: {
          processed: true,
          pagesProcessed: budgetChunks,
          processingCost: budgetChunks * 0.01
        }
      });
      console.log(`✅ Marked Budget.pdf as processed (${budgetChunks} pages)`);
    } else {
      console.log('⚠️  Budget.pdf has no chunks - needs processing');
    }
    
    // Final summary
    const processed = await prisma.document.count({ where: { processed: true } });
    const unprocessed = await prisma.document.count({ where: { processed: false } });
    
    console.log('\n=== FINAL STATUS ===');
    console.log(`✅ Processed: ${processed}`);
    console.log(`⏳ Unprocessed: ${unprocessed}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
