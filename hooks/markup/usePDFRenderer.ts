'use client';

import { useState, useEffect } from 'react';

interface PDFDocumentProxy {
  numPages: number;
  destroy: () => Promise<void>;
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

export function usePDFRenderer(documentUrl: string | null) {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    if (!documentUrl) {
      setPdfDocument(null);
      setPageCount(0);
      return;
    }

    let isMounted = true;
    let currentDoc: PDFDocumentProxy | null = null;

    const loadPDF = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Dynamic import pdfjs-dist
        const pdfjs = (await import('pdfjs-dist')) as unknown as PDFJSLib;

        // Set worker from CDN
        pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

        const loadingTask = pdfjs.getDocument({ url: documentUrl });
        const doc = await loadingTask.promise;

        if (!isMounted) {
          await doc.destroy();
          return;
        }

        currentDoc = doc;
        setPdfDocument(doc);
        setPageCount(doc.numPages);
        setIsLoading(false);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setIsLoading(false);
      }
    };

    loadPDF();

    return () => {
      isMounted = false;
      if (currentDoc) {
        currentDoc.destroy().catch(() => {
          // Cleanup error - ignore
        });
      }
    };
  }, [documentUrl]);

  return {
    pdfDocument,
    isLoading,
    error,
    pageCount,
  };
}
