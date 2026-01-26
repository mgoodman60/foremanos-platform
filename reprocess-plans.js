const { PrismaClient } = require('@prisma/client');
const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function chunkText(text, chunkSize = 1000) {
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function extractPdfTextWithPages(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    
    const chunks = [];
    const fullText = result.text;
    const totalPages = result.total || result.pages.length;
    
    if (!fullText || fullText.trim().length === 0) {
      console.log(`  No extractable text found in PDF`);
      return [];
    }
    
    const avgTextPerPage = fullText.length / totalPages;
    const textChunks = chunkText(fullText, 1500);
    
    let currentPosition = 0;
    textChunks.forEach((chunk) => {
      const estimatedPage = Math.max(1, Math.min(
        totalPages,
        Math.ceil((currentPosition + 1) / avgTextPerPage)
      ));
      
      chunks.push({
        content: chunk,
        pageNumber: estimatedPage,
      });
      
      currentPosition += chunk.length;
    });

    return chunks;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return [];
  }
}

async function reprocessPlans() {
  try {
    console.log('🔍 Finding Plans.pdf document...');
    
    const plansDoc = await prisma.document.findFirst({
      where: { name: { contains: 'Plans.pdf' } }
    });
    
    if (!plansDoc) {
      console.log('❌ Plans.pdf not found in database');
      return;
    }
    
    console.log(`✓ Found: ${plansDoc.name} (ID: ${plansDoc.id})`);
    
    // Delete existing chunks
    console.log('🗑️  Deleting old chunks...');
    const deletedCount = await prisma.documentChunk.deleteMany({
      where: { documentId: plansDoc.id }
    });
    console.log(`✓ Deleted ${deletedCount.count} old chunks`);
    
    // Extract new chunks
    console.log('📄 Extracting text from Plans.pdf...');
    const fullPath = path.join(__dirname, 'public', plansDoc.filePath.replace(/^\//, ''));
    const chunks = await extractPdfTextWithPages(fullPath);
    
    console.log(`✓ Extracted ${chunks.length} chunks`);
    
    // Find chunks with footing info
    const footingChunks = chunks.filter(c => {
      const lower = c.content.toLowerCase();
      return lower.includes('footing') || lower.includes('subgrade');
    });
    console.log(`✓ Found ${footingChunks.length} chunks with footing/subgrade information`);
    
    // Show first footing chunk
    if (footingChunks.length > 0) {
      console.log('\n--- Sample footing chunk ---');
      console.log(footingChunks[0].content.substring(0, 500));
      console.log('...\n');
    }
    
    // Save chunks to database
    console.log('💾 Saving chunks to database...');
    for (let i = 0; i < chunks.length; i++) {
      await prisma.documentChunk.create({
        data: {
          documentId: plansDoc.id,
          content: chunks[i].content,
          chunkIndex: i,
          pageNumber: chunks[i].pageNumber,
          metadata: {
            fileName: plansDoc.fileName,
            documentName: plansDoc.name,
            accessLevel: plansDoc.accessLevel,
            chunkCount: chunks.length,
            hasPageNumbers: true,
          },
        },
      });
    }
    
    // Mark as processed
    await prisma.document.update({
      where: { id: plansDoc.id },
      data: { processed: true },
    });
    
    console.log('✅ Successfully reprocessed Plans.pdf');
    console.log(`📊 Total chunks in database: ${chunks.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reprocessPlans();
