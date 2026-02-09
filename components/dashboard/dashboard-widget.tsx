'use client';

import { type LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface PrimaryMetric {
  value: string | number;
  label: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

interface SecondaryMetric {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: string;
}

interface WidgetAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyState {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

export interface DashboardWidgetProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  primaryMetric: PrimaryMetric;
  secondaryMetrics?: SecondaryMetric[];
  actions?: WidgetAction[];
  href?: string;
  loading?: boolean;
  error?: string;
  emptyState?: EmptyState;
}

function TrendIndicator({ trend, value }: { trend: 'up' | 'down' | 'stable'; value?: string }) {
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const color = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon className="w-3 h-3" />
      {value && <span>{value}</span>}
    </span>
  );
}

function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-700" />
        <div className="h-4 w-24 bg-gray-700 rounded" />
      </div>
      <div className="h-8 w-20 bg-gray-700 rounded" />
      <div className="h-3 w-32 bg-gray-700 rounded" />
    </div>
  );
}

export function DashboardWidget({
  title,
  icon: Icon,
  iconColor,
  primaryMetric,
  secondaryMetrics,
  actions,
  href,
  loading,
  error,
  emptyState,
}: DashboardWidgetProps) {
  if (loading) {
    return (
      <article
        aria-label={title}
        className="bg-slate-900 border-2 border-gray-700 rounded-xl transition-all duration-250"
      >
        <WidgetSkeleton />
      </article>
    );
  }

  if (error) {
    return (
      <article
        aria-label={title}
        className="bg-slate-900 border-2 border-red-500/30 rounded-xl p-6"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-slate-50">{title}</h3>
        </div>
        <p className="text-sm text-red-400">{error}</p>
        <p className="text-xs text-gray-500 mt-1">Try refreshing the page</p>
      </article>
    );
  }

  if (emptyState && primaryMetric.value === 0) {
    return (
      <article
        aria-label={title}
        className="bg-slate-900 border-2 border-gray-700 rounded-xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-lg ${iconColor} opacity-50 flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-400">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-3">{emptyState.message}</p>
        {emptyState.actionLabel && emptyState.actionHref && (
          <Link
            href={emptyState.actionHref}
            className="text-sm text-orange-400 hover:text-orange-300 font-medium"
          >
            {emptyState.actionLabel}
          </Link>
        )}
      </article>
    );
  }

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-sm font-semibold text-slate-50">{title}</h3>
      </div>

      {/* Primary Metric */}
      <div className="mb-1">
        <span className="text-3xl font-bold text-slate-50" aria-live="polite">
          {primaryMetric.value}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-400">{primaryMetric.label}</span>
        {primaryMetric.trend && (
          <TrendIndicator trend={primaryMetric.trend} value={primaryMetric.trendValue} />
        )}
      </div>

      {/* Secondary Metrics */}
      {secondaryMetrics && secondaryMetrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {secondaryMetrics.map((metric) => (
            <div key={metric.label} className="flex items-center gap-2">
              {metric.icon && (
                <metric.icon className={`w-3.5 h-3.5 ${metric.color || 'text-gray-400'}`} />
              )}
              <div>
                <p className={`text-sm font-semibold ${metric.color || 'text-slate-50'}`}>
                  {metric.value}
                </p>
                <p className="text-xs text-gray-500">{metric.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="flex gap-2 pt-3 border-t border-gray-700">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                action.onClick();
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors min-h-[36px] ${
                action.variant === 'primary'
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </>
  );

  const cardClasses =
    'bg-slate-900 border-2 border-gray-700 rounded-xl p-6 transition-all duration-250 ' +
    (href
      ? 'hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-y-0.5 cursor-pointer'
      : '');

  if (href) {
    return (
      <Link href={href} className="block">
        <article aria-label={title} className={cardClasses}>
          {content}
        </article>
      </Link>
    );
  }

  return (
    <article aria-label={title} className={cardClasses}>
      {content}
    </article>
  );
}
