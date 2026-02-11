'use client';

import React from 'react';

interface Props {
  references: any;
  csiReferences: any;
  keynotes: any;
  noteClauses: any;
}

export default function SpecReferencesPanel({ references, csiReferences, keynotes, noteClauses }: Props) {
  const specSections = references?.specSections;
  const codeReferences = references?.codeReferences;

  const hasSpecSections = Array.isArray(specSections) && specSections.length > 0;
  const hasCodeRefs = Array.isArray(codeReferences) && codeReferences.length > 0;
  const hasCsi = Array.isArray(csiReferences) && csiReferences.length > 0;
  const hasKeynotes = Array.isArray(keynotes) && keynotes.length > 0;
  const hasNoteClauses = Array.isArray(noteClauses) && noteClauses.length > 0;

  if (!hasSpecSections && !hasCodeRefs && !hasCsi && !hasKeynotes && !hasNoteClauses) {
    return null;
  }

  // Group CSI references by division
  const csiByDivision: Record<string, any[]> = {};
  if (hasCsi) {
    for (const ref of csiReferences) {
      const div = ref.division || 'Other';
      if (!csiByDivision[div]) csiByDivision[div] = [];
      csiByDivision[div].push(ref);
    }
  }

  // Group note clauses by category
  const clausesByCategory: Record<string, any[]> = {};
  if (hasNoteClauses) {
    for (const clause of noteClauses) {
      const cat = clause.category || 'General';
      if (!clausesByCategory[cat]) clausesByCategory[cat] = [];
      clausesByCategory[cat].push(clause);
    }
  }

  return (
    <div className="space-y-4 mt-3">
      {hasSpecSections && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Spec Sections</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Section</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Title</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Description</th>
                </tr>
              </thead>
              <tbody>
                {specSections.map((s: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 px-2 text-xs font-mono text-gray-700">{s.section}</td>
                    <td className="py-1.5 px-2 text-xs text-gray-900">{s.title}</td>
                    <td className="py-1.5 px-2 text-xs text-gray-600">{s.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasCodeRefs && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Code References</h4>
          <ul className="space-y-1">
            {codeReferences.map((ref: any, i: number) => (
              <li key={i} className="text-xs text-gray-700">
                <span className="font-medium text-gray-900">{ref.code} {ref.section}</span>
                {ref.requirement && <span className="text-gray-400"> — {ref.requirement}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasCsi && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">CSI References</h4>
          <div className="space-y-2">
            {Object.entries(csiByDivision).map(([division, refs]) => (
              <div key={division}>
                <div className="text-xs font-medium text-gray-700 mb-1">Division {division}</div>
                <ul className="space-y-0.5 ml-3">
                  {refs.map((ref: any, i: number) => (
                    <li key={i} className="text-xs text-gray-600">
                      <span className="font-mono text-gray-700">{ref.section}</span> {ref.title}
                      {ref.manufacturer && (
                        <span className="text-gray-400"> — {ref.manufacturer}{ref.product ? ` / ${ref.product}` : ''}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasKeynotes && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Keynotes</h4>
          <ol className="space-y-1">
            {keynotes.map((kn: any, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="font-mono font-medium text-gray-700 shrink-0">{kn.number}</span>
                <span className="text-gray-600">
                  {kn.text}
                  {kn.sheetReference && (
                    <span className="ml-1 text-blue-600">[{kn.sheetReference}]</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {hasNoteClauses && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Note Clauses</h4>
          <div className="space-y-2">
            {Object.entries(clausesByCategory).map(([category, clauses]) => (
              <div key={category}>
                <div className="text-xs font-medium text-gray-700 mb-1">{category}</div>
                <ul className="space-y-0.5 ml-3 list-disc list-inside">
                  {clauses.map((clause: any, i: number) => (
                    <li key={i} className="text-xs text-gray-600">
                      {clause.text}
                      {clause.specReference && (
                        <span className="ml-1 font-mono text-gray-400">({clause.specReference})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
