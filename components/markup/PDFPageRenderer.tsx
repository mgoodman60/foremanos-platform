'use client';

import React, { useEffect, useRef, useState } from 'react';

interface PDFPageRendererProps {
  documentId: string;
  pageNumber: number;
  zoom: number;
  onPageLoaded?: (width: number, height: number) => void;
}

interface PDFDocumentProxy {
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

interface PDFPageProxy {
  getViewport: (params: { scale: number }) => PDFViewport;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PDFViewport;
  }) => { promise: Promise<void> };
}

interface PDFViewport {
  width: number;
  height: number;
}

interface PDFJSLib {
  getDocument: (options: {
    url?: string;
    data?: ArrayBuffer;
  }) => { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: {
    workerSrc: string;
  };
}

export function PDFPageRenderer({ documentId, pageNumber, zoom, onPageLoaded }: PDFPageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<{ promise: Promise<void> } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Try pdfjs-dist first
        try {
          const pdfjs = (await import('pdfjs-dist')) as unknown as PDFJSLib;

          // Set worker from CDN
          pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

          // Fetch PDF data
          const response = await fetch(`/api/documents/${documentId}`);
          if (!response.ok) throw new Error('Failed to fetch PDF');

          const arrayBuffer = await response.arrayBuffer();
          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          const doc = await loadingTask.promise;

          if (!isMounted) return;

          const page = await doc.getPage(pageNumber);
          const viewport = page.getViewport({ scale: zoom });

          if (!isMounted) return;

          // Set canvas dimensions
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const context = canvas.getContext('2d');
          if (!context) throw new Error('Failed to get canvas context');

          // Cancel previous render
          if (renderTaskRef.current) {
            // Note: pdfjs render tasks don't have a cancel method in all versions
            renderTaskRef.current = null;
          }

          // Render page
          const renderTask = page.render({ canvasContext: context, viewport });
          renderTaskRef.current = renderTask;

          await renderTask.promise;

          if (!isMounted) return;

          if (onPageLoaded) {
            onPageLoaded(viewport.width / zoom, viewport.height / zoom);
          }

          setIsLoading(false);
        } catch (pdfjsError) {
          // Fallback to page-image API
          if (!isMounted) return;

          const response = await fetch(`/api/documents/${documentId}/page-image?pageNumber=${pageNumber}&zoom=${zoom}`);

          if (!response.ok) {
            throw new Error('Failed to render page with both pdfjs and page-image API');
          }

          const blob = await response.blob();
          const img = new Image();

          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              if (!isMounted) return;

              canvas.width = img.width;
              canvas.height = img.height;

              const context = canvas.getContext('2d');
              if (!context) {
                reject(new Error('Failed to get canvas context'));
                return;
              }

              context.drawImage(img, 0, 0);

              if (onPageLoaded) {
                onPageLoaded(img.width / zoom, img.height / zoom);
              }

              resolve();
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(blob);
          });

          if (!isMounted) return;
          setIsLoading(false);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to render page');
        setIsLoading(false);
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      renderTaskRef.current = null;
    };
  }, [documentId, pageNumber, zoom, onPageLoaded]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="max-w-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50">
          <div className="text-sm text-gray-600">Loading page {pageNumber}...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}
    </div>
  );
}
