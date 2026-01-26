/**
 * Title Block Metadata Card Component
 * 
 * Displays extracted title block information for a document
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  FileText,
  Calendar,
  Hash,
  Ruler,
  User,
  Building2,
  Info
} from 'lucide-react';
import { TitleBlockData, getDisciplineName } from '@/lib/title-block-extractor';

interface TitleBlockMetadataCardProps {
  titleBlockData: TitleBlockData;
  className?: string;
}

export default function TitleBlockMetadataCard({
  titleBlockData,
  className = ''
}: TitleBlockMetadataCardProps) {
  const getDisciplineColor = (discipline: string) => {
    const colors: Record<string, string> = {
      'A': 'bg-blue-500',
      'S': 'bg-orange-500',
      'M': 'bg-green-500',
      'E': 'bg-yellow-500',
      'P': 'bg-cyan-500',
      'FP': 'bg-red-500',
      'C': 'bg-purple-500',
      'L': 'bg-emerald-500',
      'G': 'bg-gray-500',
      'UNKNOWN': 'bg-gray-400'
    };
    return colors[discipline] || 'bg-gray-400';
  };

  return (
    <Card className={`bg-[#2d333b] border-gray-700 ${className}`}>
      <CardHeader>
        <CardTitle className="text-gray-100 flex items-center gap-2 text-lg">
          <Info className="h-5 w-5 text-orange-500" />
          Title Block Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Project Info */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-400" />
            Project
          </h4>
          <div className="ml-6 space-y-1">
            <p className="text-gray-100 font-medium">{titleBlockData.projectName}</p>
            {titleBlockData.projectNumber && (
              <p className="text-sm text-gray-400">#{titleBlockData.projectNumber}</p>
            )}
          </div>
        </div>

        {/* Sheet Info */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-400" />
            Sheet
          </h4>
          <div className="ml-6 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={`${getDisciplineColor(titleBlockData.discipline)} text-white`}>
                {titleBlockData.discipline}
              </Badge>
              <span className="font-mono font-bold text-gray-100">
                {titleBlockData.sheetNumber}
              </span>
              <Badge variant="outline" className="border-gray-600 text-gray-300">
                Rev {titleBlockData.revision}
              </Badge>
            </div>
            <p className="text-sm text-gray-300">{titleBlockData.sheetTitle}</p>
            <p className="text-xs text-gray-500">
              {getDisciplineName(titleBlockData.discipline)}
            </p>
          </div>
        </div>

        {/* Scale */}
        {titleBlockData.scale && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Ruler className="h-4 w-4 text-purple-400" />
              Scale
            </h4>
            <p className="ml-6 text-sm text-gray-100 font-mono">{titleBlockData.scale}</p>
          </div>
        )}

        {/* Dates */}
        {(titleBlockData.dateIssued || titleBlockData.revisionDate) && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-400" />
              Dates
            </h4>
            <div className="ml-6 space-y-1 text-sm">
              {titleBlockData.dateIssued && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Issued:</span>
                  <span className="text-gray-100">
                    {new Date(titleBlockData.dateIssued).toLocaleDateString()}
                  </span>
                </div>
              )}
              {titleBlockData.revisionDate && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Revised:</span>
                  <span className="text-gray-100">
                    {new Date(titleBlockData.revisionDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Authors */}
        {(titleBlockData.drawnBy || titleBlockData.checkedBy) && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <User className="h-4 w-4 text-yellow-400" />
              Authorship
            </h4>
            <div className="ml-6 space-y-1 text-sm">
              {titleBlockData.drawnBy && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Drawn by:</span>
                  <span className="text-gray-100">{titleBlockData.drawnBy}</span>
                </div>
              )}
              {titleBlockData.checkedBy && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Checked by:</span>
                  <span className="text-gray-100">{titleBlockData.checkedBy}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confidence */}
        <div className="pt-2 border-t border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Extraction Confidence</span>
            <span className="text-gray-300 font-medium">
              {Math.round(titleBlockData.confidence * 100)}%
            </span>
          </div>
          <div className="mt-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
              style={{ width: `${titleBlockData.confidence * 100}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
