'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ThumbsDown, ThumbsUp, Brain, Trash2, Save, X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Feedback {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  message: {
    id: string;
    message: string;
    response: string;
    createdAt: string;
    conversation?: {
      project?: {
        name: string;
        slug: string;
      };
    };
    user?: {
      username: string;
      role: string;
    };
  };
  correction?: {
    id: string;
    correctedAnswer: string;
    isActive: boolean;
  };
}

interface AdminFeedbackReviewProps {
  projectSlug?: string;
}

export function AdminFeedbackReview({ projectSlug }: AdminFeedbackReviewProps) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyNegative, setShowOnlyNegative] = useState(true);
  const [showNeedsCorrection, setShowNeedsCorrection] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    correctedAnswer: '',
    adminNotes: '',
    keywords: [] as string[],
    keywordInput: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchFeedback();
  }, [projectSlug, showOnlyNegative, showNeedsCorrection]);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (projectSlug) params.append('projectSlug', projectSlug);
      if (showOnlyNegative) params.append('onlyNegative', 'true');
      if (showNeedsCorrection) params.append('needsCorrection', 'true');

      const response = await fetch(`/api/feedback/review?${params}`);
      if (!response.ok) throw new Error('Failed to fetch feedback');
      
      const data = await response.json();
      setFeedback(data.feedback);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const openCorrectionDialog = (fb: Feedback) => {
    setSelectedFeedback(fb);
    if (fb.correction) {
      // Edit existing correction
      setCorrectionForm({
        correctedAnswer: fb.correction.correctedAnswer,
        adminNotes: '',
        keywords: [],
        keywordInput: ''
      });
    } else {
      // New correction
      setCorrectionForm({
        correctedAnswer: fb.message.response, // Start with original answer
        adminNotes: '',
        keywords: [],
        keywordInput: ''
      });
    }
    setShowCorrectionDialog(true);
  };

  const addKeyword = () => {
    const keyword = correctionForm.keywordInput.trim();
    if (keyword && !correctionForm.keywords.includes(keyword)) {
      setCorrectionForm({
        ...correctionForm,
        keywords: [...correctionForm.keywords, keyword],
        keywordInput: ''
      });
    }
  };

  const removeKeyword = (keyword: string) => {
    setCorrectionForm({
      ...correctionForm,
      keywords: correctionForm.keywords.filter((k: string) => k !== keyword)
    });
  };

  const saveCorrection = async () => {
    if (!selectedFeedback) return;
    
    if (!correctionForm.correctedAnswer.trim()) {
      toast.error('Corrected answer is required');
      return;
    }

    if (correctionForm.keywords.length === 0) {
      toast.error('At least one keyword is required');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/feedback/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackId: selectedFeedback.id,
          correctedAnswer: correctionForm.correctedAnswer,
          adminNotes: correctionForm.adminNotes || null,
          keywords: correctionForm.keywords,
          projectSlug: selectedFeedback.message.conversation?.project?.slug
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save correction');
      }

      toast.success('Correction saved! The chatbot will learn from this.');
      setShowCorrectionDialog(false);
      fetchFeedback();
    } catch (error: any) {
      console.error('Error saving correction:', error);
      toast.error(error.message || 'Failed to save correction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Teach the Chatbot
          </CardTitle>
          <CardDescription>
            Review user feedback and provide corrections to improve chatbot responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="only-negative"
                checked={showOnlyNegative}
                onCheckedChange={setShowOnlyNegative}
              />
              <Label htmlFor="only-negative">Only negative feedback</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="needs-correction"
                checked={showNeedsCorrection}
                onCheckedChange={setShowNeedsCorrection}
              />
              <Label htmlFor="needs-correction">Needs correction</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading feedback...
        </div>
      ) : feedback.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No feedback found matching the filters
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {feedback.map((fb: Feedback) => (
            <Card key={fb.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {fb.rating === 1 ? (
                        <ThumbsUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <ThumbsDown className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant={fb.correction ? 'default' : 'outline'}>
                        {fb.correction ? 'Has Correction' : 'Needs Review'}
                      </Badge>
                      {fb.message.conversation?.project && (
                        <Badge variant="secondary">
                          {fb.message.conversation.project.name}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {fb.message.user?.username || 'Anonymous'} • {new Date(fb.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCorrectionDialog(fb)}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    {fb.correction ? 'View Correction' : 'Add Correction'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">User Question:</Label>
                  <p className="text-sm mt-1">{fb.message.message}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Chatbot Response:</Label>
                  <p className="text-sm mt-1 text-muted-foreground">
                    {fb.message.response.substring(0, 300)}
                    {fb.message.response.length > 300 && '...'}
                  </p>
                </div>
                {fb.comment && (
                  <div>
                    <Label className="text-sm font-semibold">User Comment:</Label>
                    <p className="text-sm mt-1 italic">{fb.comment}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Correction Dialog */}
      <Dialog open={showCorrectionDialog} onOpenChange={setShowCorrectionDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teach the Chatbot</DialogTitle>
            <DialogDescription>
              Provide the correct answer and keywords. The chatbot will use this for similar future questions.
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-4">
              {/* Original Question */}
              <div>
                <Label className="font-semibold">Original Question:</Label>
                <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                  {selectedFeedback.message.message}
                </p>
              </div>

              {/* Original Answer */}
              <div>
                <Label className="font-semibold">Original Answer:</Label>
                <p className="text-sm mt-1 p-3 bg-muted rounded-md max-h-32 overflow-y-auto">
                  {selectedFeedback.message.response}
                </p>
              </div>

              {/* Corrected Answer */}
              <div>
                <Label htmlFor="corrected-answer" className="font-semibold">
                  Corrected Answer: <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="corrected-answer"
                  value={correctionForm.correctedAnswer}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, correctedAnswer: e.target.value })}
                  rows={6}
                  placeholder="Provide the correct answer..."
                  className="mt-1"
                />
              </div>

              {/* Admin Notes */}
              <div>
                <Label htmlFor="admin-notes" className="font-semibold">
                  Admin Notes (Optional):
                </Label>
                <Textarea
                  id="admin-notes"
                  value={correctionForm.adminNotes}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, adminNotes: e.target.value })}
                  rows={3}
                  placeholder="Additional context or reasoning..."
                  className="mt-1"
                />
              </div>

              {/* Keywords */}
              <div>
                <Label className="font-semibold">
                  Keywords: <span className="text-red-500">*</span>
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Add keywords to help match similar questions
                </p>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={correctionForm.keywordInput}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, keywordInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder="Enter a keyword and press Enter"
                  />
                  <Button type="button" onClick={addKeyword} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {correctionForm.keywords.map((keyword: string) => (
                    <Badge key={keyword} variant="secondary" className="gap-1">
                      {keyword}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => removeKeyword(keyword)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCorrectionDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={saveCorrection} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Correction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
