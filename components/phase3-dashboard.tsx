'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Home,
  Package,
  Zap,
  Map,
  Layers,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Users,
  Activity,
  ArrowUpRight,
  Search,
  BarChart3,
  PieChart,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface DashboardAnalytics {
  overview: {
    totalDocuments: number;
    processedDocuments: number;
    processingRate: number;
    totalRooms: number;
    totalMEP: number;
    totalMaterialItems: number;
    totalMaterialCost: number;
    projectMembers: number;
  };
  documents: {
    total: number;
    processed: number;
    pending: number;
    pdf: number;
    images: number;
    other: number;
  };
  rooms: {
    total: number;
    byFloor: Record<string, number>;
    byStatus: Record<string, number>;
    recentlyAdded: number;
  };
  mep: {
    total: number;
    hvac: number;
    electrical: number;
    plumbing: number;
    fire: number;
    distribution: Record<string, number>;
  };
  materials: {
    totalItems: number;
    totalCost: number;
    verifiedItems: number;
    verificationRate: number;
    categories: number;
    categoryBreakdown: Array<{
      name: string;
      count: number;
      items: number;
      totalCost: number;
      percentage: number;
    }>;
  };
  activity: {
    last7Days: {
      rooms: number;
      documents: number;
    };
    lastUpdate: string;
  };
  health: {
    documentProcessing: number;
    materialVerification: number;
    dataCompleteness: number;
  };
}

interface Phase3DashboardProps {
  projectSlug: string;
  onOpenRoom?: () => void;
  onOpenMaterials?: () => void;
  onOpenMEP?: () => void;
  onOpenPlans?: () => void;
}

export function Phase3Dashboard({
  projectSlug,
  onOpenRoom,
  onOpenMaterials,
  onOpenMEP,
  onOpenPlans,
}: Phase3DashboardProps) {
  const { data: session } = useSession() || {};
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectSlug) {
      fetchAnalytics();
    }
  }, [projectSlug]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/dashboard-analytics`);
      if (!response.ok) throw new Error('Failed to fetch analytics');

      const data = await response.json();
      setAnalytics(data);
    } catch (error: any) {
      console.error('Error fetching dashboard analytics:', error);
      toast.error('Failed to load dashboard analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getHealthColor = (percentage: number): string => {
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthBgColor = (percentage: number): string => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="animate-spin text-orange-500 h-8 w-8 mb-3 inline-block" />
          <p className="text-sm text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <BarChart3 className="mx-auto mb-3 h-12 w-12 text-gray-600" />
          <p className="text-sm text-gray-400">No analytics data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-50 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-blue-500" />
            Project Intelligence Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Unified view of rooms, materials, equipment, and plans
          </p>
        </div>
        <Button
          onClick={fetchAnalytics}
          variant="outline"
          size="sm"
          className="border-gray-600 text-gray-300 hover:bg-dark-card"
        >
          <Activity className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Documents */}
        <Card className="bg-dark-card border-dark-hover p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <span className="text-sm text-gray-400">Documents</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {analytics.overview.processingRate}%
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-slate-50">
              {analytics.overview.totalDocuments}
            </div>
            <div className="text-xs text-gray-400">
              {analytics.overview.processedDocuments} processed
            </div>
          </div>
        </Card>

        {/* Rooms */}
        <Card className="bg-dark-card border-dark-hover p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Home className="h-5 w-5 text-green-400" />
              </div>
              <span className="text-sm text-gray-400">Rooms</span>
            </div>
            {analytics.activity.last7Days.rooms > 0 && (
              <Badge variant="outline" className="text-xs text-green-400">
                +{analytics.activity.last7Days.rooms}
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-slate-50">
              {analytics.overview.totalRooms}
            </div>
            <div className="text-xs text-gray-400">
              {Object.keys(analytics.rooms.byFloor).length} floors
            </div>
          </div>
        </Card>

        {/* MEP Equipment */}
        <Card className="bg-dark-card border-dark-hover p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Zap className="h-5 w-5 text-orange-400" />
              </div>
              <span className="text-sm text-gray-400">MEP</span>
            </div>
            <Badge variant="outline" className="text-xs">
              4 trades
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-slate-50">
              {analytics.overview.totalMEP}
            </div>
            <div className="text-xs text-gray-400">
              Equipment items
            </div>
          </div>
        </Card>

        {/* Materials */}
        <Card className="bg-dark-card border-dark-hover p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Package className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-sm text-gray-400">Materials</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {analytics.materials.verificationRate}%
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-slate-50">
              {formatCurrency(analytics.overview.totalMaterialCost)}
            </div>
            <div className="text-xs text-gray-400">
              {analytics.overview.totalMaterialItems} items
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Access Tiles */}
      <div>
        <h2 className="text-lg font-semibold text-slate-50 mb-4 flex items-center gap-2">
          <Map className="h-5 w-5 text-blue-500" />
          Quick Access
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Room Browser */}
          <button
            onClick={onOpenRoom}
            className="group relative overflow-hidden rounded-lg border border-dark-hover bg-dark-card p-4 text-left hover:border-green-500 hover:bg-dark-hover transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all"></div>
            <div className="relative">
              <Home className="h-6 w-6 text-green-400 mb-2" />
              <h3 className="font-semibold text-slate-50 mb-1">Room Browser</h3>
              <p className="text-xs text-gray-400 mb-2">View {analytics.rooms.total} rooms</p>
              <ArrowUpRight className="h-4 w-4 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>

          {/* Material Takeoff */}
          <button
            onClick={onOpenMaterials}
            className="group relative overflow-hidden rounded-lg border border-dark-hover bg-dark-card p-4 text-left hover:border-purple-500 hover:bg-dark-hover transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
            <div className="relative">
              <Package className="h-6 w-6 text-purple-400 mb-2" />
              <h3 className="font-semibold text-slate-50 mb-1">Material Takeoff</h3>
              <p className="text-xs text-gray-400 mb-2">{formatCurrency(analytics.materials.totalCost)} total</p>
              <ArrowUpRight className="h-4 w-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>

          {/* MEP Equipment */}
          <button
            onClick={onOpenMEP}
            className="group relative overflow-hidden rounded-lg border border-dark-hover bg-dark-card p-4 text-left hover:border-orange-500 hover:bg-dark-hover transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all"></div>
            <div className="relative">
              <Zap className="h-6 w-6 text-orange-400 mb-2" />
              <h3 className="font-semibold text-slate-50 mb-1">MEP Equipment</h3>
              <p className="text-xs text-gray-400 mb-2">{analytics.mep.total} items</p>
              <ArrowUpRight className="h-4 w-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>

          {/* Document Viewer */}
          <button
            onClick={onOpenPlans}
            className="group relative overflow-hidden rounded-lg border border-dark-hover bg-dark-card p-4 text-left hover:border-blue-500 hover:bg-dark-hover transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
            <div className="relative">
              <Layers className="h-6 w-6 text-blue-400 mb-2" />
              <h3 className="font-semibold text-slate-50 mb-1">Document Viewer</h3>
              <p className="text-xs text-gray-400 mb-2">{analytics.documents.pdf} plans</p>
              <ArrowUpRight className="h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>

        </div>
      </div>

      {/* Detailed Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MEP Distribution */}
        <Card className="bg-dark-card border-dark-hover p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-orange-500" />
              MEP Trade Distribution
            </h3>
            <Badge variant="outline" className="text-xs">
              {analytics.mep.total} total
            </Badge>
          </div>
          <div className="space-y-3">
            {Object.entries(analytics.mep.distribution).map(([trade, percentage]) => (
              <div key={trade} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{trade}</span>
                  <span className="font-medium text-slate-50">{percentage}%</span>
                </div>
                <Progress
                  value={percentage}
                  className="h-2"
                  style={{
                    backgroundColor: 'rgba(75, 85, 99, 0.3)'
                  } as any}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Material Categories */}
        <Card className="bg-dark-card border-dark-hover p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              Top Material Categories
            </h3>
            <Badge variant="outline" className="text-xs">
              {analytics.materials.categories} total
            </Badge>
          </div>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {analytics.materials.categoryBreakdown.slice(0, 5).map((category) => (
                <div
                  key={category.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-dark-surface hover:bg-dark-hover transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-50 truncate">
                      {category.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {category.items} items
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div className="text-sm font-semibold text-purple-400">
                      {formatCurrency(category.totalCost)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {category.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Health Metrics */}
        <Card className="bg-dark-card border-dark-hover p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Data Health
            </h3>
          </div>
          <div className="space-y-4">
            {/* Document Processing */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-400">Document Processing</span>
                <span className={`font-medium ${getHealthColor(analytics.health.documentProcessing)}`}>
                  {analytics.health.documentProcessing}%
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getHealthBgColor(analytics.health.documentProcessing)} transition-all`}
                  style={{ width: `${analytics.health.documentProcessing}%` }}
                ></div>
              </div>
            </div>

            {/* Material Verification */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-400">Material Verification</span>
                <span className={`font-medium ${getHealthColor(analytics.health.materialVerification)}`}>
                  {analytics.health.materialVerification}%
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getHealthBgColor(analytics.health.materialVerification)} transition-all`}
                  style={{ width: `${analytics.health.materialVerification}%` }}
                ></div>
              </div>
            </div>

            {/* Data Completeness */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-400">Data Completeness</span>
                <span className={`font-medium ${getHealthColor(analytics.health.dataCompleteness)}`}>
                  {analytics.health.dataCompleteness}%
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getHealthBgColor(analytics.health.dataCompleteness)} transition-all`}
                  style={{ width: `${analytics.health.dataCompleteness}%` }}
                ></div>
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-dark-card border-dark-hover p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Recent Activity
            </h3>
            <span className="text-xs text-gray-500">Last 7 days</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-surface">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <FileText className="h-4 w-4 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-50">
                  {analytics.activity.last7Days.documents} documents added
                </div>
                <div className="text-xs text-gray-400">New uploads</div>
              </div>
              {analytics.activity.last7Days.documents > 0 && (
                <Badge variant="outline" className="text-xs text-green-400">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-surface">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Home className="h-4 w-4 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-50">
                  {analytics.activity.last7Days.rooms} rooms created
                </div>
                <div className="text-xs text-gray-400">Space tracking</div>
              </div>
              {analytics.activity.last7Days.rooms > 0 && (
                <Badge variant="outline" className="text-xs text-green-400">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-dark-surface text-xs text-gray-400">
              <span>Last updated</span>
              <span>{new Date(analytics.activity.lastUpdate).toLocaleString()}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
