/**
 * Location-Based Visual Annotations System
 * Enables users to pin notes, markups, and comments directly onto drawing locations
 * 
 * Features:
 * - Click-to-pin annotations on drawings
 * - Grid-based coordinate system
 * - Multi-user collaboration
 * - Annotation threads and discussions
 * - Export and reporting
 */

import { prisma } from './db';
import type { GridCoordinate } from './spatial-correlation';
import { parseGridCoordinate } from './spatial-correlation';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface VisualAnnotation {
  id: string;
  projectSlug: string;
  sheetNumber: string;
  position: {
    x: number; // Percentage of drawing width (0-100)
    y: number; // Percentage of drawing height (0-100)
    grid?: GridCoordinate; // Associated grid location if available
  };
  type: 'note' | 'issue' | 'rfi' | 'markup' | 'approval' | 'general';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  content: {
    title: string;
    description: string;
    tags?: string[];
  };
  author: {
    email: string;
    name: string;
  };
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  replies: AnnotationReply[];
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
  }>;
  metadata?: {
    discipline?: string;
    relatedAnnotations?: string[];
    [key: string]: any;
  };
}

export interface AnnotationReply {
  id: string;
  author: {
    email: string;
    name: string;
  };
  content: string;
  createdAt: Date;
  editedAt?: Date;
}

export interface AnnotationFilter {
  projectSlug: string;
  sheetNumber?: string;
  type?: VisualAnnotation['type'];
  status?: VisualAnnotation['status'];
  priority?: VisualAnnotation['priority'];
  author?: string;
  assignedTo?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
}

export interface AnnotationStats {
  total: number;
  byType: Record<VisualAnnotation['type'], number>;
  byStatus: Record<VisualAnnotation['status'], number>;
  byPriority: Record<VisualAnnotation['priority'], number>;
  bySheet: Record<string, number>;
  avgResolutionTime?: number; // In hours
  openIssues: number;
}

// ============================================================================
// IN-MEMORY STORAGE (Replace with database in production)
// ============================================================================

const annotationStore = new Map<string, VisualAnnotation[]>();

// ============================================================================
// ANNOTATION CRUD
// ============================================================================

/**
 * Create a new visual annotation
 */
export async function createAnnotation(
  annotation: Omit<VisualAnnotation, 'id' | 'createdAt' | 'updatedAt' | 'replies'>
): Promise<VisualAnnotation> {
  const newAnnotation: VisualAnnotation = {
    ...annotation,
    id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    replies: []
  };

  // Store annotation
  const projectAnnotations = annotationStore.get(annotation.projectSlug) || [];
  projectAnnotations.push(newAnnotation);
  annotationStore.set(annotation.projectSlug, projectAnnotations);

  return newAnnotation;
}

/**
 * Get annotation by ID
 */
export async function getAnnotationById(
  annotationId: string
): Promise<VisualAnnotation | null> {
  for (const annotations of annotationStore.values()) {
    const annotation = annotations.find(a => a.id === annotationId);
    if (annotation) return annotation;
  }
  return null;
}

/**
 * Update annotation
 */
export async function updateAnnotation(
  annotationId: string,
  updates: Partial<Omit<VisualAnnotation, 'id' | 'createdAt' | 'projectSlug'>>
): Promise<VisualAnnotation | null> {
  for (const [projectSlug, annotations] of annotationStore.entries()) {
    const index = annotations.findIndex(a => a.id === annotationId);
    if (index >= 0) {
      const updated = {
        ...annotations[index],
        ...updates,
        updatedAt: new Date(),
        resolvedAt: updates.status === 'resolved' ? new Date() : annotations[index].resolvedAt
      };
      annotations[index] = updated;
      annotationStore.set(projectSlug, annotations);
      return updated;
    }
  }
  return null;
}

/**
 * Delete annotation
 */
export async function deleteAnnotation(
  annotationId: string
): Promise<boolean> {
  for (const [projectSlug, annotations] of annotationStore.entries()) {
    const index = annotations.findIndex(a => a.id === annotationId);
    if (index >= 0) {
      annotations.splice(index, 1);
      annotationStore.set(projectSlug, annotations);
      return true;
    }
  }
  return false;
}

// ============================================================================
// QUERIES & FILTERING
// ============================================================================

/**
 * Get annotations with filtering
 */
export async function getAnnotations(
  filter: AnnotationFilter
): Promise<VisualAnnotation[]> {
  let annotations = annotationStore.get(filter.projectSlug) || [];

  // Apply filters
  if (filter.sheetNumber) {
    annotations = annotations.filter(a => a.sheetNumber === filter.sheetNumber);
  }

  if (filter.type) {
    annotations = annotations.filter(a => a.type === filter.type);
  }

  if (filter.status) {
    annotations = annotations.filter(a => a.status === filter.status);
  }

  if (filter.priority) {
    annotations = annotations.filter(a => a.priority === filter.priority);
  }

  if (filter.author) {
    annotations = annotations.filter(a => a.author.email === filter.author);
  }

  if (filter.assignedTo) {
    annotations = annotations.filter(a => a.assignedTo === filter.assignedTo);
  }

  if (filter.dateFrom) {
    annotations = annotations.filter(a => a.createdAt >= filter.dateFrom!);
  }

  if (filter.dateTo) {
    annotations = annotations.filter(a => a.createdAt <= filter.dateTo!);
  }

  if (filter.tags && filter.tags.length > 0) {
    annotations = annotations.filter(a =>
      a.content.tags?.some(tag => filter.tags!.includes(tag))
    );
  }

  // Sort by creation date (newest first)
  annotations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return annotations;
}

/**
 * Get annotations for a specific sheet
 */
export async function getSheetAnnotations(
  projectSlug: string,
  sheetNumber: string
): Promise<VisualAnnotation[]> {
  return getAnnotations({ projectSlug, sheetNumber });
}

/**
 * Get annotation statistics
 */
export async function getAnnotationStats(
  projectSlug: string
): Promise<AnnotationStats> {
  const annotations = annotationStore.get(projectSlug) || [];

  const stats: AnnotationStats = {
    total: annotations.length,
    byType: {
      note: 0,
      issue: 0,
      rfi: 0,
      markup: 0,
      approval: 0,
      general: 0
    },
    byStatus: {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0
    },
    byPriority: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    bySheet: {},
    openIssues: 0
  };

  let totalResolutionTime = 0;
  let resolvedCount = 0;

  for (const annotation of annotations) {
    // Count by type
    stats.byType[annotation.type]++;

    // Count by status
    stats.byStatus[annotation.status]++;

    // Count by priority
    stats.byPriority[annotation.priority]++;

    // Count by sheet
    stats.bySheet[annotation.sheetNumber] = 
      (stats.bySheet[annotation.sheetNumber] || 0) + 1;

    // Count open issues
    if (annotation.status === 'open') {
      stats.openIssues++;
    }

    // Calculate resolution time
    if (annotation.resolvedAt) {
      const resolutionTime = 
        annotation.resolvedAt.getTime() - annotation.createdAt.getTime();
      totalResolutionTime += resolutionTime;
      resolvedCount++;
    }
  }

  // Average resolution time in hours
  if (resolvedCount > 0) {
    stats.avgResolutionTime = totalResolutionTime / resolvedCount / (1000 * 60 * 60);
  }

  return stats;
}

// ============================================================================
// REPLIES & COLLABORATION (Using Prisma Database)
// ============================================================================

/**
 * Add a reply to an annotation (persisted to database)
 */
export async function addAnnotationReply(
  annotationId: string,
  reply: { content: string; userId: string }
): Promise<AnnotationReply | null> {
  try {
    // Verify annotation exists
    const annotation = await prisma.visualAnnotation.findUnique({
      where: { id: annotationId },
      select: { id: true }
    });

    if (!annotation) return null;

    // Create reply in database
    const dbReply = await prisma.annotationReply.create({
      data: {
        annotationId,
        content: reply.content,
        createdBy: reply.userId,
      },
      include: {
        User: {
          select: { email: true, username: true }
        }
      }
    });

    // Update annotation timestamp
    await prisma.visualAnnotation.update({
      where: { id: annotationId },
      data: { updatedAt: new Date() }
    });

    return {
      id: dbReply.id,
      author: {
        email: dbReply.User.email || '',
        name: dbReply.User.username || 'Unknown'
      },
      content: dbReply.content,
      createdAt: dbReply.createdAt
    };
  } catch (error) {
    console.error('[Visual Annotations] Error adding reply:', error);
    return null;
  }
}

/**
 * Update a reply (persisted to database)
 */
export async function updateAnnotationReply(
  annotationId: string,
  replyId: string,
  content: string
): Promise<boolean> {
  try {
    // Verify reply exists and belongs to annotation
    const existing = await prisma.annotationReply.findFirst({
      where: { id: replyId, annotationId }
    });

    if (!existing) return false;

    // Update reply in database
    await prisma.annotationReply.update({
      where: { id: replyId },
      data: { content }
    });

    // Update annotation timestamp
    await prisma.visualAnnotation.update({
      where: { id: annotationId },
      data: { updatedAt: new Date() }
    });

    return true;
  } catch (error) {
    console.error('[Visual Annotations] Error updating reply:', error);
    return false;
  }
}

/**
 * Delete a reply from database
 */
export async function deleteAnnotationReply(
  annotationId: string,
  replyId: string
): Promise<boolean> {
  try {
    // Verify reply exists and belongs to annotation
    const existing = await prisma.annotationReply.findFirst({
      where: { id: replyId, annotationId }
    });

    if (!existing) return false;

    await prisma.annotationReply.delete({
      where: { id: replyId }
    });

    return true;
  } catch (error) {
    console.error('[Visual Annotations] Error deleting reply:', error);
    return false;
  }
}

/**
 * Get all replies for an annotation from database
 */
export async function getAnnotationReplies(annotationId: string): Promise<AnnotationReply[]> {
  try {
    const replies = await prisma.annotationReply.findMany({
      where: { annotationId },
      include: {
        User: {
          select: { email: true, username: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return replies.map(r => ({
      id: r.id,
      author: {
        email: r.User.email || '',
        name: r.User.username || 'Unknown'
      },
      content: r.content,
      createdAt: r.createdAt
    }));
  } catch (error) {
    console.error('[Visual Annotations] Error getting replies:', error);
    return [];
  }
}

// ============================================================================
// SPATIAL QUERIES
// ============================================================================

/**
 * Find annotations near a specific location
 */
export async function findAnnotationsNearLocation(
  projectSlug: string,
  sheetNumber: string,
  x: number,
  y: number,
  radius: number = 5 // Percentage
): Promise<VisualAnnotation[]> {
  const annotations = await getSheetAnnotations(projectSlug, sheetNumber);

  return annotations.filter(annotation => {
    const dx = annotation.position.x - x;
    const dy = annotation.position.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= radius;
  });
}

/**
 * Find annotations at a specific grid location
 */
export async function findAnnotationsAtGrid(
  projectSlug: string,
  sheetNumber: string,
  grid: GridCoordinate
): Promise<VisualAnnotation[]> {
  const annotations = await getSheetAnnotations(projectSlug, sheetNumber);

  return annotations.filter(annotation => {
    if (!annotation.position.grid) return false;
    return (
      annotation.position.grid.x === grid.x &&
      annotation.position.grid.y === grid.y
    );
  });
}

// ============================================================================
// EXPORT
// ============================================================================

export const visualAnnotations = {
  createAnnotation,
  getAnnotationById,
  updateAnnotation,
  deleteAnnotation,
  getAnnotations,
  getSheetAnnotations,
  getAnnotationStats,
  addAnnotationReply,
  updateAnnotationReply,
  deleteAnnotationReply,
  getAnnotationReplies,
  findAnnotationsNearLocation,
  findAnnotationsAtGrid
};
