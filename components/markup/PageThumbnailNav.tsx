'use client';

import React, { useRef, useEffect, useState } from 'react';

interface PageThumbnailNavProps {
  documentId: string;
  totalPages: number;
  currentPage: number;
  onPageChange: (pageNumber: number) => void;
}

export function PageThumbnailNav({ documentId, totalPages, currentPage, onPageChange }: PageThumbnailNavProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set([currentPage]));

  // Lazy load thumbnails with IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNumber = parseInt(entry.target.getAttribute('data-page') || '0', 10);
            if (pageNumber > 0) {
              setLoadedPages((prev) => new Set(prev).add(pageNumber));
            }
          }
        });
      },
      {
        root: container,
        rootMargin: '50px',
      }
    );

    const thumbnails = container.querySelectorAll('[data-page]');
    thumbnails.forEach((thumb) => observer.observe(thumb));

    return () => observer.disconnect();
  }, [totalPages]);

  // Scroll to current page
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentThumb = container.querySelector(`[data-page="${currentPage}"]`);
    if (currentThumb) {
      currentThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPage]);

  return (
    <div
      ref={containerRef}
      className="w-32 h-full overflow-y-auto bg-gray-50 border-r border-gray-200 p-2 space-y-2"
    >
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => {
        const isLoaded = loadedPages.has(pageNumber);
        const isCurrent = pageNumber === currentPage;

        return (
          <div
            key={pageNumber}
            data-page={pageNumber}
            className={`
              relative cursor-pointer rounded border-2 transition-all
              ${isCurrent ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300 hover:border-gray-400'}
            `}
            onClick={() => onPageChange(pageNumber)}
          >
            {isLoaded ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/documents/${documentId}/page-image?pageNumber=${pageNumber}&zoom=0.2`}
                alt={`Page ${pageNumber}`}
                className="w-full h-auto"
                loading="lazy"
              />
            ) : (
              <div className="w-full aspect-[8.5/11] bg-gray-200 flex items-center justify-center">
                <span className="text-xs text-gray-400">{pageNumber}</span>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs text-center py-1">
              Page {pageNumber}
            </div>
          </div>
        );
      })}
    </div>
  );
}
