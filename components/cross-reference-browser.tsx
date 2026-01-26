/**
 * Cross-Reference Browser Component
 * 
 * Visual interface for browsing detail callouts and navigating
 * between related construction drawings.
 * 
 * Phase B.1 - Document Intelligence Roadmap
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Network,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  TrendingUp,
  FileText,
  GitBranch,
  BarChart3,
  RefreshCw,
} from 'lucide-react';

interface DetailCallout {
  id: string;
  sourceSheet: string;
  sheetReference: string;
  type: string;
  number: string;
  sourceLocation?: string;
  description?: string;
  confidence: number;
}

interface GraphNode {
  sheetNumber: string;
  incomingRefs: number;
  outgoingRefs: number;
  callouts: DetailCallout[];
}

interface CrossReference {
  fromSheet: string;
  toSheet: string;
  calloutType: string;
  calloutNumber: string;
  bidirectional: boolean;
  confidence: number;
}

interface CrossReferenceBrowserProps {
  projectSlug: string;
  onSheetSelect?: (sheetNumber: string) => void;
}

export default function CrossReferenceBrowser({
  projectSlug,
  onSheetSelect,
}: CrossReferenceBrowserProps) {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<CrossReference[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [view, setView] = useState<'graph' | 'list' | 'validation'>('list');

  // Load data
  useEffect(() => {
    loadData();
  }, [projectSlug]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load graph
      const graphRes = await fetch(
        `/api/projects/${projectSlug}/cross-references?action=graph`
      );
      const graphData = await graphRes.json();
      
      if (graphData.success) {
        setNodes(graphData.nodes || []);
        setEdges(graphData.edges || []);
      }

      // Load stats
      const statsRes = await fetch(
        `/api/projects/${projectSlug}/cross-references?action=stats`
      );
      const statsData = await statsRes.json();
      
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // Load validation
      const validRes = await fetch(
        `/api/projects/${projectSlug}/cross-references?action=validate`
      );
      const validData = await validRes.json();
      
      if (validData.success) {
        setValidation(validData.validation);
      }
    } catch (error) {
      console.error('Failed to load cross-references:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter nodes based on search and type
  const filteredNodes = nodes.filter((node) => {
    const matchesSearch =
      searchTerm === '' ||
      node.sheetNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      filterType === 'all' ||
      node.callouts.some((c) => c.type === filterType);

    return matchesSearch && matchesType;
  });

  // Get incoming/outgoing references for selected sheet
  const getSheetReferences = (sheetNumber: string) => {
    const incoming = edges.filter((e) => e.toSheet === sheetNumber);
    const outgoing = edges.filter((e) => e.fromSheet === sheetNumber);
    return { incoming, outgoing };
  };

  const handleSheetClick = (sheetNumber: string) => {
    setSelectedSheet(sheetNumber);
    onSheetSelect?.(sheetNumber);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading cross-references...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#2d333b] border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Callouts</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats?.totalCallouts || 0}
              </p>
            </div>
            <FileText className="w-8 h-8 text-cyan-400" />
          </div>
        </div>

        <div className="bg-[#2d333b] border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Sheets Referenced</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats?.sheetsWithCallouts || 0}
              </p>
            </div>
            <Network className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-[#2d333b] border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Cross-References</p>
              <p className="text-2xl font-bold text-white mt-1">
                {edges.length}
              </p>
            </div>
            <GitBranch className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        <div className="bg-[#2d333b] border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Health Score</p>
              <p className="text-2xl font-bold text-white mt-1">
                {validation
                  ? `${Math.round(validation.healthScore * 100)}%`
                  : 'N/A'}
              </p>
            </div>
            {validation && validation.healthScore > 0.9 ? (
              <CheckCircle className="w-8 h-8 text-green-400" />
            ) : (
              <AlertCircle className="w-8 h-8 text-yellow-400" />
            )}
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'list'
                ? 'bg-cyan-500 text-white'
                : 'bg-[#2d333b] text-gray-300 hover:bg-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            List View
          </button>
          <button
            onClick={() => setView('graph')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'graph'
                ? 'bg-cyan-500 text-white'
                : 'bg-[#2d333b] text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Network className="w-4 h-4 inline mr-2" />
            Graph View
          </button>
          <button
            onClick={() => setView('validation')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'validation'
                ? 'bg-cyan-500 text-white'
                : 'bg-[#2d333b] text-gray-300 hover:bg-gray-700'
            }`}
          >
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Validation
          </button>
        </div>

        <button
          onClick={loadData}
          className="px-4 py-2 bg-[#2d333b] text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Refresh
        </button>
      </div>

      {/* Search and Filter */}
      {view !== 'validation' && (
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search sheets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#2d333b] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-[#2d333b] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">All Types</option>
            <option value="detail">Details</option>
            <option value="section">Sections</option>
            <option value="elevation">Elevations</option>
            <option value="enlarged_plan">Enlarged Plans</option>
            <option value="schedule">Schedules</option>
          </select>
        </div>
      )}

      {/* Content Views */}
      {view === 'list' && (
        <ListView
          nodes={filteredNodes}
          edges={edges}
          selectedSheet={selectedSheet}
          onSheetClick={handleSheetClick}
        />
      )}

      {view === 'graph' && (
        <GraphView
          nodes={filteredNodes}
          edges={edges}
          onSheetClick={handleSheetClick}
        />
      )}

      {view === 'validation' && validation && (
        <ValidationView validation={validation} />
      )}
    </div>
  );
}

// List View Component
function ListView({
  nodes,
  edges,
  selectedSheet,
  onSheetClick,
}: {
  nodes: GraphNode[];
  edges: CrossReference[];
  selectedSheet: string | null;
  onSheetClick: (sheet: string) => void;
}) {
  return (
    <div className="space-y-3">
      {nodes.map((node) => {
        const isSelected = selectedSheet === node.sheetNumber;
        const incoming = edges.filter((e) => e.toSheet === node.sheetNumber);
        const outgoing = edges.filter((e) => e.fromSheet === node.sheetNumber);

        return (
          <div
            key={node.sheetNumber}
            className={`bg-[#2d333b] border rounded-lg p-4 cursor-pointer transition-all ${
              isSelected
                ? 'border-cyan-500 ring-2 ring-cyan-500/50'
                : 'border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => onSheetClick(node.sheetNumber)}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">
                Sheet {node.sheetNumber}
              </h3>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
                  {node.callouts.length} callouts
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">
                  <span className="font-semibold text-green-400">
                    {incoming.length}
                  </span>{' '}
                  incoming
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">
                  <span className="font-semibold text-blue-400">
                    {outgoing.length}
                  </span>{' '}
                  outgoing
                </span>
              </div>
            </div>

            {isSelected && (
              <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                {outgoing.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">
                      References to other sheets:
                    </h4>
                    <div className="space-y-2">
                      {outgoing.map((ref, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm"
                        >
                          <ArrowRight className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-400 font-mono">
                            {ref.calloutNumber}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-white font-mono">
                            {ref.toSheet}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                            {ref.calloutType}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {incoming.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">
                      Referenced from:
                    </h4>
                    <div className="space-y-2">
                      {incoming.map((ref, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="text-white font-mono">
                            {ref.fromSheet}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-green-400 font-mono">
                            {ref.calloutNumber}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                            {ref.calloutType}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Graph View Component (Simplified text-based)
function GraphView({
  nodes,
  edges,
  onSheetClick,
}: {
  nodes: GraphNode[];
  edges: CrossReference[];
  onSheetClick: (sheet: string) => void;
}) {
  // Sort nodes by number of references (most connected first)
  const sortedNodes = [...nodes].sort(
    (a, b) =>
      b.incomingRefs + b.outgoingRefs - (a.incomingRefs + a.outgoingRefs)
  );

  return (
    <div className="bg-[#2d333b] border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Most Connected Sheets
      </h3>
      <div className="space-y-3">
        {sortedNodes.slice(0, 10).map((node) => {
          const totalRefs = node.incomingRefs + node.outgoingRefs;
          const maxRefs = Math.max(
            ...sortedNodes.map((n) => n.incomingRefs + n.outgoingRefs),
            1
          );
          const width = (totalRefs / maxRefs) * 100;

          return (
            <div key={node.sheetNumber}>
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => onSheetClick(node.sheetNumber)}
                  className="text-cyan-400 hover:text-cyan-300 font-mono"
                >
                  {node.sheetNumber}
                </button>
                <span className="text-gray-400 text-sm">
                  {totalRefs} references
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Validation View Component
function ValidationView({ validation }: { validation: any }) {
  return (
    <div className="space-y-4">
      {/* Health Overview */}
      <div className="bg-[#2d333b] border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            Cross-Reference Health
          </h3>
          {validation.healthScore > 0.9 ? (
            <CheckCircle className="w-6 h-6 text-green-400" />
          ) : validation.healthScore > 0.7 ? (
            <AlertCircle className="w-6 h-6 text-yellow-400" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-400" />
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-400">
              {validation.valid}
            </p>
            <p className="text-gray-400 text-sm">Valid References</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">
              {validation.broken.length}
            </p>
            <p className="text-gray-400 text-sm">Broken Links</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-400">
              {validation.orphaned.length}
            </p>
            <p className="text-gray-400 text-sm">Orphaned Sheets</p>
          </div>
        </div>
      </div>

      {/* Broken References */}
      {validation.broken.length > 0 && (
        <div className="bg-[#2d333b] border border-red-500/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-400 mb-4">
            ⚠️ Broken References ({validation.broken.length})
          </h3>
          <div className="space-y-3">
            {validation.broken.map((item: any, idx: number) => (
              <div
                key={idx}
                className="bg-red-500/10 border border-red-500/30 rounded p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-mono">
                      {item.callout.sourceSheet} → {item.callout.sheetReference}
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      {item.reason}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded">
                    {item.callout.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orphaned Sheets */}
      {validation.orphaned.length > 0 && (
        <div className="bg-[#2d333b] border border-yellow-500/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-400 mb-4">
            📄 Orphaned Sheets ({validation.orphaned.length})
          </h3>
          <p className="text-gray-400 text-sm mb-3">
            These sheets have no cross-references (neither incoming nor outgoing).
          </p>
          <div className="flex flex-wrap gap-2">
            {validation.orphaned.map((sheet: string) => (
              <span
                key={sheet}
                className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded font-mono text-sm"
              >
                {sheet}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
