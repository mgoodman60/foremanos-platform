'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronRight, Home, ArrowLeft, Settings, Upload, RefreshCcw, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import EVMDashboard from '@/components/evm-dashboard';
import BudgetSetupModal from '@/components/budget-setup-modal';
import BudgetItemsManager from '@/components/budget-items-manager';
import TradeBudgetBreakdown from '@/components/trade-budget-breakdown';
import BudgetImportModal from '@/components/budget-import-modal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Project {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}

export default function EVMPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBudgetSetup, setShowBudgetSetup] = useState(false);
  const [showBudgetImport, setShowBudgetImport] = useState(false);
  const [showBudgetEdit, setShowBudgetEdit] = useState(false);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [currentBudgetTotal, setCurrentBudgetTotal] = useState<number>(0);
  const [newBudgetTotal, setNewBudgetTotal] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && slug) {
      fetchProject();
      fetchBudget();
    }
  }, [status, slug, router, refreshKey]);

  const fetchProject = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
      } else if (res.status === 403) {
        toast.error('You do not have access to this project');
        router.push('/dashboard');
      } else {
        toast.error('Project not found');
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const fetchBudget = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/budget`);
      if (res.ok) {
        const data = await res.json();
        if (data.budget) {
          setBudgetId(data.budget.id);
          setCurrentBudgetTotal(data.budget.totalBudget || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching budget:', error);
    }
  };

  const handleBudgetCreated = () => {
    setRefreshKey(prev => prev + 1);
    fetchBudget();
  };

  const handleSyncBudget = async () => {
    try {
      setSyncing(true);
      toast.loading('Syncing budget from items...', { id: 'sync-budget' });
      
      const res = await fetch(`/api/projects/${slug}/budget/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recalculate: true }),
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message, { id: 'sync-budget' });
        setRefreshKey(prev => prev + 1);
        fetchBudget();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to sync budget', { id: 'sync-budget' });
      }
    } catch (error) {
      console.error('Error syncing budget:', error);
      toast.error('Failed to sync budget', { id: 'sync-budget' });
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateBudgetTotal = async () => {
    const amount = parseFloat(newBudgetTotal.replace(/[^0-9.]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid budget amount');
      return;
    }

    try {
      toast.loading('Updating budget total...', { id: 'update-budget' });
      
      const res = await fetch(`/api/projects/${slug}/budget/sync`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalBudget: amount }),
      });
      
      if (res.ok) {
        toast.success(`Budget total updated to $${amount.toLocaleString()}`, { id: 'update-budget' });
        setShowBudgetEdit(false);
        setNewBudgetTotal('');
        setRefreshKey(prev => prev + 1);
        fetchBudget();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update budget', { id: 'update-budget' });
      }
    } catch (error) {
      console.error('Error updating budget:', error);
      toast.error('Failed to update budget', { id: 'update-budget' });
    }
  };

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-surface">
      {/* Header */}
      <header className="bg-dark-surface border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <nav className="flex items-center text-sm text-gray-400 min-w-0 flex-1">
              <button
                onClick={() => router.push('/dashboard')}
                className="hover:text-gray-200 transition-colors flex-shrink-0"
              >
                <Home className="w-4 h-4" />
              </button>
              <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
              <button
                onClick={() => router.push(`/project/${project.slug}`)}
                className="hover:text-gray-200 transition-colors truncate"
              >
                {project.name}
              </button>
              <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
              <span className="text-[#F8FAFC] font-medium">EVM Dashboard</span>
            </nav>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {budgetId && (
                <>
                  <Button
                    onClick={() => {
                      setNewBudgetTotal(currentBudgetTotal.toString());
                      setShowBudgetEdit(true);
                    }}
                    variant="outline"
                    className="border-green-600 text-green-400 hover:bg-green-600/20"
                  >
                    <DollarSign className="w-4 h-4 mr-1" />
                    Edit Total
                  </Button>
                  <Button
                    onClick={handleSyncBudget}
                    disabled={syncing}
                    variant="outline"
                    className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
                  >
                    <RefreshCcw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Budget'}
                  </Button>
                </>
              )}
              <Button
                onClick={() => setShowBudgetImport(true)}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:border-[#F97316] hover:text-[#F97316]"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import from PDF
              </Button>
              {!budgetId && (
                <Button
                  onClick={() => setShowBudgetSetup(true)}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Setup Budget
                </Button>
              )}
              <Button
                onClick={() => router.push(`/project/${project.slug}`)}
                variant="outline"
                className="border-gray-700 text-gray-300 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Project
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {budgetId ? (
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="bg-dark-surface border border-gray-700 p-1">
              <TabsTrigger 
                value="dashboard" 
                className="text-gray-300 data-[state=active]:bg-dark-card data-[state=active]:text-[#F97316] data-[state=active]:shadow-sm"
              >
                EVM Dashboard
              </TabsTrigger>
              <TabsTrigger 
                value="trades"
                className="text-gray-300 data-[state=active]:bg-dark-card data-[state=active]:text-[#F97316] data-[state=active]:shadow-sm"
              >
                Cost by Trade
              </TabsTrigger>
              <TabsTrigger 
                value="items"
                className="text-gray-300 data-[state=active]:bg-dark-card data-[state=active]:text-[#F97316] data-[state=active]:shadow-sm"
              >
                Budget Items
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="dashboard">
              <EVMDashboard key={refreshKey} />
            </TabsContent>
            
            <TabsContent value="trades">
              <TradeBudgetBreakdown />
            </TabsContent>
            
            <TabsContent value="items">
              <BudgetItemsManager budgetId={budgetId} />
            </TabsContent>
          </Tabs>
        ) : (
          <EVMDashboard key={refreshKey} />
        )}
      </main>

      {/* Budget Setup Modal */}
      <BudgetSetupModal
        isOpen={showBudgetSetup}
        onClose={() => setShowBudgetSetup(false)}
        onSuccess={handleBudgetCreated}
      />

      {/* Budget Import Modal */}
      <BudgetImportModal
        isOpen={showBudgetImport}
        onClose={() => setShowBudgetImport(false)}
        onSuccess={handleBudgetCreated}
      />

      {/* Budget Edit Dialog */}
      <Dialog open={showBudgetEdit} onOpenChange={setShowBudgetEdit}>
        <DialogContent className="bg-dark-card border-gray-700 text-[#F8FAFC]">
          <DialogHeader>
            <DialogTitle className="text-[#F8FAFC]">Update Budget Total</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter the correct total budget amount from your budget document.
              Current: ${currentBudgetTotal.toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="budgetTotal" className="text-gray-300">Total Budget Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="budgetTotal"
                  type="text"
                  placeholder="2,985,000"
                  value={newBudgetTotal}
                  onChange={(e) => setNewBudgetTotal(e.target.value)}
                  className="pl-9 bg-dark-surface border-gray-600 text-[#F8FAFC] placeholder-gray-500"
                />
              </div>
              <p className="text-xs text-gray-500">
                Enter the contract amount from your budget document (e.g., 2985000 or 2,985,000)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBudgetEdit(false)}
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateBudgetTotal}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Update Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
