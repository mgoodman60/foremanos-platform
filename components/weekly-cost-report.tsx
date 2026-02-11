"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText, RefreshCw, Download, Calendar, TrendingUp,
  TrendingDown, DollarSign, Loader2, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface WeeklyReport {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  totalBudget: number;
  actualCost: number;
  committedCost: number;
  cpi?: number;
  spi?: number;
  eac?: number;
  contingencyUsed: number;
  contingencyRemaining: number;
  changeOrdersApproved: number;
  changeOrdersValue: number;
  laborCost: number;
  materialsCost: number;
  highlights?: string;
  concerns?: string;
  generatedAt: string;
}

export default function WeeklyCostReport() {
  const params = useParams();
  const slug = params?.slug as string;

  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);

  useEffect(() => {
    if (slug) fetchReports();
  }, [slug]);

  const fetchReports = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/weekly-report?weeks=8`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports);
        if (data.reports.length > 0) {
          setSelectedReport(data.reports[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${slug}/weekly-report`, {
        method: 'POST'
      });
      if (res.ok) {
        const report = await res.json();
        toast.success('Weekly report generated');
        fetchReports();
      } else if (res.status === 409) {
        const data = await res.json();
        toast.info('Report already exists for this week');
        setSelectedReport(data.report);
      } else {
        toast.error('Failed to generate report');
      }
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getPerformanceColor = (value: number | null | undefined) => {
    if (!value) return 'text-gray-400';
    if (value >= 1) return 'text-green-400';
    if (value >= 0.9) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-400" />
          Weekly Cost Reports
        </h3>
        <Button
          onClick={generateReport}
          disabled={generating}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Generate Report
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Report List */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Recent Reports</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {reports.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No reports generated yet</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedReport?.id === report.id
                        ? 'bg-blue-600/20 border border-blue-500/30'
                        : 'bg-dark-surface hover:bg-dark-surface/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm font-medium">
                          Week of {format(new Date(report.weekStartDate), 'MMM d')}
                        </div>
                        <div className="text-xs text-gray-400">
                          {format(new Date(report.generatedAt), 'MMM d, h:mm a')}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Detail */}
        {selectedReport ? (
          <Card className="bg-dark-card border-gray-700 lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-400" />
                  Week of {format(new Date(selectedReport.weekStartDate), 'MMMM d, yyyy')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-dark-surface rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">CPI</div>
                  <div className={`text-xl font-bold ${getPerformanceColor(selectedReport.cpi)}`}>
                    {selectedReport.cpi?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                <div className="p-3 bg-dark-surface rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">SPI</div>
                  <div className={`text-xl font-bold ${getPerformanceColor(selectedReport.spi)}`}>
                    {selectedReport.spi?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                <div className="p-3 bg-dark-surface rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">EAC</div>
                  <div className="text-xl font-bold text-white">
                    {selectedReport.eac ? formatCurrency(selectedReport.eac) : 'N/A'}
                  </div>
                </div>
                <div className="p-3 bg-dark-surface rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Actual Cost</div>
                  <div className="text-xl font-bold text-white">
                    {formatCurrency(selectedReport.actualCost)}
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-dark-surface rounded-lg">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Cost Breakdown</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Labor</span>
                      <span className="text-white">{formatCurrency(selectedReport.laborCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Materials</span>
                      <span className="text-white">{formatCurrency(selectedReport.materialsCost)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                      <span className="text-gray-400">Total</span>
                      <span className="text-white font-medium">
                        {formatCurrency(selectedReport.laborCost + selectedReport.materialsCost)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-dark-surface rounded-lg">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Change Orders</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Approved</span>
                      <span className="text-white">{selectedReport.changeOrdersApproved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Value</span>
                      <span className="text-white">{formatCurrency(selectedReport.changeOrdersValue)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contingency */}
              <div className="p-4 bg-dark-surface rounded-lg mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Contingency Status</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-400">Used:</span>
                    <span className="text-red-400 ml-2">{formatCurrency(selectedReport.contingencyUsed)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Remaining:</span>
                    <span className="text-green-400 ml-2">{formatCurrency(selectedReport.contingencyRemaining)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {(selectedReport.highlights || selectedReport.concerns) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedReport.highlights && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <h4 className="text-sm font-medium text-green-400 mb-2">Highlights</h4>
                      <p className="text-sm text-gray-300">{selectedReport.highlights}</p>
                    </div>
                  )}
                  {selectedReport.concerns && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <h4 className="text-sm font-medium text-red-400 mb-2">Concerns</h4>
                      <p className="text-sm text-gray-300">{selectedReport.concerns}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-dark-card border-gray-700 lg:col-span-2">
            <CardContent className="p-8 text-center text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-600" />
              <p>Select a report to view details or generate a new one</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
