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
  colSpan?: 1 | 2 | 3;
  customContent?: React.ReactNode;
  lastFetched?: Date;
  compact?: boolean;
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

function FreshnessDot({ lastFetched }: { lastFetched?: Date }) {
  if (!lastFetched) return <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" />;

  const ageMs = Date.now() - lastFetched.getTime();
  const fiveMin = 5 * 60 * 1000;
  const oneHour = 60 * 60 * 1000;

  let color = 'bg-gray-600';
  if (ageMs < fiveMin) color = 'bg-green-400';
  else if (ageMs < oneHour) color = 'bg-yellow-400';

  return <span className={`w-1.5 h-1.5 rounded-full ${color} inline-block`} />;
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
  colSpan,
  customContent,
  lastFetched,
  compact,
}: DashboardWidgetProps) {
  const colSpanClass = colSpan === 2 ? 'md:col-span-2' : colSpan === 3 ? 'md:col-span-3' : '';

  if (loading) {
    return (
      <div className={colSpanClass}>
        <article
          aria-label={title}
          className="bg-slate-900 border-2 border-gray-700 rounded-xl transition-all duration-250"
        >
          <WidgetSkeleton />
        </article>
      </div>
    );
  }

  if (error) {
    return (
      <div className={colSpanClass}>
        <article
          aria-label={title}
          className="bg-slate-900 border-2 border-red-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-50">{title}</h3>
              <FreshnessDot lastFetched={lastFetched} />
            </div>
          </div>
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-gray-500 mt-1">Try refreshing the page</p>
        </article>
      </div>
    );
  }

  if (emptyState && primaryMetric.value === 0) {
    return (
      <div className={colSpanClass}>
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
      </div>
    );
  }

  const header = (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-50">{title}</h3>
        <FreshnessDot lastFetched={lastFetched} />
      </div>
    </div>
  );

  const content = customContent ? (
    <>
      {header}
      {customContent}
    </>
  ) : (
    <>
      {header}

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

      {/* Secondary Metrics (hidden in compact mode) */}
      {!compact && secondaryMetrics && secondaryMetrics.length > 0 && (
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

      {/* Actions (hidden in compact mode) */}
      {!compact && actions && actions.length > 0 && (
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
      <div className={colSpanClass}>
        <Link href={href} className="block">
          <article aria-label={title} className={cardClasses}>
            {content}
          </article>
        </Link>
      </div>
    );
  }

  return (
    <div className={colSpanClass}>
      <article aria-label={title} className={cardClasses}>
        {content}
      </article>
    </div>
  );
}
