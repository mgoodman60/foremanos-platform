'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsCards } from '@/components/admin/stats-cards';
import { ActivityFeed } from '@/components/admin/activity-feed';
import { UserManagement } from '@/components/admin/user-management';
import { AdminFeedbackReview } from '@/components/admin/feedback-review';
import { ProcessingAnalytics } from '@/components/admin/processing-analytics';
import { toast } from 'sonner';

interface Stats {
  usersByRole: {
    admin: number;
    client: number;
    guest: number;
    pending: number;
  };
  pendingApprovals: number;
  totalProjects: number;
  totalDocuments: number;
  recentSignups: number;
}

interface CacheStats {
  totalHits: number;
  totalMisses: number;
  cacheSize: number;
  estimatedSavings: number;
  hitRate: number;
  gpt52Hits?: number;
  gpt52Savings?: number;
  highValueEntries?: number;
  avgHitCount?: number;
}

interface TopQuery {
  query: string;
  hitCount: number;
  complexity: string;
}

interface User {
  id: string;
  email?: string;
  username: string;
  role: string;
  approved: boolean;
  createdAt: string;
  lastLoginAt?: string;
  _count?: {
    ownedProjects: number;
    chatMessages: number;
  };
}

interface Activity {
  id: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: any;
  createdAt: string;
  user?: {
    username: string;
    email?: string;
  };
}

export default function AdminDashboard() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && session?.user?.role !== 'admin') {
      toast.error('Access denied. Admin privileges required.');
      router.push('/dashboard');
      return;
    }

    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, session, router]);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes, activityRes, cacheRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
        fetch('/api/admin/activity?limit=20'),
        fetch('/api/cache/stats'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users);
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivities(activityData.activities);
      }

      if (cacheRes.ok) {
        const cacheData = await cacheRes.json();
        setCacheStats(cacheData.stats);
        setTopQueries(cacheData.topQueries || []);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-client-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="text-center">
          <p className="text-gray-600">Failed to load dashboard data</p>
          <Button onClick={handleRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="inline-flex items-center text-sm text-gray-600 hover:text-client-primary transition-colors">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Link>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/foremanos-new-logo.png"
                  alt="ForemanOS"
                  className="h-10 w-auto object-contain"
                />
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
                  <p className="text-sm text-slate-600">Platform Management</p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          {/* Stats Cards */}
          <StatsCards stats={stats} />

          {/* Tabs */}
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 max-w-5xl">
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="feedback">Teach Chatbot</TabsTrigger>
              <TabsTrigger value="activity">Activity Feed</TabsTrigger>
              <TabsTrigger value="cost">Cost Optimization</TabsTrigger>
              <TabsTrigger value="processing">Processing Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <UserManagement users={users} onRefresh={handleRefresh} />
            </TabsContent>

            <TabsContent value="feedback" className="space-y-4">
              <AdminFeedbackReview />
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <ActivityFeed activities={activities} />
            </TabsContent>

            <TabsContent value="cost" className="space-y-4">
              {/* Cost Optimization Dashboard */}
              <div className="grid gap-6">
                {/* Cache Statistics Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Hit Rate</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">
                          {cacheStats?.hitRate.toFixed(1) || '0.0'}%
                        </p>
                      </div>
                      <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Target: &gt;30%
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Cache Hits</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">
                          {cacheStats?.totalHits.toLocaleString() || '0'}
                        </p>
                      </div>
                      <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Queries served from cache
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Est. Savings</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">
                          ${cacheStats?.estimatedSavings.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center">
                        <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Total saved this session
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Cache Size</p>
                        <p className="text-2xl font-bold text-purple-600 mt-1">
                          {cacheStats?.cacheSize || '0'}
                        </p>
                      </div>
                      <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                        <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Max: 2,000 entries (upgraded)
                    </p>
                  </div>
                </div>

                {/* GPT-5.2 Specific Cache Metrics */}
                {cacheStats && (cacheStats.gpt52Hits || cacheStats.highValueEntries) && (
                  <div className="grid gap-4 md:grid-cols-3 mt-4">
                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg shadow-sm border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-orange-900">GPT-5.2 Cache Hits</p>
                          <p className="text-2xl font-bold text-orange-600 mt-1">
                            {cacheStats.gpt52Hits?.toLocaleString() || '0'}
                          </p>
                        </div>
                        <div className="h-12 w-12 bg-orange-200 rounded-full flex items-center justify-center">
                          <span className="text-2xl">⚡</span>
                        </div>
                      </div>
                      <p className="text-xs text-orange-700 mt-2">
                        Complex queries cached
                      </p>
                    </div>

                    <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg shadow-sm border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-900">GPT-5.2 Savings</p>
                          <p className="text-2xl font-bold text-green-600 mt-1">
                            ${cacheStats.gpt52Savings?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                        <div className="h-12 w-12 bg-green-200 rounded-full flex items-center justify-center">
                          <span className="text-2xl">💰</span>
                        </div>
                      </div>
                      <p className="text-xs text-green-700 mt-2">
                        Saved on $0.21/query model
                      </p>
                    </div>

                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg shadow-sm border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-900">High-Value Entries</p>
                          <p className="text-2xl font-bold text-purple-600 mt-1">
                            {cacheStats.highValueEntries?.toLocaleString() || '0'}
                          </p>
                        </div>
                        <div className="h-12 w-12 bg-purple-200 rounded-full flex items-center justify-center">
                          <span className="text-2xl">⭐</span>
                        </div>
                      </div>
                      <p className="text-xs text-purple-700 mt-2">
                        72h TTL (vs 48h standard)
                      </p>
                    </div>
                  </div>
                )}

                {/* Top Cached Queries */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Top Cached Queries</h3>
                    <span className="text-sm text-gray-500">{topQueries.length} unique queries</span>
                  </div>
                  <div className="space-y-3">
                    {topQueries.length > 0 ? (
                      topQueries.slice(0, 10).map((query, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {query.query}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                query.complexity === 'simple' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {query.complexity}
                              </span>
                              <span className="text-xs text-gray-500">
                                {query.hitCount} {query.hitCount === 1 ? 'hit' : 'hits'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4 flex-shrink-0">
                            <span className="text-lg font-bold text-blue-600">
                              {query.hitCount}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-500 py-8">
                        No cached queries yet. Cache will populate as users interact with the system.
                      </p>
                    )}
                  </div>
                </div>

                {/* Cost Optimization Info */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Cost Optimization Strategy</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">🎯 Model Routing (GPT-5.2 Enabled)</h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Simple queries → GPT-3.5 ($0.03)</li>
                        <li>• Medium queries → Claude 3.5 ($0.15)</li>
                        <li>• Complex queries → GPT-5.2 Instant ($0.21) ✨ 30% cheaper!</li>
                        <li>• Gantt/Planning → GPT-5.2 Thinking ($0.30)</li>
                        <li>• Images → GPT-4o Vision ($0.01/page)</li>
                        <li>• All models have web search enabled</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">💾 Enhanced Caching (GPT-5.2 Optimized)</h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Standard TTL: 48 hours (↑ from 24h)</li>
                        <li>• High-value TTL: 72 hours (GPT-5.2, common queries)</li>
                        <li>• Max cache size: 2,000 entries (↑ from 1,000)</li>
                        <li>• Smart LRU eviction (preserves high-value)</li>
                        <li>• Target hit rate: &gt;40% (↑ from 30%)</li>
                        <li>• Construction term normalization</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <p className="text-sm text-gray-700">
                      <strong>Expected Savings with GPT-5.2:</strong> 15% additional reduction vs GPT-4o baseline 
                      (~$675/month savings, $8,100/year on current usage)
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      💡 GPT-5.2 offers 45% fewer hallucinations and 70.9% expert-level performance on construction planning
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="processing" className="space-y-4">
              <ProcessingAnalytics />
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
}
