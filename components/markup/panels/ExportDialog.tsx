'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { logger } from '@/lib/logger';

interface ExportDialogProps {
  slug: string;
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = 'png' | 'pdf' | 'csv';

export function ExportDialog({ slug, documentId, open, onOpenChange }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [includeComments, setIncludeComments] = useState(true);
  const [includeMeasurements, setIncludeMeasurements] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/markups/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          includeComments,
          includeMeasurements,
          includeMetadata,
        }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `markups-export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch (error) {
      logger.error('EXPORT_DIALOG', 'Export failed', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Markups</DialogTitle>
          <DialogDescription>
            Choose export format and options for your markups.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label className="text-sm font-medium mb-3 block">Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="png" id="png" />
                <Label htmlFor="png" className="font-normal cursor-pointer">
                  PNG Image (2x resolution)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="font-normal cursor-pointer">
                  PDF Document (with annotations)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="font-normal cursor-pointer">
                  CSV Spreadsheet (markup data)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {(format === 'pdf' || format === 'csv') && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Options</Label>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="comments"
                  checked={includeComments}
                  onCheckedChange={(checked) => setIncludeComments(checked === true)}
                />
                <Label htmlFor="comments" className="font-normal cursor-pointer">
                  Include comments
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="measurements"
                  checked={includeMeasurements}
                  onCheckedChange={(checked) => setIncludeMeasurements(checked === true)}
                />
                <Label htmlFor="measurements" className="font-normal cursor-pointer">
                  Include measurements
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="metadata"
                  checked={includeMetadata}
                  onCheckedChange={(checked) => setIncludeMetadata(checked === true)}
                />
                <Label htmlFor="metadata" className="font-normal cursor-pointer">
                  Include metadata (status, priority, tags)
                </Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
