import { PrismaClient } from '@prisma/client';
import { getFileUrl } from './lib/s3';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execPromise = promisify(exec);
const prisma = new PrismaClient();

async function main() {
  try {
    const docId = 'cmk5hyqms0005p2075yxs6opc';
    
    const document = await prisma.document.findUnique({
      where: { id: docId }
    });
    
    if (!document || !document.cloud_storage_path) {
      throw new Error('Document not found');
    }
    
    console.log('Downloading Budget.pdf from S3...');
    const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Save to temp file
    const tempFile = join(tmpdir(), 'budget-temp.pdf');
    await writeFile(tempFile, buffer);
    
    // Extract text using pdftotext
    console.log('Extracting text...');
    const { stdout } = await execPromise(`pdftotext "${tempFile}" -`);
    
    console.log('Text extracted:', stdout.substring(0, 500));
    console.log(`\nTotal text length: ${stdout.length} characters`);
    
    // Create chunk
    if (stdout.trim().length > 0) {
      await prisma.documentChunk.create({
        data: {
          documentId: docId,
          pageNumber: 1,
          chunkIndex: 0,
          content: stdout,
          metadata: {
            source: 'text-extraction',
            textLength: stdout.length
          }
        }
      });
      
      // Mark as processed
      await prisma.document.update({
        where: { id: docId },
        data: {
          processed: true,
          pagesProcessed: 1,
          processingCost: 0
        }
      });
      
      console.log('✅ Budget.pdf processed successfully with text extraction');
    }
    
    // Cleanup
    await unlink(tempFile);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
