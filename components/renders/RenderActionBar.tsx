'use client';

import { useState } from 'react';
import { Download, RefreshCw, Pencil, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { ProjectRender } from './RenderGallery';

interface RenderActionBarProps {
  render: ProjectRender;
  onDownload: () => void;
  onRegenerate: () => void;
  onAdjust: () => void;
  onFavorite: () => void;
  onDelete: () => void;
}

export function RenderActionBar({
  render,
  onDownload,
  onRegenerate,
  onAdjust,
  onFavorite,
  onDelete,
}: RenderActionBarProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Download */}
      <Button
        variant="outline"
        size="sm"
        onClick={onDownload}
        disabled={render.status !== 'completed'}
        className="border-gray-700 text-gray-300"
        aria-label="Download render"
      >
        <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
        Download
      </Button>

      {/* Regenerate with confirmation */}
      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-300"
            aria-label="Regenerate render"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Regenerate
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate a new variation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new render using the same settings. Estimated cost: ~$0.04.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRegenerate();
                setRegenOpen(false);
              }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adjust */}
      <Button
        variant="outline"
        size="sm"
        onClick={onAdjust}
        className="border-gray-700 text-gray-300"
        aria-label="Adjust and retry"
      >
        <Pencil className="h-4 w-4 mr-1.5" aria-hidden="true" />
        Adjust
      </Button>

      {/* Favorite */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onFavorite}
        className={render.isFavorite ? 'text-yellow-400' : 'text-gray-400'}
        aria-label={render.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star
          className={`h-4 w-4 ${render.isFavorite ? 'fill-yellow-400' : ''}`}
        />
      </Button>

      {/* Delete with confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
            aria-label="Delete render"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this render?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The render image and all associated
              data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                onDelete();
                setDeleteOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
