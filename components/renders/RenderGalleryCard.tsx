'use client';

import { Building2, Home, Plane, Star, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ProjectRender } from './RenderGallery';

interface RenderGalleryCardProps {
  render: ProjectRender;
  onClick: () => void;
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getViewTypeIcon(viewType: string) {
  switch (viewType?.toLowerCase()) {
    case 'exterior':
      return <Building2 className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'interior':
      return <Home className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'aerial':
      return <Plane className="h-3.5 w-3.5" aria-hidden="true" />;
    default:
      return <Building2 className="h-3.5 w-3.5" aria-hidden="true" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">
          Pending
        </Badge>
      );
    case 'generating':
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
          Generating
        </Badge>
      );
    case 'completed':
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
          Complete
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

function getAutoTitle(render: ProjectRender): string {
  if (render.title) return render.title;
  const viewType = render.viewType
    ? render.viewType.charAt(0).toUpperCase() + render.viewType.slice(1)
    : 'Render';
  const style = render.style
    ? render.style.charAt(0).toUpperCase() + render.style.slice(1)
    : '';
  const date = new Date(render.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${viewType}${style ? ` - ${style}` : ''} - ${date}`;
}

export function RenderGalleryCard({ render, onClick }: RenderGalleryCardProps) {
  return (
    <Card
      className="group cursor-pointer overflow-hidden border-gray-800 bg-dark-subtle hover:border-orange-500/50 transition-all duration-200 hover:shadow-lg hover:scale-[1.01]"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`View render: ${getAutoTitle(render)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video overflow-hidden">
        {render.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={render.thumbnailUrl}
            alt={getAutoTitle(render)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 flex items-center justify-center">
            {render.status === 'generating' ? (
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" aria-hidden="true" />
            ) : (
              <Building2 className="h-8 w-8 text-gray-600" aria-hidden="true" />
            )}
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute top-2 left-2">
          {getStatusBadge(render.status)}
        </div>

        {/* Favorite star */}
        <div className="absolute top-2 right-2">
          <Star
            className={`h-5 w-5 transition-colors ${
              render.isFavorite
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-400 opacity-0 group-hover:opacity-100'
            }`}
            aria-hidden="true"
          />
        </div>
      </div>

      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-medium text-white truncate">
            {getAutoTitle(render)}
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View type */}
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
            {getViewTypeIcon(render.viewType)}
            {render.viewType}
          </span>

          {/* Style pill */}
          {render.style && (
            <Badge
              variant="outline"
              className="text-[10px] border-gray-600 text-gray-400"
            >
              {render.style}
            </Badge>
          )}

          {/* Time */}
          <span className="text-[10px] text-gray-400 ml-auto">
            {timeAgo(render.createdAt)}
          </span>
        </div>

        <p className="text-[9px] text-gray-600 mt-2">
          AI-generated conceptual visualization — for illustrative purposes only.
        </p>
      </CardContent>
    </Card>
  );
}
