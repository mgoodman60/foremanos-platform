"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Layers,
  Zap,
  Brain,
  MessageSquare,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';

interface DashboardData {
  project: any;
  phaseA: any;
  phaseB: any;
  phaseC: any;
  insights: string[];
  recommendations: string[];
  health: any;
}

export default function IntelligenceDashboard() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession() || {};
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const slug = params?.slug as string;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (slug && status === 'authenticated') {
      fetchDashboard();
    }
  }, [slug, status]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${slug}/intelligence-dashboard`);
      const data = await response.json();

      if (data.success) {
        setDashboard(data.dashboard);
      } else {
        setError(data.error || 'Failed to load dashboard');
      }
    } catch (err) {
      setError('Network error loading dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#1F2328] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin" />
          <p className="text-gray-300">Loading Intelligence Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-[#1F2328] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-4">{error || 'Failed to load dashboard'}</p>
          <button
            onClick={() => router.push(`/project/${slug}`)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
          >
            Back to Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1F2328] text-gray-100">
      {/* Header */}
      <div className="bg-[#2d333b] border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/project/${slug}`)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-cyan-400 flex items-center space-x-2">
                  <Brain className="h-8 w-8" />
                  <span>Intelligence Dashboard</span>
                </h1>
                <p className="text-gray-400 mt-1">{dashboard.project.name}</p>
              </div>
            </div>
            <button
              onClick={fetchDashboard}
              className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Health Overview */}
        <div className="bg-[#2d333b] rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
              <Activity className="h-6 w-6 text-cyan-400" />
              <span>System Health</span>
            </h2>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                dashboard.health.status === 'excellent' ? 'bg-green-400' :
                dashboard.health.status === 'good' ? 'bg-cyan-400' :
                dashboard.health.status === 'fair' ? 'bg-yellow-400' :
                'bg-red-400'
              }`} />
              <span className="text-sm text-gray-300 capitalize">{dashboard.health.status}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
              <p className="text-sm text-gray-400 mb-1">Overall Score</p>
              <p className="text-3xl font-bold text-cyan-400">{dashboard.health.overall}%</p>
            </div>
            <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
              <p className="text-sm text-gray-400 mb-1">Data Quality</p>
              <p className="text-lg font-semibold text-white capitalize">{dashboard.health.indicators.dataQuality}</p>
            </div>
            <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
              <p className="text-sm text-gray-400 mb-1">System Integration</p>
              <p className="text-lg font-semibold text-white capitalize">{dashboard.health.indicators.systemIntegration}</p>
            </div>
            <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
              <p className="text-sm text-gray-400 mb-1">Collaboration</p>
              <p className="text-lg font-semibold text-white capitalize">{dashboard.health.indicators.collaboration}</p>
            </div>
          </div>
        </div>

        {/* Phase Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Phase A */}
          <PhaseCard
            title={dashboard.phaseA.title}
            phase="A"
            score={dashboard.phaseA.score}
            features={dashboard.phaseA.features}
            icon={<Layers className="h-6 w-6" />}
            color="blue"
          />

          {/* Phase B */}
          <PhaseCard
            title={dashboard.phaseB.title}
            phase="B"
            score={dashboard.phaseB.score}
            features={dashboard.phaseB.features}
            icon={<Zap className="h-6 w-6" />}
            color="purple"
          />

          {/* Phase C */}
          <PhaseCard
            title={dashboard.phaseC.title}
            phase="C"
            score={dashboard.phaseC.score}
            features={dashboard.phaseC.features}
            icon={<Brain className="h-6 w-6" />}
            color="cyan"
          />
        </div>

        {/* Phase C Feature Details */}
        <div className="bg-[#2d333b] rounded-xl border border-cyan-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                <Brain className="h-6 w-6 text-cyan-400" />
                <span>Phase C: System Integration Features</span>
              </h2>
              <p className="text-sm text-gray-400 mt-1">Advanced analysis and coordination capabilities</p>
            </div>
            <button
              onClick={() => router.push(`/project/${slug}`)}
              className="text-cyan-400 hover:text-cyan-300 text-sm"
            >
              View All Tools →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* C.1: Multi-Sheet Spatial Correlation */}
            <div className="bg-[#1F2328] rounded-lg border border-gray-700 p-5 hover:border-cyan-600 transition-colors cursor-pointer"
                 onClick={() => router.push(`/project/${slug}/spatial`)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-cyan-900/30 rounded-lg">
                    <Layers className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Multi-Sheet Spatial Correlation</h3>
                    <p className="text-xs text-gray-400">C.1</p>
                  </div>
                </div>
                <CheckCircle className={`h-5 w-5 ${
                  dashboard.phaseC.features.spatialCorrelation.sheetsAnalyzed > 0 
                    ? 'text-green-400' 
                    : 'text-gray-600'
                }`} />
              </div>
              <p className="text-sm text-gray-300 mb-3">
                Cross-sheet location queries and coordinate mapping across disciplines
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Sheets Analyzed:</span>
                <span className="font-semibold text-cyan-400">
                  {dashboard.phaseC.features.spatialCorrelation.sheetsAnalyzed}
                </span>
              </div>
            </div>

            {/* C.2: Advanced MEP Path Tracing */}
            <div className="bg-[#1F2328] rounded-lg border border-gray-700 p-5 hover:border-cyan-600 transition-colors cursor-pointer"
                 onClick={() => router.push(`/project/${slug}/mep`)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-900/30 rounded-lg">
                    <Zap className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">MEP Path Tracing & Clash Detection</h3>
                    <p className="text-xs text-gray-400">C.2</p>
                  </div>
                </div>
                {dashboard.phaseC.features.mepPathTracing.criticalClashes > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                ) : (
                  <CheckCircle className={`h-5 w-5 ${
                    dashboard.phaseC.features.mepPathTracing.elementsDetected > 0 
                      ? 'text-green-400' 
                      : 'text-gray-600'
                  }`} />
                )}
              </div>
              <p className="text-sm text-gray-300 mb-3">
                Vertical routing and interference detection between MEP systems
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Elements:</span>
                  <span className="font-semibold text-white">
                    {dashboard.phaseC.features.mepPathTracing.elementsDetected}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Clashes:</span>
                  <span className={`font-semibold ${
                    dashboard.phaseC.features.mepPathTracing.clashesIdentified > 0 
                      ? 'text-yellow-400' 
                      : 'text-green-400'
                  }`}>
                    {dashboard.phaseC.features.mepPathTracing.clashesIdentified}
                  </span>
                </div>
              </div>
            </div>

            {/* C.3: Adaptive Symbol Learning */}
            <div className="bg-[#1F2328] rounded-lg border border-gray-700 p-5 hover:border-cyan-600 transition-colors cursor-pointer"
                 onClick={() => router.push(`/project/${slug}/legends`)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-900/30 rounded-lg">
                    <Brain className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Adaptive Symbol Learning</h3>
                    <p className="text-xs text-gray-400">C.3</p>
                  </div>
                </div>
                <CheckCircle className={`h-5 w-5 ${
                  dashboard.phaseC.features.adaptiveSymbolLearning.customSymbolsLearned > 0 
                    ? 'text-green-400' 
                    : 'text-gray-600'
                }`} />
              </div>
              <p className="text-sm text-gray-300 mb-3">
                AI-powered recognition and learning of project-specific symbols
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Symbols:</span>
                  <span className="font-semibold text-purple-400">
                    {dashboard.phaseC.features.adaptiveSymbolLearning.customSymbolsLearned}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Confidence:</span>
                  <span className="font-semibold text-white">
                    {Math.round((dashboard.phaseC.features.adaptiveSymbolLearning.confidence || 0) * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* C.4: Isometric View Interpretation */}
            <div className="bg-[#1F2328] rounded-lg border border-gray-700 p-5 hover:border-cyan-600 transition-colors cursor-pointer"
                 onClick={() => router.push(`/project/${slug}/isometric`)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-900/30 rounded-lg">
                    <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Isometric View Interpretation</h3>
                    <p className="text-xs text-gray-400">C.4</p>
                  </div>
                </div>
                <CheckCircle className="h-5 w-5 text-gray-600" />
              </div>
              <p className="text-sm text-gray-300 mb-3">
                3D reconstruction and analysis from 2D isometric drawings
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Status:</span>
                <span className="font-semibold text-indigo-400">
                  Available for MEP sheets
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Insights & Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Insights */}
          <div className="bg-[#2d333b] rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white flex items-center space-x-2 mb-4">
              <TrendingUp className="h-6 w-6 text-green-400" />
              <span>Key Insights</span>
            </h2>
            <div className="space-y-3">
              {dashboard.insights.map((insight, index) => (
                <div key={index} className="flex items-start space-x-3 text-gray-300">
                  <span className="text-lg">•</span>
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-[#2d333b] rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white flex items-center space-x-2 mb-4">
              <MessageSquare className="h-6 w-6 text-yellow-400" />
              <span>Recommendations</span>
            </h2>
            <div className="space-y-3">
              {dashboard.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start space-x-3 text-gray-300">
                  <span className="text-lg">•</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Project Stats */}
        <div className="bg-[#2d333b] rounded-xl border border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Project Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Documents" value={dashboard.project.documentsCount} />
            <StatCard label="Drawing Sheets" value={dashboard.project.sheetsCount} />
            <StatCard label="Data Chunks" value={dashboard.project.chunksCount} />
            <StatCard label="MEP Elements" value={dashboard.phaseC.features.mepPathTracing.elementsDetected} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface PhaseCardProps {
  title: string;
  phase: string;
  score: number;
  features: any[];
  icon: React.ReactNode;
  color: 'blue' | 'purple' | 'cyan';
}

function PhaseCard({ title, phase, score, features, icon, color }: PhaseCardProps) {
  const colorClasses: Record<'blue' | 'purple' | 'cyan', string> = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30'
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl border p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className={`p-2 bg-${color}-500/20 rounded-lg`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-white">Phase {phase}</h3>
            <p className="text-sm text-gray-400">{title}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{score}%</p>
          <p className="text-xs text-gray-400">Score</p>
        </div>
      </div>
      
      <div className="space-y-2 mt-4">
        {Object.entries(features).slice(0, 3).map(([key, value]: [string, any]) => (
          <div key={key} className="flex justify-between text-sm">
            <span className="text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
            <span className="text-white font-medium">
              {typeof value === 'object' 
                ? (value.count || value.total || value.score || Object.values(value)[0])
                : value
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#1F2328] rounded-lg p-4 border border-gray-700">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  );
}
