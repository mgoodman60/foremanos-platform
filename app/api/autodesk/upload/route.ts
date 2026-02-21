/**
 * Autodesk File Upload API Endpoint
 * Uploads design files to Autodesk OSS and starts translation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { uploadFile } from '@/lib/autodesk-oss';
import { safeErrorMessage } from '@/lib/api-error';
import { startTranslation, isSupportedFormat, SUPPORTED_FORMATS } from '@/lib/autodesk-model-derivative';
import { prisma } from '@/lib/db';
import { validateS3Config } from '@/lib/aws-config';
import { downloadFile } from '@/lib/s3';
import { createLogger } from '@/lib/logger';

const log = createLogger('autodesk-upload');

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

    // Determine if this is a presigned URL confirmation (JSON) or legacy FormData upload
    const contentTypeHeader = request.headers.get('content-type') || '';
    const isPresignedConfirm = contentTypeHeader.includes('application/json');

    let buffer: Buffer;
    let fileName: string;
    let fileType: string;
    let projectSlug: string;

    if (isPresignedConfirm) {
      // Presigned URL flow: file already in R2, download for Autodesk upload
      const body = await request.json();
      if (!body.cloudStoragePath || !body.fileName || !body.projectSlug) {
        return NextResponse.json(
          { error: 'Missing cloudStoragePath, fileName, or projectSlug' },
          { status: 400 }
        );
      }

      fileName = body.fileName;
      fileType = body.contentType || 'application/octet-stream';
      projectSlug = body.projectSlug;

      // Validate file format
      if (!isSupportedFormat(fileName)) {
        return NextResponse.json(
          { error: 'Unsupported file format', supported: SUPPORTED_FORMATS },
          { status: 400 }
        );
      }

      log.info( `Downloading file from R2 for Autodesk: ${fileName}`, {
        cloudStoragePath: body.cloudStoragePath,
      });
      buffer = await downloadFile(body.cloudStoragePath);
    } else {
      // Legacy FormData flow
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const slug = formData.get('projectSlug') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      if (!slug) {
        return NextResponse.json({ error: 'Project slug required' }, { status: 400 });
      }

      // Validate file format
      if (!isSupportedFormat(file.name)) {
        return NextResponse.json(
          { error: 'Unsupported file format', supported: SUPPORTED_FORMATS },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileName = file.name;
      fileType = file.type || 'application/octet-stream';
      projectSlug = slug;
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Upload to Autodesk OSS
    log.info( `Uploading file: ${fileName}`);
    const uploadResult = await uploadFile(fileName, buffer, fileType);

    // Start translation job
    log.info( `Starting translation for: ${uploadResult.objectId}`);
    const translation = await startTranslation(uploadResult.objectId);

    // Determine file type
    const fileExt = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    const is2DFile = ['.dwg', '.dxf', '.dwf', '.dwfx'].includes(fileExt);

    // Save model record to database
    const model = await prisma.autodeskModel.create({
      data: {
        projectId: project.id,
        fileName: fileName,
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
    scheduleStatusChecks(model.id);

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
    log.error('Upload error', error as Error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Upload failed') },
      { status: 500 }
    );
  }
}

/**
 * Schedule automatic status checks to trigger extraction when ready
 */
async function scheduleStatusChecks(modelId: string) {
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
        
        log.info('Checking translation status', { modelId, delay });
        
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
        
        log.info('Translation status update', { modelId, status: newStatus, progress: translationStatus.progress });
        
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
            log.info('Model complete, starting extraction', { modelId, fileType: isDWGFile ? 'DWG' : isBIMFile ? 'BIM' : 'Other' });
            
            try {
              if (isDWGFile) {
                // DWG/DXF file - extract layers, blocks, annotations
                log.info('Using DWG extractor', { fileName: model.fileName });
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
                
                log.info('DWG extraction complete', { modelId, totalLayers: dwgData.summary.totalLayers, totalBlocks: dwgData.summary.totalBlocks, totalAnnotations: dwgData.summary.totalAnnotations });
                
              } else if (isBIMFile) {
                // BIM file (Revit, IFC) - extract elements, properties
                log.info('Using BIM extractor', { fileName: model.fileName });
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
                
                log.info('BIM extraction complete', { modelId, importedItems: takeoffResult.importedItems });
                
              } else {
                // Other 3D file types - mark as ready without detailed extraction
                log.info('No specific extractor available, marking as ready', { fileExt });
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
              log.error('Extraction failed', extractError as Error, { modelId });
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
        log.error('Error checking model status', error as Error, { modelId });
      }
    }, delay);
  }
}
