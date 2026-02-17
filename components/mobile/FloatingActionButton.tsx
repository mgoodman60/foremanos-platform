'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera, X, Upload, MessageSquare, FileText, Mic, Image as ImageIcon } from 'lucide-react';

interface FloatingActionButtonProps {
  onCapture: () => void;
  onUpload: () => void;
  onVoiceNote?: () => void;
  className?: string;
}

export function FloatingActionButton({
  onCapture,
  onUpload,
  onVoiceNote,
  className = ''
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Hide FAB when keyboard is open (on mobile)
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        // If viewport is significantly smaller than window, keyboard is likely open
        setIsVisible(viewportHeight > windowHeight * 0.7);
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  const actions = [
    {
      icon: Camera,
      label: 'Photo',
      onClick: () => { onCapture(); setIsOpen(false); },
      color: 'bg-orange-500 hover:bg-orange-600',
    },
    {
      icon: Upload,
      label: 'Upload',
      onClick: () => { onUpload(); setIsOpen(false); },
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    ...(onVoiceNote ? [{
      icon: Mic,
      label: 'Voice',
      onClick: () => { onVoiceNote(); setIsOpen(false); },
      color: 'bg-green-500 hover:bg-green-600',
    }] : []),
  ];

  // Handle touch drag
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isOpen) return;
    const touch = e.touches[0];
    dragStartRef.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragStartRef.current.x;
    const newY = touch.clientY - dragStartRef.current.y;
    
    // Constrain to viewport
    const maxX = window.innerWidth - 60;
    const maxY = window.innerHeight - 60;
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed z-40 hidden md:hidden ${className}`}
      style={{
        right: position.x === 0 ? '1rem' : 'auto',
        bottom: position.y === 0 ? '5rem' : 'auto',
        left: position.x !== 0 ? position.x : 'auto',
        top: position.y !== 0 ? position.y : 'auto',
      }}
    >
      {/* Expanded Actions */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 flex flex-col gap-3 items-end">
          {actions.map((action, index) => (
            <div
              key={action.label}
              className="flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg">
                {action.label}
              </span>
              <button
                onClick={action.onClick}
                className={`w-12 h-12 rounded-full ${action.color} shadow-lg flex items-center justify-center transition-transform active:scale-95`}
              >
                <action.icon className="w-5 h-5 text-white" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB Button */}
      <button
        ref={fabRef}
        onClick={() => setIsOpen(!isOpen)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all transform active:scale-95 ${isOpen ? 'bg-gray-700 rotate-45' : 'bg-orange-500'}`}
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" aria-hidden="true" />
        ) : (
          <Camera className="w-6 h-6 text-white" aria-hidden="true" />
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
