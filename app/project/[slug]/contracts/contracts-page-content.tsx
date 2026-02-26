'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, FileText, Loader2, FileCheck } from 'lucide-react';

import { Contract, ContractStats, Subcontractor, Project, ManualData } from './types';
import { ContractStatsCards } from './contract-stats-cards';
import { ContractCard } from './contract-card';
import { ContractUploadDialog } from './contract-upload-dialog';
import { ContractDetailDialog } from './contract-detail-dialog';
import { BudgetImpactModal } from './budget-impact-modal';

interface ContractsPageContentProps {
  project: Project;
}

export default function ContractsPageContent({ project }: ContractsPageContentProps) {
  const searchParams = useSearchParams();
  const projectSlug = project.slug;
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
  const [manualData, setManualData] = useState<ManualData>({
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
          body: JSON.stringify({ action: 'approve', approvedAmount, useContingency: true }),
        }
      );

      if (!response.ok) throw new Error('Failed to approve change order');
      const data = await response.json();

      toast.success(
        `Change order approved! Budget updated: ${data.budgetUpdates?.budgetItemsUpdated || 0} line items, ${data.budgetUpdates?.cashFlowsUpdated || 0} forecast periods`
      );

      setShowBudgetImpact(false);
      setBudgetImpact(null);
      setSelectedChangeOrder(null);

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
      toast.success(
        `Change order ${
          action === 'submit'
            ? 'submitted'
            : action === 'review'
            ? 'under review'
            : action === 'reject'
            ? 'rejected'
            : action === 'void'
            ? 'voided'
            : 'updated'
        }`
      );

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

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-surface p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/project/${projectSlug}/subcontractors`}
            className="inline-flex items-center mb-4 text-gray-300 hover:text-white hover:bg-dark-card px-3 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Subcontractors
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <FileCheck className="w-8 h-8 text-orange-500" />
                Contract Management
              </h1>
              <p className="text-gray-400 mt-1">
                Manage subcontractor contracts, insurance, and change orders
              </p>
            </div>
            <Button
              onClick={() => setShowUploadDialog(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contract
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <ContractStatsCards stats={stats} formatCurrency={formatCurrency} />
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
                  <SelectItem value="all" className="text-white">
                    All Subcontractors
                  </SelectItem>
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
              <p className="text-gray-400 mb-6">
                Upload a contract PDF to get started with AI extraction
              </p>
              <Button
                onClick={() => setShowUploadDialog(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Contract
              </Button>
            </Card>
          ) : (
            contracts.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                onView={handleViewContract}
                onStatusAction={handleStatusAction}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            ))
          )}
        </div>
      </div>

      <ContractUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        subcontractors={subcontractors}
        selectedSubcontractorId={selectedSubcontractorId}
        onSubcontractorChange={setSelectedSubcontractorId}
        manualEntry={manualEntry}
        onManualEntryChange={setManualEntry}
        uploadFile={uploadFile}
        onFileChange={handleFileChange}
        manualData={manualData}
        onManualDataChange={setManualData}
        uploading={uploading}
        onUpload={handleUploadContract}
      />

      <ContractDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        detailLoading={detailLoading}
        selectedContract={selectedContract}
        onChangeOrderAction={handleChangeOrderAction}
        onPreviewBudgetImpact={handlePreviewBudgetImpact}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
      />

      <BudgetImpactModal
        open={showBudgetImpact}
        onOpenChange={setShowBudgetImpact}
        selectedChangeOrder={selectedChangeOrder}
        budgetImpact={budgetImpact}
        impactLoading={impactLoading}
        approvedAmountInput={approvedAmountInput}
        onApprovedAmountChange={setApprovedAmountInput}
        onApprove={handleApproveChangeOrder}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
      />
    </div>
  );
}
