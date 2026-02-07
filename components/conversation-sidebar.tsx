'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, Edit2, Check, X, Menu, ChevronLeft, Shield, Pin, Lock, Calendar, CheckCircle, Clock, Camera, Image as ImageIcon, ChevronDown, LayoutDashboard, History } from 'lucide-react';
import { Button } from './ui/button';
import { WithTooltip } from './ui/icon-button';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ConfirmDialog } from './confirm-dialog';
import { useSession } from 'next-auth/react';
import { DocumentLibraryRibbon } from './document-library-ribbon';
import { Phase3DashboardRibbon } from './phase3-dashboard-ribbon';
import { RoomBrowserRibbon } from './room-browser-ribbon';
import { MaterialTakeoffRibbon } from './material-takeoff-ribbon';
import { MEPEquipmentRibbon } from './mep-equipment-ribbon';

import { PlanViewerRibbon } from './plan-viewer-ribbon';
import { PhotoLibrary } from './photo-library';
import { PhotoTimeline } from './photo-timeline';
import { QuickCaptureModal } from './quick-capture-modal';

interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  projectName?: string;
  conversationType?: string;
  isSystemManaged?: boolean;
  isPinned?: boolean;
  dailyReportDate?: string | null;
  isReadOnly?: boolean;
  finalized?: boolean;
  finalizedAt?: string | null;
  lastActivityAt?: string | null;
}

interface ConversationSidebarProps {
  projectSlug: string;
  projectId: string;
  activeConversationId: string | null;
  onConversationSelect: (conversationId: string | null) => void;
  onNewConversation: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function ConversationSidebar({
  projectSlug,
  projectId,
  activeConversationId,
  onConversationSelect,
  onNewConversation,
  mobileOpen,
  onMobileClose,
}: ConversationSidebarProps) {
  const { data: session } = useSession() || {};
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Use external mobile control if provided
  const isMobileOpen = mobileOpen !== undefined ? mobileOpen : !isCollapsed;
  const handleMobileClose = onMobileClose || (() => setIsCollapsed(true));
  const [loadingDailyReport, setLoadingDailyReport] = useState(false);
  const [showPhotoLibrary, setShowPhotoLibrary] = useState(false);
  const [showPhotoTimeline, setShowPhotoTimeline] = useState(false);
  const [showRoomBrowser, setShowRoomBrowser] = useState(false);
  const [showMaterialTakeoff, setShowMaterialTakeoff] = useState(false);
  const [showMEPEquipment, setShowMEPEquipment] = useState(false);
  const [showPlanViewer, setShowPlanViewer] = useState(false);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [dashboardExpanded, setDashboardExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteConv, setPendingDeleteConv] = useState<{ id: string; conv: Conversation } | null>(null);

  // Check if user has access to daily reports (Pro tier or higher)
  const eligibleTiers = ['pro', 'team', 'business', 'enterprise'];
  const hasDailyReportAccess = session?.user?.subscriptionTier && 
    eligibleTiers.includes(session.user.subscriptionTier);

  // Debug logging for tier access
  useEffect(() => {
    if (session?.user) {
      console.log('[DAILY REPORT ACCESS] User:', session.user.username);
      console.log('[DAILY REPORT ACCESS] Subscription Tier:', session.user.subscriptionTier || 'NOT SET');
      console.log('[DAILY REPORT ACCESS] Has Access:', hasDailyReportAccess);
    }
  }, [session, hasDailyReportAccess]);

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [projectSlug]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/conversations/list?projectSlug=${projectSlug}`);
      if (response.ok) {
        const data = await response.json();
        const allConversations = data.conversations || [];
        
        // Filter out old daily reports (keep only today's)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const filteredConversations = allConversations.filter((conv: Conversation) => {
          if (conv.conversationType !== 'daily_report') {
            return true; // Keep all non-daily-report conversations
          }
          
          // For daily reports, only keep today's
          if (conv.dailyReportDate) {
            const reportDate = new Date(conv.dailyReportDate);
            reportDate.setHours(0, 0, 0, 0);
            return reportDate.getTime() === today.getTime();
          }
          
          return false; // Filter out daily reports without a date
        });
        
        setConversations(filteredConversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDailyReport = async () => {
    try {
      setLoadingDailyReport(true);
      console.log('[DAILY REPORT] Opening daily report for project:', projectId);
      
      const response = await fetch(`/api/conversations/daily-report?projectId=${projectId}`);
      console.log('[DAILY REPORT] API response status:', response.status);
      
      if (response.ok) {
        const dailyReport = await response.json();
        console.log('[DAILY REPORT] Daily report data:', dailyReport);
        
        // Select this conversation
        console.log('[DAILY REPORT] Selecting conversation:', dailyReport.id);
        onConversationSelect(dailyReport.id);
        
        // Refresh conversation list to show it
        console.log('[DAILY REPORT] Refreshing conversation list');
        await fetchConversations();
        
        toast.success('Daily report opened');
        
        // Close mobile sidebar
        if (isMobile) setIsCollapsed(true);
      } else {
        const data = await response.json();
        console.error('[DAILY REPORT] Error response:', data);
        
        if (data.requiresUpgrade) {
          toast.error('Daily Report Chat requires Pro tier or higher');
        } else if (data.featureDisabled) {
          toast.error('Daily Report Chat is not enabled for this project');
        } else {
          toast.error(data.error || 'Failed to open daily report');
        }
      }
    } catch (error) {
      console.error('[DAILY REPORT] Exception:', error);
      toast.error('Failed to open daily report');
    } finally {
      setLoadingDailyReport(false);
    }
  };

  const handleDelete = (conversationId: string, conv: Conversation) => {
    // Prevent deleting system-managed chats
    if (conv.isSystemManaged) {
      toast.error('System-managed chats cannot be deleted');
      return;
    }
    setPendingDeleteConv({ id: conversationId, conv });
    setShowDeleteConfirm(true);
  };

  const doDeleteConversation = async () => {
    setShowDeleteConfirm(false);
    if (!pendingDeleteConv) return;
    const { id: conversationId } = pendingDeleteConv;
    setPendingDeleteConv(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (activeConversationId === conversationId) {
          onConversationSelect(null);
        }
        toast.success('Conversation deleted');
      } else {
        toast.error('Failed to delete conversation');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    }
  };

  const handleRename = async (conversationId: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle }),
      });

      if (response.ok) {
        setConversations(prev =>
          prev.map(c => (c.id === conversationId ? { ...c, title: editTitle } : c))
        );
        setEditingId(null);
        toast.success('Conversation renamed');
      } else {
        toast.error('Failed to rename conversation');
      }
    } catch (error) {
      console.error('Error renaming conversation:', error);
      toast.error('Failed to rename conversation');
    }
  };

  const startEditing = (conv: Conversation) => {
    // Prevent editing system-managed chats
    if (conv.isSystemManaged) {
      toast.error('System-managed chats cannot be renamed');
      return;
    }
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle('');
  };

  // Mobile collapsed state - show toggle button (only if not using external control)
  if (isMobile && !isMobileOpen && mobileOpen === undefined) {
    return (
      <div className="fixed top-20 left-0 z-50">
        <Button
          onClick={() => setIsCollapsed(false)}
          variant="outline"
          size="sm"
          className="m-2 bg-dark-card border-gray-700 text-gray-300 shadow-lg"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Mobile drawer wrapper
  if (isMobile) {
    if (!isMobileOpen) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/90 z-40 animate-in fade-in duration-200"
          onClick={handleMobileClose}
        />
        {/* Drawer */}
        <div
          className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] flex flex-col bg-dark-surface border-r border-gray-700 shadow-2xl animate-in slide-in-from-left duration-300"
        >
          {renderSidebarContent()}
        </div>
      </>
    );
  }

  // Desktop sidebar
  return (
    <div className="relative flex flex-col bg-dark-surface border-r border-gray-700 w-80">
      {renderSidebarContent()}
    </div>
  );

  function renderSidebarContent() {
    return (
      <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-slate-50">Project Assistant</h2>
        <div className="flex gap-1">
          {isMobile && (
            <Button
              onClick={handleMobileClose}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-dark-card"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* PROJECT DASHBOARD Section - Collapsible */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => setDashboardExpanded(!dashboardExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-dark-card transition-colors focus:outline-none focus:bg-dark-card"
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold text-slate-50">Project Dashboard</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${dashboardExpanded ? '' : '-rotate-90'}`} />
          </button>
          <div className={`overflow-hidden transition-all duration-200 ${dashboardExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {/* Document Library Ribbon - Visible to all users */}
            <DocumentLibraryRibbon projectId={projectId} userRole={session?.user?.role} />

            {/* Project Tools Section - Hidden for guests */}
            {session?.user?.role !== 'guest' && (
              <>
                {/* Phase 3 Dashboard */}
                <Phase3DashboardRibbon
                  projectSlug={projectSlug}
                  projectId={projectId}
                  onOpenRoom={() => setShowRoomBrowser(true)}
                  onOpenMaterials={() => setShowMaterialTakeoff(true)}
                  onOpenMEP={() => setShowMEPEquipment(true)}
                  onOpenPlans={() => setShowPlanViewer(true)}
                />

                {/* Room Browser Ribbon */}
                <RoomBrowserRibbon projectSlug={projectSlug} projectId={projectId} />

                {/* Material Takeoff Ribbon */}
                <MaterialTakeoffRibbon projectSlug={projectSlug} projectId={projectId} />

                {/* MEP Equipment Ribbon */}
                <MEPEquipmentRibbon projectSlug={projectSlug} projectId={projectId} />

                {/* Document Viewer Ribbon */}
                <PlanViewerRibbon projectSlug={projectSlug} projectId={projectId} />

                {/* Photo Library Buttons */}
                <div className="p-2 border-b border-gray-700 space-y-2">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowPhotoLibrary(true)}
                      variant="outline"
                      className="flex-1 flex items-center justify-center gap-2 border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white hover:border-green-500 py-2 transition-all focus:ring-2 focus:ring-green-500"
                    >
                      <ImageIcon className="h-4 w-4" />
                      <span>Photo Library</span>
                    </Button>
                    <Button
                      onClick={() => setShowQuickCapture(true)}
                      disabled={!activeConversationId}
                      size="icon"
                      className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      title="Quick capture photo"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => setShowPhotoTimeline(true)}
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white hover:border-blue-500 py-2 transition-all focus:ring-2 focus:ring-blue-500"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Photo Timeline</span>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* CHAT HISTORY Section - Collapsible */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-dark-card transition-colors focus:outline-none focus:bg-dark-card"
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold text-slate-50">Chat History</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${historyExpanded ? '' : '-rotate-90'}`} />
          </button>
          <div className={`overflow-hidden transition-all duration-200 ${historyExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {/* New Conversation Button */}
            <div className="p-2 border-b border-gray-700">
              <Button
                onClick={onNewConversation}
                variant="outline"
                className="w-full flex items-center justify-center gap-2 border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white hover:border-orange-500 py-2 transition-all focus:ring-2 focus:ring-orange-500"
              >
                <Plus className="h-4 w-4" />
                <span>New Conversation</span>
              </Button>
            </div>

            {/* Today's Daily Report Button - Only show if user has Pro+ tier */}
            {hasDailyReportAccess && (
              <div className="p-2 border-b border-gray-700 bg-dark-surface">
                <Button
                  onClick={handleOpenDailyReport}
                  disabled={loadingDailyReport}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 active:from-blue-800 active:to-blue-700 text-white py-3 rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-dark-surface disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Calendar className="h-5 w-5" />
                  <span className="font-semibold">
                    {loadingDailyReport ? 'Opening...' : "Today's Daily Report"}
                  </span>
                </Button>
              </div>
            )}

            {/* Conversation List */}
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="space-y-2">
                  {/* Skeleton Loading States */}
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-dark-card border border-gray-700 rounded-lg p-3 animate-pulse">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 bg-gray-700 rounded"></div>
                        <div className="h-3 bg-gray-700 rounded flex-1"></div>
                      </div>
                      <div className="h-2 bg-gray-700 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex items-center justify-center min-h-[200px] px-4">
                  <div className="text-center max-w-xs">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-orange-500/30">
                      <MessageSquare className="w-8 h-8 text-orange-400" />
                    </div>
                    <h3 className="text-base font-bold text-slate-50 mb-2">
                      No Conversations Yet
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">
                      Start a new conversation to get help with your construction project.
                    </p>
                    <Button
                      onClick={onNewConversation}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Start First Conversation
                    </Button>
                  </div>
                </div>
              ) : (
                conversations.map(conv => (
            <div
              key={conv.id}
              role="button"
              tabIndex={0}
              aria-label={`${conv.title} - ${conv.messageCount} message${conv.messageCount !== 1 ? 's' : ''}`}
              aria-current={activeConversationId === conv.id ? 'true' : 'false'}
              className={`group relative rounded-lg p-3 cursor-pointer transition-all ${
                activeConversationId === conv.id
                  ? 'bg-orange-500/20 border border-orange-500 shadow-md'
                  : 'hover:bg-dark-card hover:shadow-sm border border-transparent hover:border-gray-600'
              }`}
              onClick={() => {
                if (editingId !== conv.id) {
                  onConversationSelect(conv.id);
                  if (isMobile) setIsCollapsed(true);
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && editingId !== conv.id) {
                  e.preventDefault();
                  onConversationSelect(conv.id);
                  if (isMobile) setIsCollapsed(true);
                }
              }}
            >
              {editingId === conv.id ? (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(conv.id);
                      if (e.key === 'Escape') cancelEditing();
                    }}
                    className="flex-1 px-2 py-1 text-sm bg-dark-surface border border-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                  />
                  <Button
                    onClick={() => handleRename(conv.id)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-green-400 hover:bg-green-900/30"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    onClick={cancelEditing}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-400 hover:bg-dark-card"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    {/* Icon based on conversation type */}
                    <div className="relative">
                      {conv.conversationType === 'daily_report' ? (
                        <Calendar className={`h-4 w-4 mt-0.5 flex-shrink-0 ${conv.finalized ? 'text-green-500' : 'text-blue-400'}`} />
                      ) : conv.isSystemManaged ? (
                        <Shield className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-slate-50 truncate">
                          {conv.title}
                        </p>
                        {/* Pinned indicator */}
                        {conv.isPinned && (
                          <div className="flex-shrink-0">
                            <Pin className="h-3 w-3 text-orange-500" />
                          </div>
                        )}
                        {/* Read-only indicator */}
                        {conv.isReadOnly && (
                          <div className="flex-shrink-0">
                            <Lock className="h-3 w-3 text-gray-500" />
                          </div>
                        )}
                        {/* Daily Report Status Badge */}
                        {conv.conversationType === 'daily_report' && (
                          <div className="flex-shrink-0">
                            {conv.finalized ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-900/30 text-green-400 border border-green-700">
                                <CheckCircle className="h-2.5 w-2.5" />
                                Finalized
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/30 text-blue-400 border border-blue-700">
                                <Clock className="h-2.5 w-2.5" />
                                In Progress
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''} •{' '}
                        {conv.conversationType === 'daily_report' && conv.lastActivityAt
                          ? `Active ${format(new Date(conv.lastActivityAt), 'h:mm a')}`
                          : format(new Date(conv.updatedAt), 'MMM d, h:mm a')
                        }
                      </p>
                      {/* Daily Report Date */}
                      {conv.conversationType === 'daily_report' && conv.dailyReportDate && (
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          📅 {format(new Date(conv.dailyReportDate), 'EEEE, MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons - Hide for system-managed chats */}
                  {!conv.isSystemManaged && (
                    <div
                      className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => e.stopPropagation()}
                    >
                      <WithTooltip tooltip="Rename conversation">
                        <Button
                          onClick={() => startEditing(conv)}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-400 hover:bg-dark-surface hover:text-orange-500"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </WithTooltip>
                      <WithTooltip tooltip="Delete conversation">
                        <Button
                          onClick={() => handleDelete(conv.id, conv)}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-400 hover:bg-red-900/30 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </WithTooltip>
                    </div>
                  )}
                </>
              )}
            </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700 bg-dark-surface">
        <p className="text-xs text-gray-500 text-center">
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Photo Library Modal */}
      {showPhotoLibrary && (
        <PhotoLibrary
          projectSlug={projectSlug}
          onClose={() => setShowPhotoLibrary(false)}
        />
      )}

      {/* Photo Timeline Modal */}
      {showPhotoTimeline && (
        <PhotoTimeline
          projectSlug={projectSlug}
          onClose={() => setShowPhotoTimeline(false)}
        />
      )}

      {/* Quick Capture Modal */}
      {showQuickCapture && activeConversationId && (
        <QuickCaptureModal
          conversationId={activeConversationId}
          onClose={() => setShowQuickCapture(false)}
          onPhotoUploaded={() => {
            // Optionally refresh conversation data
            fetchConversations();
          }}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={doDeleteConversation}
        onCancel={() => { setShowDeleteConfirm(false); setPendingDeleteConv(null); }}
        title="Delete Conversation"
        description="Delete this conversation? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
      </>
    );
  }
}
