/**
 * Cross-Reference Map Component
 * Phase B.5 - Visual representation of sheet relationships and cross-references
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Network, ArrowRight, FileText, Layers, Loader2 } from 'lucide-react';

interface CrossReference {
  sourceSheet: string;
  targetSheet: string;
  referenceType: string;
  referenceText: string;
  context?: string;
}

interface SheetRelationship {
  sheet1: string;
  sheet2: string;
  type: string;
  strength: number;
  referenceCount: number;
  references: CrossReference[];
}

interface Props {
  projectSlug: string;
}

export default function CrossReferenceMap({ projectSlug }: Props) {
  const [relationships, setRelationships] = useState<SheetRelationship[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRelationships();
  }, [projectSlug]);

  const fetchRelationships = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/projects/${projectSlug}/extract-callouts?action=relationships`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch relationships');
      }

      const data = await response.json();
      setRelationships(data.relationships || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRelationshipColor = (type: string) => {
    switch (type) {
      case 'detail_reference':
        return 'bg-blue-500';
      case 'section_reference':
        return 'bg-purple-500';
      case 'parent_child':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getRelationshipLabel = (type: string) => {
    switch (type) {
      case 'detail_reference':
        return 'Detail';
      case 'section_reference':
        return 'Section';
      case 'parent_child':
        return 'Parent/Child';
      default:
        return 'Peer';
    }
  };

  // Get all unique sheets
  const allSheets = Array.from(
    new Set(relationships.flatMap(r => [r.sheet1, r.sheet2]))
  ).sort();

  // Filter relationships based on selected sheet and search
  const filteredRelationships = relationships.filter(rel => {
    const matchesSheet = !selectedSheet || 
      rel.sheet1 === selectedSheet || 
      rel.sheet2 === selectedSheet;
    
    const matchesSearch = !searchQuery || 
      rel.sheet1.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rel.sheet2.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSheet && matchesSearch;
  });

  // Get connected sheets for selected sheet
  const connectedSheets = selectedSheet
    ? Array.from(
        new Set(
          relationships
            .filter(r => r.sheet1 === selectedSheet || r.sheet2 === selectedSheet)
            .flatMap(r => [r.sheet1, r.sheet2])
            .filter(s => s !== selectedSheet)
        )
      )
    : [];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin text-orange-500 h-8 w-8" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network aria-hidden="true" className="h-5 w-5" />
                Cross-Reference Map
              </CardTitle>
              <CardDescription>
                Visual representation of sheet relationships and cross-references
              </CardDescription>
            </div>
            <Badge variant="outline">
              {relationships.length} relationships
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search aria-hidden="true" className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search sheets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {selectedSheet && (
              <Button
                variant="outline"
                onClick={() => setSelectedSheet(null)}
              >
                Clear Selection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sheet List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sheets</CardTitle>
            <CardDescription>{allSheets.length} total sheets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allSheets.map(sheet => {
                const isSelected = sheet === selectedSheet;
                const refCount = relationships.filter(
                  r => r.sheet1 === sheet || r.sheet2 === sheet
                ).length;

                return (
                  <button
                    key={sheet}
                    onClick={() => setSelectedSheet(isSelected ? null : sheet)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500'
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText aria-hidden="true" className="h-4 w-4" />
                        <span className="font-medium">{sheet}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {refCount}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Relationships */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedSheet
                ? `Relationships for ${selectedSheet}`
                : 'All Relationships'}
            </CardTitle>
            <CardDescription>
              {filteredRelationships.length} relationships shown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredRelationships.length === 0 ? (
                <p className="text-center text-gray-400 py-8">
                  No relationships found
                </p>
              ) : (
                filteredRelationships.map((rel, idx) => (
                  <div
                    key={idx}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={getRelationshipColor(rel.type)}>
                        {getRelationshipLabel(rel.type)}
                      </Badge>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-medium">{rel.sheet1}</span>
                        <ArrowRight aria-hidden="true" className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{rel.sheet2}</span>
                      </div>
                      <Badge variant="outline">
                        {rel.referenceCount} refs
                      </Badge>
                    </div>

                    {/* Strength indicator */}
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Strength:</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${rel.strength * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">
                          {Math.round(rel.strength * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* References preview */}
                    {rel.references && rel.references.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          References:
                        </p>
                        <div className="space-y-1">
                          {rel.references.slice(0, 3).map((ref, refIdx) => (
                            <div
                              key={refIdx}
                              className="text-xs text-gray-600 flex items-center gap-2"
                            >
                              <Layers aria-hidden="true" className="h-3 w-3" />
                              <span>{ref.referenceText}</span>
                            </div>
                          ))}
                          {rel.references.length > 3 && (
                            <p className="text-xs text-gray-400 italic">
                              +{rel.references.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connected Sheets (when sheet is selected) */}
      {selectedSheet && connectedSheets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connected Sheets</CardTitle>
            <CardDescription>
              Sheets that reference or are referenced by {selectedSheet}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {connectedSheets.map(sheet => (
                <Button
                  key={sheet}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSheet(sheet)}
                  className="flex items-center gap-2"
                >
                  <FileText aria-hidden="true" className="h-3 w-3" />
                  {sheet}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
