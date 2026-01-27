'use client';

import { useState, useMemo } from 'react';
import type { MaterialTakeoff, TakeoffLineItem } from '@/types/takeoff';

interface UseTakeoffFiltersReturn {
  filteredItems: TakeoffLineItem[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  filterVerified: string;
  setFilterVerified: (verified: string) => void;
  viewMode: 'csi' | 'category';
  setViewMode: (mode: 'csi' | 'category') => void;
  availableCategories: string[];
}

/**
 * Hook for managing takeoff filtering and search
 * 
 * @param takeoff - The currently selected takeoff
 * @param allTakeoffs - All takeoffs (for CSI view across all takeoffs)
 * @returns Object containing filtered items, filter state, and control functions
 */
export function useTakeoffFilters(
  takeoff: MaterialTakeoff | null,
  allTakeoffs: MaterialTakeoff[]
): UseTakeoffFiltersReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterVerified, setFilterVerified] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'csi' | 'category'>('category');

  // Get all items from all takeoffs (for CSI view)
  const getAllTakeoffItems = useMemo((): TakeoffLineItem[] => {
    const allItems: TakeoffLineItem[] = [];
    
    allTakeoffs.forEach((t) => {
      t.lineItems.forEach((item) => {
        allItems.push(item);
      });
    });
    
    return allItems;
  }, [allTakeoffs]);

  // Get available categories
  const availableCategories = useMemo((): string[] => {
    const categories = new Set<string>();
    const items = takeoff ? takeoff.lineItems : getAllTakeoffItems;
    
    items.forEach((item) => {
      if (item.category) {
        categories.add(item.category);
      }
    });
    
    return Array.from(categories).sort();
  }, [takeoff, getAllTakeoffItems]);

  // Filter items based on current filters
  const filteredItems = useMemo((): TakeoffLineItem[] => {
    const items = takeoff ? takeoff.lineItems : getAllTakeoffItems;

    return items.filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          item.itemName.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.location?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (filterCategory !== 'all' && item.category !== filterCategory) {
        return false;
      }

      // Verified filter
      if (filterVerified === 'verified' && !item.verified) return false;
      if (filterVerified === 'unverified' && item.verified) return false;

      return true;
    });
  }, [takeoff, getAllTakeoffItems, searchQuery, filterCategory, filterVerified]);

  return {
    filteredItems,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    filterVerified,
    setFilterVerified,
    viewMode,
    setViewMode,
    availableCategories,
  };
}
