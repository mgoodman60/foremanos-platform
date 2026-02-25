'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Users, ArrowLeft, Upload, FileText, Loader2, FileCheck } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Project {
  id: string;
  name: string;
  slug: string;
  documentCount: number;
  ownerId: string;
}

interface Subcontractor {
  id: string;
  companyName: string;
  tradeType: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
}

const TRADE_TYPES = [
  { value: 'general_contractor', label: 'General Contractor' },
  { value: 'concrete_masonry', label: 'Concrete & Masonry' },
  { value: 'carpentry_framing', label: 'Carpentry & Framing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'hvac_mechanical', label: 'HVAC & Mechanical' },
  { value: 'drywall_finishes', label: 'Drywall & Finishes' },
  { value: 'site_utilities', label: 'Site Utilities' },
  { value: 'structural_steel', label: 'Structural Steel' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'glazing_windows', label: 'Glazing & Windows' },
  { value: 'painting_coating', label: 'Painting & Coating' },
  { value: 'flooring', label: 'Flooring' },
];

export default function SubcontractorsPageContent({ project }: { project: Project }) {
  const projectSlug = project.slug;

  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [filteredSubcontractors, setFilteredSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTrade, setFilterTrade] = useState<string>('all');

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [currentSubcontractor, setCurrentSubcontractor] = useState<Subcontractor | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    companyName: '',
    tradeType: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  // Fetch subcontractors
  useEffect(() => {
    fetchSubcontractors();
  }, [projectSlug]);

  // Filter subcontractors
  useEffect(() => {
    let filtered = subcontractors;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (sub) =>
          sub.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sub.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sub.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Trade filter
    if (filterTrade && filterTrade !== 'all') {
      filtered = filtered.filter((sub) => sub.tradeType === filterTrade);
    }

    setFilteredSubcontractors(filtered);
  }, [subcontractors, searchTerm, filterTrade]);

  const fetchSubcontractors = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/subcontractors`);
      if (!response.ok) throw new Error('Failed to fetch subcontractors');
      const data = await response.json();
      setSubcontractors(data);
    } catch (error) {
      console.error('Error fetching subcontractors:', error);
      toast.error('Failed to load subcontractors');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      companyName: '',
      tradeType: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
    });
    setShowAddDialog(true);
  };

  const handleEdit = (subcontractor: Subcontractor) => {
    setCurrentSubcontractor(subcontractor);
    setFormData({
      companyName: subcontractor.companyName,
      tradeType: subcontractor.tradeType,
      contactName: subcontractor.contactName || '',
      contactPhone: subcontractor.contactPhone || '',
      contactEmail: subcontractor.contactEmail || '',
    });
    setShowEditDialog(true);
  };

  const handleDelete = (subcontractor: Subcontractor) => {
    setCurrentSubcontractor(subcontractor);
    setShowDeleteDialog(true);
  };

  const handleSubmitAdd = async () => {
    if (!formData.companyName || !formData.tradeType) {
      toast.error('Company name and trade type are required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/projects/${projectSlug}/subcontractors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add subcontractor');
      }

      toast.success('Subcontractor added successfully');
      setShowAddDialog(false);
      fetchSubcontractors();
    } catch (error: unknown) {
      console.error('Error adding subcontractor:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed to add subcontractor';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!currentSubcontractor || !formData.companyName || !formData.tradeType) {
      toast.error('Company name and trade type are required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(
        `/api/projects/${projectSlug}/subcontractors/${currentSubcontractor.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update subcontractor');
      }

      toast.success('Subcontractor updated successfully');
      setShowEditDialog(false);
      fetchSubcontractors();
    } catch (error: unknown) {
      console.error('Error updating subcontractor:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed to update subcontractor';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!currentSubcontractor) return;

    try {
      setSubmitting(true);
      const response = await fetch(
        `/api/projects/${projectSlug}/subcontractors/${currentSubcontractor.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete subcontractor');
      }

      toast.success('Subcontractor deleted successfully');
      setShowDeleteDialog(false);
      fetchSubcontractors();
    } catch (error) {
      console.error('Error deleting subcontractor:', error);
      toast.error('Failed to delete subcontractor');
    } finally {
      setSubmitting(false);
    }
  };

  const getTradeName = (tradeValue: string) => {
    return TRADE_TYPES.find((t) => t.value === tradeValue)?.label || tradeValue;
  };

  const handleImport = () => {
    setImportFile(null);
    setImportText('');
    setShowImportDialog(true);
  };

  const handleImportSubmit = async () => {
    if (!importFile && !importText.trim()) {
      toast.error('Please upload a file or paste text content');
      return;
    }

    try {
      setImporting(true);
      const formData = new FormData();

      if (importFile) {
        formData.append('file', importFile);
      } else {
        formData.append('text', importText);
      }

      const response = await fetch(`/api/projects/${projectSlug}/subcontractors/import`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import subcontractors');
      }

      if (result.imported > 0) {
        toast.success(result.message);
      } else if (result.skipped > 0) {
        toast.info(result.message);
      } else {
        toast.warning(result.message || 'No subcontractors found in the document');
      }

      if (result.errors?.length > 0) {
        result.errors.forEach((err: string) => toast.error(err));
      }

      setShowImportDialog(false);
      fetchSubcontractors();
    } catch (error: unknown) {
      console.error('Error importing subcontractors:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed to import subcontractors';
      toast.error(errMsg);
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Accept common document formats
      const allowedTypes = [
        'text/plain',
        'text/csv',
        'application/json',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      const allowedExtensions = ['.txt', '.csv', '.json', '.doc', '.docx'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        toast.error('Please upload a text file (.txt, .csv, .json, .doc, .docx)');
        return;
      }

      setImportFile(file);
      setImportText(''); // Clear text if file is selected
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <div className="text-gray-300">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-surface p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/project/${projectSlug}`}>
            <Button
              variant="ghost"
              className="mb-4 text-gray-300 hover:text-white hover:bg-dark-card"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Users className="w-8 h-8 text-orange-500" />
                Subcontractor Management
              </h1>
              <p className="text-gray-400 mt-1">Manage subcontractors for this project</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleImport}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import from Document
              </Button>
              <Button
                onClick={handleAdd}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Subcontractor
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-dark-card border-gray-700 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by company, contact name, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-dark-surface border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>
            </div>
            <div className="w-full sm:w-64">
              <Select value={filterTrade} onValueChange={setFilterTrade}>
                <SelectTrigger className="bg-dark-surface border-gray-600 text-white">
                  <SelectValue placeholder="Filter by trade" />
                </SelectTrigger>
                <SelectContent className="bg-dark-card border-gray-700">
                  <SelectItem value="all" className="text-white">All Trades</SelectItem>
                  {TRADE_TYPES.map((trade) => (
                    <SelectItem key={trade.value} value={trade.value} className="text-white">
                      {trade.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Subcontractor List */}
        <div className="grid gap-4">
          {filteredSubcontractors.length === 0 ? (
            <Card className="bg-dark-card border-gray-700 p-12 text-center">
              <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchTerm || filterTrade !== 'all'
                  ? 'No subcontractors found'
                  : 'No subcontractors yet'}
              </h3>
              <p className="text-gray-400 mb-6">
                {searchTerm || filterTrade !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Add your first subcontractor to get started'}
              </p>
              {!searchTerm && filterTrade === 'all' && (
                <Button
                  onClick={handleAdd}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subcontractor
                </Button>
              )}
            </Card>
          ) : (
            filteredSubcontractors.map((sub) => (
              <Card key={sub.id} className="bg-dark-card border-gray-700 p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">{sub.companyName}</h3>
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-orange-500/20 text-orange-500">
                        {getTradeName(sub.tradeType)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      {sub.contactName && (
                        <div>
                          <span className="text-gray-400">Contact: </span>
                          <span className="text-white">{sub.contactName}</span>
                        </div>
                      )}
                      {sub.contactPhone && (
                        <div>
                          <span className="text-gray-400">Phone: </span>
                          <span className="text-white">{sub.contactPhone}</span>
                        </div>
                      )}
                      {sub.contactEmail && (
                        <div>
                          <span className="text-gray-400">Email: </span>
                          <span className="text-white">{sub.contactEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Link href={`/project/${projectSlug}/contracts?subcontractorId=${sub.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-600 text-gray-300 hover:bg-dark-surface hover:text-white"
                      >
                        <FileCheck className="w-4 h-4 mr-1" />
                        Contracts
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(sub)}
                      className="text-gray-400 hover:text-white hover:bg-dark-surface"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(sub)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-dark-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Add Subcontractor</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add a new subcontractor to this project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="ABC Construction"
                className="bg-dark-surface border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="tradeType">Trade Type *</Label>
              <Select
                value={formData.tradeType}
                onValueChange={(value) => setFormData({ ...formData, tradeType: value })}
              >
                <SelectTrigger className="bg-dark-surface border-gray-600 text-white">
                  <SelectValue placeholder="Select trade type" />
                </SelectTrigger>
                <SelectContent className="bg-dark-card border-gray-700">
                  {TRADE_TYPES.map((trade) => (
                    <SelectItem key={trade.value} value={trade.value} className="text-white">
                      {trade.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="John Smith"
                className="bg-dark-surface border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                placeholder="(555) 123-4567"
                className="bg-dark-surface border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="contact@abcconstruction.com"
                className="bg-dark-surface border-gray-600 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={submitting}
              className="border-gray-600 text-gray-300 hover:bg-dark-surface"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAdd}
              disabled={submitting}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {submitting ? 'Adding...' : 'Add Subcontractor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-dark-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Edit Subcontractor</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update subcontractor information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-companyName">Company Name *</Label>
              <Input
                id="edit-companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="bg-dark-surface border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="edit-tradeType">Trade Type *</Label>
              <Select
                value={formData.tradeType}
                onValueChange={(value) => setFormData({ ...formData, tradeType: value })}
              >
                <SelectTrigger className="bg-dark-surface border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-dark-card border-gray-700">
                  {TRADE_TYPES.map((trade) => (
                    <SelectItem key={trade.value} value={trade.value} className="text-white">
                      {trade.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-contactName">Contact Name</Label>
              <Input
                id="edit-contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="bg-dark-surface border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="edit-contactPhone">Contact Phone</Label>
              <Input
                id="edit-contactPhone"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className="bg-dark-surface border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="edit-contactEmail">Contact Email</Label>
              <Input
                id="edit-contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="bg-dark-surface border-gray-600 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={submitting}
              className="border-gray-600 text-gray-300 hover:bg-dark-surface"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEdit}
              disabled={submitting}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-dark-card border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subcontractor</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete <strong>{currentSubcontractor?.companyName}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={submitting}
              className="border-gray-600 text-gray-300 hover:bg-dark-surface"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-dark-card border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" />
              Import Subcontractors
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Upload a document or paste text containing subcontractor information.
              AI will extract company names, trades, and contact details automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* File Upload */}
            <div>
              <Label className="text-gray-300 mb-2 block">Upload Document</Label>
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-orange-500 transition-colors">
                <input
                  type="file"
                  id="import-file"
                  className="hidden"
                  accept=".txt,.csv,.json,.doc,.docx"
                  onChange={handleFileChange}
                />
                <label htmlFor="import-file" className="cursor-pointer">
                  <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                  {importFile ? (
                    <div className="text-orange-500 font-medium">{importFile.name}</div>
                  ) : (
                    <>
                      <p className="text-gray-300 mb-1">Click to upload or drag &amp; drop</p>
                      <p className="text-gray-500 text-sm">Supports .txt, .csv, .json, .doc, .docx</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-600" />
              <span className="text-gray-500 text-sm">OR</span>
              <div className="flex-1 h-px bg-gray-600" />
            </div>

            {/* Text Paste */}
            <div>
              <Label htmlFor="import-text" className="text-gray-300 mb-2 block">Paste Text Content</Label>
              <Textarea
                id="import-text"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  if (e.target.value) setImportFile(null);
                }}
                placeholder="Paste your subcontractor list here...&#10;&#10;Example:&#10;ABC Electrical - Contact: John Smith (555) 123-4567&#10;XYZ Plumbing Co - Contact: Jane Doe jane@xyzplumbing.com"
                className="bg-dark-surface border-gray-600 text-white min-h-[150px] placeholder:text-gray-500"
              />
            </div>

            <div className="bg-dark-surface rounded-lg p-4 text-sm">
              <h4 className="text-gray-300 font-medium mb-2">Tips for best results:</h4>
              <ul className="text-gray-400 space-y-1 list-disc list-inside">
                <li>Include company names, trade types, and contact details</li>
                <li>Formats like bid tabs, subcontractor lists, or contact sheets work well</li>
                <li>AI will automatically categorize trades and extract contact info</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(false)}
              disabled={importing}
              className="border-gray-600 text-gray-300 hover:bg-dark-surface"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportSubmit}
              disabled={importing || (!importFile && !importText.trim())}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Subcontractors
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
