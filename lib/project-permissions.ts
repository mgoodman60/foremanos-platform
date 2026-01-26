import { prisma } from '@/lib/db';

export type ProjectRole = 'owner' | 'editor' | 'viewer' | null;

interface ProjectAccess {
  hasAccess: boolean;
  role: ProjectRole;
  isOwner: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canViewDocuments: boolean;
  canUploadDocuments: boolean;
}

/**
 * Check user's access level and permissions for a specific project
 */
export async function checkProjectAccess(
  userId: string,
  projectSlug: string
): Promise<ProjectAccess> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      ProjectMember: {
        where: { userId },
        select: { role: true },
      },
    },
  });

  if (!project) {
    return {
      hasAccess: false,
      role: null,
      isOwner: false,
      canEdit: false,
      canDelete: false,
      canManageMembers: false,
      canViewDocuments: false,
      canUploadDocuments: false,
    };
  }

  const isOwner = project.ownerId === userId;
  const membership = project.ProjectMember[0];
  const role: ProjectRole = isOwner ? 'owner' : (membership?.role as ProjectRole) || null;

  const hasAccess = isOwner || !!membership;

  // Define permissions based on role
  const canEdit = role === 'owner' || role === 'editor';
  const canDelete = role === 'owner';
  const canManageMembers = role === 'owner';
  const canViewDocuments = hasAccess; // All members can view
  const canUploadDocuments = canEdit; // Owner and editors can upload

  return {
    hasAccess,
    role,
    isOwner,
    canEdit,
    canDelete,
    canManageMembers,
    canViewDocuments,
    canUploadDocuments,
  };
}

/**
 * Check if user has specific permission for a project
 */
export async function requireProjectPermission(
  userId: string,
  projectSlug: string,
  permission: 'view' | 'edit' | 'delete' | 'manage_members' | 'upload'
): Promise<{ allowed: boolean; access: ProjectAccess }> {
  const access = await checkProjectAccess(userId, projectSlug);

  if (!access.hasAccess) {
    return { allowed: false, access };
  }

  let allowed = false;
  switch (permission) {
    case 'view':
      allowed = access.canViewDocuments;
      break;
    case 'edit':
      allowed = access.canEdit;
      break;
    case 'delete':
      allowed = access.canDelete;
      break;
    case 'manage_members':
      allowed = access.canManageMembers;
      break;
    case 'upload':
      allowed = access.canUploadDocuments;
      break;
  }

  return { allowed, access };
}
