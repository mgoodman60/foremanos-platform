export type DocumentCategory = string;

export interface DocumentLibraryProps {
  userRole: string;
  projectId: string;
  onDocumentsChange?: () => void;
}

export interface DocumentProgress {
  status: string;
  pagesProcessed: number;
  totalPages: number;
  percentComplete: number;
  currentPhase: string;
  estimatedTimeRemaining: number;
  queuePosition: number | null;
  error: string | null;
  currentBatch: number | null;
  totalBatches: number | null;
  startedAt?: string;
  lastActivityAt?: string;
  secondsPerPage?: number;
  elapsedSeconds?: number;
  concurrency?: number;
  activeBatches?: number[];
  failedBatchRanges?: string[];
  processingMode?: string;
}

export interface DocumentIntelligence {
  sheetCount: number;
  disciplines: string[];
  drawingTypes: Record<string, number>;
  averageConfidence: number | null;
  lowConfidenceCount: number;
}

export interface Document {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  accessLevel: string;
  category: string;
  filePath: string | null;
  fileSize: number | null;
  lastModified: string | null;
  updatedAt: string;
  queueStatus?: string;
  processed?: boolean;
  intelligence?: DocumentIntelligence | null;
}

export type ProcessingStage = 'upload' | 'scanning' | 'analysis' | 'extraction' | 'indexing' | 'complete';

export const PROCESSING_STAGES: { key: ProcessingStage; label: string; description: string }[] = [
  { key: 'upload', label: 'Upload Complete', description: 'File received and validated' },
  { key: 'scanning', label: 'Page Scanning', description: 'Extracting text and images' },
  { key: 'analysis', label: 'AI Analysis', description: 'Analyzing content with AI' },
  { key: 'extraction', label: 'Data Extraction', description: 'Extracting structured data' },
  { key: 'indexing', label: 'Indexing', description: 'Building search index' },
  { key: 'complete', label: 'Complete', description: 'Ready for queries' },
];
