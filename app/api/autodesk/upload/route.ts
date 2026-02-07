/**
 * Autodesk File Upload API Endpoint
 * Uploads design files to Autodesk OSS and starts translation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { uploadFile } from '@/lib/autodesk-oss';
import { startTranslation, isSupportedFormat, SUPPORTED_FORMATS } from '@/lib/autodesk-model-derivative';
import { prisma } from '@/lib/db';
import { validateS3Config } from '@/lib/aws-config';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const s3Check = validateS3Config();
    if (!s3Check.valid) {
      return NextResponse.json(
        { error: 'File storage is not configured. Please contact your administrator.' },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectSlug = formData.get('projectSlug') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!projectSlug) {
      return NextResponse.json({ error: 'Project slug required' }, { status: 400 });
    }

    // Validate file format
    if (!isSupportedFormat(file.name)) {
      return NextResponse.json(
        { 
          error: 'Unsupported file format', 
          supported: SUPPORTED_FORMATS 
        },
        { status: 400 }
      );
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Autodesk OSS
    console.log('[Autodesk Upload] Uploading file:', file.name);
    const uploadResult = await uploadFile(file.name, buffer, file.type || 'application/octet-stream');

    // Start translation job
    console.log('[Autodesk Upload] Starting translation for:', uploadResult.objectId);
    const translation = await startTranslation(uploadResult.objectId);

    // Determine file type
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const is2DFile = ['.dwg', '.dxf', '.dwf', '.dwfx'].includes(fileExt);
    
    // Save model record to database
    const model = await prisma.autodeskModel.create({
      data: {
        projectId: project.id,
        fileName: file.name,
        objectId: uploadResult.objectId,
        objectKey: uploadResult.objectKey,
        urn: translation.urn,
        status: 'processing',
        fileSize: buffer.length,
        uploadedBy: session.user.id,
        fileType: fileExt.replace('.', ''),
        is2D: is2DFile,
      },
    });

    // Schedule automatic status checks to trigger extraction
    // First check after 30 seconds, then 60 seconds, then 2 minutes
    scheduleStatusChecks(model.id, projectSlug);

    return NextResponse.json({
      success: true,
      model: {
        id: model.id,
        fileName: model.fileName,
        urn: model.urn,
        status: model.status,
      },
      message: 'File uploaded. Processing will complete automatically.',
    });
  } catch (error) {
    console.error('[Autodesk Upload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

/**
 * Schedule automatic status checks to trigger extraction when ready
 */
async function scheduleStatusChecks(modelId: string, _projectSlug: string) {
  // Import dynamically to avoid circular dependencies
  const { getTranslationStatus } = await import('@/lib/autodesk-model-derivative');
  const { extractBIMData } = await import('@/lib/bim-metadata-extractor');
  const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');
  const { indexBIMForRAG } = await import('@/lib/bim-rag-indexer');
  const { extractDWGMetadata, generateDWGSearchContent } = await import('@/lib/dwg-metadata-extractor');

  // Check delays: 30s, 60s, 120s, 300s (5 min)
  const delays = [30000, 60000, 120000, 300000];
  
  for (const delay of delays) {
    setTimeout(async () => {
      try {
        const model = await prisma.autodeskModel.findUnique({
          where: { id: modelId },
        });
        
        // Stop checking if already complete or failed
        if (!model || model.status === 'ready' || model.status === 'complete' || model.status === 'failed') {
          return;
        }
        
        console.log(`[Autodesk Auto-Check] Checking status for model ${modelId} (delay: ${delay}ms)`);
        
        // Check translation status directly
        const translationStatus = await getTranslationStatus(model.urn);
        
        // Map status
        let newStatus = model.status;
        if (translationStatus.status === 'success') {
          newStatus = 'complete';
        } else if (translationStatus.status === 'failed' || translationStatus.status === 'timeout') {
          newStatus = 'failed';
        } else if (translationStatus.status === 'inprogress') {
          newStatus = 'processing';
        }
        
        console.log(`[Autodesk Auto-Check] Model ${modelId}: ${newStatus} (${translationStatus.progress})`);
        
        // Detect file type for appropriate extraction
        const fileExt = model.fileName.toLowerCase().substring(model.fileName.lastIndexOf('.'));
        const isDWGFile = ['.dwg', '.dxf'].includes(fileExt);
        const isBIMFile = ['.rvt', '.rfa', '.ifc', '.nwd', '.nwc'].includes(fileExt);
        
        // Update status if changed
        if (newStatus !== model.status) {
          await prisma.autodeskModel.update({
            where: { id: model.id },
            data: { status: newStatus },
          });
          
          // Auto-trigger extraction when complete
          if (newStatus === 'complete') {
            console.log(`[Autodesk Auto-Check] Model ${modelId} complete, starting extraction... (Type: ${isDWGFile ? 'DWG' : isBIMFile ? 'BIM' : 'Other'})`);
            
            try {
              if (isDWGFile) {
                // DWG/DXF file - extract layers, blocks, annotations
                console.log(`[Autodesk Auto-Check] Using DWG extractor for ${model.fileName}`);
                const dwgData = await extractDWGMetadata(model.urn, model.fileName);
                const searchChunks = generateDWGSearchContent(dwgData);
                
                // Update model with DWG-specific metadata
                await prisma.autodeskModel.update({
                  where: { id: model.id },
                  data: {
                    status: 'ready',
                    extractedMetadata: {
                      ...dwgData,
                      searchChunks,
                    } as any,
                    lastExtractedAt: new Date(),
                    metadata: {
                      extracted: true,
                      extractedAt: new Date().toISOString(),
                      fileType: 'dwg',
                      totalLayers: dwgData.summary.totalLayers,
                      totalBlocks: dwgData.summary.totalBlocks,
                      totalAnnotations: dwgData.summary.totalAnnotations,
                      layerCategories: dwgData.layerCategories,
                      searchChunks: searchChunks.length,
                    },
                  },
                });
                
                console.log(`[Autodesk Auto-Check] DWG extraction complete for ${modelId}: ${dwgData.summary.totalLayers} layers, ${dwgData.summary.totalBlocks} blocks, ${dwgData.summary.totalAnnotations} annotations`);
                
              } else if (isBIMFile) {
                // BIM file (Revit, IFC) - extract elements, properties
                console.log(`[Autodesk Auto-Check] Using BIM extractor for ${model.fileName}`);
                const bimData = await extractBIMData(model.urn);
                
                // Import to takeoff
                const takeoffResult = await importBIMToTakeoff(model.projectId, model.id, bimData);
                
                // Index for RAG
                const ragChunks = await indexBIMForRAG(model.projectId, model.id, bimData);
                
                // Update model metadata
                await prisma.autodeskModel.update({
                  where: { id: model.id },
                  data: {
                    status: 'ready',
                    metadata: {
                      extracted: true,
                      extractedAt: new Date().toISOString(),
                      fileType: 'bim',
                      totalElements: bimData.totalElements,
                      summary: bimData.summary,
                      takeoffId: takeoffResult.takeoffId,
                      takeoffItems: takeoffResult.importedItems,
                      ragChunks,
                    },
                  },
                });
                
                console.log(`[Autodesk Auto-Check] BIM extraction complete for ${modelId}: ${takeoffResult.importedItems} items`);
                
              } else {
                // Other 3D file types - mark as ready without detailed extraction
                console.log(`[Autodesk Auto-Check] No specific extractor for ${fileExt}, marking as ready`);
                await prisma.autodeskModel.update({
                  where: { id: model.id },
                  data: {
                    status: 'ready',
                    metadata: {
                      extracted: false,
                      extractedAt: new Date().toISOString(),
                      fileType: fileExt.replace('.', ''),
                      note: 'Viewable but no detailed extraction available for this file type',
                    },
                  },
                });
              }
              
            } catch (extractError) {
              console.error(`[Autodesk Auto-Check] Extraction failed for ${modelId}:`, extractError);
              await prisma.autodeskModel.update({
                where: { id: model.id },
                data: {
                  status: 'ready', // Still viewable even if extraction failed
                  metadata: {
                    extracted: false,
                    extractionFailed: true,
                    extractionError: extractError instanceof Error ? extractError.message : 'Unknown error',
                  },
                },
              });
            }
          }
        }
      } catch (error) {
        console.error(`[Autodesk Auto-Check] Error checking model ${modelId}:`, error);
      }
    }, delay);
  }
}
