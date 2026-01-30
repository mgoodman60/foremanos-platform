'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Plus, FolderOpen, FileText, Users, Shield, Search, Key, Copy, Share2, Check, Pencil, UserPlus, Eye, Edit, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { NotificationCenter } from '@/components/admin/notification-center';
import { GuestCredentialModal } from '@/components/guest-credential-modal';
import { OnboardingWizard } from '@/components/onboarding-wizard';
import { BillingCard } from '@/components/billing-card';
import { QuotaIndicator } from '@/components/quota-indicator';
import { fetchWithRetry } from '@/lib/fetch-with-retry';

interface Project {
  id: string;
  name: string;
  slug: string;
  guestUsername: string;
  documentCount: number;
  memberCount: number;
  ownerName: string;
  isOwner: boolean;
  memberRole?: string;
  createdAt: string;
  status?: string;
}

interface DashboardStats {
  totalProjects: number;
  totalDocuments: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [ownedProjects, setOwnedProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ totalProjects: 0, totalDocuments: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGuestLoginModal, setShowGuestLoginModal] = useState(false);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameProject, setRenameProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectData, setNewProjectData] = useState({ name: '', guestUsername: '', guestPassword: '' });
  
  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteProject, setInviteProject] = useState<Project | null>(null);
  const [inviteData, setInviteData] = useState({ emailOrUsername: '', role: 'viewer' });
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  
  // Members modal state
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [membersProject, setMembersProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Track previous subscription tier for detecting upgrades/downgrades
  const [previousTier, setPreviousTier] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && session) {
      if (session.user.role === 'guest' && session.user.assignedProjectId) {
        fetchAssignedProjectSlug();
        return;
      }

      fetchDashboardData();
    }
  }, [status, session, router]);

  // Poll subscription info every 30 seconds to detect tier changes
  useEffect(() => {
    if (status !== 'authenticated' || !session) {
      return;
    }

    // Skip polling for guest users
    if (session.user.role === 'guest') {
      return;
    }

    // Set up polling interval
    const pollInterval = setInterval(() => {
      fetchSubscriptionInfo();
    }, 30000); // Poll every 30 seconds

    // Clean up interval on unmount
    return () => clearInterval(pollInterval);
  }, [status, session, previousTier]);

  const fetchAssignedProjectSlug = async () => {
    try {
      const res = await fetchWithRetry('/api/projects/assigned', {
        retryOptions: {
          maxRetries: 3,
          onRetry: (attempt) => {
            toast.loading(`Loading project... (attempt ${attempt}/3)`, { id: 'fetch-assigned' });
          }
        }
      });
      
      toast.dismiss('fetch-assigned');
      
      if (res.ok) {
        const { slug } = await res.json();
        router.push(`/project/${slug}`);
      } else {
        toast.error('Could not find assigned project');
      }
    } catch (error) {
      console.error('Error fetching assigned project:', error);
      toast.dismiss('fetch-assigned');
      toast.error('Failed to load project. Please try again.');
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetchWithRetry('/api/dashboard', {
        retryOptions: {
          maxRetries: 3,
          onRetry: (attempt) => {
            toast.loading(`Loading dashboard... (attempt ${attempt}/3)`, { id: 'fetch-dashboard' });
          }
        }
      });
      
      toast.dismiss('fetch-dashboard');
      
      if (res.ok) {
        const data = await res.json();
        setOwnedProjects(data.ownedProjects || []);
        setSharedProjects(data.sharedProjects || []);
        setStats(data.stats);
        checkOnboardingStatus();
        fetchSubscriptionInfo();
      } else {
        toast.error('Failed to load dashboard. Please refresh the page.');
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.dismiss('fetch-dashboard');
      toast.error('Connection error. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionInfo = async () => {
    try {
      const res = await fetchWithRetry('/api/subscription/info', {
        retryOptions: { maxRetries: 2 }
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Check if subscription tier has changed
        if (previousTier && data.tier !== previousTier) {
          const tierNames: Record<string, string> = {
            'free': 'Free',
            'starter': 'Starter',
            'pro': 'Pro',
            'team': 'Team',
            'business': 'Business',
            'enterprise': 'Enterprise'
          };
          
          const oldTierName = tierNames[previousTier] || previousTier;
          const newTierName = tierNames[data.tier] || data.tier;
          
          // Show notification for tier change
          toast.success(
            `🎉 Your subscription has been updated from ${oldTierName} to ${newTierName}! Your dashboard will refresh to show new limits.`,
            { duration: 5000 }
          );
          
          // Refresh dashboard data to show new limits
          fetchDashboardData();
        }
        
        // Update subscription info and track tier
        setSubscriptionInfo(data);
        setPreviousTier(data.tier);
      }
    } catch (error) {
      console.error('Error fetching subscription info:', error);
      // Silent fail - subscription info is not critical
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      const res = await fetchWithRetry('/api/user/onboarding', {
        retryOptions: { maxRetries: 2 }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (!data.hasCompletedOnboarding && session?.user.role !== 'guest') {
          setShowOnboardingWizard(true);
        }
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // Silent fail - onboarding check is not critical
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      const res = await fetchWithRetry('/api/user/onboarding', {
        method: 'POST',
        retryOptions: { maxRetries: 2 }
      });
      
      if (res.ok) {
        setShowOnboardingWizard(false);
        toast.success('Welcome to ForemanOS! 🎉');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Failed to save onboarding progress');
    }
  };

  const handleCopyLoginLink = () => {
    const loginUrl = `${window.location.origin}/login`;
    navigator.clipboard.writeText(loginUrl).then(() => {
      setLinkCopied(true);
      toast.success('Login link copied to clipboard!');
      setTimeout(() => setLinkCopied(false), 3000);
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newProjectData.name.trim() || !newProjectData.guestUsername.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check project limit before creating
    if (subscriptionInfo) {
      const currentProjects = ownedProjects.length;
      const limit = subscriptionInfo.limits.projects;
      
      if (limit !== -1 && currentProjects >= limit) {
        toast.error(`You've reached your project limit (${limit}). Upgrade your plan to create more projects.`, {
          duration: 5000,
          action: {
            label: 'Upgrade',
            onClick: () => router.push('/pricing'),
          },
        });
        return;
      }
    }

    try {
      const response = await fetchWithRetry('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProjectData),
        retryOptions: {
          maxRetries: 3,
          onRetry: (attempt) => {
            toast.loading(`Creating project... (attempt ${attempt}/3)`, { id: 'create-project' });
          }
        }
      });

      toast.dismiss('create-project');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create project');
      }

      const { project } = await response.json();
      
      toast.success('Project created successfully!');
      setShowCreateModal(false);
      setNewProjectData({ name: '', guestUsername: '', guestPassword: '' });
      
      fetchDashboardData();
      router.push(`/project/${project.slug}`);
    } catch (error) {
      console.error('Error creating project:', error);
      toast.dismiss('create-project');
      toast.error(error instanceof Error ? error.message : 'Failed to create project. Please try again.');
    }
  };

  const handleRenameProject = async () => {
    if (!renameProject || !newProjectName.trim()) {
      toast.error('Please enter a valid project name');
      return;
    }

    try {
      const response = await fetchWithRetry(`/api/projects/${renameProject.slug}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newProjectName.trim() }),
        retryOptions: {
          maxRetries: 2,
          onRetry: (attempt) => {
            toast.loading(`Renaming project... (attempt ${attempt}/2)`, { id: 'rename-project' });
          }
        }
      });

      toast.dismiss('rename-project');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rename project');
      }

      toast.success('Project renamed successfully');
      setRenameModalOpen(false);
      setRenameProject(null);
      setNewProjectName('');
      fetchDashboardData();
    } catch (error) {
      console.error('Error renaming project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rename project');
    }
  };

  const openRenameModal = (project: Project) => {
    setRenameProject(project);
    setNewProjectName(project.name);
    setRenameModalOpen(true);
  };

  const openInviteModal = (project: Project) => {
    setInviteProject(project);
    setInviteData({ emailOrUsername: '', role: 'viewer' });
    setInviteModalOpen(true);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteProject || !inviteData.emailOrUsername.trim()) {
      toast.error('Please enter an email or username');
      return;
    }

    setSendingInvite(true);
    try {
      const response = await fetchWithRetry(`/api/projects/${inviteProject.slug}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inviteData),
        retryOptions: {
          maxRetries: 2,
          onRetry: (attempt) => {
            toast.loading(`Sending invitation... (attempt ${attempt}/2)`, { id: 'send-invite' });
          }
        }
      });

      toast.dismiss('send-invite');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send invitation');
      }

      toast.success('Invitation sent successfully!');
      setInviteModalOpen(false);
      setInviteData({ emailOrUsername: '', role: 'viewer' });
    } catch (error) {
      console.error('Error sending invite:', error);
      toast.dismiss('send-invite');
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  const openMembersModal = async (project: Project) => {
    setMembersProject(project);
    setMembersModalOpen(true);
    setLoadingMembers(true);
    
    try {
      const response = await fetchWithRetry(`/api/projects/${project.slug}/members`, {
        retryOptions: {
          maxRetries: 2,
          onRetry: (attempt) => {
            toast.loading(`Loading members... (attempt ${attempt}/2)`, { id: 'load-members' });
          }
        }
      });
      
      toast.dismiss('load-members');
      
      if (response.ok) {
        const data = await response.json();
        setProjectMembers(data.members || []);
      } else {
        toast.error('Failed to load members');
      }
    } catch (error) {
      console.error('Error loading members:', error);
      toast.dismiss('load-members');
      toast.error('Failed to load members. Please try again.');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (!membersProject) return;
    
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      const response = await fetchWithRetry(`/api/projects/${membersProject.slug}/members/${userId}`, {
        method: 'DELETE',
        retryOptions: {
          maxRetries: 2,
          onRetry: (attempt) => {
            toast.loading(`Removing member... (attempt ${attempt}/2)`, { id: 'remove-member' });
          }
        }
      });

      toast.dismiss('remove-member');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove member');
      }

      toast.success('Member removed successfully');
      // Refresh members list
      openMembersModal(membersProject);
    } catch (error) {
      console.error('Error removing member:', error);
      toast.dismiss('remove-member');
      toast.error(error instanceof Error ? error.message : 'Failed to remove member');
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-[#1F2328] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316] mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  const getRoleBadge = (role?: string) => {
    if (role === 'owner') {
      return (
        <span className="px-2.5 py-1 bg-blue-900/30 text-blue-300 text-xs font-semibold rounded-full inline-flex items-center gap-1 border border-blue-700">
          <Crown className="w-3 h-3" />
          Owner
        </span>
      );
    } else if (role === 'editor') {
      return (
        <span className="px-2.5 py-1 bg-green-900/30 text-green-300 text-xs font-semibold rounded-full inline-flex items-center gap-1 border border-green-700">
          <Edit className="w-3 h-3" />
          Editor
        </span>
      );
    } else if (role === 'viewer') {
      return (
        <span className="px-2.5 py-1 bg-gray-700 text-gray-300 text-xs font-semibold rounded-full inline-flex items-center gap-1 border border-gray-600">
          <Eye className="w-3 h-3" />
          Viewer
        </span>
      );
    }
    return null;
  };

  const renderProjectCard = (project: Project, showSharedBy = false) => (
    <div
      key={project.id}
      className="border-2 border-gray-600 rounded-xl p-5 hover:shadow-xl hover:border-[#F97316] transition-all duration-200 bg-[#2d333b]"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-[#F8FAFC] text-lg mb-2">{project.name}</h4>
          <div className="flex flex-wrap gap-2">
            {getRoleBadge(project.memberRole || (project.isOwner ? 'owner' : undefined))}
            {showSharedBy && (
              <p className="text-xs text-gray-300 mt-1">
                Shared by {project.ownerName}
              </p>
            )}
          </div>
        </div>
      </div>
      
      <div className="space-y-2.5 text-sm text-gray-300 mb-4 bg-[#1F2328] rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#F97316]" />
            <span className="font-medium">{project.documentCount} document{project.documentCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => openMembersModal(project)}
            className="flex items-center gap-2 text-[#F97316] hover:text-[#EA580C] transition-colors"
          >
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">{project.memberCount} {project.memberCount === 1 ? 'person' : 'people'}</span>
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <button
          onClick={() => router.push(`/project/${project.slug}`)}
          className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white py-2.5 px-4 rounded-lg transition-all duration-200 font-semibold focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 focus:outline-none transform hover:scale-[1.02]"
        >
          Open Project →
        </button>
        {project.isOwner && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => openRenameModal(project)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 px-3 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              Rename
            </button>
            <button
              onClick={() => openInviteModal(project)}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-1"
            >
              <UserPlus className="w-3 h-3" />
              Invite
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1F2328]">
      {/* Header */}
      <header className="bg-[#2d333b] border-b border-gray-700 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/foremanos-new-logo.png" 
                alt="ForemanOS" 
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-3">
              {session?.user.role === 'admin' && (
                <button
                  onClick={() => router.push('/admin')}
                  className="px-3 py-1 bg-purple-900/30 text-purple-300 text-sm font-medium rounded-full flex items-center gap-1 hover:bg-purple-900/50 transition-colors border border-purple-700"
                >
                  <Shield className="w-4 h-4" />
                  Admin Dashboard
                </button>
              )}
              <NotificationCenter />
              <button
                onClick={() => router.push('/api/auth/signout')}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-[#F8FAFC] hover:bg-[#3d434b] rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Share Login Link Ribbon - Only for Clients */}
      {session?.user.role === 'client' && (
        <div className="bg-[#1F2328] text-white py-4 px-4 shadow-lg border-b-4 border-[#F97316]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-[#F97316]/20 p-2 rounded-lg">
                  <Share2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#F8FAFC]">Share Your Project Login</h3>
                  <p className="text-[#F8FAFC]/80 text-sm">Copy the login link to share with team members</p>
                </div>
              </div>
              <button
                onClick={handleCopyLoginLink}
                className="bg-[#F97316] hover:bg-[#EA580C] text-white px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg flex items-center gap-2 whitespace-nowrap"
              >
                {linkCopied ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    <span>Copy Login Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-[#F8FAFC]">
            Welcome back, {session?.user.username}
          </h2>
          <p className="mt-2 text-gray-300">
            Manage your construction projects and collaborate with your team
          </p>
        </div>

        {/* Quota Indicator */}
        <div className="mb-8">
          <QuotaIndicator />
        </div>

        {/* Quick Actions */}
        {(session?.user.role === 'admin' || session?.user.role === 'client') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg shadow-md p-6 text-left transition-all transform hover:scale-105 focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 focus:outline-none"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-lg">
                  <Plus className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Create New Project</h3>
                  <p className="text-sm text-white/90 mt-1">
                    Start a new construction project
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setShowGuestLoginModal(true)}
              className="bg-[#2d333b] hover:bg-[#3d434b] text-[#F8FAFC] border-2 border-gray-600 rounded-lg shadow-md p-6 text-left transition-all transform hover:scale-105 focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 focus:outline-none"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#1F2328] rounded-lg">
                  <Users className="w-8 h-8 text-gray-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#F8FAFC]">Add Project via Guest Login</h3>
                  <p className="text-sm text-gray-300 mt-1">
                    Access a project using guest credentials
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Your Projects Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-[#F8FAFC]">
              Your Projects ({ownedProjects.length})
            </h3>
            {ownedProjects.length > 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            )}
          </div>
          
          {ownedProjects.length === 0 ? (
            <div className="bg-[#2d333b] rounded-lg shadow-md p-12 text-center border border-gray-700">
              <FolderOpen className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300 text-lg mb-2">No projects yet</p>
              <p className="text-gray-400 text-sm mb-6">Create your first project to get started</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownedProjects.map((project) => renderProjectCard(project))}
            </div>
          )}
        </div>

        {/* Shared With You Section */}
        {sharedProjects.length > 0 && (
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-[#F8FAFC] mb-4">
              Shared With You ({sharedProjects.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedProjects.map((project) => renderProjectCard(project, true))}
            </div>
          </div>
        )}

        {/* Billing & Subscription Section */}
        {subscriptionInfo && (
          <div className="mb-8">
            <BillingCard subscription={subscriptionInfo} />
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2d333b] rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-[#F8FAFC] mb-4">Create New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProjectData.name}
                  onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#F97316] focus:border-transparent bg-[#1F2328] text-[#F8FAFC] placeholder-gray-400"
                  placeholder="e.g., Downtown Office Building"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Job Pin (Guest Username) *
                </label>
                <input
                  type="text"
                  value={newProjectData.guestUsername}
                  onChange={(e) => setNewProjectData({ ...newProjectData, guestUsername: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#F97316] focus:border-transparent bg-[#1F2328] text-[#F8FAFC] placeholder-gray-400"
                  placeholder="e.g., downtown-2024"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Guest Password (Optional)
                </label>
                <input
                  type="password"
                  value={newProjectData.guestPassword}
                  onChange={(e) => setNewProjectData({ ...newProjectData, guestPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#F97316] focus:border-transparent bg-[#1F2328] text-[#F8FAFC] placeholder-gray-400"
                  placeholder="Leave blank for no password"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewProjectData({ name: '', guestUsername: '', guestPassword: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-[#1F2328] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-colors font-medium"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Project Modal */}
      {renameModalOpen && renameProject && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2d333b] rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-[#F8FAFC] mb-4">Rename Project</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  New Project Name
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#F97316] focus:border-transparent bg-[#1F2328] text-[#F8FAFC] placeholder-gray-400"
                  placeholder="Enter new name"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setRenameModalOpen(false);
                    setRenameProject(null);
                    setNewProjectName('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-[#1F2328] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenameProject}
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {inviteModalOpen && inviteProject && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2d333b] rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-[#F8FAFC] mb-2">Invite to {inviteProject.name}</h3>
            <p className="text-sm text-gray-300 mb-4">Invite team members to collaborate on this project</p>
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email or Username
                </label>
                <input
                  type="text"
                  value={inviteData.emailOrUsername}
                  onChange={(e) => setInviteData({ ...inviteData, emailOrUsername: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#F97316] focus:border-transparent bg-[#1F2328] text-[#F8FAFC] placeholder-gray-400"
                  placeholder="e.g., john@example.com or john123"
                  required
                  disabled={sendingInvite}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={inviteData.role}
                  onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#F97316] focus:border-transparent bg-[#1F2328] text-[#F8FAFC]"
                  disabled={sendingInvite}
                >
                  <option value="viewer">Viewer - Can view and chat</option>
                  <option value="editor">Editor - Can upload and manage documents</option>
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setInviteModalOpen(false);
                    setInviteData({ emailOrUsername: '', role: 'viewer' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-[#1F2328] transition-colors"
                  disabled={sendingInvite}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={sendingInvite}
                >
                  {sendingInvite ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {membersModalOpen && membersProject && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2d333b] rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto border border-gray-700">
            <h3 className="text-xl font-bold text-[#F8FAFC] mb-4">
              Project Members - {membersProject.name}
            </h3>
            
            {loadingMembers ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316] mx-auto"></div>
                <p className="mt-2 text-gray-300">Loading members...</p>
              </div>
            ) : projectMembers.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No members yet</p>
            ) : (
              <div className="space-y-3">
                {projectMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border border-gray-600 rounded-lg hover:border-[#F97316] transition-colors bg-[#1F2328]"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[#F8FAFC]">{member.username}</p>
                        {getRoleBadge(member.projectRole)}
                        {member.isOwner && (
                          <span className="text-xs text-gray-400">(Project Owner)</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-300">{member.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!member.isOwner && membersProject.isOwner && (
                      <button
                        onClick={() => handleRemoveMember(member.id, member.userId)}
                        className="ml-4 px-3 py-1.5 text-sm bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg transition-colors border border-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-6">
              <button
                onClick={() => {
                  setMembersModalOpen(false);
                  setMembersProject(null);
                  setProjectMembers([]);
                }}
                className="w-full px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-[#1F2328] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Login Modal */}
      {showGuestLoginModal && (
        <GuestCredentialModal onClose={() => setShowGuestLoginModal(false)} />
      )}

      {/* Onboarding Wizard */}
      {showOnboardingWizard && (
        <OnboardingWizard
          isOpen={showOnboardingWizard}
          onComplete={handleCompleteOnboarding}
        />
      )}
    </div>
  );
}