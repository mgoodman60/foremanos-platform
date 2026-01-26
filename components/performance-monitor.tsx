"use client";

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Database,
  Zap,
  TrendingUp,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface PerformanceStats {
  cache: {
    response: CacheStats & { backend: string };
    document: CacheStats & { backend: string };
    query: CacheStats & { backend: string };
    combined: {
      totalSize: number;
      totalEntries: number;
      overallHitRate: number;
    };
  };
  realtime: {
    subscriberCount: number;
    recentEvents: any[];
  };
  redis?: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
  memory: {
    heapUsed: string;
    heapTotal: string;
    external: string;
    rss: string;
  };
  timestamp: string;
}

interface CacheStats {
  size: number;
  maxSize: number;
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

export function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(loadStats, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/performance');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load performance stats:', error);
      toast.error('Failed to load performance stats');
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async (type?: string) => {
    try {
      const url = type
        ? `/api/admin/performance?action=clearCache&type=${type}`
        : '/api/admin/performance?action=clearCache';
      
      const response = await fetch(url, { method: 'DELETE' });
      
      if (response.ok) {
        toast.success(`Cache cleared: ${type || 'all'}`);
        loadStats();
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      console.error('Clear cache error:', error);
      toast.error('Failed to clear cache');
    }
  };

  const formatBytes = (bytes: number): string => {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getHitRateColor = (hitRate: number): string => {
    if (hitRate >= 70) return 'text-green-500';
    if (hitRate >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500">Loading performance stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-500" />
            Performance Monitor
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Real-time system performance and cache statistics
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span className="ml-2">{autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={loadStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Cache Hit Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getHitRateColor(stats.cache.combined.overallHitRate)}`}>
              {stats.cache.combined.overallHitRate.toFixed(1)}%
            </div>
            <Progress
              value={stats.cache.combined.overallHitRate}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Cache Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.cache.combined.totalSize.toFixed(1)} MB
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.cache.combined.totalEntries} entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.memory.heapUsed}</div>
            <p className="text-xs text-gray-500 mt-1">
              of {stats.memory.heapTotal}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Active Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.realtime.subscriberCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">WebSocket subscribers</p>
          </CardContent>
        </Card>

        {/* Redis Status Card */}
        {stats.redis && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Redis Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {stats.redis.connected ? (
                  <>
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-2xl font-bold text-green-500">Connected</span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 bg-gray-400 rounded-full" />
                    <span className="text-2xl font-bold text-gray-400">Disconnected</span>
                  </>
                )}
              </div>
              {stats.redis.connected && stats.redis.latency !== undefined && (
                <p className="text-xs text-gray-500 mt-1">{stats.redis.latency}ms latency</p>
              )}
              {stats.redis.error && (
                <p className="text-xs text-red-500 mt-1">{stats.redis.error}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cache Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Response Cache */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-500" />
                Response Cache
                <Badge variant="outline" className="text-xs">
                  {stats.cache.response.backend}
                </Badge>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearCache('response')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Entries:</span>
              <span className="font-medium">{stats.cache.response.entries}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Size:</span>
              <span className="font-medium">{formatBytes(stats.cache.response.size)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Hit Rate:</span>
              <span className={`font-medium ${getHitRateColor(stats.cache.response.hitRate)}`}>
                {stats.cache.response.hitRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Hits:</span>
              <span className="font-medium text-green-500">{stats.cache.response.hits}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Misses:</span>
              <span className="font-medium text-red-500">{stats.cache.response.misses}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Evictions:</span>
              <span className="font-medium">{stats.cache.response.evictions}</span>
            </div>
          </CardContent>
        </Card>

        {/* Document Cache */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-500" />
                Document Cache
                <Badge variant="outline" className="text-xs">
                  {stats.cache.document.backend}
                </Badge>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearCache('document')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Entries:</span>
              <span className="font-medium">{stats.cache.document.entries}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Size:</span>
              <span className="font-medium">{formatBytes(stats.cache.document.size)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Hit Rate:</span>
              <span className={`font-medium ${getHitRateColor(stats.cache.document.hitRate)}`}>
                {stats.cache.document.hitRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Hits:</span>
              <span className="font-medium text-green-500">{stats.cache.document.hits}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Misses:</span>
              <span className="font-medium text-red-500">{stats.cache.document.misses}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Evictions:</span>
              <span className="font-medium">{stats.cache.document.evictions}</span>
            </div>
          </CardContent>
        </Card>

        {/* Query Cache */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Query Cache
                <Badge variant="outline" className="text-xs">
                  {stats.cache.query.backend}
                </Badge>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearCache('query')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Entries:</span>
              <span className="font-medium">{stats.cache.query.entries}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Size:</span>
              <span className="font-medium">{formatBytes(stats.cache.query.size)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Hit Rate:</span>
              <span className={`font-medium ${getHitRateColor(stats.cache.query.hitRate)}`}>
                {stats.cache.query.hitRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Hits:</span>
              <span className="font-medium text-green-500">{stats.cache.query.hits}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Misses:</span>
              <span className="font-medium text-red-500">{stats.cache.query.misses}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Evictions:</span>
              <span className="font-medium">{stats.cache.query.evictions}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      {stats.realtime.recentEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>Last 10 real-time system events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.realtime.recentEvents.map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {event.type.includes('error') ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {event.type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      {JSON.stringify(event.data)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clear All Button */}
      <Card className="border-red-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Clear All Caches</h4>
              <p className="text-sm text-gray-500 mt-1">
                This will clear all cached data and may temporarily impact performance
              </p>
            </div>
            <Button variant="destructive" onClick={() => clearCache()}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
