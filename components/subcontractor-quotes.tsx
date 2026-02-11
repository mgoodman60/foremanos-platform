"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText, Upload, Check, X, AlertCircle, Clock, RefreshCw,
  DollarSign, Building2, Phone, Mail, Calendar, ChevronDown,
  ChevronUp, Download, Trash2, BarChart3, Import, Eye, FileSearch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ScopeGapAnalysis from './scope-gap-analysis';

interface Quote {
  id: string;
  companyName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  quoteNumber?: string;
  quoteDate?: string;
  expirationDate?: string;
  tradeType?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED';
  totalAmount: number;
  laborCost?: number;
  materialCost?: number;
  equipmentCost?: number;
  scopeDescription?: string;
  inclusions: string[];
  exclusions: string[];
  assumptions: string[];
  originalFileName: string;
  aiExtracted: boolean;
  aiConfidence?: number;
  importedToBudget: boolean;
  createdAt: string;
  Uploader?: { username: string };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400', icon: <Clock className="h-3 w-3" /> },
  UNDER_REVIEW: { label: 'Under Review', color: 'bg-blue-500/20 text-blue-400', icon: <Eye className="h-3 w-3" /> },
  APPROVED: { label: 'Approved', color: 'bg-green-500/20 text-green-400', icon: <Check className="h-3 w-3" /> },
  REJECTED: { label: 'Rejected', color: 'bg-red-500/20 text-red-400', icon: <X className="h-3 w-3" /> },
  EXPIRED: { label: 'Expired', color: 'bg-gray-500/20 text-gray-400', icon: <AlertCircle className="h-3 w-3" /> },
  SUPERSEDED: { label: 'Superseded', color: 'bg-purple-500/20 text-purple-400', icon: <RefreshCw className="h-3 w-3" /> },
};

const TRADE_LABELS: Record<string, string> = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac_mechanical: 'HVAC/Mechanical',
  concrete_masonry: 'Concrete/Masonry',
  carpentry_framing: 'Carpentry/Framing',
  drywall_finishes: 'Drywall/Finishes',
  painting_coating: 'Painting',
  roofing: 'Roofing',
  structural_steel: 'Structural Steel',
  glazing_windows: 'Glazing/Windows',
  flooring: 'Flooring',
  site_utilities: 'Site/Utilities',
  general_contractor: 'General',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

type ViewMode = 'quotes' | 'gap-analysis';

export default function SubcontractorQuotes() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTrade, setFilterTrade] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('quotes');
  const [summary, setSummary] = useState<{ total: number; pending: number; approved: number; totalValue: number }>(
    { total: 0, pending: 0, approved: 0, totalValue: 0 }
  );

  const fetchQuotes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterTrade !== 'all') params.set('tradeType', filterTrade);
      
      const res = await fetch(`/api/projects/${slug}/quotes?${params}`);
      if (!res.ok) throw new Error('Failed to fetch quotes');
      
      const data = await res.json();
      setQuotes(data.quotes || []);
      setSummary(data.summary || { total: 0, pending: 0, approved: 0, totalValue: 0 });
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [slug, filterStatus, filterTrade]);

  useEffect(() => {
    if (slug) fetchQuotes();
  }, [slug, fetchQuotes]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('pdf') && !file.type.includes('image')) {
      toast.error('Please upload a PDF or image file');
      return;
    }

    setUploading(true);
    try {
      // Get presigned URL
      const presignRes = await fetch(`/api/projects/${slug}/quotes/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      });

      if (!presignRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, cloudStoragePath } = await presignRes.json();

      // Upload to S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) throw new Error('Failed to upload file');

      // Create quote and analyze
      toast.loading('Analyzing quote...', { id: 'analyze' });
      
      const createRes = await fetch(`/api/projects/${slug}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          cloudStoragePath,
          analyzeNow: true,
        }),
      });

      if (!createRes.ok) throw new Error('Failed to create quote');
      
      toast.dismiss('analyze');
      toast.success('Quote uploaded and analyzed successfully');
      fetchQuotes();
    } catch (error) {
      toast.dismiss('analyze');
      console.error('Upload error:', error);
      toast.error('Failed to upload quote');
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleAction = async (quoteId: string, action: string, data?: any) => {
    try {
      const res = await fetch(`/api/projects/${slug}/quotes/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });

      if (!res.ok) throw new Error('Action failed');
      
      const result = await res.json();
      
      if (action === 'import_to_budget') {
        toast.success(`Created ${result.budgetItemsCreated} budget items`);
      } else {
        toast.success(`Quote ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'updated'}`);
      }
      
      fetchQuotes();
    } catch (error) {
      console.error('Action error:', error);
      toast.error('Action failed');
    }
  };

  const handleDelete = async (quoteId: string) => {
    if (!confirm('Are you sure you want to delete this quote?')) return;
    
    try {
      const res = await fetch(`/api/projects/${slug}/quotes/${quoteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Delete failed');
      toast.success('Quote deleted');
      fetchQuotes();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete quote');
    }
  };

  const handleDownload = async (quoteId: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/quotes/${quoteId}`);
      if (!res.ok) throw new Error('Failed to get download URL');
      
      const { downloadUrl } = await res.json();
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download quote');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-dark-surface p-1 rounded-lg border border-gray-700">
          <button
            onClick={() => setViewMode('quotes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'quotes'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-card'
            }`}
          >
            <FileText className="h-4 w-4" />
            Quotes
          </button>
          <button
            onClick={() => setViewMode('gap-analysis')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'gap-analysis'
                ? 'bg-amber-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-card'
            }`}
          >
            <FileSearch className="h-4 w-4" />
            Scope Gap Analysis
          </button>
        </div>
      </div>

      {/* Scope Gap Analysis View */}
      {viewMode === 'gap-analysis' && (
        <ScopeGapAnalysis selectedTrade={filterTrade !== 'all' ? filterTrade : undefined} />
      )}

      {/* Quotes View */}
      {viewMode === 'quotes' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-dark-card rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total Quotes</p>
                  <p className="text-2xl font-bold text-white">{summary.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-card rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Pending Review</p>
                  <p className="text-2xl font-bold text-white">{summary.pending}</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-card rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Check className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Approved</p>
                  <p className="text-2xl font-bold text-white">{summary.approved}</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-card rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total Value</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(summary.totalValue)}</p>
                </div>
              </div>
            </div>
          </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-dark-card border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Trade Filter */}
          <select
            value={filterTrade}
            onChange={(e) => setFilterTrade(e.target.value)}
            className="bg-dark-card border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All Trades</option>
            {Object.entries(TRADE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Upload Button */}
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={handleFileUpload}
            className="hidden"
            disabled={uploading}
          />
          <Button disabled={uploading} className="bg-blue-600 hover:bg-blue-700">
            {uploading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Quote
          </Button>
        </label>
      </div>

      {/* Quotes List */}
      <div className="space-y-3">
        {quotes.length === 0 ? (
          <div className="bg-dark-card rounded-lg p-8 text-center border border-gray-700">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No quotes uploaded yet</p>
            <p className="text-sm text-gray-400 mt-1">Upload a subcontractor quote to get started</p>
          </div>
        ) : (
          quotes.map((quote) => (
            <div
              key={quote.id}
              className="bg-dark-card rounded-lg border border-gray-700 overflow-hidden"
            >
              {/* Quote Header */}
              <div
                className="p-4 cursor-pointer hover:bg-dark-hover transition-colors"
                onClick={() => setExpandedQuote(expandedQuote === quote.id ? null : quote.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-700 rounded-lg">
                      <Building2 className="h-5 w-5 text-gray-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{quote.companyName}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        {quote.tradeType && (
                          <span>{TRADE_LABELS[quote.tradeType] || quote.tradeType}</span>
                        )}
                        {quote.quoteNumber && (
                          <span>#{quote.quoteNumber}</span>
                        )}
                        <span>{quote.originalFileName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* AI Confidence Badge */}
                    {quote.aiExtracted && quote.aiConfidence !== undefined && (
                      <div className={`text-xs px-2 py-1 rounded ${
                        quote.aiConfidence >= 0.8 ? 'bg-green-500/20 text-green-400' :
                        quote.aiConfidence >= 0.6 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        AI: {Math.round(quote.aiConfidence * 100)}%
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${STATUS_CONFIG[quote.status]?.color}`}>
                      {STATUS_CONFIG[quote.status]?.icon}
                      <span>{STATUS_CONFIG[quote.status]?.label}</span>
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      <p className="font-bold text-white">{formatCurrency(quote.totalAmount)}</p>
                      {quote.importedToBudget && (
                        <p className="text-xs text-green-400">In Budget</p>
                      )}
                    </div>

                    {expandedQuote === quote.id ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedQuote === quote.id && (
                <div className="border-t border-gray-700 p-4 space-y-4">
                  {/* Contact & Dates Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Contact Info */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-400">Contact</h4>
                      {quote.contactName && (
                        <p className="text-white text-sm">{quote.contactName}</p>
                      )}
                      {quote.contactEmail && (
                        <p className="text-gray-400 text-sm flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {quote.contactEmail}
                        </p>
                      )}
                      {quote.contactPhone && (
                        <p className="text-gray-400 text-sm flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {quote.contactPhone}
                        </p>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-400">Dates</h4>
                      {quote.quoteDate && (
                        <p className="text-gray-300 text-sm">
                          Quoted: {format(new Date(quote.quoteDate), 'MMM d, yyyy')}
                        </p>
                      )}
                      {quote.expirationDate && (
                        <p className={`text-sm ${
                          new Date(quote.expirationDate) < new Date() ? 'text-red-400' : 'text-gray-300'
                        }`}>
                          Expires: {format(new Date(quote.expirationDate), 'MMM d, yyyy')}
                        </p>
                      )}
                      <p className="text-gray-400 text-xs">
                        Uploaded: {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                        {quote.Uploader && ` by ${quote.Uploader.username}`}
                      </p>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-400">Cost Breakdown</h4>
                      <div className="space-y-1 text-sm">
                        {quote.laborCost !== undefined && quote.laborCost > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Labor:</span>
                            <span className="text-white">{formatCurrency(quote.laborCost)}</span>
                          </div>
                        )}
                        {quote.materialCost !== undefined && quote.materialCost > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Materials:</span>
                            <span className="text-white">{formatCurrency(quote.materialCost)}</span>
                          </div>
                        )}
                        {quote.equipmentCost !== undefined && quote.equipmentCost > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Equipment:</span>
                            <span className="text-white">{formatCurrency(quote.equipmentCost)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold pt-1 border-t border-gray-600">
                          <span className="text-gray-300">Total:</span>
                          <span className="text-green-400">{formatCurrency(quote.totalAmount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scope Description */}
                  {quote.scopeDescription && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Scope of Work</h4>
                      <p className="text-gray-300 text-sm bg-dark-card p-3 rounded-lg">
                        {quote.scopeDescription}
                      </p>
                    </div>
                  )}

                  {/* Inclusions/Exclusions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quote.inclusions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-green-400 mb-2">Inclusions</h4>
                        <ul className="text-sm text-gray-300 space-y-1">
                          {quote.inclusions.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {quote.exclusions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-red-400 mb-2">Exclusions</h4>
                        <ul className="text-sm text-gray-300 space-y-1">
                          {quote.exclusions.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(quote.id)}
                      className="border-gray-600 text-gray-300"
                    >
                      <Download className="h-4 w-4 mr-1" /> Download
                    </Button>
                    
                    {quote.status !== 'APPROVED' && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(quote.id, 'approve')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                    )}

                    {quote.status !== 'REJECTED' && quote.status !== 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(quote.id, 'reject', { reason: 'Manually rejected' })}
                        className="border-red-600 text-red-400 hover:bg-red-600/20"
                      >
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    )}

                    {quote.status === 'APPROVED' && !quote.importedToBudget && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(quote.id, 'import_to_budget')}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Import className="h-4 w-4 mr-1" /> Import to Budget
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(quote.id, 'reanalyze')}
                      className="border-gray-600 text-gray-300"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" /> Re-analyze
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(quote.id)}
                      className="border-red-600 text-red-400 hover:bg-red-600/20 ml-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
        </>
      )}
    </div>
  );
}
