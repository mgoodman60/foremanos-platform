'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string | null;
  fileFormat: string;
}

interface TemplateExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  conversationType: string;
}

export default function TemplateExportDialog({
  isOpen,
  onClose,
  conversationId,
  conversationType,
}: TemplateExportDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, conversationId]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/conversations/${conversationId}/export-with-template`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      setTemplates(data.templates || []);

      // Auto-select first template if available
      if (data.templates && data.templates.length > 0) {
        setSelectedTemplateId(data.templates[0].id);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to load templates'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a template');
      return;
    }

    setExporting(true);
    const toastId = toast.loading('Generating document from template...');

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/export-with-template`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            templateId: selectedTemplateId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename="')[1]?.split('"')[0]
        : 'exported_document.docx';

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Document exported successfully', { id: toastId });
      onClose();
    } catch (error) {
      console.error('Error exporting with template:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to export document',
        { id: toastId }
      );
    } finally {
      setExporting(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-card border-gray-700 text-[#F8FAFC] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#F97316]" />
            Export with Template
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Select a template to export your {conversationType.replace('_', ' ')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#F97316]" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-200">
                <p className="font-medium mb-1">Error Loading Templates</p>
                <p className="text-red-300/80">{error}</p>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 mb-2">No templates available</p>
              <p className="text-sm text-gray-500">
                Upload a template for this document type to enable template exports
              </p>
            </div>
          ) : (
            <>
              {/* Template Selection */}
              <div className="space-y-2">
                <Label htmlFor="template">Select Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="bg-dark-surface border-gray-700 text-[#F8FAFC]">
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-card border-gray-700">
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} (.{template.fileFormat})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Preview Card */}
              {selectedTemplate && (
                <Card className="bg-dark-surface border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-[#F97316] mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-[#F8FAFC]">
                          {selectedTemplate.name}
                        </p>
                        {selectedTemplate.description && (
                          <p className="text-sm text-gray-400 mt-1">
                            {selectedTemplate.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Format: .{selectedTemplate.fileFormat.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Info */}
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200">
                  The template will be populated with data from your {conversationType.replace('_', ' ')}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={exporting}
            className="border-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || !selectedTemplateId || templates.length === 0}
            className="bg-[#F97316] hover:bg-[#ea6d0a]"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Document
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
