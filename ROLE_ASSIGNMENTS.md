# ForemanOS Improvement - Role Assignments

**Project:** ForemanOS Code Quality Improvements  
**Date:** January 27, 2026  
**Status:** Active

---

## Overview

This document assigns specific roles and tasks for the ForemanOS improvement project to **Claude**, **Codex**, and **Cursor**. Work is organized to enable parallel development while maintaining clear coordination points.

---

## Agent Strengths & Focus Areas

### 🤖 Claude (Primary Architect & Refactorer)
**Strengths:**
- Complex architecture decisions
- Large-scale refactoring
- Multi-file coordination
- Type system design
- Error handling patterns

**Focus:** Phase 1 (Material Takeoff Manager) and Phase 2 (Chat API Route)

### 🔧 Codex (Utilities & Infrastructure)
**Strengths:**
- Focused utility functions
- Type definitions
- Test writing
- Small, well-defined tasks
- Code quality improvements

**Focus:** Phase 4 (TypeScript Types), Phase 5 (Error Handling), Phase 6 (Code Quality)

### 🖥️ Cursor (Built-in AI Features)
**Strengths:**
- Codebase indexing and semantic search
- Inline AI suggestions
- Native chat interface
- Multi-file context awareness
- Pattern recognition from codebase
- Quick refactoring via inline suggestions
- Code navigation via semantic search
- Code review using codebase indexing

**Focus:** Phase 3 (Project Page), Testing, Review, and Coordination

---

## Detailed Role Assignments

### Phase 1: Material Takeoff Manager Refactoring

#### Claude's Responsibilities
**Priority: High | Estimated Time: 3-4 days**

1. **Component Architecture & Orchestration**
   - [ ] Create `components/takeoff/` directory structure
   - [ ] Refactor main `MaterialTakeoffManager.tsx` into orchestrator (~200 lines)
   - [ ] Design component interfaces and prop types
   - [ ] Coordinate component integration

2. **Core Component Development**
   - [ ] `TakeoffTable.tsx` (~400 lines) - Main table component with virtualization
   - [ ] `TakeoffFilters.tsx` (~200 lines) - Search and filter UI
   - [ ] `TakeoffActions.tsx` (~300 lines) - Bulk actions and export buttons
   - [ ] `TakeoffSummary.tsx` (~150 lines) - Cost summary display
   - [ ] `TakeoffModals.tsx` (~150 lines) - Modal wrapper component

3. **Custom Hooks Development**
   - [ ] `hooks/useTakeoffData.ts` - Data fetching and state management
   - [ ] `hooks/useTakeoffFilters.ts` - Filtering logic and state
   - [ ] `hooks/useTakeoffSelection.ts` - Selection management
   - [ ] `hooks/useTakeoffCalculations.ts` - Cost calculations

4. **Integration & Testing**
   - [ ] Ensure backward compatibility with existing usage
   - [ ] Test component integration
   - [ ] Verify no breaking changes

**Commit Convention:** `[CLAUDE] Phase 1: Refactor Material Takeoff Manager`

#### Codex's Responsibilities
**Priority: High | Estimated Time: 2-3 days**

1. **Utility Functions**
   - [ ] `lib/takeoff-calculations.ts` - All calculation functions
   - [ ] `lib/takeoff-formatters.ts` - Formatting utilities
   - [ ] `lib/takeoff-grouping.ts` - CSI division and category grouping

2. **Type Definitions**
   - [ ] `types/takeoff.ts` - All takeoff-related interfaces
   - [ ] Update existing types to remove `any` types
   - [ ] Add JSDoc comments to all exported functions

3. **Unit Tests**
   - [ ] `__tests__/lib/takeoff-calculations.test.ts`
   - [ ] `__tests__/lib/takeoff-formatters.test.ts`
   - [ ] `__tests__/hooks/useTakeoffData.test.ts`

**Commit Convention:** `[CODEX] Phase 1: Add takeoff utilities and types`

#### Cursor's Responsibilities
**Priority: Medium | Estimated Time: 1-2 days**

1. **Review & Testing**
   - [ ] Review Claude's component architecture
   - [ ] Test Material Takeoff Manager in browser
   - [ ] Verify all features still work (filtering, export, bulk actions)
   - [ ] Performance testing with large datasets

2. **Product Decisions**
   - [ ] Approve component structure
   - [ ] Validate UI/UX improvements
   - [ ] Prioritize any additional features

**Commit Convention:** `[CURSOR] Phase 1: Review and test Material Takeoff Manager`

---

### Phase 2: Chat API Route Refactoring

#### Claude's Responsibilities
**Priority: High | Estimated Time: 3-4 days**

1. **Middleware Extraction**
   - [ ] Create `lib/chat/middleware/` directory
   - [ ] `lib/chat/middleware/auth-check.ts` - Authentication logic
   - [ ] `lib/chat/middleware/rate-limit-check.ts` - Rate limiting
   - [ ] `lib/chat/middleware/query-validation.ts` - Input validation
   - [ ] `lib/chat/middleware/maintenance-check.ts` - Maintenance mode

2. **Processor Extraction**
   - [ ] Create `lib/chat/processors/` directory
   - [ ] `lib/chat/processors/context-builder.ts` - RAG context building
   - [ ] `lib/chat/processors/llm-handler.ts` - LLM request handling
   - [ ] `lib/chat/processors/response-streamer.ts` - Response streaming
   - [ ] `lib/chat/processors/conversation-manager.ts` - Conversation logic

3. **Main Route Refactoring**
   - [ ] Refactor `app/api/chat/route.ts` to use extracted modules
   - [ ] Reduce from 1,310 lines to ~300 lines
   - [ ] Maintain all existing functionality
   - [ ] Ensure backward compatibility

4. **Integration Testing**
   - [ ] Test chat functionality end-to-end
   - [ ] Verify rate limiting still works
   - [ ] Test error handling paths

**Commit Convention:** `[CLAUDE] Phase 2: Refactor Chat API route`

#### Codex's Responsibilities
**Priority: Medium | Estimated Time: 2 days**

1. **Utility Functions**
   - [ ] `lib/chat/utils/query-classifier.ts` - Query type classification
   - [ ] `lib/chat/utils/follow-up-generator.ts` - Follow-up question generation
   - [ ] `lib/chat/utils/response-formatter.ts` - Response formatting

2. **Type Definitions**
   - [ ] `types/chat.ts` - Chat-related interfaces
   - [ ] Update middleware return types
   - [ ] Add JSDoc comments

3. **Unit Tests**
   - [ ] `__tests__/lib/chat/utils/query-classifier.test.ts`
   - [ ] `__tests__/lib/chat/middleware/auth-check.test.ts`
   - [ ] `__tests__/lib/chat/middleware/rate-limit-check.test.ts`

**Commit Convention:** `[CODEX] Phase 2: Add chat utilities and tests`

#### Cursor's Responsibilities
**Priority: Medium | Estimated Time: 1 day**

1. **Testing**
   - [ ] Test chat functionality in browser
   - [ ] Verify RAG retrieval still works correctly
   - [ ] Test rate limiting behavior
   - [ ] Test error scenarios

2. **Review**
   - [ ] Review refactored route structure
   - [ ] Validate middleware extraction
   - [ ] Approve processor design

**Commit Convention:** `[CURSOR] Phase 2: Test and review Chat API refactoring`

---

### Phase 3: Project Page Refactoring

#### Cursor's Responsibilities (Primary)
**Priority: Medium | Estimated Time: 2-3 days**

1. **Component Extraction**
   - [ ] Create `components/project/` directory
   - [ ] `components/project/ProjectHeader.tsx` - Header component
   - [ ] `components/project/ProjectNavigation.tsx` - Navigation component
   - [ ] `components/project/ProjectModals.tsx` - Modal management
   - [ ] `components/project/ProjectContent.tsx` - Main content area

2. **Hook Development**
   - [ ] `hooks/useProjectPage.ts` - Project page state management

3. **Main Page Refactoring**
   - [ ] Refactor `app/project/[slug]/page.tsx` to use new components
   - [ ] Reduce from 1,225+ lines to ~400 lines

**Commit Convention:** `[CURSOR] Phase 3: Refactor Project page`

#### Claude's Support Role
**Priority: Low | Estimated Time: 1 day (as needed)**

- [ ] Code review of extracted components
- [ ] Architecture suggestions
- [ ] Help with complex state management if needed

**Commit Convention:** `[CLAUDE] Phase 3: Review and support Project page refactoring`

#### Codex's Support Role
**Priority: Low | Estimated Time: 0.5 days (as needed)**

- [ ] Add type definitions if needed
- [ ] Write unit tests for `useProjectPage` hook

**Commit Convention:** `[CODEX] Phase 3: Add types and tests for Project page`

---

### Phase 4: TypeScript Type Improvements

#### Codex's Responsibilities (Primary)
**Priority: High | Estimated Time: 2 days**

1. **Type Definitions**
   - [ ] `types/takeoff.ts` - Takeoff interfaces (CostSummary, MEPData, BudgetItem)
   - [ ] `types/report.ts` - Report interfaces (ReportData)
   - [ ] `types/api-errors.ts` - API error interfaces

2. **Remove `any` Types**
   - [ ] Fix `lib/email-service.ts` line 112: `errorData: any`
   - [ ] Fix `components/material-takeoff-manager.tsx` lines 142-145
   - [ ] Fix `components/annotation-browser.tsx` line 361: `as any`
   - [ ] Fix `components/dimension-browser.tsx` line 340: `as any`
   - [ ] Fix `lib/report-finalization.ts` line 959: `reportData as any`

3. **Type Safety Improvements**
   - [ ] Add type guards where needed
   - [ ] Ensure strict TypeScript compliance
   - [ ] Add JSDoc type annotations

**Commit Convention:** `[CODEX] Phase 4: Fix TypeScript types and remove any`

#### Claude's Support Role
**Priority: Low | Estimated Time: 0.5 days (as needed)**

- [ ] Review type definitions for correctness
- [ ] Help with complex type scenarios
- [ ] Validate type safety improvements

**Commit Convention:** `[CLAUDE] Phase 4: Review TypeScript improvements`

#### Cursor's Responsibilities
**Priority: Low | Estimated Time: 0.5 days**

- [ ] Verify no type errors in build
- [ ] Test that fixes don't break functionality
- [ ] Approve type definitions

**Commit Convention:** `[CURSOR] Phase 4: Verify TypeScript type fixes`

---

### Phase 5: Error Handling Standardization

#### Codex's Responsibilities (Primary)
**Priority: Medium | Estimated Time: 2-3 days**

1. **Standard Error Handler**
   - [ ] `lib/api-error-handler.ts` - Centralized error handling
   - [ ] Implement all error handler methods
   - [ ] Standard error response format

2. **Update API Routes**
   - [ ] `app/api/projects/[slug]/route.ts`
   - [ ] `app/api/documents/upload/route.ts`
   - [ ] `app/api/dashboard/route.ts`
   - [ ] All routes in `app/api/projects/[slug]/`

3. **Error Response Format**
   - [ ] Ensure consistent error format across all routes
   - [ ] Add proper HTTP status codes
   - [ ] Include error codes for client handling

**Commit Convention:** `[CODEX] Phase 5: Standardize error handling`

#### Claude's Support Role
**Priority: Low | Estimated Time: 1 day (as needed)**

- [ ] Review error handler design
- [ ] Help with complex error scenarios
- [ ] Validate error response format

**Commit Convention:** `[CLAUDE] Phase 5: Review error handling standardization`

#### Cursor's Responsibilities
**Priority: Low | Estimated Time: 1 day**

- [ ] Test error scenarios in browser
- [ ] Verify error messages are user-friendly
- [ ] Test error handling in different scenarios

**Commit Convention:** `[CURSOR] Phase 5: Test error handling improvements`

---

### Phase 6: Code Quality Improvements

#### Codex's Responsibilities (Primary)
**Priority: Medium | Estimated Time: 2 days**

1. **Component Optimization**
   - [ ] Add React.memo to large list components
   - [ ] Implement virtualization for tables with >100 items
   - [ ] Lazy load modal components

2. **Documentation**
   - [ ] Add JSDoc comments to all exported functions
   - [ ] Document complex algorithms
   - [ ] Add inline comments for non-obvious code

3. **Code Cleanup**
   - [ ] Remove unused imports
   - [ ] Fix linting issues
   - [ ] Improve code formatting consistency

**Commit Convention:** `[CODEX] Phase 6: Code quality improvements`

#### Claude's Support Role
**Priority: Low | Estimated Time: 0.5 days (as needed)**

- [ ] Review optimization strategies
- [ ] Help with performance improvements
- [ ] Validate documentation quality

**Commit Convention:** `[CLAUDE] Phase 6: Review code quality improvements`

#### Cursor's Responsibilities
**Priority: Low | Estimated Time: 0.5 days**

- [ ] Verify performance improvements
- [ ] Review documentation
- [ ] Approve code quality changes

**Commit Convention:** `[CURSOR] Phase 6: Review code quality improvements`

---

## Coordination & Workflow

### Daily Standup Points

**Check `.workflow-status.json` for:**
- Current work status
- Completed tasks
- Blockers
- Next steps

### Handoff Points

1. **Claude → Codex**
   - When components need utility functions
   - When types are needed for new interfaces
   - When tests are needed for new code

2. **Codex → Claude**
   - When utilities are ready for integration
   - When type definitions are complete
   - When tests reveal issues

3. **Both → Cursor**
   - When code is ready for review
   - When testing is needed
   - When product decisions are required

### Parallel Work Opportunities

**Can work in parallel:**
- Phase 1 (Claude) + Phase 4 (Codex) - Types can be defined while components are built
- Phase 2 (Claude) + Phase 5 (Codex) - Error handling can be standardized while route is refactored
- Phase 3 (Cursor) + Phase 6 (Codex) - Code quality can be improved while project page is refactored

**Must be sequential:**
- Phase 1 → Phase 4 (types) - Types should be defined before or alongside components
- Phase 2 → Phase 5 (error handling) - Error handler should be ready before route refactoring

### Communication Protocol

1. **Update `.workflow-status.json`** after completing each task
2. **Commit with proper prefix** (`[CLAUDE]`, `[CODEX]`, `[CURSOR]`)
3. **Update `WORKFLOW_LOG.md`** with progress notes
4. **Use commit messages** to communicate changes clearly

### Conflict Resolution

**If conflicts arise:**
1. Check `.workflow-status.json` for current work
2. Communicate via commit messages or workflow log
3. Cursor makes final decision on conflicts
4. Use feature branches if needed for parallel work

---

## Timeline & Milestones

### Week 1: Foundation
- **Day 1-2:** Claude starts Phase 1 (Material Takeoff Manager)
- **Day 1-2:** Codex starts Phase 4 (TypeScript Types) - can work in parallel
- **Day 3-4:** Claude continues Phase 1, Codex provides types
- **Day 5:** Cursor reviews and tests Phase 1

### Week 2: API Refactoring
- **Day 1-2:** Claude starts Phase 2 (Chat API Route)
- **Day 1-2:** Codex starts Phase 5 (Error Handling) - can work in parallel
- **Day 3-4:** Claude continues Phase 2, Codex provides error handler
- **Day 5:** Cursor reviews and tests Phase 2

### Week 3: Project Page & Polish
- **Day 1-2:** Cursor works on Phase 3 (Project Page)
- **Day 1-2:** Codex works on Phase 6 (Code Quality) - can work in parallel
- **Day 3-4:** Cursor continues Phase 3, Codex continues Phase 6
- **Day 5:** Final review and integration testing

### Week 4: Testing & Documentation
- **Day 1-2:** Comprehensive testing
- **Day 3-4:** Documentation updates
- **Day 5:** Final review and deployment preparation

---

## Success Metrics

### Quantitative Goals
- [ ] All files under 500 lines per component
- [ ] Zero `any` types in active code
- [ ] 100% of API routes use standard error handler
- [ ] 60% test coverage for new/refactored code

### Qualitative Goals
- [ ] Clear component structure
- [ ] Well-documented code
- [ ] Easy to maintain and extend
- [ ] No performance regressions

---

## Notes

- **Flexibility:** Roles can be adjusted based on progress and availability
- **Communication:** Regular updates in `.workflow-status.json` are critical
- **Quality:** All code should be reviewed before merging
- **Testing:** Cursor testing is required before considering any phase complete

---

## Approval

**Status:** Ready for execution  
**Next Step:** Update `.workflow-status.json` with initial assignments and begin Phase 1
