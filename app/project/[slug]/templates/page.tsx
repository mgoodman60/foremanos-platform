'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Link from 'next/link';
import { Upload, FileText, Download, Trash2, Plus, X, ChevronLeft } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';

interface Template {
  id: string;
  name: string;
  description: string | null;
  templateType: string;
  fileFormat: string;
  cloud_storage_path: string;
  isPublic: boolean;
  fileSize: number | null;
  uploadedBy: string;
  createdAt: string;
  User: {
    id: string;
    username: string;
    email: string | null;
  };
  Project: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export default function TemplatesPage() {
  const params = useParams();
  const _router = useRouter();
  const { data: _session } = useSession();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    templateType: 'daily_report',
    isPublic: false,
  });
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, [params.slug]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/templates?projectSlug=${params.slug}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data.templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file format
      const validFormats = ['docx', 'xlsx', 'pdf'];
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (!extension || !validFormats.includes(extension)) {
        toast.error('Invalid file format. Only .docx, .xlsx, and .pdf files are allowed');
        return;
      }

      setSelectedFile(file);
      
      // Auto-fill name if empty
      if (!uploadForm.name) {
        const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
        setUploadForm({ ...uploadForm, name: nameWithoutExtension });
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    if (!uploadForm.name) {
      toast.error('Please enter a template name');
      return;
    }

    setUploading(true);
    const toastId = toast.loading('Uploading template...');

    try {
      // Get file extension
      const fileFormat = selectedFile.name.split('.').pop()?.toLowerCase() || '';

      // Step 1: Generate presigned URL
      const presignedResponse = await fetch('/api/documents/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          isPublic: uploadForm.isPublic,
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error('Failed to generate upload URL');
      }

      const { uploadUrl, cloud_storage_path } = await presignedResponse.json();

      // Step 2: Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type,
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Create template record
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: uploadForm.name,
          description: uploadForm.description,
          templateType: uploadForm.templateType,
          fileFormat,
          cloud_storage_path,
          isPublic: uploadForm.isPublic,
          fileSize: selectedFile.size,
          projectSlug: params.slug,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create template record');
      }

      toast.success('Template uploaded successfully', { id: toastId });
      setShowUploadDialog(false);
      setSelectedFile(null);
      setUploadForm({
        name: '',
        description: '',
        templateType: 'daily_report',
        isPublic: false,
      });
      fetchTemplates();
    } catch (error) {
      console.error('Error uploading template:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload template',
        { id: toastId }
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (templateId: string) => {
    setDeleteTemplateId(templateId);
  };

  const doDelete = async () => {
    const templateId = deleteTemplateId;
    setDeleteTemplateId(null);
    if (!templateId) return;

    const toastId = toast.loading('Deleting template...');

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      toast.success('Template deleted successfully', { id: toastId });
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete template',
        { id: toastId }
      );
    }
  };

  const getTemplateTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      daily_report: 'Daily Report',
      schedule: 'Schedule',
      budget: 'Budget',
      rfi: 'RFI',
      custom: 'Custom',
    };
    return labels[type] || type;
  };

  const getTemplateTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      daily_report: 'bg-blue-500',
      schedule: 'bg-orange-500',
      budget: 'bg-green-500',
      rfi: 'bg-purple-500',
      custom: 'bg-gray-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-dark-surface">
      {/* Back Navigation */}
      <div className="border-b border-gray-700 bg-gray-800">
        <div className="container mx-auto px-6 py-4">
          <Link
            href={`/project/${params.slug}`}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Project
          </Link>
        </div>
      </div>
      
      <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Document Templates</h1>
          <p className="text-gray-400 mt-2">
            Upload and manage custom templates for document exports
          </p>
        </div>
        <Button
          onClick={() => setShowUploadDialog(true)}
          className="bg-orange-500 hover:bg-orange-600 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Upload Template
        </Button>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="bg-dark-card border-gray-700 animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-dark-surface rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className="bg-dark-card border-gray-700">
          <CardContent className="p-12 text-center">
            <FileText className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-50 mb-2">
              No Templates Yet
            </h3>
            <p className="text-gray-400 mb-4">
              Upload custom document templates to use when exporting reports and documents
            </p>
            <Button
              onClick={() => setShowUploadDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <Card key={template.id} className="bg-dark-card border-gray-700 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-slate-50 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-orange-500" />
                      {template.name}
                    </CardTitle>
                    {template.description && (
                      <CardDescription className="mt-2 text-gray-400">
                        {template.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Metadata */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={getTemplateTypeBadgeColor(template.templateType)}>
                    {getTemplateTypeLabel(template.templateType)}
                  </Badge>
                  <Badge variant="outline" className="text-gray-300">
                    .{template.fileFormat}
                  </Badge>
                  {template.isPublic && (
                    <Badge variant="outline" className="text-green-400 border-green-400">
                      Public
                    </Badge>
                  )}
                </div>

                {/* File Size */}
                {template.fileSize && (
                  <p className="text-sm text-gray-400">
                    Size: {(template.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}

                {/* Uploaded By */}
                <p className="text-xs text-gray-500">
                  Uploaded by {template.User.username || template.User.email} •{' '}
                  {new Date(template.createdAt).toLocaleDateString()}
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-dark-surface"
                    onClick={() => {
                      // Download template
                      window.open(`/api/templates/${template.id}`, '_blank');
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-600 text-red-400 hover:bg-red-900/20"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-dark-card border-gray-700 text-slate-50 max-w-md">
          <DialogHeader>
            <DialogTitle>Upload New Template</DialogTitle>
            <DialogDescription className="text-gray-400">
              Upload a custom document template (DOCX, XLSX, or PDF)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* File Input */}
            <div className="space-y-2">
              <Label htmlFor="file">Template File</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  accept=".docx,.xlsx,.pdf"
                  onChange={handleFileSelect}
                  className="bg-dark-surface border-gray-700 text-slate-50"
                />
                {selectedFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {selectedFile && (
                <p className="text-sm text-gray-400">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {/* Template Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={uploadForm.name}
                onChange={e => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="e.g., Daily Report Template"
                className="bg-dark-surface border-gray-700 text-slate-50"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={uploadForm.description}
                onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
                placeholder="Brief description of this template"
                className="bg-dark-surface border-gray-700 text-slate-50"
                rows={3}
              />
            </div>

            {/* Template Type */}
            <div className="space-y-2">
              <Label htmlFor="templateType">Template Type</Label>
              <Select
                value={uploadForm.templateType}
                onValueChange={value => setUploadForm({ ...uploadForm, templateType: value })}
              >
                <SelectTrigger className="bg-dark-surface border-gray-700 text-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-dark-card border-gray-700">
                  <SelectItem value="daily_report">Daily Report</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                  <SelectItem value="budget">Budget</SelectItem>
                  <SelectItem value="rfi">RFI</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Public Toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={uploadForm.isPublic}
                onChange={e => setUploadForm({ ...uploadForm, isPublic: e.target.checked })}
                className="rounded border-gray-700"
              />
              <Label htmlFor="isPublic" className="cursor-pointer">
                Make this template publicly downloadable
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
              disabled={uploading}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !uploadForm.name || uploading}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {uploading ? 'Uploading...' : 'Upload Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTemplateId !== null}
        onConfirm={doDelete}
        onCancel={() => setDeleteTemplateId(null)}
        title="Delete Template"
        description="Are you sure you want to delete this template?"
        variant="destructive"
      />
      </div>
    </div>
  );
}
