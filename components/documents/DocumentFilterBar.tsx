'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

interface Props {
  categories: string[];
  disciplines: string[];
  drawingTypes: string[];
  selectedCategory: string;
  selectedDisciplines: string[];
  selectedDrawingTypes: string[];
  searchQuery: string;
  onCategoryChange: (category: string) => void;
  onDisciplinesChange: (disciplines: string[]) => void;
  onDrawingTypesChange: (types: string[]) => void;
  onSearchChange: (query: string) => void;
}

function MultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 min-h-[36px]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {label}
        {selected.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
            {selected.length}
          </span>
        )}
        <ChevronDown aria-hidden="true" className="h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute z-10 mt-1 w-48 bg-white border rounded-md shadow-lg py-1 max-h-60 overflow-y-auto"
          role="listbox"
          aria-label={`${label} options`}
        >
          {options.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm min-h-[36px]"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => {
                  onChange(
                    selected.includes(opt)
                      ? selected.filter(s => s !== opt)
                      : [...selected, opt]
                  );
                }}
                className="rounded"
              />
              {opt.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentFilterBar({
  categories, disciplines, drawingTypes,
  selectedCategory, selectedDisciplines, selectedDrawingTypes, searchQuery,
  onCategoryChange, onDisciplinesChange, onDrawingTypesChange, onSearchChange,
}: Props) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(value), 300);
  }, [onSearchChange]);

  const hasFilters = selectedCategory !== 'all' || selectedDisciplines.length > 0 || selectedDrawingTypes.length > 0 || searchQuery.length > 0;

  const clearAll = () => {
    onCategoryChange('all');
    onDisciplinesChange([]);
    onDrawingTypesChange([]);
    onSearchChange('');
    setLocalSearch('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search extracted content..."
          className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          aria-label="Search documents"
        />
        {localSearch && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-2 top-1/2 transform -translate-y-1/2"
            aria-label="Clear search"
          >
            <X className="h-3 w-3 text-gray-400" />
          </button>
        )}
      </div>

      {/* Category */}
      <select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="px-3 py-1.5 text-sm border rounded-md min-h-[36px]"
        aria-label="Filter by category"
      >
        <option value="all">All Categories</option>
        {categories.map(c => (
          <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
        ))}
      </select>

      {/* Discipline multi-select */}
      {disciplines.length > 0 && (
        <MultiSelect
          label="Discipline"
          options={disciplines}
          selected={selectedDisciplines}
          onChange={onDisciplinesChange}
        />
      )}

      {/* Drawing Type multi-select */}
      {drawingTypes.length > 0 && (
        <MultiSelect
          label="Drawing Type"
          options={drawingTypes}
          selected={selectedDrawingTypes}
          onChange={onDrawingTypesChange}
        />
      )}

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="text-sm text-gray-400 hover:text-gray-700 px-2 min-h-[36px]"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
