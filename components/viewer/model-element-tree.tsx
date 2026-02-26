'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Box, Eye, EyeOff, Target,
  Search, Loader2, Layers, Filter, X
} from 'lucide-react';
import type { ViewerHandle } from './forge-viewer-enhanced';

interface TreeNode {
  dbId: number;
  name: string;
  children: TreeNode[];
}

interface ModelElementTreeProps {
  viewerRef: React.RefObject<ViewerHandle | null>;
  selectedIds: number[];
  onSelect: (ids: number[]) => void;
  className?: string;
}

export default function ModelElementTree({
  viewerRef,
  selectedIds,
  onSelect,
  className = '',
}: ModelElementTreeProps) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [_filterCategory, _setFilterCategory] = useState<string | null>(null);

  // Build tree from model
  useEffect(() => {
    const buildTree = async () => {
      try {
        const objectTree = await viewerRef.current?.getModelTree();
        if (!objectTree) {
          setLoading(false);
          return;
        }

        const buildNode = (nodeId: number): TreeNode => {
          const name = objectTree.getNodeName(nodeId) || `Element ${nodeId}`;
          const children: TreeNode[] = [];

          objectTree.enumNodeChildren(nodeId, (childId: number) => {
            children.push(buildNode(childId));
          }, false);

          return { dbId: nodeId, name, children };
        };

        const rootId = objectTree.getRootId();
        const rootNode = buildNode(rootId);
        setTree(rootNode);

        // Auto-expand first level
        if (rootNode.children.length > 0) {
          const initialExpanded = new Set([rootNode.dbId]);
          rootNode.children.forEach(child => initialExpanded.add(child.dbId));
          setExpandedIds(initialExpanded);
        }
      } catch (e) {
        console.error('[ModelTree] Build error:', e);
      } finally {
        setLoading(false);
      }
    };

    // Wait a bit for model to fully load
    const timer = setTimeout(buildTree, 1000);
    return () => clearTimeout(timer);
  }, [viewerRef]);

  // Search functionality
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await viewerRef.current?.search(searchQuery);
      setSearchResults(results || []);

      // Auto-expand to show results
      if (results && results.length > 0) {
        viewerRef.current?.select(results);
        viewerRef.current?.fitToView(results);
      }
    } catch (e) {
      console.error('[ModelTree] Search error:', e);
    }
  }, [searchQuery, viewerRef]);

  // Toggle expand/collapse
  const toggleExpand = (dbId: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(dbId)) {
      newExpanded.delete(dbId);
    } else {
      newExpanded.add(dbId);
    }
    setExpandedIds(newExpanded);
  };

  // Select element
  const handleSelect = (dbId: number) => {
    onSelect([dbId]);
    viewerRef.current?.select([dbId]);
  };

  // Isolate element
  const handleIsolate = (dbId: number) => {
    viewerRef.current?.isolate([dbId]);
  };

  // Toggle visibility
  const toggleVisibility = (dbId: number) => {
    const newHidden = new Set(hiddenIds);
    if (newHidden.has(dbId)) {
      newHidden.delete(dbId);
      viewerRef.current?.show([dbId]);
    } else {
      newHidden.add(dbId);
      viewerRef.current?.hide([dbId]);
    }
    setHiddenIds(newHidden);
  };

  // Focus on element
  const handleFocus = (dbId: number) => {
    viewerRef.current?.fitToView([dbId]);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    viewerRef.current?.clearSelection();
  };

  // Render tree node
  const renderNode = (node: TreeNode, depth: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.dbId);
    const isSelected = selectedIds.includes(node.dbId);
    const isHidden = hiddenIds.has(node.dbId);
    const isSearchResult = searchResults.includes(node.dbId);

    return (
      <div key={node.dbId}>
        <div
          className={`flex items-center gap-1 px-2 py-1.5 hover:bg-gray-700/50 cursor-pointer group rounded-md transition-colors ${
            isSelected ? 'bg-blue-600/30 border-l-2 border-blue-500' : ''
          } ${isSearchResult ? 'bg-yellow-600/20' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleSelect(node.dbId)}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.dbId);
              }}
              className="p-0.5 hover:bg-gray-600 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}

          {/* Icon */}
          <Box className={`w-4 h-4 flex-shrink-0 ${isSearchResult ? 'text-yellow-400' : 'text-gray-400'}`} aria-hidden="true" />

          {/* Name */}
          <span className={`flex-1 text-sm truncate ${isHidden ? 'text-gray-400 line-through' : 'text-white'}`}>
            {node.name}
          </span>

          {/* Actions (visible on hover) */}
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleVisibility(node.dbId);
              }}
              className="p-1 hover:bg-gray-600 rounded"
              title={isHidden ? 'Show' : 'Hide'}
            >
              {isHidden ? (
                <EyeOff className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleIsolate(node.dbId);
              }}
              className="p-1 hover:bg-gray-600 rounded"
              title="Isolate"
            >
              <Layers className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFocus(node.dbId);
              }}
              className="p-1 hover:bg-gray-600 rounded"
              title="Focus"
            >
              <Target className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-dark-subtle border border-gray-700 rounded-xl overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" aria-hidden="true" />
          <span className="text-sm font-medium text-white">Model Elements</span>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-1.5 rounded-lg transition-colors ${showFilters ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search elements..."
            className="w-full pl-9 pr-8 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-700 rounded"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
        {searchResults.length > 0 && (
          <p className="text-xs text-yellow-400 mt-2">
            Found {searchResults.length} element{searchResults.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" aria-hidden="true" />
          </div>
        ) : tree ? (
          <div className="py-2">
            {renderNode(tree)}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            No model loaded
          </div>
        )}
      </div>

      {/* Stats footer */}
      {tree && (
        <div className="px-4 py-2 border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
          <span>{selectedIds.length > 0 ? `${selectedIds.length} selected` : 'No selection'}</span>
          <span>{hiddenIds.size > 0 ? `${hiddenIds.size} hidden` : ''}</span>
        </div>
      )}
    </div>
  );
}
