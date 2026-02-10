'use client';

import { useState } from 'react';
import { PresentationBoardList } from './PresentationBoardList';
import { PresentationBoardEditor } from './PresentationBoardEditor';

interface PresentationBoardTabProps {
  projectSlug: string;
}

export function PresentationBoardTab({ projectSlug }: PresentationBoardTabProps) {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);

  const handleNewBoard = () => {
    setCurrentBoardId(null);
    setView('editor');
  };

  const handleEditBoard = (id: string) => {
    setCurrentBoardId(id);
    setView('editor');
  };

  const handleBack = () => {
    setView('list');
    setCurrentBoardId(null);
  };

  if (view === 'editor') {
    return (
      <PresentationBoardEditor
        projectSlug={projectSlug}
        boardId={currentBoardId}
        onBack={handleBack}
      />
    );
  }

  return (
    <PresentationBoardList
      projectSlug={projectSlug}
      onNewBoard={handleNewBoard}
      onEditBoard={handleEditBoard}
    />
  );
}
