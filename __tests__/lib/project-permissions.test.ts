import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before importing
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

import {
  checkProjectAccess,
  requireProjectPermission,
  ProjectRole,
} from '@/lib/project-permissions';

describe('project-permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkProjectAccess', () => {
    describe('Project not found', () => {
      it('should return no access when project does not exist', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(null);

        const result = await checkProjectAccess('user-1', 'nonexistent-project');

        expect(result).toEqual({
          hasAccess: false,
          role: null,
          isOwner: false,
          canEdit: false,
          canDelete: false,
          canManageMembers: false,
          canViewDocuments: false,
          canUploadDocuments: false,
        });

        expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
          where: { slug: 'nonexistent-project' },
          include: {
            ProjectMember: {
              where: { userId: 'user-1' },
              select: { role: true },
            },
          },
        });
      });

      it('should handle database errors gracefully', async () => {
        mockPrisma.project.findUnique.mockRejectedValue(new Error('Database error'));

        await expect(
          checkProjectAccess('user-1', 'test-project')
        ).rejects.toThrow('Database error');
      });
    });

    describe('Owner access', () => {
      it('should grant full permissions to project owner', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('owner-1', 'test-project');

        expect(result).toEqual({
          hasAccess: true,
          role: 'owner',
          isOwner: true,
          canEdit: true,
          canDelete: true,
          canManageMembers: true,
          canViewDocuments: true,
          canUploadDocuments: true,
        });
      });

      it('should treat owner as having access even without membership', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('owner-1', 'test-project');

        expect(result.hasAccess).toBe(true);
        expect(result.isOwner).toBe(true);
        expect(result.role).toBe('owner');
      });

      it('should prioritize owner role even if user is also a member', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'viewer' }, // Owner is also listed as viewer
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('owner-1', 'test-project');

        expect(result.role).toBe('owner');
        expect(result.isOwner).toBe(true);
        expect(result.canDelete).toBe(true);
        expect(result.canManageMembers).toBe(true);
      });
    });

    describe('Editor access', () => {
      it('should grant edit permissions to editor', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'editor' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('editor-1', 'test-project');

        expect(result).toEqual({
          hasAccess: true,
          role: 'editor',
          isOwner: false,
          canEdit: true,
          canDelete: false,
          canManageMembers: false,
          canViewDocuments: true,
          canUploadDocuments: true,
        });
      });

      it('should allow editor to view and upload documents', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'editor' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('editor-1', 'test-project');

        expect(result.canViewDocuments).toBe(true);
        expect(result.canUploadDocuments).toBe(true);
        expect(result.canEdit).toBe(true);
      });

      it('should deny editor from deleting project', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'editor' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('editor-1', 'test-project');

        expect(result.canDelete).toBe(false);
        expect(result.canManageMembers).toBe(false);
      });
    });

    describe('Viewer access', () => {
      it('should grant view-only permissions to viewer', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'viewer' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('viewer-1', 'test-project');

        expect(result).toEqual({
          hasAccess: true,
          role: 'viewer',
          isOwner: false,
          canEdit: false,
          canDelete: false,
          canManageMembers: false,
          canViewDocuments: true,
          canUploadDocuments: false,
        });
      });

      it('should allow viewer to only view documents', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'viewer' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('viewer-1', 'test-project');

        expect(result.canViewDocuments).toBe(true);
        expect(result.canUploadDocuments).toBe(false);
        expect(result.canEdit).toBe(false);
        expect(result.canDelete).toBe(false);
        expect(result.canManageMembers).toBe(false);
      });
    });

    describe('No membership', () => {
      it('should deny access when user has no membership', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('random-user', 'test-project');

        expect(result).toEqual({
          hasAccess: false,
          role: null,
          isOwner: false,
          canEdit: false,
          canDelete: false,
          canManageMembers: false,
          canViewDocuments: false,
          canUploadDocuments: false,
        });
      });

      it('should deny all permissions when not a member', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('non-member', 'test-project');

        expect(result.hasAccess).toBe(false);
        expect(result.role).toBeNull();
        expect(result.canViewDocuments).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty userId', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('', 'test-project');

        expect(result.hasAccess).toBe(false);
        expect(result.isOwner).toBe(false);
      });

      it('should handle empty projectSlug', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(null);

        const result = await checkProjectAccess('user-1', '');

        expect(result.hasAccess).toBe(false);
      });

      it('should handle multiple memberships (take first)', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'editor' },
            { role: 'viewer' }, // Should not happen, but handle gracefully
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('user-1', 'test-project');

        // Should use first membership
        expect(result.role).toBe('editor');
        expect(result.canEdit).toBe(true);
      });

      it('should handle null role in membership', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: null },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('user-1', 'test-project');

        expect(result.role).toBeNull();
        expect(result.hasAccess).toBe(true); // Has membership but no role
        expect(result.canEdit).toBe(false);
      });

      it('should handle undefined role in membership', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            {},
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await checkProjectAccess('user-1', 'test-project');

        expect(result.role).toBeNull();
        expect(result.hasAccess).toBe(true);
      });
    });
  });

  describe('requireProjectPermission', () => {
    describe('View permission', () => {
      it('should allow view permission for all members', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'viewer' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('user-1', 'test-project', 'view');

        expect(result.allowed).toBe(true);
        expect(result.access.canViewDocuments).toBe(true);
      });

      it('should allow view permission for editors', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'editor' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('user-1', 'test-project', 'view');

        expect(result.allowed).toBe(true);
      });

      it('should allow view permission for owners', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('owner-1', 'test-project', 'view');

        expect(result.allowed).toBe(true);
      });

      it('should deny view permission for non-members', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('non-member', 'test-project', 'view');

        expect(result.allowed).toBe(false);
        expect(result.access.hasAccess).toBe(false);
      });
    });

    describe('Edit permission', () => {
      it('should allow edit permission for owners', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('owner-1', 'test-project', 'edit');

        expect(result.allowed).toBe(true);
        expect(result.access.canEdit).toBe(true);
      });

      it('should allow edit permission for editors', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'editor' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('editor-1', 'test-project', 'edit');

        expect(result.allowed).toBe(true);
        expect(result.access.canEdit).toBe(true);
      });

      it('should deny edit permission for viewers', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'viewer' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('viewer-1', 'test-project', 'edit');

        expect(result.allowed).toBe(false);
        expect(result.access.canEdit).toBe(false);
      });

      it('should deny edit permission for non-members', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('non-member', 'test-project', 'edit');

        expect(result.allowed).toBe(false);
      });
    });

    describe('Delete permission', () => {
      it('should allow delete permission only for owners', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('owner-1', 'test-project', 'delete');

        expect(result.allowed).toBe(true);
        expect(result.access.canDelete).toBe(true);
      });

      it('should deny delete permission for editors', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'editor' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('editor-1', 'test-project', 'delete');

        expect(result.allowed).toBe(false);
        expect(result.access.canDelete).toBe(false);
      });

      it('should deny delete permission for viewers', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'viewer' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('viewer-1', 'test-project', 'delete');

        expect(result.allowed).toBe(false);
      });

      it('should deny delete permission for non-members', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('non-member', 'test-project', 'delete');

        expect(result.allowed).toBe(false);
      });
    });

    describe('Manage members permission', () => {
      it('should allow manage_members permission only for owners', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('owner-1', 'test-project', 'manage_members');

        expect(result.allowed).toBe(true);
        expect(result.access.canManageMembers).toBe(true);
      });

      it('should deny manage_members permission for editors', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'editor' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('editor-1', 'test-project', 'manage_members');

        expect(result.allowed).toBe(false);
        expect(result.access.canManageMembers).toBe(false);
      });

      it('should deny manage_members permission for viewers', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'viewer' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('viewer-1', 'test-project', 'manage_members');

        expect(result.allowed).toBe(false);
      });
    });

    describe('Upload permission', () => {
      it('should allow upload permission for owners', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('owner-1', 'test-project', 'upload');

        expect(result.allowed).toBe(true);
        expect(result.access.canUploadDocuments).toBe(true);
      });

      it('should allow upload permission for editors', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'editor' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('editor-1', 'test-project', 'upload');

        expect(result.allowed).toBe(true);
        expect(result.access.canUploadDocuments).toBe(true);
      });

      it('should deny upload permission for viewers', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'viewer' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('viewer-1', 'test-project', 'upload');

        expect(result.allowed).toBe(false);
        expect(result.access.canUploadDocuments).toBe(false);
      });

      it('should deny upload permission for non-members', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const result = await requireProjectPermission('non-member', 'test-project', 'upload');

        expect(result.allowed).toBe(false);
      });
    });

    describe('Non-existent project', () => {
      it('should deny all permissions when project does not exist', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(null);

        const viewResult = await requireProjectPermission('user-1', 'nonexistent', 'view');
        const editResult = await requireProjectPermission('user-1', 'nonexistent', 'edit');
        const deleteResult = await requireProjectPermission('user-1', 'nonexistent', 'delete');
        const uploadResult = await requireProjectPermission('user-1', 'nonexistent', 'upload');
        const manageResult = await requireProjectPermission('user-1', 'nonexistent', 'manage_members');

        expect(viewResult.allowed).toBe(false);
        expect(editResult.allowed).toBe(false);
        expect(deleteResult.allowed).toBe(false);
        expect(uploadResult.allowed).toBe(false);
        expect(manageResult.allowed).toBe(false);
      });

      it('should return access object even when denied', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(null);

        const result = await requireProjectPermission('user-1', 'nonexistent', 'view');

        expect(result.access).toBeDefined();
        expect(result.access.hasAccess).toBe(false);
        expect(result.access.role).toBeNull();
      });
    });

    describe('Edge cases', () => {
      it('should handle all permission types', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const permissions: Array<'view' | 'edit' | 'delete' | 'manage_members' | 'upload'> = [
          'view',
          'edit',
          'delete',
          'manage_members',
          'upload',
        ];

        for (const permission of permissions) {
          const result = await requireProjectPermission('owner-1', 'test-project', permission);
          expect(result.allowed).toBe(true);
        }
      });

      it('should return consistent access object across permission checks', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [
            { role: 'editor' },
          ],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        const viewResult = await requireProjectPermission('editor-1', 'test-project', 'view');
        const editResult = await requireProjectPermission('editor-1', 'test-project', 'edit');

        expect(viewResult.access.role).toBe('editor');
        expect(editResult.access.role).toBe('editor');
        expect(viewResult.access.canEdit).toBe(editResult.access.canEdit);
      });

      it('should handle empty permission string gracefully', async () => {
        const mockProject = {
          id: 'proj-1',
          slug: 'test-project',
          ownerId: 'owner-1',
          ProjectMember: [],
        };

        mockPrisma.project.findUnique.mockResolvedValue(mockProject);

        // TypeScript would prevent this, but testing runtime behavior
        const result = await requireProjectPermission('owner-1', 'test-project', '' as any);

        expect(result.allowed).toBe(false);
      });
    });
  });

  describe('Permission matrix validation', () => {
    it('should validate owner permission matrix', async () => {
      const mockProject = {
        id: 'proj-1',
        slug: 'test-project',
        ownerId: 'owner-1',
        ProjectMember: [],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const access = await checkProjectAccess('owner-1', 'test-project');

      // Owner should have all permissions
      expect(access.hasAccess).toBe(true);
      expect(access.role).toBe('owner');
      expect(access.isOwner).toBe(true);
      expect(access.canEdit).toBe(true);
      expect(access.canDelete).toBe(true);
      expect(access.canManageMembers).toBe(true);
      expect(access.canViewDocuments).toBe(true);
      expect(access.canUploadDocuments).toBe(true);
    });

    it('should validate editor permission matrix', async () => {
      const mockProject = {
        id: 'proj-1',
        slug: 'test-project',
        ownerId: 'owner-1',
        ProjectMember: [
          { role: 'editor' },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const access = await checkProjectAccess('editor-1', 'test-project');

      // Editor permissions: view, edit, upload
      expect(access.hasAccess).toBe(true);
      expect(access.role).toBe('editor');
      expect(access.isOwner).toBe(false);
      expect(access.canEdit).toBe(true);
      expect(access.canDelete).toBe(false);
      expect(access.canManageMembers).toBe(false);
      expect(access.canViewDocuments).toBe(true);
      expect(access.canUploadDocuments).toBe(true);
    });

    it('should validate viewer permission matrix', async () => {
      const mockProject = {
        id: 'proj-1',
        slug: 'test-project',
        ownerId: 'owner-1',
        ProjectMember: [
          { role: 'viewer' },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const access = await checkProjectAccess('viewer-1', 'test-project');

      // Viewer permissions: only view
      expect(access.hasAccess).toBe(true);
      expect(access.role).toBe('viewer');
      expect(access.isOwner).toBe(false);
      expect(access.canEdit).toBe(false);
      expect(access.canDelete).toBe(false);
      expect(access.canManageMembers).toBe(false);
      expect(access.canViewDocuments).toBe(true);
      expect(access.canUploadDocuments).toBe(false);
    });

    it('should validate non-member permission matrix', async () => {
      const mockProject = {
        id: 'proj-1',
        slug: 'test-project',
        ownerId: 'owner-1',
        ProjectMember: [],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const access = await checkProjectAccess('non-member', 'test-project');

      // Non-member: no permissions
      expect(access.hasAccess).toBe(false);
      expect(access.role).toBeNull();
      expect(access.isOwner).toBe(false);
      expect(access.canEdit).toBe(false);
      expect(access.canDelete).toBe(false);
      expect(access.canManageMembers).toBe(false);
      expect(access.canViewDocuments).toBe(false);
      expect(access.canUploadDocuments).toBe(false);
    });
  });
});
