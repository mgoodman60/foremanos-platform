'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Upload,
  FileText,
  DollarSign,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Eye,
  MoreHorizontal,
  Building2,
  FileCheck,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface Subcontractor {
  id: string;
  companyName: string;
  tradeType: string;
}

interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  contractType: string;
  status: string;
  originalValue: number;
  currentValue: number;
  retainagePercent: number;
  effectiveDate: string;
  completionDate: string;
  subcontractor: {
    companyName: string;
    tradeType: string;
  };
  _count: {
    insuranceCerts: number;
    changeOrders: number;
    payments: number;
  };
  totalApprovedCOs: number;
  totalPaid: number;
  totalRetainage: number;
  aiExtracted: boolean;
  aiConfidence?: number;
}

interface ContractStats {
  totalContracts: number;
  activeContracts: number;
  totalOriginalValue: number;
  totalCurrentValue: number;
  totalApprovedCOs: number;
  totalPaid: number;
  totalRetainage: number;
  balanceRemaining: number;
}

const CONTRACT_TYPES = [
  { value: 'SUBCONTRACT', label: 'Subcontract' },
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'SERVICE_AGREEMENT', label: 'Service Agreement' },
  { value: 'MASTER_AGREEMENT', label: 'Master Agreement' },
  { value: 'TASK_ORDER', label: 'Task Order' },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400',
  PENDING_REVIEW: 'bg-yellow-500/20 text-yellow-400',
  PENDING_APPROVAL: 'bg-orange-500/20 text-orange-400',
  ACTIVE: 'bg-green-500/20 text-green-400',
  SUSPENDED: 'bg-red-500/20 text-red-400',
  COMPLETED: 'bg-blue-500/20 text-blue-400',
  TERMINATED: 'bg-red-500/20 text-red-400',
  EXPIRED: 'bg-gray-500/20 text-gray-400',
};

export default function ContractsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession() || {};
  const projectSlug = params.slug as string;
  const preselectedSubId = searchParams.get('subcontractorId');

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSubcontractor, setFilterSubcontractor] = useState<string>(preselectedSubId || 'all');

  // Upload dialog state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>(preselectedSubId || '');
  const [manualEntry, setManualEntry] = useState(false);
  const [manualData, setManualData] = useState({
    title: '',
    contractType: 'SUBCONTRACT',
    originalValue: '',
    effectiveDate: '',
    completionDate: '',
    retainagePercent: '10',
    scopeOfWork: '',
  });

  // Detail dialog state
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Budget impact modal state
  const [showBudgetImpact, setShowBudgetImpact] = useState(false);
  const [budgetImpact, setBudgetImpact] = useState<any>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [selectedChangeOrder, setSelectedChangeOrder] = useState<any>(null);
  const [approvedAmountInput, setApprovedAmountInput] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.append('includeStats', 'true');
      if (filterStatus !== 'all') queryParams.append('status', filterStatus);
      if (filterSubcontractor !== 'all') queryParams.append('subcontractorId', filterSubcontractor);

      const response = await fetch(`/api/projects/${projectSlug}/contracts?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch contracts');
      const data = await response.json();
      setContracts(data.contracts);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      toast.error('Failed to load contracts');
    } finally {
      setLoading(false);
    }
  }, [projectSlug, filterStatus, filterSubcontractor]);

  const fetchSubcontractors = async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/subcontractors`);
      if (!response.ok) throw new Error('Failed to fetch subcontractors');
      const data = await response.json();
      setSubcontractors(data);
    } catch (error) {
      console.error('Error fetching subcontractors:', error);
    }
  };

  useEffect(() => {
    fetchContracts();
    fetchSubcontractors();
  }, [fetchContracts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      setUploadFile(file);
      setManualEntry(false);
    }
  };

  const handleUploadContract = async () => {
    if (!selectedSubcontractorId) {
      toast.error('Please select a subcontractor');
      return;
    }

    if (!uploadFile && !manualEntry) {
      toast.error('Please upload a contract PDF or enter details manually');
      return;
    }

    try {
      setUploading(true);

      if (manualEntry) {
        // Create contract manually
        const response = await fetch(`/api/projects/${projectSlug}/contracts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subcontractorId: selectedSubcontractorId,
            title: manualData.title,
            contractType: manualData.contractType,
            originalValue: parseFloat(manualData.originalValue) || 0,
            effectiveDate: manualData.effectiveDate,
            completionDate: manualData.completionDate,
            retainagePercent: parseFloat(manualData.retainagePercent) || 10,
            scopeOfWork: manualData.scopeOfWork,
          }),
        });

        if (!response.ok) throw new Error('Failed to create contract');
        toast.success('Contract created successfully');
      } else {
        // Upload with AI extraction
        // Step 1: Get presigned URL
        const urlResponse = await fetch(`/api/projects/${projectSlug}/contracts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getUploadUrl',
            fileName: uploadFile!.name,
            contentType: uploadFile!.type,
          }),
        });

        if (!urlResponse.ok) throw new Error('Failed to get upload URL');
        const { uploadUrl, cloudStoragePath } = await urlResponse.json();

        // Step 2: Upload to S3
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': uploadFile!.type },
          body: uploadFile,
        });

        if (!uploadResponse.ok) throw new Error('Failed to upload file');

        // Step 3: Process with AI extraction
        toast.loading('Extracting contract data with AI...', { id: 'ai-extract' });
        const processResponse = await fetch(`/api/projects/${projectSlug}/contracts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'processUpload',
            subcontractorId: selectedSubcontractorId,
            cloudStoragePath,
            fileName: uploadFile!.name,
            contentType: uploadFile!.type,
            fileSize: uploadFile!.size,
          }),
        });

        toast.dismiss('ai-extract');

        if (!processResponse.ok) throw new Error('Failed to process contract');
        const result = await processResponse.json();

        if (result.extracted?.confidence && result.extracted.confidence > 70) {
          toast.success(`Contract created! AI extracted data with ${result.extracted.confidence}% confidence`);
        } else {
          toast.success('Contract uploaded. Please review extracted data.');
        }
      }

      setShowUploadDialog(false);
      setUploadFile(null);
      setManualEntry(false);
      setManualData({
        title: '',
        contractType: 'SUBCONTRACT',
        originalValue: '',
        effectiveDate: '',
        completionDate: '',
        retainagePercent: '10',
        scopeOfWork: '',
      });
      fetchContracts();
    } catch (error) {
      console.error('Error uploading contract:', error);
      toast.error('Failed to upload contract');
    } finally {
      setUploading(false);
    }
  };

  const handleViewContract = async (contractId: string) => {
    try {
      setDetailLoading(true);
      setShowDetailDialog(true);

      const response = await fetch(`/api/projects/${projectSlug}/contracts/${contractId}`);
      if (!response.ok) throw new Error('Failed to fetch contract details');
      const data = await response.json();
      setSelectedContract(data);
    } catch (error) {
      console.error('Error fetching contract details:', error);
      toast.error('Failed to load contract details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusAction = async (contractId: string, action: string) => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/contracts/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) throw new Error('Failed to update contract');
      toast.success(`Contract ${action}d successfully`);
      fetchContracts();
    } catch (error) {
      console.error('Error updating contract:', error);
      toast.error('Failed to update contract');
    }
  };

  // Budget impact preview
  const handlePreviewBudgetImpact = async (co: any) => {
    if (!selectedContract) return;
    
    try {
      setImpactLoading(true);
      setSelectedChangeOrder(co);
      setApprovedAmountInput(co.originalAmount.toString());
      setShowBudgetImpact(true);
      
      const response = await fetch(
        `/api/projects/${projectSlug}/contracts/${selectedContract.contract.id}/change-orders/${co.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'preview-impact', previewAmount: co.originalAmount }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch budget impact');
      const data = await response.json();
      setBudgetImpact(data.impact);
    } catch (error) {
      console.error('Error fetching budget impact:', error);
      toast.error('Failed to load budget impact');
    } finally {
      setImpactLoading(false);
    }
  };

  const handleApproveChangeOrder = async () => {
    if (!selectedContract || !selectedChangeOrder) return;
    
    try {
      setImpactLoading(true);
      const approvedAmount = parseFloat(approvedAmountInput) || selectedChangeOrder.originalAmount;
      
      const response = await fetch(
        `/api/projects/${projectSlug}/contracts/${selectedContract.contract.id}/change-orders/${selectedChangeOrder.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'approve', 
            approvedAmount,
            useContingency: true
          }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to approve change order');
      const data = await response.json();
      
      toast.success(`Change order approved! Budget updated: ${data.budgetUpdates?.budgetItemsUpdated || 0} line items, ${data.budgetUpdates?.cashFlowsUpdated || 0} forecast periods`);
      
      setShowBudgetImpact(false);
      setBudgetImpact(null);
      setSelectedChangeOrder(null);
      
      // Refresh contract details
      handleViewContract(selectedContract.contract.id);
      fetchContracts();
    } catch (error) {
      console.error('Error approving change order:', error);
      toast.error('Failed to approve change order');
    } finally {
      setImpactLoading(false);
    }
  };

  const handleChangeOrderAction = async (co: any, action: string) => {
    if (!selectedContract) return;
    
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/contracts/${selectedContract.contract.id}/change-orders/${co.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to update change order');
      toast.success(`Change order ${action === 'submit' ? 'submitted' : action === 'review' ? 'under review' : action === 'reject' ? 'rejected' : action === 'void' ? 'voided' : 'updated'}`);
      
      // Refresh contract details
      handleViewContract(selectedContract.contract.id);
    } catch (error) {
      console.error('Error updating change order:', error);
      toast.error('Failed to update change order');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-surface p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/project/${projectSlug}/subcontractors`)}
            className="mb-4 text-gray-300 hover:text-white hover:bg-dark-card"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Subcontractors
          </Button>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <FileCheck className="w-8 h-8 text-[#F97316]" />
                Contract Management
              </h1>
              <p className="text-gray-400 mt-1">Manage subcontractor contracts, insurance, and change orders</p>
            </div>
            <Button
              onClick={() => setShowUploadDialog(true)}
              className="bg-[#F97316] hover:bg-[#ea580c] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contract
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-dark-card border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Contracts</p>
                  <p className="text-white text-xl font-bold">{stats.totalContracts}</p>
                </div>
              </div>
            </Card>
            <Card className="bg-dark-card border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Value</p>
                  <p className="text-white text-xl font-bold">{formatCurrency(stats.totalCurrentValue)}</p>
                </div>
              </div>
            </Card>
            <Card className="bg-dark-card border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Approved COs</p>
                  <p className="text-white text-xl font-bold">{formatCurrency(stats.totalApprovedCOs)}</p>
                </div>
              </div>
            </Card>
            <Card className="bg-dark-card border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <Receipt className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Balance Remaining</p>
                  <p className="text-white text-xl font-bold">{formatCurrency(stats.balanceRemaining)}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-dark-card border-gray-700 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={filterSubcontractor} onValueChange={setFilterSubcontractor}>
                <SelectTrigger className="bg-dark-surface border-gray-600 text-white">
                  <SelectValue placeholder="Filter by subcontractor" />
                </SelectTrigger>
                <SelectContent className="bg-dark-card border-gray-700">
                  <SelectItem value="all" className="text-white">All Subcontractors</SelectItem>
                  {subcontractors.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id} className="text-white">
                      {sub.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-dark-surface border-gray-600 text-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-dark-card border-gray-700">
                  <SelectItem value="all" className="text-white">All Statuses</SelectItem>
                  <SelectItem value="DRAFT" className="text-white">Draft</SelectItem>
                  <SelectItem value="ACTIVE" className="text-white">Active</SelectItem>
                  <SelectItem value="COMPLETED" className="text-white">Completed</SelectItem>
                  <SelectItem value="SUSPENDED" className="text-white">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Contracts List */}
        <div className="space-y-4">
          {contracts.length === 0 ? (
            <Card className="bg-dark-card border-gray-700 p-12 text-center">
              <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No contracts yet</h3>
              <p className="text-gray-400 mb-6">Upload a contract PDF to get started with AI extraction</p>
              <Button
                onClick={() => setShowUploadDialog(true)}
                className="bg-[#F97316] hover:bg-[#ea580c] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Contract
              </Button>
            </Card>
          ) : (
            contracts.map((contract) => (
              <Card key={contract.id} className="bg-dark-card border-gray-700 p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{contract.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[contract.status]}`}>
                        {contract.status.replace('_', ' ')}
                      </span>
                      {contract.aiExtracted && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400">
                          AI Extracted
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {contract.subcontractor.companyName}
                      </span>
                      <span>{contract.contractNumber}</span>
                      <span className="capitalize">
                        {CONTRACT_TYPES.find(t => t.value === contract.contractType)?.label || contract.contractType}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Original Value</span>
                        <p className="text-white font-medium">{formatCurrency(contract.originalValue)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Current Value</span>
                        <p className="text-white font-medium">{formatCurrency(contract.currentValue)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Paid</span>
                        <p className="text-green-400 font-medium">{formatCurrency(contract.totalPaid)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Retainage Held</span>
                        <p className="text-yellow-400 font-medium">{formatCurrency(contract.totalRetainage)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Completion Date</span>
                        <p className="text-white font-medium">{formatDate(contract.completionDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span>{contract._count.insuranceCerts} Insurance Certs</span>
                      <span>{contract._count.changeOrders} Change Orders</span>
                      <span>{contract._count.payments} Payments</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewContract(contract.id)}
                      className="border-gray-600 text-gray-300 hover:bg-dark-surface"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-white"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-dark-card border-gray-700">
                        {contract.status === 'DRAFT' && (
                          <DropdownMenuItem
                            onClick={() => handleStatusAction(contract.id, 'approve')}
                            className="text-white hover:bg-dark-surface"
                          >
                            <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                            Approve & Activate
                          </DropdownMenuItem>
                        )}
                        {contract.status === 'ACTIVE' && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleStatusAction(contract.id, 'complete')}
                              className="text-white hover:bg-dark-surface"
                            >
                              <CheckCircle className="w-4 h-4 mr-2 text-blue-400" />
                              Mark Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusAction(contract.id, 'suspend')}
                              className="text-white hover:bg-dark-surface"
                            >
                              <Clock className="w-4 h-4 mr-2 text-yellow-400" />
                              Suspend
                            </DropdownMenuItem>
                          </>
                        )}
                        {contract.status === 'SUSPENDED' && (
                          <DropdownMenuItem
                            onClick={() => handleStatusAction(contract.id, 'approve')}
                            className="text-white hover:bg-dark-surface"
                          >
                            <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                            Reactivate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-gray-700" />
                        <DropdownMenuItem
                          onClick={() => handleStatusAction(contract.id, 'terminate')}
                          className="text-red-400 hover:bg-red-900/20"
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Terminate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Upload/Create Contract Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-dark-card border-gray-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-[#F97316]" />
              Add Subcontractor Contract
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Upload a contract PDF for AI extraction or enter details manually
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Subcontractor Selection */}
            <div>
              <Label className="text-gray-300">Select Subcontractor *</Label>
              <Select value={selectedSubcontractorId} onValueChange={setSelectedSubcontractorId}>
                <SelectTrigger className="bg-dark-surface border-gray-600 text-white mt-1">
                  <SelectValue placeholder="Choose subcontractor" />
                </SelectTrigger>
                <SelectContent className="bg-dark-card border-gray-700">
                  {subcontractors.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id} className="text-white">
                      {sub.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upload or Manual Toggle */}
            <div className="flex gap-4">
              <Button
                variant={!manualEntry ? 'default' : 'outline'}
                onClick={() => setManualEntry(false)}
                className={!manualEntry ? 'bg-[#F97316] hover:bg-[#ea580c]' : 'border-gray-600 text-gray-300'}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload PDF
              </Button>
              <Button
                variant={manualEntry ? 'default' : 'outline'}
                onClick={() => setManualEntry(true)}
                className={manualEntry ? 'bg-[#F97316] hover:bg-[#ea580c]' : 'border-gray-600 text-gray-300'}
              >
                <FileText className="w-4 h-4 mr-2" />
                Manual Entry
              </Button>
            </div>

            {!manualEntry ? (
              /* PDF Upload */
              <div>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-[#F97316] transition-colors">
                  <input
                    type="file"
                    id="contract-file"
                    className="hidden"
                    accept="application/pdf"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="contract-file" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    {uploadFile ? (
                      <div className="text-[#F97316] font-medium">{uploadFile.name}</div>
                    ) : (
                      <>
                        <p className="text-gray-300 mb-1">Click to upload contract PDF</p>
                        <p className="text-gray-500 text-sm">AI will extract contract details automatically</p>
                      </>
                    )}
                  </label>
                </div>
                <div className="bg-dark-surface rounded-lg p-4 mt-4 text-sm">
                  <h4 className="text-gray-300 font-medium mb-2">AI will extract:</h4>
                  <ul className="text-gray-400 space-y-1 list-disc list-inside">
                    <li>Contract value, dates, and retainage terms</li>
                    <li>Scope of work, inclusions, and exclusions</li>
                    <li>Insurance and bonding requirements</li>
                    <li>Liquidated damages and warranty period</li>
                  </ul>
                </div>
              </div>
            ) : (
              /* Manual Entry Form */
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Contract Title *</Label>
                  <Input
                    id="title"
                    value={manualData.title}
                    onChange={(e) => setManualData({ ...manualData, title: e.target.value })}
                    placeholder="e.g., Electrical Work - Phase 1"
                    className="bg-dark-surface border-gray-600 text-white mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contractType">Contract Type</Label>
                    <Select
                      value={manualData.contractType}
                      onValueChange={(v) => setManualData({ ...manualData, contractType: v })}
                    >
                      <SelectTrigger className="bg-dark-surface border-gray-600 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-dark-card border-gray-700">
                        {CONTRACT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value} className="text-white">
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="originalValue">Contract Value *</Label>
                    <Input
                      id="originalValue"
                      type="number"
                      value={manualData.originalValue}
                      onChange={(e) => setManualData({ ...manualData, originalValue: e.target.value })}
                      placeholder="500000"
                      className="bg-dark-surface border-gray-600 text-white mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="effectiveDate">Start Date</Label>
                    <Input
                      id="effectiveDate"
                      type="date"
                      value={manualData.effectiveDate}
                      onChange={(e) => setManualData({ ...manualData, effectiveDate: e.target.value })}
                      className="bg-dark-surface border-gray-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="completionDate">End Date</Label>
                    <Input
                      id="completionDate"
                      type="date"
                      value={manualData.completionDate}
                      onChange={(e) => setManualData({ ...manualData, completionDate: e.target.value })}
                      className="bg-dark-surface border-gray-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="retainagePercent">Retainage %</Label>
                    <Input
                      id="retainagePercent"
                      type="number"
                      value={manualData.retainagePercent}
                      onChange={(e) => setManualData({ ...manualData, retainagePercent: e.target.value })}
                      placeholder="10"
                      className="bg-dark-surface border-gray-600 text-white mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="scopeOfWork">Scope of Work</Label>
                  <Textarea
                    id="scopeOfWork"
                    value={manualData.scopeOfWork}
                    onChange={(e) => setManualData({ ...manualData, scopeOfWork: e.target.value })}
                    placeholder="Describe the scope of work..."
                    className="bg-dark-surface border-gray-600 text-white mt-1 min-h-[100px]"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
              disabled={uploading}
              className="border-gray-600 text-gray-300 hover:bg-dark-surface"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadContract}
              disabled={uploading || !selectedSubcontractorId || (!uploadFile && !manualEntry)}
              className="bg-[#F97316] hover:bg-[#ea580c] text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {manualEntry ? 'Creating...' : 'Processing...'}
                </>
              ) : (
                <>
                  {manualEntry ? 'Create Contract' : 'Upload & Extract'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="bg-dark-card border-gray-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
            </div>
          ) : selectedContract ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedContract.contract.title}</DialogTitle>
                <DialogDescription className="text-gray-400">
                  {selectedContract.contract.contractNumber} • {selectedContract.contract.subcontractor.companyName}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="bg-dark-surface">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="insurance">Insurance ({selectedContract.contract.insuranceCerts?.length || 0})</TabsTrigger>
                  <TabsTrigger value="changeOrders">Change Orders ({selectedContract.contract.changeOrders?.length || 0})</TabsTrigger>
                  <TabsTrigger value="payments">Payments ({selectedContract.contract.payments?.length || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                  {/* Financials */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-dark-surface rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Original Value</p>
                      <p className="text-white text-xl font-bold">{formatCurrency(selectedContract.financials.originalValue)}</p>
                    </div>
                    <div className="bg-dark-surface rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Approved COs</p>
                      <p className="text-purple-400 text-xl font-bold">+{formatCurrency(selectedContract.financials.approvedCOs)}</p>
                    </div>
                    <div className="bg-dark-surface rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Current Value</p>
                      <p className="text-white text-xl font-bold">{formatCurrency(selectedContract.financials.currentValue)}</p>
                    </div>
                    <div className="bg-dark-surface rounded-lg p-4">
                      <p className="text-gray-400 text-sm">% Complete</p>
                      <p className="text-[#F97316] text-xl font-bold">{selectedContract.financials.percentComplete}%</p>
                    </div>
                  </div>

                  {/* Insurance Compliance */}
                  {selectedContract.insuranceCompliance && (
                    <div className="bg-dark-surface rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-5 h-5 text-blue-400" />
                        <h4 className="text-white font-medium">Insurance Compliance</h4>
                        {selectedContract.insuranceCompliance.isCompliant ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Compliant</span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Issues Found</span>
                        )}
                      </div>
                      {selectedContract.insuranceCompliance.issues.length > 0 && (
                        <ul className="space-y-1">
                          {selectedContract.insuranceCompliance.issues.map((issue: string, i: number) => (
                            <li key={i} className="text-red-400 text-sm flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      )}
                      {selectedContract.insuranceCompliance.warnings.length > 0 && (
                        <ul className="space-y-1 mt-2">
                          {selectedContract.insuranceCompliance.warnings.map((warning: string, i: number) => (
                            <li key={i} className="text-yellow-400 text-sm flex items-start gap-2">
                              <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              {warning}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Scope of Work */}
                  {selectedContract.contract.scopeOfWork && (
                    <div className="bg-dark-surface rounded-lg p-4">
                      <h4 className="text-white font-medium mb-2">Scope of Work</h4>
                      <p className="text-gray-300 text-sm whitespace-pre-wrap">{selectedContract.contract.scopeOfWork}</p>
                    </div>
                  )}

                  {/* View PDF */}
                  {selectedContract.contract.fileUrl && (
                    <Button
                      onClick={() => window.open(selectedContract.contract.fileUrl, '_blank')}
                      variant="outline"
                      className="w-full border-gray-600 text-gray-300 hover:bg-dark-surface"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Contract PDF
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="insurance" className="mt-4">
                  {selectedContract.contract.insuranceCerts?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedContract.contract.insuranceCerts.map((cert: any) => (
                        <div key={cert.id} className="bg-dark-surface rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-white font-medium">{cert.certType.replace('_', ' ')}</p>
                              <p className="text-gray-400 text-sm">{cert.insurer}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white">{formatCurrency(cert.coverageAmount)}</p>
                              <p className={`text-sm ${new Date(cert.expirationDate) < new Date() ? 'text-red-400' : 'text-gray-400'}`}>
                                Expires: {formatDate(cert.expirationDate)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No insurance certificates uploaded yet
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="changeOrders" className="mt-4">
                  {selectedContract.contract.changeOrders?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedContract.contract.changeOrders.map((co: any) => (
                        <div key={co.id} className="bg-dark-surface rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-white font-medium">{co.coNumber}: {co.title}</p>
                                <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[co.status]}`}>
                                  {co.status}
                                </span>
                              </div>
                              <p className="text-gray-400 text-sm">{co.reason.replace('_', ' ')}</p>
                              {co.daysAdded > 0 && (
                                <p className="text-yellow-400 text-sm mt-1">+{co.daysAdded} days schedule impact</p>
                              )}
                            </div>
                            <div className="text-right mr-4">
                              <p className="text-white">{formatCurrency(co.originalAmount)}</p>
                              {co.approvedAmount && (
                                <p className="text-green-400 text-sm">Approved: {formatCurrency(co.approvedAmount)}</p>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-dark-card border-gray-600">
                                {co.status === 'DRAFT' && (
                                  <DropdownMenuItem 
                                    onClick={() => handleChangeOrderAction(co, 'submit')}
                                    className="text-gray-200 hover:bg-dark-surface"
                                  >
                                    Submit for Review
                                  </DropdownMenuItem>
                                )}
                                {co.status === 'SUBMITTED' && (
                                  <DropdownMenuItem 
                                    onClick={() => handleChangeOrderAction(co, 'review')}
                                    className="text-gray-200 hover:bg-dark-surface"
                                  >
                                    Mark Under Review
                                  </DropdownMenuItem>
                                )}
                                {(co.status === 'SUBMITTED' || co.status === 'UNDER_REVIEW') && (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={() => handlePreviewBudgetImpact(co)}
                                      className="text-green-400 hover:bg-dark-surface"
                                    >
                                      <TrendingUp className="w-4 h-4 mr-2" />
                                      Preview Budget Impact & Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-gray-600" />
                                    <DropdownMenuItem 
                                      onClick={() => handleChangeOrderAction(co, 'reject')}
                                      className="text-red-400 hover:bg-dark-surface"
                                    >
                                      Reject
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {co.status === 'APPROVED' && (
                                  <DropdownMenuItem 
                                    onClick={() => handleChangeOrderAction(co, 'void')}
                                    className="text-red-400 hover:bg-dark-surface"
                                  >
                                    Void Change Order
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No change orders yet
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="payments" className="mt-4">
                  {selectedContract.contract.payments?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedContract.contract.payments.map((payment: any) => (
                        <div key={payment.id} className="bg-dark-surface rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-white font-medium">Payment #{payment.paymentNumber}</p>
                              <p className="text-gray-400 text-sm">
                                {payment.invoiceNumber && `Invoice: ${payment.invoiceNumber}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-white">{formatCurrency(payment.currentPayment)}</p>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[payment.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                {payment.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No payments recorded yet
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Budget Impact Preview Modal */}
      <Dialog open={showBudgetImpact} onOpenChange={setShowBudgetImpact}>
        <DialogContent className="bg-dark-card border-gray-600 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#F97316]" />
              Budget Impact Preview
            </DialogTitle>
            {selectedChangeOrder && (
              <DialogDescription className="text-gray-400">
                {selectedChangeOrder.coNumber}: {selectedChangeOrder.title}
              </DialogDescription>
            )}
          </DialogHeader>

          {impactLoading && !budgetImpact ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
            </div>
          ) : budgetImpact ? (
            <div className="space-y-6">
              {/* Approved Amount Input */}
              <div className="bg-dark-surface rounded-lg p-4">
                <Label className="text-gray-300 mb-2 block">Approved Amount</Label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">$</span>
                  <Input
                    type="number"
                    value={approvedAmountInput}
                    onChange={(e) => setApprovedAmountInput(e.target.value)}
                    className="bg-dark-card border-gray-600 text-white flex-1"
                  />
                </div>
                <p className="text-gray-400 text-sm mt-1">
                  Requested: {formatCurrency(budgetImpact.changeOrder.originalAmount)}
                </p>
              </div>

              {/* Project Budget Impact */}
              <div className="bg-dark-surface rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Project Budget Impact</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Current Budget</p>
                    <p className="text-white font-medium">{formatCurrency(budgetImpact.projectBudgetImpact.currentTotalBudget)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">New Budget</p>
                    <p className="text-green-400 font-medium">{formatCurrency(budgetImpact.projectBudgetImpact.newTotalBudget)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Current Committed</p>
                    <p className="text-white font-medium">{formatCurrency(budgetImpact.projectBudgetImpact.currentCommittedCost)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">New Committed</p>
                    <p className="text-purple-400 font-medium">{formatCurrency(budgetImpact.projectBudgetImpact.newCommittedCost)}</p>
                  </div>
                </div>
                {budgetImpact.projectBudgetImpact.useContingency && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <div className="flex items-center gap-2 text-yellow-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">Using {formatCurrency(budgetImpact.projectBudgetImpact.contingencyUsed)} from contingency</span>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                      Contingency remaining: {formatCurrency(budgetImpact.projectBudgetImpact.contingencyRemaining)}
                    </p>
                  </div>
                )}
              </div>

              {/* Budget Line Items */}
              {budgetImpact.budgetImpacts.length > 0 && (
                <div className="bg-dark-surface rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">Affected Budget Line Items</h4>
                  <div className="space-y-2">
                    {budgetImpact.budgetImpacts.map((impact: any) => (
                      <div key={impact.budgetItemId} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                        <div>
                          <p className="text-white text-sm">{impact.budgetItemName}</p>
                          {impact.costCode && <p className="text-gray-400 text-xs">{impact.costCode}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-white text-sm">{formatCurrency(impact.currentBudget)} → {formatCurrency(impact.newBudget)}</p>
                          <p className={`text-xs ${impact.variancePercent > 10 ? 'text-red-400' : 'text-yellow-400'}`}>
                            +{impact.variancePercent.toFixed(1)}% variance
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule Impact */}
              {budgetImpact.scheduleImpact.daysAdded > 0 && (
                <div className="bg-dark-surface rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-yellow-400" />
                    Schedule Impact
                  </h4>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-400 text-sm">Days Added</p>
                      <p className="text-yellow-400 font-medium">+{budgetImpact.scheduleImpact.daysAdded} days</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">New Completion</p>
                      <p className="text-white font-medium">
                        {formatDate(budgetImpact.scheduleImpact.newCompletion)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cash Flow Impact */}
              <div className="bg-dark-surface rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Cash Flow Impact</h4>
                <p className="text-gray-300 text-sm">
                  Additional {formatCurrency(budgetImpact.cashFlowImpact.additionalPerMonth)}/month 
                  over {budgetImpact.cashFlowImpact.monthsAffected.length} month(s)
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {budgetImpact.cashFlowImpact.monthsAffected.slice(0, 6).map((month: string) => (
                    <span key={month} className="px-2 py-1 bg-dark-card rounded text-xs text-gray-300">
                      {month}
                    </span>
                  ))}
                  {budgetImpact.cashFlowImpact.monthsAffected.length > 6 && (
                    <span className="px-2 py-1 bg-dark-card rounded text-xs text-gray-300">
                      +{budgetImpact.cashFlowImpact.monthsAffected.length - 6} more
                    </span>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {budgetImpact.warnings.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
                  <h4 className="text-yellow-400 font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Warnings
                  </h4>
                  <ul className="space-y-1">
                    {budgetImpact.warnings.map((warning: string, i: number) => (
                      <li key={i} className="text-yellow-200 text-sm">• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowBudgetImpact(false)}
              className="border-gray-600 text-gray-300 hover:bg-dark-surface"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveChangeOrder}
              disabled={impactLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {impactLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Approve & Update Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
