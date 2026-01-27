'use client';

import { useState, useCallback } from 'react';

interface UseTakeoffSelectionReturn {
  selectedItems: Set<string>;
  toggleItemSelection: (itemId: string) => void;
  selectAllItems: (itemIds: string[]) => void;
  clearSelection: () => void;
  isSelected: (itemId: string) => boolean;
  selectedCount: number;
}

/**
 * Hook for managing item selection for bulk operations
 * 
 * @returns Object containing selection state and control functions
 */
export function useTakeoffSelection(): UseTakeoffSelectionReturn {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItems((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
      } else {
        newSelected.add(itemId);
      }
      return newSelected;
    });
  }, []);

  const selectAllItems = useCallback((itemIds: string[]) => {
    setSelectedItems(new Set(itemIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const isSelected = useCallback((itemId: string) => {
    return selectedItems.has(itemId);
  }, [selectedItems]);

  return {
    selectedItems,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    isSelected,
    selectedCount: selectedItems.size,
  };
}
