'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toPng } from 'html-to-image';
import { PDFDocument } from 'pdf-lib';

interface PresentationExportBarProps {
  previewRef: React.RefObject<HTMLDivElement | null>;
  boardTitle: string;
  templateId: string;
  onExported: (format: string) => void;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'presentation';
}

export function PresentationExportBar({
  previewRef,
  boardTitle,
  templateId,
  onExported,
}: PresentationExportBarProps) {
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const filename = sanitizeFilename(boardTitle || 'presentation');

  const captureAsPng = async (): Promise<string> => {
    if (!previewRef.current) throw new Error('Preview element not found');
    return toPng(previewRef.current, { pixelRatio: 2, cacheBust: true });
  };

  const handlePngExport = async () => {
    setExportingPng(true);
    try {
      const dataUrl = await captureAsPng();
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
      onExported('png');
    } catch {
      alert('PNG export failed. Please try again.');
    } finally {
      setExportingPng(false);
    }
  };

  const handlePdfExport = async () => {
    setExportingPdf(true);
    try {
      const pngDataUrl = await captureAsPng();
      const pngBytes = await fetch(pngDataUrl).then((r) => r.arrayBuffer());
      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(pngBytes);

      const isLandscape = ['hero_sign', 'before_after'].includes(templateId);
      const pageWidth = isLandscape ? 792 : 612;
      const pageHeight = isLandscape ? 612 : 792;

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawImage(pngImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${filename}.pdf`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      onExported('pdf');
    } catch {
      alert('PDF export failed. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handlePngExport}
        disabled={exportingPng || exportingPdf}
        className="gap-2"
      >
        {exportingPng ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <Download size={14} aria-hidden="true" />
        )}
        PNG
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handlePdfExport}
        disabled={exportingPng || exportingPdf}
        className="gap-2"
      >
        {exportingPdf ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <Download size={14} aria-hidden="true" />
        )}
        PDF
      </Button>
    </div>
  );
}
