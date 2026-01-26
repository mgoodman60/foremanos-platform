/**
 * Extract Scales API
 * POST /api/projects/[slug]/extract-scales
 * 
 * Extracts scale information from all documents in a project
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  detectScalesWithVision,
  extractScalesWithPatterns,
  storeSheetScaleData,
  type SheetScaleData,
} from '@/lib/scale-detector';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role === 'guest') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { forceReprocess = false } = await req.json();

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        Document: {
          where: {
            fileType: 'application/pdf',
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let processed = 0;
    let extracted = 0;
    let totalScales = 0;

    // Process each document
    for (const document of project.Document) {
      console.log(`\n📄 Processing document: ${document.name}`);
      
      // Check if already processed
      if (!forceReprocess) {
        const existingScale = await prisma.documentChunk.findFirst({
          where: {
            documentId: document.id,
          },
        });

        if (existingScale) {
          console.log(`  ⏭️  Already has scale data, skipping`);
          continue;
        }
      }

      processed++;

      try {
        // Download PDF from S3
        const { getFileUrl } = await import('@/lib/s3');
        const pdfUrl = await getFileUrl(document.cloud_storage_path || '', document.isPublic || false);
        
        const pdfResponse = await fetch(pdfUrl);
        const pdfBuffer = await pdfResponse.arrayBuffer();
        
        const tempDir = path.join('/tmp', `scale_extraction_${document.id}`);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const pdfPath = path.join(tempDir, 'document.pdf');
        fs.writeFileSync(pdfPath, Buffer.from(pdfBuffer));

        // Convert PDF pages to images
        await execPromise(`pdftoppm -jpeg -r 150 "${pdfPath}" "${tempDir}/page"`);

        const imageFiles = fs.readdirSync(tempDir)
          .filter(f => f.startsWith('page-') && f.endsWith('.jpg'))
          .sort();

        // Process each page
        for (let i = 0; i < imageFiles.length; i++) {
          const imageFile = imageFiles[i];
          const pageNumber = i + 1;
          
          console.log(`  📃 Processing page ${pageNumber}/${imageFiles.length}`);

          // Use page number as sheet identifier
          const sheetNumber = `Page ${pageNumber}`;

          // Read image
          const imagePath = path.join(tempDir, imageFile);
          const imageBuffer = fs.readFileSync(imagePath);
          const imageBase64 = imageBuffer.toString('base64');

          // Try Vision API first
          const visionResult = await detectScalesWithVision(imageBase64, sheetNumber);

          if (visionResult.success && visionResult.scales.length > 0) {
            // Store scale data
            const scaleData: SheetScaleData = {
              sheetNumber,
              primaryScale: visionResult.scales[0],
              secondaryScales: visionResult.scales.slice(1),
              hasMultipleScales: visionResult.scales.length > 1,
              scaleCount: visionResult.scales.length,
              extractedFrom: visionResult.extractedFrom,
              confidence: visionResult.confidence,
            };

            await storeSheetScaleData(project.id, document.id, sheetNumber, scaleData);
            
            extracted++;
            totalScales += visionResult.scales.length;
            console.log(`  ✓ Extracted ${visionResult.scales.length} scale(s) from page ${pageNumber}`);
          } else {
            console.log(`  ⚠️  No scales found on page ${pageNumber}`);
          }
        }

        // Cleanup temp files
        fs.rmSync(tempDir, { recursive: true, force: true });

      } catch (error) {
        console.error(`Error processing document ${document.name}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      extracted,
      totalScales,
    });

  } catch (error) {
    console.error('Extract scales error:', error);
    return NextResponse.json(
      { error: 'Failed to extract scales' },
      { status: 500 }
    );
  }
}
