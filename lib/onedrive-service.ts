// OneDrive service for per-project document synchronization
// Uses Microsoft Graph API with per-project OAuth tokens

import { prisma } from './db';
import { uploadFile, deleteFile } from './s3';
import crypto from 'crypto';
import { processUnprocessedDocuments } from './document-processor';
import { suggestDocumentCategory } from './document-categorizer';
import { createScopedLogger } from './logger';
import type { OneDriveItem, OneDriveListResponse } from './types/report-data';

const log = createScopedLogger('ONEDRIVE');

export interface OneDriveConfig {
  projectId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
  folderId?: string;
}

export interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  '@microsoft.graph.downloadUrl': string;
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
      sha1Hash?: string;
    };
  };
}

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: string[];
}

export class OneDriveService {
  private accessToken: string;
  private refreshToken: string;
  private tokenExpiry: Date;
  private projectId: string;
  private folderId?: string;

  private static readonly CLIENT_ID = process.env.ONEDRIVE_CLIENT_ID || '';
  private static readonly CLIENT_SECRET = process.env.ONEDRIVE_CLIENT_SECRET || '';
  private static readonly TENANT_ID = process.env.ONEDRIVE_TENANT_ID || 'common';
  private static readonly REDIRECT_URI = (process.env.NEXTAUTH_URL || 'https://foremanos.vercel.app') + '/api/projects/onedrive/callback';

  constructor(config: OneDriveConfig) {
    this.projectId = config.projectId;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.tokenExpiry = config.tokenExpiry;
    this.folderId = config.folderId;
  }

  // Static method to generate OAuth authorization URL
  static getAuthUrl(projectSlug: string): string {
    const params = new URLSearchParams({
      client_id: OneDriveService.CLIENT_ID,
      response_type: 'code',
      redirect_uri: OneDriveService.REDIRECT_URI,
      response_mode: 'query',
      scope: 'Files.ReadWrite Files.ReadWrite.All offline_access',
      state: projectSlug, // Pass project slug in state
    });

    return `https://login.microsoftonline.com/${OneDriveService.TENANT_ID}/oauth2/v2.0/authorize?${params}`;
  }

  // Static method to exchange authorization code for tokens
  static async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const tokenUrl = `https://login.microsoftonline.com/${OneDriveService.TENANT_ID}/oauth2/v2.0/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: OneDriveService.CLIENT_ID,
        client_secret: OneDriveService.CLIENT_SECRET,
        code,
        redirect_uri: OneDriveService.REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  // Create service instance from project data
  static async fromProject(projectId: string): Promise<OneDriveService | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        oneDriveAccessToken: true,
        oneDriveRefreshToken: true,
        oneDriveTokenExpiry: true,
        oneDriveFolderId: true,
      },
    });

    if (!project || !project.oneDriveAccessToken || !project.oneDriveRefreshToken) {
      return null;
    }

    return new OneDriveService({
      projectId: project.id,
      accessToken: project.oneDriveAccessToken,
      refreshToken: project.oneDriveRefreshToken,
      tokenExpiry: project.oneDriveTokenExpiry || new Date(),
      folderId: project.oneDriveFolderId || undefined,
    });
  }

  // Get access token (refresh if expired)
  async getAccessToken(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Refresh token
    const tokenUrl = `https://login.microsoftonline.com/${OneDriveService.TENANT_ID}/oauth2/v2.0/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: OneDriveService.CLIENT_ID,
        client_secret: OneDriveService.CLIENT_SECRET,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
        scope: 'Files.ReadWrite Files.ReadWrite.All offline_access',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh OneDrive access token: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000) - 60000); // Subtract 1 minute for safety

    // Update tokens in database
    await prisma.project.update({
      where: { id: this.projectId },
      data: {
        oneDriveAccessToken: this.accessToken,
        oneDriveTokenExpiry: this.tokenExpiry,
      },
    });

    return this.accessToken;
  }

  // List folders in OneDrive root (for folder selection UI)
  async listFolders(): Promise<Array<{ id: string; name: string; path: string }>> {
    try {
      const token = await this.getAccessToken();
      
      const response = await fetch(
        'https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=folder ne null',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to list OneDrive folders');
      }

      const data = await response.json();
      return (data.value || []).map((item: OneDriveItem) => ({
        id: item.id,
        name: item.name,
        path: `/${item.name}`,
      }));
    } catch (error) {
      log.error('Error listing OneDrive folders', error);
      return [];
    }
  }

  // List all files in the configured folder
  async listFilesInFolder(): Promise<OneDriveFile[]> {
    if (!this.folderId) {
      throw new Error('No folder configured for this project');
    }

    try {
      const token = await this.getAccessToken();
      
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${this.folderId}/children?$filter=file ne null`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list files in folder: ${error}`);
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      log.error('Error listing OneDrive files', error);
      throw error;
    }
  }

  // Download a file from OneDrive
  async downloadFile(fileId: string): Promise<Buffer> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download file from OneDrive: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Create a folder in OneDrive (creates nested folders as needed)
  async createFolder(folderPath: string): Promise<string> {
    if (!OneDriveService.CLIENT_ID || !OneDriveService.CLIENT_SECRET) {
      throw new Error('OneDrive credentials not configured. Set ONEDRIVE_CLIENT_ID and ONEDRIVE_CLIENT_SECRET environment variables.');
    }

    const token = await this.getAccessToken();

    // Split path into segments and remove empty strings
    const pathSegments = folderPath.split('/').filter(segment => segment.length > 0);

    let parentId = 'root';
    let folderId = '';

    // Create each folder in the path
    for (const segment of pathSegments) {
      try {
        // Check if folder exists
        const checkResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children?$filter=name eq '${encodeURIComponent(segment)}' and folder ne null`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (!checkResponse.ok) {
          throw new Error(`Failed to check for existing folder: ${checkResponse.statusText}`);
        }

        const checkData = await checkResponse.json();

        if (checkData.value && checkData.value.length > 0) {
          // Folder exists
          folderId = checkData.value[0].id;
        } else {
          // Create folder
          const createResponse = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: segment,
                folder: {},
                '@microsoft.graph.conflictBehavior': 'rename',
              }),
            }
          );

          if (!createResponse.ok) {
            const error = await createResponse.text();
            throw new Error(`Failed to create folder '${segment}': ${error}`);
          }

          const createData = await createResponse.json();
          folderId = createData.id;
        }

        parentId = folderId;
      } catch (error) {
        log.error(`Error creating folder segment '${segment}'`, error);
        throw error;
      }
    }

    return folderId;
  }

  // Upload a file to OneDrive
  async uploadFile(
    buffer: Buffer,
    fileName: string,
    folderPath?: string
  ): Promise<{ fileId: string; webUrl: string }> {
    if (!OneDriveService.CLIENT_ID || !OneDriveService.CLIENT_SECRET) {
      throw new Error('OneDrive credentials not configured. Set ONEDRIVE_CLIENT_ID and ONEDRIVE_CLIENT_SECRET environment variables.');
    }

    const token = await this.getAccessToken();

    // Create folder if folderPath is provided
    let targetFolderId = 'root';
    if (folderPath) {
      targetFolderId = await this.createFolder(folderPath);
    }

    // Use simple upload for files < 4MB, otherwise use resumable upload
    const useSimpleUpload = buffer.length < 4 * 1024 * 1024;

    if (useSimpleUpload) {
      // Simple upload
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${targetFolderId}:/${encodeURIComponent(fileName)}:/content`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
          },
          body: buffer,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to upload file to OneDrive: ${error}`);
      }

      const data = await response.json();
      return {
        fileId: data.id,
        webUrl: data.webUrl,
      };
    } else {
      // Resumable upload for larger files
      // Create upload session
      const sessionResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${targetFolderId}:/${encodeURIComponent(fileName)}:/createUploadSession`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item: {
              '@microsoft.graph.conflictBehavior': 'replace',
              name: fileName,
            },
          }),
        }
      );

      if (!sessionResponse.ok) {
        const error = await sessionResponse.text();
        throw new Error(`Failed to create upload session: ${error}`);
      }

      const sessionData = await sessionResponse.json();
      const uploadUrl = sessionData.uploadUrl;

      // Upload file in chunks (10MB chunks)
      const chunkSize = 10 * 1024 * 1024;
      let offset = 0;

      while (offset < buffer.length) {
        const chunk = buffer.slice(offset, Math.min(offset + chunkSize, buffer.length));
        const chunkEnd = offset + chunk.length - 1;

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Length': chunk.length.toString(),
            'Content-Range': `bytes ${offset}-${chunkEnd}/${buffer.length}`,
          },
          body: chunk,
        });

        if (!uploadResponse.ok && uploadResponse.status !== 202) {
          const error = await uploadResponse.text();
          throw new Error(`Failed to upload chunk: ${error}`);
        }

        offset += chunk.length;

        // Last chunk returns the file metadata
        if (offset >= buffer.length) {
          const data = await uploadResponse.json();
          return {
            fileId: data.id,
            webUrl: data.webUrl,
          };
        }
      }

      throw new Error('Upload completed but no file metadata received');
    }
  }

  // Calculate hash of file content for change detection
  private calculateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // Check if file type is supported
  private isSupportedFileType(fileName: string, fileSize: number): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    // Define size limits (in bytes)
    const sizeLimits = {
      pdf: Infinity, // Uncapped
      doc: 25 * 1024 * 1024, // 25 MB
      docx: 25 * 1024 * 1024,
      xlsx: 25 * 1024 * 1024,
      xls: 25 * 1024 * 1024,
      jpg: Infinity, // Uncapped
      jpeg: Infinity,
      png: Infinity,
      gif: Infinity,
    };

    if (!ext || !(ext in sizeLimits)) {
      return false;
    }

    return fileSize <= sizeLimits[ext as keyof typeof sizeLimits];
  }

  // Sync documents from OneDrive with duplicate prevention and soft deletes
  async syncDocuments(): Promise<SyncResult> {
    const result: SyncResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Get all files from OneDrive folder
      const oneDriveFiles = await this.listFilesInFolder();
      
      // Get all existing documents for this project (including soft-deleted ones)
      const existingDocs = await prisma.document.findMany({
        where: {
          projectId: this.projectId,
          syncSource: 'onedrive_sync',
        },
      });

      // Track OneDrive file IDs we've seen
      const seenOneDriveIds = new Set<string>();

      // Process each OneDrive file
      for (const file of oneDriveFiles) {
        try {
          seenOneDriveIds.add(file.id);

          // Check if file type is supported
          if (!this.isSupportedFileType(file.name, file.size)) {
            result.skipped++;
            log.debug(`Skipping unsupported file`, { fileName: file.name, size: file.size });
            continue;
          }

          // Check if document already exists
          const existingDoc = existingDocs.find((doc: any) => doc.oneDriveId === file.id);
          
          const lastModified = new Date(file.lastModifiedDateTime);

          if (existingDoc) {
            // Check if file was modified or was previously soft-deleted
            const needsUpdate = 
              !existingDoc.lastModified || 
              lastModified > existingDoc.lastModified ||
              existingDoc.deletedAt !== null;

            if (needsUpdate) {
              // Download file
              const fileBuffer = await this.downloadFile(file.id);
              const fileHash = this.calculateFileHash(fileBuffer);

              // Only update if content actually changed or file was undeleted
              if (existingDoc.oneDriveHash !== fileHash || existingDoc.deletedAt !== null) {
                // Upload to S3
                const s3Key = await uploadFile(
                  fileBuffer,
                  `${this.projectId}/${Date.now()}-${file.name}`,
                  false // Not public
                );

                // Update document record
                await prisma.document.update({
                  where: { id: existingDoc.id },
                  data: {
                    name: file.name,
                    fileName: file.name,
                    cloud_storage_path: s3Key,
                    oneDriveHash: fileHash,
                    lastModified,
                    fileSize: file.size,
                    processed: false, // Mark for reprocessing
                    deletedAt: null, // Undelete if it was soft-deleted
                  },
                });

                // Delete old chunks for reprocessing
                await prisma.documentChunk.deleteMany({
                  where: { documentId: existingDoc.id },
                });

                result.updated++;
                log.info(`Updated document`, { fileName: file.name });
              } else {
                result.skipped++;
              }
            } else {
              result.skipped++;
            }
          } else {
            // New document - download and create
            const fileBuffer = await this.downloadFile(file.id);
            const fileHash = this.calculateFileHash(fileBuffer);

            // Upload to S3
            const s3Key = await uploadFile(
              fileBuffer,
              `${this.projectId}/${Date.now()}-${file.name}`,
              false
            );

            // Auto-categorize document using AI
            const fileType = file.name.split('.').pop() || 'unknown';
            let category = 'other';
            try {
              const suggestion = await suggestDocumentCategory(file.name, fileType);
              category = suggestion.suggestedCategory;
              log.info(`Auto-categorized document`, { fileName: file.name, category, confidence: suggestion.confidence });
            } catch (error) {
              log.error(`Failed to auto-categorize document`, error, { fileName: file.name });
            }

            // Create document record
            await prisma.document.create({
              data: {
                projectId: this.projectId,
                name: file.name,
                fileName: file.name,
                fileType,
                oneDriveId: file.id,
                oneDriveHash: fileHash,
                syncSource: 'onedrive_sync',
                accessLevel: 'client', // Default to client access
                category: category as any,
                cloud_storage_path: s3Key,
                isPublic: false,
                lastModified,
                fileSize: file.size,
                processed: false,
              },
            });

            result.added++;
            log.info(`Added new document`, { fileName: file.name });
          }
        } catch (error) {
          const errorMsg = `Error processing ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          log.error(errorMsg, error);
          result.errors.push(errorMsg);
        }
      }

      // Soft delete documents that are no longer in OneDrive
      for (const doc of existingDocs) {
        if (doc.oneDriveId && !seenOneDriveIds.has(doc.oneDriveId) && !doc.deletedAt) {
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              deletedAt: new Date(),
            },
          });
          result.deleted++;
          log.info(`Soft deleted document`, { fileName: doc.name });
        }
      }

    } catch (error) {
      const errorMsg = `Error syncing documents: ${error instanceof Error ? error.message : 'Unknown error'}`;
      log.error(errorMsg, error);
      result.errors.push(errorMsg);
    }

    // Process any unprocessed documents after sync completes
    log.info('Starting document processing for synced files');
    try {
      const processingResult = await processUnprocessedDocuments(this.projectId);
      log.info(`Document processing complete`, { processed: processingResult.processed, failed: processingResult.failed });

      // Add processing errors to sync result
      if (processingResult.errors.length > 0) {
        result.errors.push(...processingResult.errors);
      }
    } catch (error) {
      const errorMsg = `Error processing documents: ${error instanceof Error ? error.message : 'Unknown error'}`;
      log.error(errorMsg, error);
      result.errors.push(errorMsg);
    }

    return result;
  }
}
