'use client';

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { PDFDocument, rgb } from 'pdf-lib';
import { logger } from '@/lib/logger';

interface FloorPlanExportProps {
  projectName: string;
  floorNumber: string | number;
  exportContainerId: string;
}

export function FloorPlanExport({
  projectName,
  floorNumber,
  exportContainerId,
}: FloorPlanExportProps) {
  const [exporting, setExporting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Sanitize project name for filename
  const sanitizeFilename = (name: string): string => {
    return name
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  };

  // Generate filename with current date
  const generateFilename = (extension: string): string => {
    const sanitizedProject = sanitizeFilename(projectName);
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${sanitizedProject}-floor-${floorNumber}-${date}.${extension}`;
  };

  // Capture the floor plan container as PNG
  const captureFloorPlan = async (): Promise<string> => {
    const element = document.getElementById(exportContainerId);

    if (!element) {
      throw new Error('Floor plan container not found');
    }

    // Use html-to-image to capture the element
    const dataUrl = await toPng(element, {
      pixelRatio: 2, // High-resolution export
      cacheBust: true,
      backgroundColor: '#1a1a1a', // Match dark theme background
    });

    return dataUrl;
  };

  // Export as PNG
  const exportAsPng = async () => {
    setExporting(true);
    setDropdownOpen(false);

    try {
      logger.info('FLOOR_PLAN_EXPORT', 'Starting PNG export', {
        projectName,
        floorNumber,
        containerId: exportContainerId,
      });

      const dataUrl = await captureFloorPlan();
      const filename = generateFilename('png');

      // Create download link
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Floor plan exported as PNG');
      logger.info('FLOOR_PLAN_EXPORT', 'PNG export completed', { filename });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export PNG';
      logger.error('FLOOR_PLAN_EXPORT', 'PNG export failed', err as Error);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  // Export as PDF
  const exportAsPdf = async () => {
    setExporting(true);
    setDropdownOpen(false);

    try {
      logger.info('FLOOR_PLAN_EXPORT', 'Starting PDF export', {
        projectName,
        floorNumber,
        containerId: exportContainerId,
      });

      // Capture floor plan as PNG
      const pngDataUrl = await captureFloorPlan();

      // Create PDF document
      const pdfDoc = await PDFDocument.create();

      // Convert data URL to bytes
      const pngBytes = await fetch(pngDataUrl).then((res) => res.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(pngBytes);

      // Get image dimensions
      const { width, height } = pngImage.scale(1);

      // Create landscape page sized to fit image (max 11x17 inches at 72 DPI)
      const maxWidth = 17 * 72; // 1224 points
      const maxHeight = 11 * 72; // 792 points

      let pageWidth = width;
      let pageHeight = height;

      // Scale down if too large
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        pageWidth = width * scale;
        pageHeight = height * scale;
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Draw image on page
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      // Add header text
      const headerText = `${projectName} - Floor ${floorNumber}`;
      const dateText = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      page.drawText(headerText, {
        x: 20,
        y: pageHeight - 20,
        size: 14,
        color: rgb(1, 1, 1),
      });

      page.drawText(dateText, {
        x: 20,
        y: pageHeight - 38,
        size: 10,
        color: rgb(0.8, 0.8, 0.8),
      });

      // Serialize PDF to bytes
      const pdfBytes = await pdfDoc.save();

      // Create download link
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const filename = generateFilename('pdf');

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      URL.revokeObjectURL(url);

      toast.success('Floor plan exported as PDF');
      logger.info('FLOOR_PLAN_EXPORT', 'PDF export completed', { filename });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export PDF';
      logger.error('FLOOR_PLAN_EXPORT', 'PDF export failed', err as Error);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative">
      {/* Dropdown button */}
      <Button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        disabled={exporting}
        className="bg-orange-600 hover:bg-orange-700 text-white"
      >
        {exporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export
          </>
        )}
      </Button>

      {/* Dropdown menu */}
      {dropdownOpen && !exporting && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-dark-surface border border-gray-700 rounded-lg shadow-lg z-50">
            <button
              onClick={exportAsPng}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-dark-hover transition-colors rounded-t-lg"
            >
              Export as PNG
            </button>
            <button
              onClick={exportAsPdf}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-dark-hover transition-colors rounded-b-lg"
            >
              Export as PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
