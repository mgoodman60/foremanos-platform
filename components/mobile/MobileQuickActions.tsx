'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

interface MobileQuickActionsProps {
  actions: QuickAction[];
  className?: string;
}

export function MobileQuickActions({ actions, className = '' }: MobileQuickActionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollRef.current;
    ref?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      ref?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [actions]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const variantClasses = {
    default: 'bg-dark-card border-gray-600 text-gray-200 active:bg-[#3d434b]',
    primary: 'bg-orange-500 border-orange-600 text-white active:bg-orange-600',
    success: 'bg-green-600 border-green-700 text-white active:bg-green-700',
    warning: 'bg-yellow-600 border-yellow-700 text-white active:bg-yellow-700',
  };

  return (
    <div className={`relative ${className}`}>
      {/* Scroll indicators */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-dark-surface/90 rounded-full shadow-lg flex items-center justify-center text-gray-300 hover:text-white hidden sm:flex"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-dark-surface/90 rounded-full shadow-lg flex items-center justify-center text-gray-300 hover:text-white hidden sm:flex"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide py-2 px-1 -mx-1 snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full border whitespace-nowrap text-sm font-medium transition-colors snap-start shrink-0 ${variantClasses[action.variant || 'default']}`}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {/* Gradient fade indicators */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#1F2328] to-transparent pointer-events-none sm:hidden" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#1F2328] to-transparent pointer-events-none sm:hidden" />
      )}
    </div>
  );
}
