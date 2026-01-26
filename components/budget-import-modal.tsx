"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Upload,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BudgetDocument {
  id: string;
  name: string;
  category: string;
  processed: boolean;
  createdAt: string;
}

interface ExtractedItem {
  name: string;
  costCode?: string;
  tradeType?: string;
  budgetedAmount: number;
}

interface BudgetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BudgetImportModal({ isOpen, onClose, onSuccess }: BudgetImportModalProps) {
  const params = useParams();
  const slug = params?.slug as string;

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<BudgetDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<{
    totalBudget: number;
    itemCount: number;
    confidence: number;
    items: ExtractedItem[];
  } | null>(null);

  useEffect(() => {
    if (isOpen && slug) {
      fetchBudgetDocuments();
    }
  }, [isOpen, slug]);

  const fetchBudgetDocuments = async () => {
    setLoading(true);
    try {
      // Fetch documents that might contain budget info
      const response = await fetch(`/api/projects/${slug}/documents`);
      if (response.ok) {
        const data = await response.json();
        // Filter for budget-related documents
        const budgetDocs = (data.documents || []).filter((doc: BudgetDocument) =>
          doc.processed && (
            doc.category === 'budget' ||
            doc.category === 'estimate' ||
            doc.name.toLowerCase().includes('budget') ||
            doc.name.toLowerCase().includes('cost') ||
            doc.name.toLowerCase().includes('estimate') ||
            doc.name.toLowerCase().includes('proposal') ||
            doc.name.toLowerCase().includes('bid')
          )
        );
        setDocuments(budgetDocs);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!selectedDoc) {
      toast.error('Please select a document');
      return;
    }

    setExtracting(true);
    setExtractionResult(null);

    try {
      const response = await fetch(`/api/projects/${slug}/budget/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDoc,
          autoImport: false, // Preview first
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Extraction failed');
      }

      const result = await response.json();
      setExtractionResult({
        totalBudget: result.extraction.totalBudget,
        itemCount: result.extraction.itemCount,
        confidence: result.extraction.confidence,
        items: result.lineItems,
      });

      toast.success(`Extracted ${result.extraction.itemCount} budget items`);
    } catch (error: any) {
      console.error('Extraction error:', error);
      toast.error(error.message || 'Failed to extract budget');
    } finally {
      setExtracting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedDoc || !extractionResult) {
      toast.error('Please extract budget first');
      return;
    }

    setExtracting(true);

    try {
      const response = await fetch(`/api/projects/${slug}/budget/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDoc,
          autoImport: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();
      toast.success(`Imported ${result.import.itemsCreated} budget items`);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import budget');
    } finally {
      setExtracting(false);
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#2d333b] border-gray-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#F97316]" />
            Import Budget from Document
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Select a budget document to extract line items using AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Document Selection */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              Select Budget Document
            </label>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-gray-500 mb-2" />
                <p className="text-gray-400">No budget documents found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Upload a budget PDF or Excel file first
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSelectedDoc(doc.id);
                      setExtractionResult(null);
                    }}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedDoc === doc.id
                        ? 'border-[#F97316] bg-[#F97316]/10'
                        : 'border-gray-600 hover:border-gray-500 bg-[#1F2328]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className={`h-5 w-5 ${
                        selectedDoc === doc.id ? 'text-[#F97316]' : 'text-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{doc.name}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {selectedDoc === doc.id && (
                        <CheckCircle2 className="h-5 w-5 text-[#F97316]" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Extract Button */}
          {selectedDoc && !extractionResult && (
            <Button
              onClick={handleExtract}
              disabled={extracting}
              className="w-full bg-[#F97316] hover:bg-[#EA580C]"
            >
              {extracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting budget...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Extract Budget Items
                </>
              )}
            </Button>
          )}

          {/* Extraction Result Preview */}
          {extractionResult && (
            <div className="space-y-3">
              <div className="p-4 bg-[#1F2328] rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">Extraction Result</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    extractionResult.confidence >= 80 
                      ? 'bg-green-900/40 text-green-400'
                      : extractionResult.confidence >= 60
                        ? 'bg-yellow-900/40 text-yellow-400'
                        : 'bg-red-900/40 text-red-400'
                  }`}>
                    {extractionResult.confidence.toFixed(0)}% confidence
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {formatCurrency(extractionResult.totalBudget)}
                    </div>
                    <div className="text-xs text-gray-500">Total Budget</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {extractionResult.itemCount}
                    </div>
                    <div className="text-xs text-gray-500">Line Items</div>
                  </div>
                </div>
              </div>

              {/* Preview items */}
              <div className="max-h-48 overflow-y-auto space-y-1">
                <div className="text-xs text-gray-400 mb-2">Preview (first 10 items):</div>
                {extractionResult.items.slice(0, 10).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-[#1F2328] rounded text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {item.costCode && (
                        <span className="text-xs text-gray-500 font-mono">{item.costCode}</span>
                      )}
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="font-medium text-gray-300 ml-2">
                      {formatCurrency(item.budgetedAmount)}
                    </span>
                  </div>
                ))}
                {extractionResult.itemCount > 10 && (
                  <div className="text-xs text-gray-500 text-center py-1">
                    +{extractionResult.itemCount - 10} more items
                  </div>
                )}
              </div>

              {extractionResult.confidence < 70 && (
                <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-300">
                    Low confidence extraction. Please review the items carefully before importing.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="border-gray-600">
            Cancel
          </Button>
          {extractionResult && (
            <Button
              onClick={handleImport}
              disabled={extracting}
              className="bg-green-600 hover:bg-green-700"
            >
              {extracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Import to Budget
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
