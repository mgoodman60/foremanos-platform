'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  FileText, Plus, DollarSign, Check, X, Clock,
  Send, Eye, Download, AlertCircle, ChevronRight,
  Upload, FileUp, Loader2, Info, CheckCircle2
} from 'lucide-react';

interface PaymentApplication {
  id: string;
  applicationNumber: number;
  periodStart: string;
  periodEnd: string;
  scheduledValue: number;
  previouslyApproved: number;
  currentPeriod: number;
  totalCompleted: number;
  retainage: number;
  retainagePercent: number;
  netDue: number;
  status: string;
  submittedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  createdByUser?: { username: string };
  items?: any[];
}

interface Summary {
  totalContractValue: number;
  totalBilled: number;
  totalApproved: number;
  totalPaid: number;
  totalRetainage: number;
  pendingPayment: number;
  percentBilled: number;
  percentPaid: number;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'bg-gray-600', label: 'Draft' },
  SUBMITTED: { color: 'bg-blue-600', label: 'Submitted' },
  UNDER_REVIEW: { color: 'bg-yellow-600', label: 'Under Review' },
  REVISION_REQUIRED: { color: 'bg-orange-600', label: 'Revision Required' },
  APPROVED: { color: 'bg-green-600', label: 'Approved' },
  PARTIALLY_PAID: { color: 'bg-emerald-600', label: 'Partially Paid' },
  PAID: { color: 'bg-emerald-700', label: 'Paid' },
  REJECTED: { color: 'bg-red-600', label: 'Rejected' }
};

export default function PaymentApplications() {
  const params = useParams();
  const slug = params?.slug as string;

  const [payApps, setPayApps] = useState<PaymentApplication[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPayApp, setSelectedPayApp] = useState<PaymentApplication | null>(null);
  const [generating, setGenerating] = useState(false);

  const [periodDates, setPeriodDates] = useState({
    start: '',
    end: ''
  });

  // File upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    paymentApplication?: any;
    parsing?: { confidence: string; warnings: string[]; matchedItems: number; totalItems: number };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPayApps = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/payment-apps`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPayApps(data.paymentApplications || []);
      setSummary(data.summary);
    } catch (err) {
      toast.error('Failed to load payment applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayApps();
  }, [slug]);

  const handleGenerate = async () => {
    if (!periodDates.start || !periodDates.end) {
      toast.error('Please select period dates');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${slug}/payment-apps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodStart: periodDates.start,
          periodEnd: periodDates.end
        })
      });

      if (!res.ok) throw new Error('Failed to generate');

      toast.success('Payment application generated');
      setShowGenerateModal(false);
      setPeriodDates({ start: '', end: '' });
      fetchPayApps();
    } catch (err) {
      toast.error('Failed to generate payment application');
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/payment-apps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success('Status updated');
      fetchPayApps();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleReview = async (id: string, action: string, reason?: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/payment-apps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(action === 'approve' ? 'Pay app approved' : 'Pay app rejected');
      fetchPayApps();
    } catch (err) {
      toast.error('Failed to process review');
    }
  };

  const viewDetails = async (payApp: PaymentApplication) => {
    try {
      const res = await fetch(`/api/projects/${slug}/payment-apps/${payApp.id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSelectedPayApp(data);
      setShowDetailModal(true);
    } catch (err) {
      toast.error('Failed to load details');
    }
  };

  // Handle file upload for pay application parsing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);
    const uploadToast = toast.loading('Parsing pay application document...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/projects/${slug}/payment-apps/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.dismiss(uploadToast);
          toast.error(data.error, {
            description: data.suggestion,
            duration: 5000
          });
        } else {
          throw new Error(data.error || 'Upload failed');
        }
        return;
      }

      setUploadResult(data);
      toast.dismiss(uploadToast);
      toast.success(`Pay App #${data.paymentApplication.applicationNumber} created`, {
        description: `${data.paymentApplication.itemCount} line items extracted`
      });
      
      fetchPayApps();

    } catch (err) {
      toast.dismiss(uploadToast);
      toast.error('Failed to parse pay application', {
        description: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className="p-6 bg-dark-card border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3" />
          <div className="h-32 bg-gray-700 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Contract Value</div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(summary.totalContractValue)}
            </div>
          </Card>
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Total Billed</div>
            <div className="text-2xl font-bold text-blue-400">
              {formatCurrency(summary.totalBilled)}
            </div>
            <Progress value={summary.percentBilled} className="h-1 mt-2" />
          </Card>
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Total Paid</div>
            <div className="text-2xl font-bold text-green-400">
              {formatCurrency(summary.totalPaid)}
            </div>
            <Progress value={summary.percentPaid} className="h-1 mt-2" />
          </Card>
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Retainage Held</div>
            <div className="text-2xl font-bold text-yellow-400">
              {formatCurrency(summary.totalRetainage)}
            </div>
          </Card>
        </div>
      )}

      {/* Pending Payment Alert */}
      {summary && summary.pendingPayment > 0 && (
        <Card className="p-4 bg-yellow-900/20 border-yellow-700">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div>
              <span className="text-yellow-400 font-medium">
                {formatCurrency(summary.pendingPayment)}
              </span>
              <span className="text-gray-300"> pending payment</span>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => setShowGenerateModal(true)}>
          <Plus className="h-4 w-4 mr-2" /> Generate Pay App
        </Button>
        
        {/* Upload Pay App Button */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
            id="payapp-upload"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="border-gray-600 hover:bg-gray-700"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Pay App
          </Button>
        </div>
        
        {/* Data source indicator */}
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-400">
          <Info className="h-4 w-4" />
          <span>Pay apps update actual project costs automatically</span>
        </div>
      </div>

      {/* Upload Result Summary */}
      {uploadResult && uploadResult.success && (
        <Card className="p-4 bg-green-900/20 border-green-700">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-green-400">
                Pay App #{uploadResult.paymentApplication.applicationNumber} Imported
              </div>
              <div className="text-sm text-gray-300 mt-1">
                {uploadResult.paymentApplication.itemCount} line items extracted
                {uploadResult.parsing && (
                  <span className="ml-2">
                    • {uploadResult.parsing.matchedItems} matched to budget
                    • Confidence: {uploadResult.parsing.confidence}
                  </span>
                )}
              </div>
              {uploadResult.parsing?.warnings && uploadResult.parsing.warnings.length > 0 && (
                <div className="text-xs text-yellow-400 mt-2">
                  ⚠️ {uploadResult.parsing.warnings.join(' | ')}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setUploadResult(null)}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Pay Apps List */}
      <div className="space-y-3">
        {payApps.length === 0 ? (
          <Card className="p-8 bg-dark-card border-gray-700 text-center text-gray-400">
            <FileUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No payment applications yet</p>
            <p className="text-sm mt-1">
              Upload an AIA G702/G703 form or generate a new pay app
            </p>
            <div className="flex justify-center gap-3 mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-gray-600"
              >
                <Upload className="h-4 w-4 mr-2" /> Upload Document
              </Button>
              <Button size="sm" onClick={() => setShowGenerateModal(true)}>
                <Plus className="h-4 w-4 mr-2" /> Generate New
              </Button>
            </div>
          </Card>
        ) : (
          payApps.map(pa => {
            const config = STATUS_CONFIG[pa.status] || STATUS_CONFIG.DRAFT;
            const percentComplete = pa.scheduledValue > 0
              ? (pa.totalCompleted / pa.scheduledValue) * 100
              : 0;

            return (
              <Card key={pa.id} className="p-4 bg-dark-card border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-600 p-3 rounded-lg">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">
                          Pay Application #{pa.applicationNumber}
                        </h3>
                        <Badge className={`${config.color} text-white`}>
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Period: {format(new Date(pa.periodStart), 'MMM d')} - {format(new Date(pa.periodEnd), 'MMM d, yyyy')}
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                          <div className="text-xs text-gray-500">This Period</div>
                          <div className="text-sm font-medium text-white">
                            {formatCurrency(pa.currentPeriod)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Total Completed</div>
                          <div className="text-sm font-medium text-white">
                            {formatCurrency(pa.totalCompleted)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Retainage</div>
                          <div className="text-sm font-medium text-yellow-400">
                            {formatCurrency(pa.retainage)} ({pa.retainagePercent}%)
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Net Due</div>
                          <div className="text-sm font-medium text-green-400">
                            {formatCurrency(pa.netDue)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span>{percentComplete.toFixed(1)}%</span>
                        </div>
                        <Progress value={percentComplete} className="h-2" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="ghost" onClick={() => viewDetails(pa)}>
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                    {pa.status === 'DRAFT' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-blue-400"
                        onClick={() => handleStatusUpdate(pa.id, 'SUBMITTED')}
                      >
                        <Send className="h-4 w-4 mr-1" /> Submit
                      </Button>
                    )}
                    {pa.status === 'SUBMITTED' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-400"
                          onClick={() => handleReview(pa.id, 'approve')}
                        >
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400"
                          onClick={() => handleReview(pa.id, 'reject', 'Needs revision')}
                        >
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    {pa.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-400"
                        onClick={() => handleStatusUpdate(pa.id, 'PAID')}
                      >
                        <DollarSign className="h-4 w-4 mr-1" /> Mark Paid
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Generate Modal */}
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent className="bg-dark-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Generate Payment Application</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={periodDates.start}
                  onChange={(e) => setPeriodDates({ ...periodDates, start: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                />
              </div>
              <div>
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={periodDates.end}
                  onChange={(e) => setPeriodDates({ ...periodDates, end: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                />
              </div>
            </div>

            <p className="text-sm text-gray-400">
              The system will automatically calculate progress based on linked schedule tasks
              and budget items for the specified period.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-dark-card border-gray-700 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Payment Application #{selectedPayApp?.applicationNumber}
            </DialogTitle>
          </DialogHeader>

          {selectedPayApp && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Scheduled Value</div>
                  <div className="text-lg font-bold">
                    {formatCurrency(selectedPayApp.scheduledValue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">This Application</div>
                  <div className="text-lg font-bold text-blue-400">
                    {formatCurrency(selectedPayApp.currentPeriod)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Retainage</div>
                  <div className="text-lg font-bold text-yellow-400">
                    {formatCurrency(selectedPayApp.retainage)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Net Due</div>
                  <div className="text-lg font-bold text-green-400">
                    {formatCurrency(selectedPayApp.netDue)}
                  </div>
                </div>
              </div>

              {/* Line Items */}
              {selectedPayApp.items && selectedPayApp.items.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Line Items</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2">Description</th>
                          <th className="text-right py-2">Scheduled</th>
                          <th className="text-right py-2">Previous</th>
                          <th className="text-right py-2">This Period</th>
                          <th className="text-right py-2">% Complete</th>
                          <th className="text-right py-2">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPayApp.items.map((item: any) => (
                          <tr key={item.id} className="border-b border-gray-700/50">
                            <td className="py-2">
                              <div>{item.description}</div>
                              {item.costCode && (
                                <div className="text-xs text-gray-500">{item.costCode}</div>
                              )}
                            </td>
                            <td className="text-right py-2">
                              {formatCurrency(item.scheduledValue)}
                            </td>
                            <td className="text-right py-2">
                              {formatCurrency(item.fromPreviousApp)}
                            </td>
                            <td className="text-right py-2 text-blue-400">
                              {formatCurrency(item.thisApplication)}
                            </td>
                            <td className="text-right py-2">
                              {item.percentComplete.toFixed(1)}%
                            </td>
                            <td className="text-right py-2 text-gray-400">
                              {formatCurrency(item.balanceToFinish)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
