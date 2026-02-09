'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export interface Project {
  id: string;
  name: string;
  slug: string;
  documentCount: number;
  ownerId: string;
}

interface ProjectContextValue {
  project: Project | null;
  loading: boolean;
  session: ReturnType<typeof useSession>['data'];
  isOwner: boolean;
  isAdmin: boolean;
  refreshProject: () => Promise<void>;
  pendingUpdatesCount: number;
  setPendingUpdatesCount: (count: number) => void;
  aiDrawerOpen: boolean;
  setAiDrawerOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return ctx;
}

interface ProjectProviderProps {
  slug: string;
  children: ReactNode;
}

export function ProjectProvider({ slug, children }: ProjectProviderProps) {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingUpdatesCount, setPendingUpdatesCount] = useState(0);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Load persisted sidebar state
  useEffect(() => {
    try {
      const stored = localStorage.getItem('foremanos_sidebar_collapsed');
      if (stored !== null) {
        setSidebarCollapsedState(stored === 'true');
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Load persisted drawer state
  useEffect(() => {
    try {
      const stored = localStorage.getItem('foremanos_ai_drawer_open');
      if (stored !== null) {
        setAiDrawerOpen(stored === 'true');
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    try {
      localStorage.setItem('foremanos_sidebar_collapsed', String(collapsed));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const setAiDrawerOpenPersisted = useCallback((open: boolean) => {
    setAiDrawerOpen(open);
    try {
      localStorage.setItem('foremanos_ai_drawer_open', String(open));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const fetchProject = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    try {
      const res = await fetch(`/api/projects/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
      } else if (res.status === 403) {
        toast.error('You do not have access to this project');
        router.push('/dashboard');
      } else if (res.status === 503 && retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        toast.loading(`Connecting to project... (attempt ${retryCount + 2}/${maxRetries + 1})`, {
          id: 'project-retry',
        });
        setTimeout(() => fetchProject(retryCount + 1), delay);
        return;
      } else {
        toast.error('Project not found');
        router.push('/dashboard');
      }
    } catch (error: unknown) {
      if (retryCount < maxRetries && error instanceof Error && (
        error.message?.includes('fetch') ||
        error.message?.includes('network') ||
        error.message?.includes('connection')
      )) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        toast.loading(`Reconnecting... (attempt ${retryCount + 2}/${maxRetries + 1})`, {
          id: 'project-retry',
        });
        setTimeout(() => fetchProject(retryCount + 1), delay);
        return;
      }
      toast.error('Failed to load project. Please refresh the page.');
    } finally {
      setLoading(false);
      toast.dismiss('project-retry');
    }
  }, [slug, router]);

  const refreshProject = useCallback(async () => {
    await fetchProject(0);
  }, [fetchProject]);

  // Auth redirect + initial fetch
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status === 'authenticated' && slug) {
      fetchProject(0);
    }
  }, [status, slug, router, fetchProject]);

  const isOwner = !!(session?.user?.id && project?.ownerId && session.user.id === project.ownerId);
  const isAdmin = session?.user?.role === 'admin';

  return (
    <ProjectContext.Provider
      value={{
        project,
        loading,
        session,
        isOwner,
        isAdmin,
        refreshProject,
        pendingUpdatesCount,
        setPendingUpdatesCount,
        aiDrawerOpen,
        setAiDrawerOpen: setAiDrawerOpenPersisted,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileSidebarOpen,
        setMobileSidebarOpen,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
