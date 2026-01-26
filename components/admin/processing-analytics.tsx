'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, TrendingUp, DollarSign, FileText, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ProcessingProgressCard } from '@/components/processing-progress-card';
import { IntelligenceExtractionPanel } from '@/components/admin/intelligence-extraction-panel';
import { getErrorMessage } from '@/lib/fetch-with-retry';

interface ProcessingStats {
  currentMonth: string;
  nextResetDate: string;
  usersNeedingReset: number;
  monthlyStats: {
    totalDocuments: number;
    totalPages: number;
    totalCost: number;
  };
  processorBreakdown: {
    vision: { documents: number; pages: number; cost: number };
    haiku: { documents: number; pages: number; cost: number };
    ocr: { documents: number; pages: number; cost: number };
  };
  topUsers: Array<{
    email: string;
    pagesProcessed: number;
    totalCost: number;
    tier: string;
  }>;
}

interface ActiveProcessing {
  documentId: string;
  documentName: string;
  status: string;
}

export function ProcessingAnalytics() {
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [activeProcessing, setActiveProcessing] = useState<ActiveProcessing[]>([]);

  const fetchActiveProcessing = async () => {
    try {
      const response = await fetch('/api/processing/active');
      
      if (!response.ok) {
        const errorMessage = await getErrorMessage(response, 'Failed to fetch active processing');
        console.error('Error fetching active processing:', errorMessage);
        return;
      }
      
      const data = await response.json();
      setActiveProcessing(data);
    } catch (error) {
      console.error('Error fetching active processing:', error);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/processing-stats');
      
      if (!response.ok) {
        const errorMessage = await getErrorMessage(response, 'Failed to fetch processing stats');
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error: any) {
      console.error('Error fetching processing stats:', error);
      toast.error(error.message || 'Failed to load processing analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleResetQuotas = async () => {
    if (!confirm('Are you sure you want to reset all user quotas? This will set all users\' monthly page counts to zero.')) {
      return;
    }

    try {
      setResetting(true);
      const response = await fetch('/api/admin/reset-quotas', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Successfully reset quotas for ${data.users.length} users`);
        fetchStats(); // Refresh stats after reset
      } else {
        throw new Error('Failed to reset quotas');
      }
    } catch (error) {
      console.error('Error resetting quotas:', error);
      toast.error('Failed to reset quotas');
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchActiveProcessing();
    
    // Poll for active processing every 5 seconds
    const interval = setInterval(fetchActiveProcessing, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processing Analytics</CardTitle>
          <CardDescription>Loading hybrid model performance data...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processing Analytics</CardTitle>
          <CardDescription>Failed to load analytics data</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchStats} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const savingsVsAllVision = (stats.monthlyStats.totalPages * 0.01) - stats.monthlyStats.totalCost;
  const savingsPercentage = ((savingsVsAllVision / (stats.monthlyStats.totalPages * 0.01)) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header with Reset Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Document Processing Analytics</CardTitle>
              <CardDescription>
                Hybrid Model Performance - {stats.currentMonth}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchStats} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={handleResetQuotas}
                variant="destructive"
                size="sm"
                disabled={resetting || stats.usersNeedingReset === 0}
              >
                {resetting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Reset Monthly Quotas ({stats.usersNeedingReset})
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Active Processing */}
      {activeProcessing.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-100">
            Active Processing ({activeProcessing.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeProcessing.map((doc) => (
              <ProcessingProgressCard
                key={doc.documentId}
                documentId={doc.documentId}
                onComplete={() => {
                  fetchActiveProcessing();
                  fetchStats();
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.monthlyStats.totalDocuments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.monthlyStats.totalPages.toLocaleString()} pages processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyStats.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              ${(stats.monthlyStats.totalCost / stats.monthlyStats.totalPages).toFixed(4)}/page avg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${savingsVsAllVision.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {savingsPercentage}% vs all GPT-4o Vision
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Reset</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(stats.nextResetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.usersNeedingReset} users need reset
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Processor Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Processor Breakdown</CardTitle>
          <CardDescription>Cost efficiency by processing method</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* GPT-4o Vision */}
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div>
                <div className="font-semibold text-blue-900 dark:text-blue-100">GPT-4o Vision</div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  Plans, drawings, photos
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-blue-900 dark:text-blue-100">
                  {stats.processorBreakdown.vision.documents} docs
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {stats.processorBreakdown.vision.pages} pages • ${stats.processorBreakdown.vision.cost.toFixed(2)}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  $0.01/page
                </div>
              </div>
            </div>

            {/* Claude 3 Haiku */}
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div>
                <div className="font-semibold text-green-900 dark:text-green-100">Claude 3 Haiku</div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  Schedules, specs, text docs
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-900 dark:text-green-100">
                  {stats.processorBreakdown.haiku.documents} docs
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  {stats.processorBreakdown.haiku.pages} pages • ${stats.processorBreakdown.haiku.cost.toFixed(2)}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">
                  $0.001/page • 90% savings
                </div>
              </div>
            </div>

            {/* OCR + GPT-4o */}
            <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <div>
                <div className="font-semibold text-purple-900 dark:text-purple-100">OCR + GPT-4o</div>
                <div className="text-sm text-purple-700 dark:text-purple-300">
                  Forms, invoices, tables
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-purple-900 dark:text-purple-100">
                  {stats.processorBreakdown.ocr.documents} docs
                </div>
                <div className="text-sm text-purple-700 dark:text-purple-300">
                  {stats.processorBreakdown.ocr.pages} pages • ${stats.processorBreakdown.ocr.cost.toFixed(2)}
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-400">
                  $0.003/page • 70% savings
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intelligence Extraction Panel */}
      <IntelligenceExtractionPanel 
        projectSlug="morehead-senior-center"
        projectName="Morehead Senior Center"
      />

      {/* Top Users by Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Top Users by Processing Usage</CardTitle>
          <CardDescription>Users with highest monthly page processing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.topUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No processing activity this month
              </p>
            ) : (
              stats.topUsers.map((user, index) => (
                <div key={user.email} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{user.email}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.tier} tier
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{user.pagesProcessed.toLocaleString()} pages</div>
                    <div className="text-sm text-muted-foreground">
                      ${user.totalCost.toFixed(2)} cost
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
