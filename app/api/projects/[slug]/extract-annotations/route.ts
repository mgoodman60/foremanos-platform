import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';
import { extractAnnotationsWithVision } from '@/lib/annotation-processor';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { forceReprocess = false } = body;

    const project = await prisma.project.findUnique({ 
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get PLANS documents separately
    const documents = await prisma.document.findMany({
      where: {
        projectId: project.id,
        category: 'plans_drawings'
      }
    });

    console.log(`[ANNOTATION EXTRACTION] Starting extraction for ${documents.length} documents...`);

    let totalAnnotations = 0;
    let processedSheets = 0;
    let criticalCount = 0;
    let errors: string[] = [];

    for (const document of documents) {
      try {
        // Check if already extracted (unless force reprocess)
        if (!forceReprocess) {
          const existing = await prisma.enhancedAnnotation.findFirst({
            where: {
              projectId: project.id,
              documentId: document.id
            }
          });

          if (existing) {
            console.log(`[ANNOTATION EXTRACTION] Skipping ${document.name} - already processed`);
            const anns = existing.annotations as any;
            if (Array.isArray(anns)) {
              totalAnnotations += anns.length;
              criticalCount += anns.filter((a: any) => a.priority === 'critical').length;
              processedSheets++;
            }
            continue;
          }
        }

        console.log(`[ANNOTATION EXTRACTION] Processing ${document.name}...`);

        // Skip if no cloud storage path
        if (!document.cloud_storage_path) {
          console.log(`[ANNOTATION EXTRACTION] Skipping ${document.name} - no cloud storage path`);
          continue;
        }

        // Download file from S3
        const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Create temp directory for processing
        const tempDir = `/tmp/ann-extract-${document.id}-${Date.now()}`;
        await execAsync(`mkdir -p ${tempDir}`);

        const pdfPath = path.join(tempDir, 'document.pdf');
        fs.writeFileSync(pdfPath, buffer);

        // Get sheet number from document metadata
        const sheetNumber = ((document as any).metadata)?.sheetNumber || document.name.replace(/\.pdf$/i, '');

        // Convert first page to image
        const imagePath = path.join(tempDir, 'page.jpg');
        await execAsync(
          `pdftoppm -jpeg -f 1 -l 1 -scale-to 2048 "${pdfPath}" "${tempDir}/page"`
        );

        // Check if image was created
        const actualImagePath = path.join(tempDir, 'page-1.jpg');
        if (!fs.existsSync(actualImagePath)) {
          throw new Error('Failed to convert PDF to image');
        }

        // Read image and convert to base64
        const imageBuffer = fs.readFileSync(actualImagePath);
        const imageBase64 = imageBuffer.toString('base64');

        // Extract annotations using vision
        console.log(`[ANNOTATION EXTRACTION] Analyzing ${sheetNumber} with GPT-5.2 Vision...`);
        const annotations = await extractAnnotationsWithVision(
          imageBase64,
          sheetNumber
        );

        console.log(`[ANNOTATION EXTRACTION] Extracted ${annotations.length} annotations from ${sheetNumber}`);

        // Transform to match component expectations
        const formattedAnnotations = annotations.map((ann, idx) => ({
          id: ann.id || `${document.id}-ann-${idx}`,
          type: ann.type,
          text: ann.text,
          priority: ann.priority as 'critical' | 'important' | 'informational',
          keywords: ann.tags,
          requirements: ann.type === 'requirement' ? [ann.text] : [],
          position: ann.boundingBox ? {
            x: ann.boundingBox.x,
            y: ann.boundingBox.y
          } : { x: 0, y: 0 },
          confidence: ann.confidence,
          context: ann.location,
          leaderLines: false
        }));

        // Calculate average confidence
        const avgConfidence = annotations.length > 0
          ? annotations.reduce((sum, a) => sum + a.confidence, 0) / annotations.length
          : 0.85;

        // Count critical annotations
        const critical = annotations.filter(a => a.priority === 'critical').length;

        // Store in database
        await prisma.enhancedAnnotation.upsert({
          where: {
            projectId_documentId_sheetNumber: {
              projectId: project.id,
              documentId: document.id,
              sheetNumber
            }
          },
          create: {
            projectId: project.id,
            documentId: document.id,
            sheetNumber,
            annotations: formattedAnnotations,
            confidence: avgConfidence
          },
          update: {
            annotations: formattedAnnotations,
            confidence: avgConfidence,
            extractedAt: new Date()
          }
        });

        totalAnnotations += annotations.length;
        criticalCount += critical;
        processedSheets++;

        // Cleanup temp files
        await execAsync(`rm -rf ${tempDir}`);

      } catch (error: any) {
        console.error(`[ANNOTATION EXTRACTION] Error processing ${document.name}:`, error);
        errors.push(`${document.name}: ${error.message}`);
      }
    }

    console.log(`[ANNOTATION EXTRACTION] Complete. Extracted ${totalAnnotations} annotations (${criticalCount} critical) from ${processedSheets} sheets.`);

    return NextResponse.json({
      success: true,
      message: `Successfully extracted annotations from ${processedSheets} sheets`,
      processed: processedSheets,
      totalAnnotations,
      criticalCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error extracting annotations:', error);
    return NextResponse.json({ 
      error: 'Failed to extract annotations',
      details: error.message 
    }, { status: 500 });
  }
}
