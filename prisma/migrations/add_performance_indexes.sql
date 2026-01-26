-- Performance Optimization: Add Critical Indexes for 100+ User Scalability
-- Phase 1: Database Query Performance Optimization
-- Created: 2026-01-06

-- =============================================================================
-- DOCUMENT CHUNK INDEXES (Most Critical - Used in RAG queries)
-- =============================================================================

-- Index for project-specific chunk queries
CREATE INDEX IF NOT EXISTS idx_document_chunks_project 
  ON "DocumentChunk"("projectId");

-- Index for sheet number lookups (used in scale/dimension queries)
CREATE INDEX IF NOT EXISTS idx_document_chunks_sheet 
  ON "DocumentChunk"("sheet_number");

-- Index for document-specific chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_document 
  ON "DocumentChunk"("documentId");

-- Composite index for project + document queries
CREATE INDEX IF NOT EXISTS idx_document_chunks_project_document 
  ON "DocumentChunk"("projectId", "documentId");

-- Index for regulatory document chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_regulatory 
  ON "DocumentChunk"("regulatoryDocumentId") 
  WHERE "regulatoryDocumentId" IS NOT NULL;

-- =============================================================================
-- CONVERSATION INDEXES (High Traffic)
-- =============================================================================

-- Index for listing conversations by project (with sorting)
CREATE INDEX IF NOT EXISTS idx_conversations_project_date 
  ON "Conversation"("projectId", "createdAt" DESC);

-- Index for user's conversation history
CREATE INDEX IF NOT EXISTS idx_conversations_user_date 
  ON "Conversation"("userId", "createdAt" DESC);

-- Composite index for project + user queries
CREATE INDEX IF NOT EXISTS idx_conversations_project_user 
  ON "Conversation"("projectId", "userId");

-- =============================================================================
-- MESSAGE INDEXES (Chat Performance)
-- =============================================================================

-- Index for conversation messages (with ordering)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_date 
  ON "Message"("conversationId", "createdAt" ASC);

-- Index for user's messages
CREATE INDEX IF NOT EXISTS idx_messages_user 
  ON "Message"("userId");

-- =============================================================================
-- PROJECT INDEXES (Navigation & Access Control)
-- =============================================================================

-- Index for project slug lookups (used in URLs)
CREATE INDEX IF NOT EXISTS idx_projects_slug 
  ON "Project"("slug");

-- Index for project status filtering
CREATE INDEX IF NOT EXISTS idx_projects_status 
  ON "Project"("status");

-- Composite index for active project listings
CREATE INDEX IF NOT EXISTS idx_projects_status_date 
  ON "Project"("status", "createdAt" DESC);

-- =============================================================================
-- PROJECT MEMBER INDEXES (Access Control)
-- =============================================================================

-- Composite index for member lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_project_members_lookup 
  ON "ProjectMember"("projectId", "userId", "role");

-- Index for user's projects
CREATE INDEX IF NOT EXISTS idx_project_members_user 
  ON "ProjectMember"("userId");

-- Index for project team listing
CREATE INDEX IF NOT EXISTS idx_project_members_project 
  ON "ProjectMember"("projectId");

-- =============================================================================
-- DOCUMENT INDEXES (File Management)
-- =============================================================================

-- Index for project documents listing
CREATE INDEX IF NOT EXISTS idx_documents_project 
  ON "Document"("projectId");

-- Index for access level filtering
CREATE INDEX IF NOT EXISTS idx_documents_access 
  ON "Document"("accessLevel");

-- Composite index for project + access queries
CREATE INDEX IF NOT EXISTS idx_documents_project_access 
  ON "Document"("projectId", "accessLevel");

-- Index for document status
CREATE INDEX IF NOT EXISTS idx_documents_status 
  ON "Document"("status");

-- Index for document type filtering
CREATE INDEX IF NOT EXISTS idx_documents_type 
  ON "Document"("fileType");

-- =============================================================================
-- USER INDEXES (Authentication & Profile)
-- =============================================================================

-- Index for email lookups (login)
CREATE INDEX IF NOT EXISTS idx_users_email 
  ON "User"("email");

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username 
  ON "User"("username");

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role 
  ON "User"("role");

-- Index for approved users
CREATE INDEX IF NOT EXISTS idx_users_approved 
  ON "User"("approved") 
  WHERE "approved" = true;

-- =============================================================================
-- SESSION INDEXES (Authentication - if using database sessions)
-- =============================================================================

-- Note: After switching to JWT (Task 4), these may be less critical
-- but keeping for backward compatibility

CREATE INDEX IF NOT EXISTS idx_sessions_user 
  ON "Session"("userId");

CREATE INDEX IF NOT EXISTS idx_sessions_token 
  ON "Session"("sessionToken");

CREATE INDEX IF NOT EXISTS idx_sessions_expires 
  ON "Session"("expires");

-- =============================================================================
-- VISUAL ANNOTATION INDEXES (Phase C Features)
-- =============================================================================

-- Index for project annotations
CREATE INDEX IF NOT EXISTS idx_annotations_project 
  ON "VisualAnnotation"("projectId");

-- Index for document annotations
CREATE INDEX IF NOT EXISTS idx_annotations_document 
  ON "VisualAnnotation"("documentId");

-- Index for sheet-specific annotations
CREATE INDEX IF NOT EXISTS idx_annotations_sheet 
  ON "VisualAnnotation"("sheetNumber");

-- Composite index for document + sheet queries
CREATE INDEX IF NOT EXISTS idx_annotations_document_sheet 
  ON "VisualAnnotation"("documentId", "sheetNumber");

-- Index for annotation status filtering
CREATE INDEX IF NOT EXISTS idx_annotations_status 
  ON "VisualAnnotation"("status");

-- Index for assigned annotations
CREATE INDEX IF NOT EXISTS idx_annotations_assigned 
  ON "VisualAnnotation"("assignedTo");

-- =============================================================================
-- CUSTOM SYMBOL INDEXES (Phase C Features)
-- =============================================================================

-- Index for project symbols
CREATE INDEX IF NOT EXISTS idx_symbols_project 
  ON "CustomSymbol"("projectId");

-- Index for symbol category filtering
CREATE INDEX IF NOT EXISTS idx_symbols_category 
  ON "CustomSymbol"("category");

-- Index for high-confidence symbols
CREATE INDEX IF NOT EXISTS idx_symbols_confidence 
  ON "CustomSymbol"("confidence") 
  WHERE "confidence" >= 0.8;

-- =============================================================================
-- PERFORMANCE MONITORING
-- =============================================================================

-- After applying indexes, run these queries to verify performance:
-- EXPLAIN ANALYZE SELECT * FROM "DocumentChunk" WHERE "projectId" = 'xxx';
-- EXPLAIN ANALYZE SELECT * FROM "Conversation" WHERE "projectId" = 'xxx' ORDER BY "createdAt" DESC;
-- EXPLAIN ANALYZE SELECT * FROM "ProjectMember" WHERE "projectId" = 'xxx' AND "userId" = 'yyy';

-- Expected improvement: Query times should drop from 500ms+ to <50ms
-- Database CPU usage should drop by 60-70%
-- Connection pool exhaustion should be eliminated
