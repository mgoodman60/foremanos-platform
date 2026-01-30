'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  position?: 'left' | 'right' | 'bottom';
  className?: string;
}

export function MobileDrawer({
  isOpen,
  onClose,
  children,
  title,
  position = 'left',
  className = ''
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState(0);
  const [touchCurrent, setTouchCurrent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Handle swipe to close
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchCurrent(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setTouchCurrent(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const diff = touchStart - touchCurrent;
    const threshold = 100; // px
    
    if (position === 'left' && diff > threshold) {
      onClose();
    } else if (position === 'right' && diff < -threshold) {
      onClose();
    }
    
    setTouchStart(0);
    setTouchCurrent(0);
  };

  const getTransform = () => {
    if (!isDragging) return '';
    const diff = touchCurrent - touchStart;
    
    if (position === 'left' && diff < 0) {
      return `translateX(${diff}px)`;
    } else if (position === 'right' && diff > 0) {
      return `translateX(${diff}px)`;
    }
    return '';
  };

  const positionClasses = {
    left: `left-0 top-0 h-full w-80 max-w-[85vw] ${isOpen ? 'translate-x-0' : '-translate-x-full'}`,
    right: `right-0 top-0 h-full w-80 max-w-[85vw] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`,
    bottom: `left-0 right-0 bottom-0 max-h-[85vh] rounded-t-2xl ${isOpen ? 'translate-y-0' : 'translate-y-full'}`,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${isOpen ? 'opacity-60' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`absolute bg-dark-surface shadow-2xl transition-transform duration-300 ease-out flex flex-col ${positionClasses[position]} ${className}`}
        style={{ transform: getTransform() || undefined }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle for bottom drawer */}
        {position === 'bottom' && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
