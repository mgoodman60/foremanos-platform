'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { HelpCircle, Check, Send } from 'lucide-react';

interface QualityQuestion {
  id: string;
  pageNumber: number;
  field: string;
  questionText: string;
  questionType: 'yes_no' | 'multiple_choice' | 'free_text';
  options: string[] | null;
  answer: string | null;
  applied: boolean;
  confidenceBefore: number | null;
  confidenceAfter: number | null;
  sheetNumber: string | null;
  discipline: string | null;
}

interface Props {
  documentId: string;
}

export default function QualityQuestionsPanel({ documentId }: Props) {
  const [questions, setQuestions] = useState<QualityQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/quality-questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [documentId]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleSubmit = async () => {
    const toSubmit = Object.entries(answers)
      .filter(([, answer]) => answer.trim() !== '')
      .map(([questionId, answer]) => ({ questionId, answer }));

    if (toSubmit.length === 0) return;

    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/quality-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: toSubmit }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitResult(`${data.applied} answers applied`);
        setAnswers({});
        fetchQuestions();
      } else {
        setSubmitResult(data.error || 'Failed');
      }
    } catch { setSubmitResult('Failed to submit'); }
    finally { setSubmitting(false); }
  };

  const pending = questions.filter(q => !q.applied);
  const answered = questions.filter(q => q.applied);
  const pendingAnswerCount = Object.values(answers).filter(a => a.trim() !== '').length;

  if (loading) return null;
  if (questions.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-gray-700 rounded-xl p-6">
      <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-1">
        <HelpCircle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
        Quality Questions ({pending.length} pending)
      </h3>
      <p className="text-xs text-gray-400 mb-4">Answer these to improve extraction accuracy</p>

      {submitResult && (
        <div className="text-sm text-yellow-400 bg-yellow-900/30 rounded-lg px-3 py-2 mb-4">{submitResult}</div>
      )}

      {/* Pending questions */}
      {pending.length > 0 && (
        <div className="space-y-4 mb-4">
          {pending.map(q => (
            <div key={q.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="text-xs text-gray-400 mb-1">
                Page {q.pageNumber}{q.sheetNumber ? ` — ${q.sheetNumber}` : ''}{q.discipline ? ` — ${q.discipline}` : ''}
              </div>
              <div className="text-sm text-white mb-2">{q.questionText}</div>

              {q.questionType === 'multiple_choice' && q.options && (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt: string) => (
                    <button
                      key={opt}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                      className={`px-3 py-1 rounded-lg text-xs transition-colors min-h-[44px] ${
                        answers[q.id] === opt
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      aria-pressed={answers[q.id] === opt}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.questionType === 'yes_no' && (
                <div className="flex gap-2">
                  {['Yes', 'No'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                      className={`px-4 py-1 rounded-lg text-xs transition-colors min-h-[44px] ${
                        answers[q.id] === opt
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      aria-pressed={answers[q.id] === opt}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.questionType === 'free_text' && (
                <input
                  type="text"
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Type your answer..."
                  className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                  aria-label={`Answer for: ${q.questionText}`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Submit button */}
      {pending.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={submitting || pendingAnswerCount === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors mb-4 min-h-[44px]"
          aria-label="Submit answers"
        >
          <Send className={`h-4 w-4 ${submitting ? 'animate-pulse' : ''}`} aria-hidden="true" />
          {submitting ? 'Submitting...' : `Submit Answers (${pendingAnswerCount})`}
        </button>
      )}

      {/* Answered section */}
      {answered.length > 0 && (
        <div>
          <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Answered ({answered.length})</div>
          <div className="space-y-1">
            {answered.map(q => (
              <div key={q.id} className="flex items-center gap-2 text-xs text-gray-400">
                <Check className="h-3 w-3 text-green-400 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">Page {q.pageNumber} — {q.field}: {q.answer}</span>
                {q.confidenceBefore != null && q.confidenceAfter != null && (
                  <span className="text-green-400 flex-shrink-0">+{Math.round(q.confidenceAfter - q.confidenceBefore)} pts</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
