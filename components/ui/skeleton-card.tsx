'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  className?: string;
}

/**
 * SkeletonCard - A reusable card skeleton for loading states
 *
 * Used in dashboards and project pages to show placeholder content
 * while data is being fetched.
 */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'border-2 border-gray-600 rounded-xl p-5 bg-dark-card animate-pulse',
        className
      )}
    >
      {/* Header area */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Skeleton className="h-6 w-3/4 bg-gray-700 mb-2" />
          <Skeleton className="h-5 w-20 bg-gray-700 rounded-full" />
        </div>
      </div>

      {/* Stats area */}
      <div className="space-y-2.5 mb-4 bg-dark-surface rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 bg-gray-700 rounded" />
          <Skeleton className="h-4 w-24 bg-gray-700" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 bg-gray-700 rounded" />
          <Skeleton className="h-4 w-20 bg-gray-700" />
        </div>
      </div>

      {/* Button area */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-full bg-gray-700 rounded-lg" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-9 bg-gray-700 rounded-lg" />
          <Skeleton className="h-9 bg-gray-700 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

interface SkeletonCardGridProps {
  /** Number of skeleton cards to show */
  count?: number;
  /** Grid columns (1, 2, or 3) */
  columns?: 1 | 2 | 3;
  className?: string;
}

/**
 * SkeletonCardGrid - A grid of skeleton cards for list loading states
 */
export function SkeletonCardGrid({
  count = 3,
  columns = 3,
  className
}: SkeletonCardGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

interface SkeletonDashboardProps {
  className?: string;
}

/**
 * SkeletonDashboard - Full dashboard skeleton with header, stats, and cards
 */
export function SkeletonDashboard({ className }: SkeletonDashboardProps) {
  return (
    <div className={cn('space-y-8', className)}>
      {/* Welcome section skeleton */}
      <div>
        <Skeleton className="h-9 w-64 bg-gray-700 mb-2" />
        <Skeleton className="h-5 w-96 bg-gray-700" />
      </div>

      {/* Quick actions skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-24 rounded-lg bg-gray-700" />
        <Skeleton className="h-24 rounded-lg bg-gray-700" />
      </div>

      {/* Projects section skeleton */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-48 bg-gray-700" />
          <Skeleton className="h-9 w-32 bg-gray-700 rounded-lg" />
        </div>
        <SkeletonCardGrid count={3} columns={3} />
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  /** Number of rows to show */
  rows?: number;
  /** Number of columns */
  columns?: number;
  className?: string;
}

/**
 * SkeletonTable - Table skeleton for data loading states
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className
}: SkeletonTableProps) {
  return (
    <div className={cn('rounded-lg border border-gray-700 overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-dark-surface border-b border-gray-700 p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1 bg-gray-700" />
          ))}
        </div>
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="p-4 border-b border-gray-700 last:border-b-0"
        >
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton
                key={colIdx}
                className={cn(
                  'h-4 flex-1 bg-gray-700',
                  colIdx === 0 && 'max-w-[200px]'
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface SkeletonStatsProps {
  /** Number of stat cards */
  count?: number;
  className?: string;
}

/**
 * SkeletonStats - Stats cards skeleton for metrics displays
 */
export function SkeletonStats({ count = 4, className }: SkeletonStatsProps) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-dark-card border border-gray-700 rounded-lg p-4"
        >
          <Skeleton className="h-4 w-20 bg-gray-700 mb-2" />
          <Skeleton className="h-8 w-16 bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonChartProps {
  /** Height of the chart area */
  height?: number;
  className?: string;
}

/**
 * SkeletonChart - Chart skeleton for analytics loading states
 */
export function SkeletonChart({ height = 300, className }: SkeletonChartProps) {
  return (
    <div
      className={cn('bg-dark-card border border-gray-700 rounded-lg p-4', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32 bg-gray-700" />
        <Skeleton className="h-8 w-24 bg-gray-700 rounded" />
      </div>

      {/* Chart area */}
      <div
        className="flex items-end gap-2 justify-between px-4"
        style={{ height }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 bg-gray-700 rounded-t"
            style={{
              height: `${Math.random() * 60 + 40}%`,
              opacity: 0.5 + Math.random() * 0.5
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface SkeletonProjectWorkspaceProps {
  className?: string;
}

/**
 * SkeletonProjectWorkspace - Project workspace skeleton with header and main content
 */
export function SkeletonProjectWorkspace({ className }: SkeletonProjectWorkspaceProps) {
  return (
    <div className={cn('min-h-screen bg-dark-surface flex flex-col', className)}>
      {/* Header skeleton */}
      <header className="bg-dark-card border-b border-gray-700 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-32 bg-gray-700 rounded" />
            <Skeleton className="h-5 w-48 bg-gray-700" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 bg-gray-700 rounded-lg" />
            <Skeleton className="h-9 w-9 bg-gray-700 rounded-lg" />
          </div>
        </div>
      </header>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col md:flex-row p-4 gap-4">
        {/* Sidebar / Document list */}
        <div className="w-full md:w-80 space-y-3">
          <Skeleton className="h-10 w-full bg-gray-700 rounded-lg" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-gray-700 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Main chat/content area */}
        <div className="flex-1 bg-dark-card border border-gray-700 rounded-lg p-4">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 bg-gray-700 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24 bg-gray-700" />
                  <Skeleton className="h-16 w-full bg-gray-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
