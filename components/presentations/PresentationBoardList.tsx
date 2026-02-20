'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2, Presentation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BoardSummary {
  id: string;
  title: string;
  templateId: string;
  updatedAt: string;
}

const TEMPLATE_LABELS: Record<string, string> = {
  hero_sign: 'Hero Sign',
  portfolio_sheet: 'Portfolio',
  before_after: 'Before/After',
  presentation_cover: 'Cover Page',
};

interface PresentationBoardListProps {
  projectSlug: string;
  onNewBoard: () => void;
  onEditBoard: (id: string) => void;
}

export function PresentationBoardList({
  projectSlug,
  onNewBoard,
  onEditBoard,
}: PresentationBoardListProps) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBoards() {
      try {
        const response = await fetch(`/api/projects/${projectSlug}/presentations`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setBoards(data.boards || []);
      } catch {
        setBoards([]);
      } finally {
        setLoading(false);
      }
    }
    fetchBoards();
  }, [projectSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* New Board card */}
        <button
          type="button"
          onClick={onNewBoard}
          className={cn(
            'flex flex-col items-center justify-center gap-3 min-h-[180px] rounded-lg border-2 border-dashed border-border',
            'text-muted-foreground hover:border-primary hover:text-primary transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <Plus size={28} aria-hidden="true" />
          <span className="text-sm font-medium">New Board</span>
        </button>

        {/* Existing boards */}
        {boards.map((board) => (
          <button
            key={board.id}
            type="button"
            onClick={() => onEditBoard(board.id)}
            className={cn(
              'flex flex-col items-start gap-3 min-h-[180px] rounded-lg border border-border bg-card p-4',
              'hover:border-primary/50 hover:bg-muted/30 transition-colors text-left',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <div className="flex items-center justify-center w-full py-4 text-muted-foreground">
              <Presentation size={32} aria-hidden="true" />
            </div>
            <div className="mt-auto w-full">
              <div className="text-sm font-medium text-foreground truncate">
                {board.title || 'Untitled Board'}
              </div>
              <div className="flex items-center justify-between mt-2">
                <Badge variant="secondary" className="text-[10px]">
                  {TEMPLATE_LABELS[board.templateId] || board.templateId}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(board.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {boards.length === 0 && (
        <p className="text-center text-sm text-muted-foreground mt-8">
          No presentation boards yet. Create your first one.
        </p>
      )}
    </div>
  );
}
