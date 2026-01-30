"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Ruler, FileText, Plus, Eye, CheckCircle2, Clock, AlertCircle, Download, Edit2, Trash2, Check, X, ChevronLeft, Sparkles, RefreshCw, Zap, Target, AlertTriangle } from 'lucide-react';
import { TakeoffConfidencePanel, TakeoffConfidenceSummary } from '@/components/takeoff-confidence-panel';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface MaterialTakeoff {
  id: string;
  name: string;
  description?: string;
  status: string;
  totalCost?: number;
  costUnit: string;
  extractedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  document?: {
    id: string;
    name: string;
  };
  creator: {
    username: string;
  };
  createdAt: string;
  _count: {
    lineItems: number;
  };
}

interface LineItem {
  id: string;
  itemName?: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
  location?: string;
  confidence?: number;
  verified: boolean;
  verificationStatus?: 'auto_approved' | 'needs_review' | 'low_confidence' | 'rejected';
  confidenceBreakdown?: {
    factors: { name: string; score: number; reason: string }[];
    totalScore: number;
    warnings: string[];
    suggestions: string[];
  };
  sources?: Array<{
    type: string;
    documentName: string;
    sheetNumber?: string;
    extractedValue: string;
  }>;
  calculationMethod?: string;
  scaleUsed?: string;
}

interface EnhancedStats {
  total: number;
  byStatus: {
    auto_approved: number;
    needs_review: number;
    low_confidence: number;
    rejected: number;
  };
  averageConfidence: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
    veryLow: number;
  };
}

export default function TakeoffsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const slug = params.slug as string;

  const [takeoffs, setTakeoffs] = useState<MaterialTakeoff[]>([]);
  const [selectedTakeoff, setSelectedTakeoff] = useState<MaterialTakeoff | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<LineItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancedExtracting, setIsEnhancedExtracting] = useState(false);
  const [showEnhancedModal, setShowEnhancedModal] = useState(false);
  const [enhancedStats, setEnhancedStats] = useState<EnhancedStats | null>(null);
  const [documents, setDocuments] = useState<{ id: string; name: string }[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  
  // Create takeoff form
  const [newTakeoff, setNewTakeoff] = useState({
    name: '',
    description: '',
    status: 'draft'
  });

  // Line item form
  const [newLineItem, setNewLineItem] = useState({
    category: '',
    description: '',
    quantity: 0,
    unit: 'EA',
    unitCost: 0,
    location: '',
    confidence: 1.0,
    verified: false
  });

  useEffect(() => {
    loadTakeoffs();
    loadDocuments();
  }, [slug]);

  const loadDocuments = async () => {
    try {
      const res = await fetch(`/api/documents?projectId=${slug}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents?.filter((d: { fileType: string }) => d.fileType === 'pdf') || []);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const loadTakeoffs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${slug}/takeoffs`);
      if (!res.ok) throw new Error('Failed to load takeoffs');
      const data = await res.json();
      setTakeoffs(data.takeoffs);
    } catch (error: unknown) {
      console.error('Error loading takeoffs:', error);
      toast.error('Failed to load material takeoffs');
    } finally {
      setLoading(false);
    }
  };

  const loadLineItems = async (takeoffId: string) => {
    try {
      const res = await fetch(`/api/takeoff/${takeoffId}`);
      if (!res.ok) throw new Error('Failed to load line items');
      const data = await res.json();
      setLineItems(data.takeoff.lineItems || []);
    } catch (error: unknown) {
      console.error('Error loading line items:', error);
      toast.error('Failed to load line items');
    }
  };

  const handleGenerateTakeoffs = async () => {
    try {
      setIsGenerating(true);
      toast.loading('Generating takeoffs from room data...', { id: 'generate-takeoffs' });
      
      const res = await fetch(`/api/projects/${slug}/generate-takeoffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ceilingHeight: 9 })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === 'No rooms with finish schedules found') {
          toast.error('No rooms with finish schedules found. Please extract room data from your floor plans first.', { id: 'generate-takeoffs' });
        } else {
          throw new Error(data.error || 'Failed to generate takeoffs');
        }
        return;
      }
      
      toast.success(`Generated ${data.lineItemCount} items from ${data.roomCount} rooms!`, { id: 'generate-takeoffs' });
      loadTakeoffs();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      console.error('Error generating takeoffs:', error);
      toast.error(message || 'Failed to generate takeoffs', { id: 'generate-takeoffs' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnhancedExtraction = async () => {
    if (!selectedDocumentId) {
      toast.error('Please select a document to extract from');
      return;
    }

    try {
      setIsEnhancedExtracting(true);
      toast.loading('Running enhanced vision analysis...', { id: 'enhanced-extract' });

      const res = await fetch(`/api/projects/${slug}/takeoffs/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          name: `Enhanced Takeoff - ${new Date().toLocaleDateString()}`,
          useVision: true,
          crossValidate: true,
          includeSchedules: true,
          saveToDatabase: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract takeoffs');
      }

      setEnhancedStats(data.summary);
      toast.success(
        `Extracted ${data.summary.totalItems} items! ` +
        `${data.summary.autoApproved} auto-approved, ` +
        `${data.summary.needsReview} need review`,
        { id: 'enhanced-extract', duration: 5000 }
      );
      setShowEnhancedModal(false);
      loadTakeoffs();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      console.error('Error in enhanced extraction:', error);
      toast.error(message || 'Failed to extract takeoffs', { id: 'enhanced-extract' });
    } finally {
      setIsEnhancedExtracting(false);
    }
  };

  const handleVerifyLineItem = async (itemId: string, verified: boolean, adjustedQuantity?: number) => {
    if (!selectedTakeoff) return;
    
    try {
      const res = await fetch(`/api/takeoff/${selectedTakeoff.id}/line-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verified,
          verificationStatus: verified ? 'auto_approved' : 'rejected',
          ...(adjustedQuantity !== undefined && { quantity: adjustedQuantity }),
        }),
      });

      if (!res.ok) throw new Error('Failed to update line item');
      
      toast.success(verified ? 'Item verified' : 'Item rejected');
      loadLineItems(selectedTakeoff.id);
    } catch (error: unknown) {
      console.error('Error verifying line item:', error);
      toast.error('Failed to update verification status');
    }
  };

  const handleCreateTakeoff = async () => {
    if (!newTakeoff.name) {
      toast.error('Please enter a takeoff name');
      return;
    }

    try {
      const res = await fetch(`/api/projects/${slug}/takeoffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTakeoff)
      });

      if (!res.ok) throw new Error('Failed to create takeoff');
      
      toast.success('Takeoff created successfully');
      setShowCreateModal(false);
      setNewTakeoff({ name: '', description: '', status: 'draft' });
      loadTakeoffs();
    } catch (error: unknown) {
      console.error('Error creating takeoff:', error);
      toast.error('Failed to create takeoff');
    }
  };

  const handleDeleteTakeoff = async (takeoffId: string) => {
    if (!confirm('Are you sure you want to delete this takeoff?')) return;

    try {
      const res = await fetch(`/api/takeoff/${takeoffId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete takeoff');
      
      toast.success('Takeoff deleted successfully');
      loadTakeoffs();
    } catch (error: unknown) {
      console.error('Error deleting takeoff:', error);
      toast.error('Failed to delete takeoff');
    }
  };

  const handleApproveTakeoff = async (takeoffId: string) => {
    try {
      const res = await fetch(`/api/takeoff/${takeoffId}/approve`, {
        method: 'POST'
      });

      if (!res.ok) throw new Error('Failed to approve takeoff');
      
      toast.success('Takeoff approved successfully');
      loadTakeoffs();
      if (selectedTakeoff?.id === takeoffId) {
        setSelectedTakeoff({ ...selectedTakeoff, status: 'approved' });
      }
    } catch (error: unknown) {
      console.error('Error approving takeoff:', error);
      toast.error('Failed to approve takeoff');
    }
  };

  const handleAddLineItem = async () => {
    if (!selectedTakeoff) return;
    if (!newLineItem.description || !newLineItem.quantity) {
      toast.error('Please fill in description and quantity');
      return;
    }

    try {
      const res = await fetch(`/api/takeoff/${selectedTakeoff.id}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newLineItem,
          totalCost: newLineItem.quantity * newLineItem.unitCost
        })
      });

      if (!res.ok) throw new Error('Failed to add line item');
      
      toast.success('Line item added successfully');
      setShowLineItemModal(false);
      setNewLineItem({
        category: '',
        description: '',
        quantity: 0,
        unit: 'EA',
        unitCost: 0,
        location: '',
        confidence: 1.0,
        verified: false
      });
      loadLineItems(selectedTakeoff.id);
    } catch (error: unknown) {
      console.error('Error adding line item:', error);
      toast.error('Failed to add line item');
    }
  };

  const handleUpdateLineItem = async () => {
    if (!selectedTakeoff || !editingLineItem) return;

    try {
      const res = await fetch(`/api/takeoff/${selectedTakeoff.id}/line-items/${editingLineItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingLineItem,
          totalCost: editingLineItem.quantity * (editingLineItem.unitCost || 0)
        })
      });

      if (!res.ok) throw new Error('Failed to update line item');
      
      toast.success('Line item updated successfully');
      setEditingLineItem(null);
      loadLineItems(selectedTakeoff.id);
    } catch (error: unknown) {
      console.error('Error updating line item:', error);
      toast.error('Failed to update line item');
    }
  };

  const handleDeleteLineItem = async (itemId: string) => {
    if (!selectedTakeoff) return;
    if (!confirm('Are you sure you want to delete this line item?')) return;

    try {
      const res = await fetch(`/api/takeoff/${selectedTakeoff.id}/line-items/${itemId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete line item');
      
      toast.success('Line item deleted successfully');
      loadLineItems(selectedTakeoff.id);
    } catch (error: unknown) {
      console.error('Error deleting line item:', error);
      toast.error('Failed to delete line item');
    }
  };

  const handleExportCSV = async (takeoffId: string) => {
    try {
      setIsExporting(true);
      
      // First, fetch the full takeoff data with line items
      const takeoffRes = await fetch(`/api/takeoff/${takeoffId}`);
      if (!takeoffRes.ok) throw new Error('Failed to fetch takeoff data');
      
      const takeoffData = await takeoffRes.json();
      
      // Then POST to the export endpoint
      const exportRes = await fetch('/api/takeoff/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          takeoff: {
            projectName: takeoffData.project?.name || 'Project',
            items: takeoffData.lineItems || [],
          },
          options: {
            format: 'csv',
            includeRollups: true,
            includeMetadata: true,
          }
        })
      });
      
      if (!exportRes.ok) throw new Error('Failed to generate export');
      
      const blob = await exportRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `takeoff_${takeoffId}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Export completed successfully');
    } catch (error: unknown) {
      console.error('Error exporting:', error);
      toast.error('Failed to export takeoff');
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewTakeoff = async (takeoff: MaterialTakeoff) => {
    setSelectedTakeoff(takeoff);
    await loadLineItems(takeoff.id);
    setShowDetailModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'approved':
        return <Badge className="bg-purple-500"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-surface">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading material takeoffs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-surface p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Material Takeoffs</h1>
            <p className="text-gray-400 mt-1">
              View and manage quantity takeoffs extracted from construction plans
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGenerateTakeoffs}
              disabled={isGenerating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {isGenerating ? 'Generating...' : 'Auto-Generate'}
            </Button>
            <Button
              onClick={() => setShowEnhancedModal(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="h-4 w-4 mr-2" />
              Enhanced Vision
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#F97316] hover:bg-[#ea6a0a]"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Takeoff
            </Button>
            <Button
              onClick={() => router.push(`/project/${slug}`)}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </div>
        </div>

        {takeoffs.length === 0 ? (
          <Card className="bg-dark-card border-gray-700 p-12">
            <div className="text-center space-y-4">
              <Ruler className="h-16 w-16 text-gray-400 mx-auto" />
              <div>
                <h3 className="text-xl font-semibold text-gray-200">No Material Takeoffs Yet</h3>
                <p className="text-gray-400 mt-2 max-w-md mx-auto">
                  Click "Auto-Generate" to extract quantities from your floor plans, or create a manual takeoff.
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Note: Auto-generate requires rooms with finish schedules to be extracted from floor plans first.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button 
                  onClick={handleGenerateTakeoffs}
                  disabled={isGenerating}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isGenerating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {isGenerating ? 'Generating...' : 'Auto-Generate'}
                </Button>
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Manual Takeoff
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="bg-dark-card border-gray-700">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-gray-300">Name</TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-300">Items</TableHead>
                  <TableHead className="text-gray-300">Total Cost</TableHead>
                  <TableHead className="text-gray-300">Source</TableHead>
                  <TableHead className="text-gray-300">Created</TableHead>
                  <TableHead className="text-gray-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {takeoffs.map((takeoff) => (
                  <TableRow key={takeoff.id} className="border-gray-700 hover:bg-dark-surface/50">
                    <TableCell className="font-medium text-gray-200">
                      {takeoff.name}
                      {takeoff.description && (
                        <p className="text-xs text-gray-400 mt-1">{takeoff.description}</p>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(takeoff.status)}</TableCell>
                    <TableCell className="text-gray-300">
                      {takeoff._count.lineItems} items
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {takeoff.totalCost
                        ? `$${takeoff.totalCost.toLocaleString()}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {takeoff.document ? takeoff.document.name : 'Manual'}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {format(new Date(takeoff.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewTakeoff(takeoff)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExportCSV(takeoff.id)}
                          disabled={isExporting}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {session?.user?.role === 'admin' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-400 hover:text-red-300 hover:bg-red-950"
                            onClick={() => handleDeleteTakeoff(takeoff.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Detail Modal */}
        {selectedTakeoff && (
          <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
            <DialogContent className="bg-dark-card border-gray-700 text-gray-100 max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedTakeoff.name}</DialogTitle>
                <DialogDescription className="text-gray-400">
                  {selectedTakeoff.description || 'Material takeoff details'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-dark-surface border-gray-700 p-4">
                    <div className="text-sm text-gray-400">Total Items</div>
                    <div className="text-2xl font-bold text-gray-100 mt-1">
                      {selectedTakeoff._count.lineItems}
                    </div>
                  </Card>
                  <Card className="bg-dark-surface border-gray-700 p-4">
                    <div className="text-sm text-gray-400">Total Cost</div>
                    <div className="text-2xl font-bold text-gray-100 mt-1">
                      {selectedTakeoff.totalCost
                        ? `$${selectedTakeoff.totalCost.toLocaleString()}`
                        : 'TBD'}
                    </div>
                  </Card>
                  <Card className="bg-dark-surface border-gray-700 p-4">
                    <div className="text-sm text-gray-400">Status</div>
                    <div className="mt-2">
                      {getStatusBadge(selectedTakeoff.status)}
                    </div>
                  </Card>
                </div>

                {/* Action Buttons */}
                {session?.user?.role !== 'guest' && (
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => setShowLineItemModal(true)}
                      className="bg-[#F97316] hover:bg-[#ea6a0a]"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Line Item
                    </Button>
                    {selectedTakeoff.status !== 'approved' && session?.user?.role === 'admin' && (
                      <Button
                        onClick={() => handleApproveTakeoff(selectedTakeoff.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve Takeoff
                      </Button>
                    )}
                    <Button
                      onClick={() => handleExportCSV(selectedTakeoff.id)}
                      variant="outline"
                      disabled={isExporting}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                )}

                {/* Line Items */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-4">Line Items</h3>
                  {lineItems.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No line items found</p>
                  ) : (
                    <div className="space-y-2">
                      {lineItems.map((item) => (
                        <Card key={item.id} className="bg-dark-surface border-gray-700 p-4">
                          {editingLineItem?.id === item.id ? (
                            // Edit mode
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-gray-300">Description</Label>
                                  <Input
                                    value={editingLineItem.description}
                                    onChange={(e) => setEditingLineItem({ ...editingLineItem, description: e.target.value })}
                                    className="bg-dark-card border-gray-700"
                                  />
                                </div>
                                <div>
                                  <Label className="text-gray-300">Category</Label>
                                  <Input
                                    value={editingLineItem.category}
                                    onChange={(e) => setEditingLineItem({ ...editingLineItem, category: e.target.value })}
                                    className="bg-dark-card border-gray-700"
                                  />
                                </div>
                                <div>
                                  <Label className="text-gray-300">Quantity</Label>
                                  <Input
                                    type="number"
                                    value={editingLineItem.quantity}
                                    onChange={(e) => setEditingLineItem({ ...editingLineItem, quantity: parseFloat(e.target.value) })}
                                    className="bg-dark-card border-gray-700"
                                  />
                                </div>
                                <div>
                                  <Label className="text-gray-300">Unit</Label>
                                  <Input
                                    value={editingLineItem.unit}
                                    onChange={(e) => setEditingLineItem({ ...editingLineItem, unit: e.target.value })}
                                    className="bg-dark-card border-gray-700"
                                  />
                                </div>
                                <div>
                                  <Label className="text-gray-300">Unit Cost</Label>
                                  <Input
                                    type="number"
                                    value={editingLineItem.unitCost || 0}
                                    onChange={(e) => setEditingLineItem({ ...editingLineItem, unitCost: parseFloat(e.target.value) })}
                                    className="bg-dark-card border-gray-700"
                                  />
                                </div>
                                <div>
                                  <Label className="text-gray-300">Location</Label>
                                  <Input
                                    value={editingLineItem.location || ''}
                                    onChange={(e) => setEditingLineItem({ ...editingLineItem, location: e.target.value })}
                                    className="bg-dark-card border-gray-700"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleUpdateLineItem}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingLineItem(null)}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // View mode
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {item.category}
                                  </Badge>
                                  {item.verified && (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  )}
                                  {item.confidence && item.confidence < 0.7 && (
                                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                                  )}
                                </div>
                                <p className="text-gray-200 font-medium mt-2">
                                  {item.description}
                                </p>
                                {item.location && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Location: {item.location}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-start gap-4">
                                <div className="text-right">
                                  <div className="text-lg font-semibold text-gray-100">
                                    {item.quantity} {item.unit}
                                  </div>
                                  {item.totalCost && (
                                    <div className="text-sm text-gray-400 mt-1">
                                      ${item.totalCost.toLocaleString()}
                                    </div>
                                  )}
                                </div>
                                {session?.user?.role !== 'guest' && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingLineItem(item)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-400 hover:text-red-300"
                                      onClick={() => handleDeleteLineItem(item.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Create Takeoff Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="bg-dark-card border-gray-700 text-gray-100">
            <DialogHeader>
              <DialogTitle>Create New Takeoff</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new material takeoff for this project
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-gray-300">Name *</Label>
                <Input
                  value={newTakeoff.name}
                  onChange={(e) => setNewTakeoff({ ...newTakeoff, name: e.target.value })}
                  placeholder="e.g., Phase 1 Concrete Takeoff"
                  className="bg-dark-surface border-gray-700 mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300">Description</Label>
                <Textarea
                  value={newTakeoff.description}
                  onChange={(e) => setNewTakeoff({ ...newTakeoff, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                  className="bg-dark-surface border-gray-700 mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300">Initial Status</Label>
                <Select
                  value={newTakeoff.status}
                  onValueChange={(value) => setNewTakeoff({ ...newTakeoff, status: value })}
                >
                  <SelectTrigger className="bg-dark-surface border-gray-700 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-card border-gray-700">
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTakeoff({ name: '', description: '', status: 'draft' });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTakeoff}
                className="bg-[#F97316] hover:bg-[#ea6a0a]"
              >
                Create Takeoff
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Line Item Modal */}
        <Dialog open={showLineItemModal} onOpenChange={setShowLineItemModal}>
          <DialogContent className="bg-dark-card border-gray-700 text-gray-100 max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Line Item</DialogTitle>
              <DialogDescription className="text-gray-400">
                Add a new item to this takeoff
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Category *</Label>
                  <Input
                    value={newLineItem.category}
                    onChange={(e) => setNewLineItem({ ...newLineItem, category: e.target.value })}
                    placeholder="e.g., Concrete, Rebar, Formwork"
                    className="bg-dark-surface border-gray-700 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Location</Label>
                  <Input
                    value={newLineItem.location}
                    onChange={(e) => setNewLineItem({ ...newLineItem, location: e.target.value })}
                    placeholder="e.g., Building A, Floor 2"
                    className="bg-dark-surface border-gray-700 mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Description *</Label>
                <Textarea
                  value={newLineItem.description}
                  onChange={(e) => setNewLineItem({ ...newLineItem, description: e.target.value })}
                  placeholder="Detailed description of the item..."
                  rows={2}
                  className="bg-dark-surface border-gray-700 mt-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-300">Quantity *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newLineItem.quantity}
                    onChange={(e) => setNewLineItem({ ...newLineItem, quantity: parseFloat(e.target.value) || 0 })}
                    className="bg-dark-surface border-gray-700 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Unit</Label>
                  <Select
                    value={newLineItem.unit}
                    onValueChange={(value) => setNewLineItem({ ...newLineItem, unit: value })}
                  >
                    <SelectTrigger className="bg-dark-surface border-gray-700 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-dark-card border-gray-700">
                      <SelectItem value="EA">EA (Each)</SelectItem>
                      <SelectItem value="SF">SF (Square Feet)</SelectItem>
                      <SelectItem value="LF">LF (Linear Feet)</SelectItem>
                      <SelectItem value="CY">CY (Cubic Yards)</SelectItem>
                      <SelectItem value="TON">TON</SelectItem>
                      <SelectItem value="LBS">LBS (Pounds)</SelectItem>
                      <SelectItem value="GAL">GAL (Gallons)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-300">Unit Cost ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newLineItem.unitCost}
                    onChange={(e) => setNewLineItem({ ...newLineItem, unitCost: parseFloat(e.target.value) || 0 })}
                    className="bg-dark-surface border-gray-700 mt-1"
                  />
                </div>
              </div>

              {newLineItem.quantity > 0 && newLineItem.unitCost > 0 && (
                <div className="bg-dark-surface border border-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-400">Total Cost</div>
                  <div className="text-2xl font-bold text-[#F97316]">
                    ${(newLineItem.quantity * newLineItem.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
              <Button
                variant="outline"
                onClick={() => {
                  setShowLineItemModal(false);
                  setNewLineItem({
                    category: '',
                    description: '',
                    quantity: 0,
                    unit: 'EA',
                    unitCost: 0,
                    location: '',
                    confidence: 1.0,
                    verified: false
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddLineItem}
                className="bg-[#F97316] hover:bg-[#ea6a0a]"
              >
                Add Item
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Enhanced Vision Extraction Modal */}
        <Dialog open={showEnhancedModal} onOpenChange={setShowEnhancedModal}>
          <DialogContent className="bg-dark-card border-gray-700 text-gray-100 max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-400" />
                Enhanced Vision Extraction
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Use AI vision to analyze plan images directly for more accurate quantity extraction with confidence scoring.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  How It Works
                </h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Analyzes actual plan images using AI vision</li>
                  <li>• Extracts dimensions directly from drawings</li>
                  <li>• Cross-validates with schedules and specs</li>
                  <li>• Calculates confidence scores for each item</li>
                  <li>• Flags low-confidence items for manual review</li>
                </ul>
              </div>

              <div>
                <Label className="text-gray-300">Select Document</Label>
                <Select
                  value={selectedDocumentId}
                  onValueChange={setSelectedDocumentId}
                >
                  <SelectTrigger className="bg-dark-surface border-gray-700 mt-1">
                    <SelectValue placeholder="Choose a PDF document..." />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-card border-gray-700">
                    {documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {documents.length === 0 && (
                  <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    No PDF documents found. Upload plans first.
                  </p>
                )}
              </div>

              {enhancedStats && (
                <Card className="bg-dark-surface border-gray-700 p-4">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Last Extraction Results</h4>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <div className="text-xl font-bold text-green-400">{enhancedStats.byStatus.auto_approved}</div>
                      <div className="text-xs text-gray-500">Auto-Approved</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-yellow-400">{enhancedStats.byStatus.needs_review}</div>
                      <div className="text-xs text-gray-500">Needs Review</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-orange-400">{enhancedStats.byStatus.low_confidence}</div>
                      <div className="text-xs text-gray-500">Low Confidence</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-blue-400">{enhancedStats.averageConfidence}%</div>
                      <div className="text-xs text-gray-500">Avg. Confidence</div>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
              <Button
                variant="outline"
                onClick={() => setShowEnhancedModal(false)}
                className="border-gray-600 text-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEnhancedExtraction}
                disabled={isEnhancedExtracting || !selectedDocumentId}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isEnhancedExtracting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Start Extraction
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
