'use client';

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { MarkupReplyRecord } from '@/lib/markup/markup-types';
import { logger } from '@/lib/logger';

interface CommentThreadProps {
  slug: string;
  documentId: string;
  markupId: string;
  currentUserId: string;
}

export function CommentThread({ slug, documentId, markupId, currentUserId }: CommentThreadProps) {
  const [replies, setReplies] = useState<(MarkupReplyRecord & { Creator: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReply, setNewReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReplies();
  }, [markupId]);

  const fetchReplies = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/markups/${markupId}/replies`);
      if (!res.ok) throw new Error('Failed to fetch replies');
      const data = await res.json();
      setReplies(data.replies || []);
    } catch (error) {
      logger.error('COMMENT_THREAD', 'Failed to fetch replies', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!newReply.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/markups/${markupId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newReply.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create reply');
      setNewReply('');
      await fetchReplies();
    } catch (error) {
      logger.error('COMMENT_THREAD', 'Failed to create reply', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('Delete this comment?')) return;

    try {
      const reply = replies.find((r) => r.id === replyId);
      if (!reply) return;

      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/markups/${markupId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete reply');
      await fetchReplies();
    } catch (error) {
      logger.error('COMMENT_THREAD', 'Failed to delete reply', error);
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading comments...</div>;
  }

  return (
    <div className="p-4">
      <h4 className="font-semibold mb-3 text-sm">Comments</h4>

      <div className="space-y-3 mb-4">
        {replies.length === 0 ? (
          <p className="text-sm text-gray-500">No comments yet</p>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="border rounded p-3 bg-gray-50">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium">{reply.Creator.name}</p>
                  <p className="text-xs text-gray-500">{getRelativeTime(reply.createdAt)}</p>
                </div>
                {reply.createdBy === currentUserId && (
                  <button
                    onClick={() => handleDeleteReply(reply.id)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <Textarea
          value={newReply}
          onChange={(e) => setNewReply(e.target.value)}
          placeholder="Add a comment..."
          className="text-sm resize-none"
          rows={3}
        />
        <Button size="sm" onClick={handleSubmitReply} disabled={!newReply.trim() || submitting}>
          {submitting ? 'Posting...' : 'Reply'}
        </Button>
      </div>
    </div>
  );
}
