'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Download,
  RefreshCw,
  X,
  ListPlus,
  FileBarChart,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScheduleFABProps {
  onAddTask?: () => void;
  onExportGantt?: () => void;
  onExportLookahead?: () => void;
  onJumpToToday?: () => void;
  onRefresh?: () => void;
}

export function ScheduleFAB({
  onAddTask,
  onExportGantt,
  onExportLookahead,
  onJumpToToday,
  onRefresh
}: ScheduleFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    {
      icon: ListPlus,
      label: 'Add Task',
      onClick: onAddTask,
      color: 'bg-green-600 hover:bg-green-500'
    },
    {
      icon: CalendarDays,
      label: 'Jump to Today',
      onClick: onJumpToToday,
      color: 'bg-blue-600 hover:bg-blue-500'
    },
    {
      icon: FileBarChart,
      label: 'Export Gantt',
      onClick: onExportGantt,
      color: 'bg-purple-600 hover:bg-purple-500'
    },
    {
      icon: Download,
      label: 'Export Lookahead',
      onClick: onExportLookahead,
      color: 'bg-indigo-600 hover:bg-indigo-500'
    },
    {
      icon: RefreshCw,
      label: 'Refresh',
      onClick: onRefresh,
      color: 'bg-gray-600 hover:bg-gray-500'
    }
  ];

  return (
    <div 
      ref={fabRef}
      className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3"
    >
      {/* Menu Items */}
      <AnimatePresence>
        {isOpen && (
          <>
            {menuItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.3, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.3, y: 20 }}
                transition={{ 
                  delay: index * 0.05,
                  type: 'spring',
                  stiffness: 300,
                  damping: 20
                }}
              >
                <button
                  onClick={() => {
                    item.onClick?.();
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-3 ${item.color} text-white px-4 py-2.5 rounded-full shadow-lg transition-all hover:shadow-xl group`}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                </button>
              </motion.div>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main FAB Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${
          isOpen 
            ? 'bg-gray-700 hover:bg-gray-600' 
            : 'bg-orange-500 hover:bg-orange-600'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {isOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Plus className="h-6 w-6 text-white" />
          )}
        </motion.div>
      </motion.button>

      {/* Keyboard hint */}
      {!isOpen && (
        <div className="absolute -top-1 -left-1 bg-gray-800 text-gray-300 text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
          Press <kbd className="bg-gray-700 px-1 rounded">?</kbd> for shortcuts
        </div>
      )}
    </div>
  );
}
