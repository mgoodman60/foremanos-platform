'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Lightbulb, ExternalLink, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureTipProps {
  /** Unique identifier for this tip (used for localStorage) */
  id: string;
  /** Title of the feature tip */
  title: string;
  /** Description or helpful tip */
  description: string;
  /** Optional link to documentation */
  docsUrl?: string;
  /** Whether to show the tip (can be controlled externally) */
  show?: boolean;
  /** Callback when the tip is dismissed */
  onDismiss?: () => void;
  /** Position of the tip */
  position?: 'top' | 'bottom' | 'inline';
  /** Additional CSS classes */
  className?: string;
  /** Variant style */
  variant?: 'default' | 'highlight' | 'minimal';
}

const STORAGE_KEY = 'foremanos_dismissed_tips';

/**
 * FeatureTip - Contextual onboarding hints for feature discovery
 *
 * Shows first-time tips that can be dismissed and remembered via localStorage.
 *
 * @example
 * <FeatureTip
 *   id="spatial-correlation"
 *   title="Spatial Correlation Analysis"
 *   description="Did you know? You can analyze how different building systems interact across your project."
 *   docsUrl="https://docs.foremanos.com/spatial"
 * />
 */
export function FeatureTip({
  id,
  title,
  description,
  docsUrl,
  show = true,
  onDismiss,
  position = 'top',
  className,
  variant = 'default',
}: FeatureTipProps) {
  const [dismissed, setDismissed] = useState(true); // Start hidden until we check localStorage
  const [visible, setVisible] = useState(false);

  // Check if this tip has been dismissed before
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const dismissedTips = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!dismissedTips.includes(id)) {
        setDismissed(false);
        // Delay showing for smooth entrance animation
        setTimeout(() => setVisible(true), 100);
      }
    } catch (error) {
      console.error('Error reading dismissed tips:', error);
      setDismissed(false);
    }
  }, [id]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    // Wait for exit animation
    setTimeout(() => {
      setDismissed(true);
      onDismiss?.();

      // Save to localStorage
      try {
        const dismissedTips = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (!dismissedTips.includes(id)) {
          dismissedTips.push(id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissedTips));
        }
      } catch (error) {
        console.error('Error saving dismissed tip:', error);
      }
    }, 300);
  }, [id, onDismiss]);

  if (dismissed || !show) return null;

  const positionClasses = {
    top: 'mb-4',
    bottom: 'mt-4',
    inline: '',
  };

  const variantClasses = {
    default: 'bg-blue-500/10 border-blue-500/30 text-blue-100',
    highlight: 'bg-orange-500/10 border-orange-500/30 text-orange-100',
    minimal: 'bg-dark-surface border-gray-700 text-gray-300',
  };

  const iconColor = {
    default: 'text-blue-400',
    highlight: 'text-orange-500',
    minimal: 'text-gray-500',
  };

  return (
    <div
      role="note"
      aria-label="Feature tip"
      className={cn(
        'rounded-lg border p-4 transition-all duration-300',
        positionClasses[position],
        variantClasses[variant],
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn('flex-shrink-0 mt-0.5', iconColor[variant])}>
          <Lightbulb className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold">{title}</h4>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Dismiss tip"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-1">{description}</p>
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-1 mt-2 text-xs font-medium transition-colors',
                variant === 'highlight' ? 'text-orange-500 hover:text-orange-600' : 'text-blue-400 hover:text-blue-300'
              )}
            >
              Learn more
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

interface FeatureTipTourProps {
  /** Unique identifier for this tour */
  tourId: string;
  /** Steps in the tour */
  steps: Array<{
    id: string;
    title: string;
    description: string;
    docsUrl?: string;
  }>;
  /** Callback when tour is completed */
  onComplete?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FeatureTipTour - Multi-step onboarding tour
 *
 * Shows a sequence of tips that guide users through features.
 */
export function FeatureTipTour({
  tourId,
  steps,
  onComplete,
  className,
}: FeatureTipTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Check if tour has been completed before
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const completedTours = JSON.parse(localStorage.getItem('foremanos_completed_tours') || '[]');
      if (completedTours.includes(tourId)) {
        setCompleted(true);
      }
    } catch (error) {
      console.error('Error reading completed tours:', error);
    }
  }, [tourId]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Tour complete
      setCompleted(true);
      onComplete?.();

      try {
        const completedTours = JSON.parse(localStorage.getItem('foremanos_completed_tours') || '[]');
        if (!completedTours.includes(tourId)) {
          completedTours.push(tourId);
          localStorage.setItem('foremanos_completed_tours', JSON.stringify(completedTours));
        }
      } catch (error) {
        console.error('Error saving completed tour:', error);
      }
    }
  }, [currentStep, steps.length, tourId, onComplete]);

  const handleSkip = useCallback(() => {
    setCompleted(true);

    try {
      const completedTours = JSON.parse(localStorage.getItem('foremanos_completed_tours') || '[]');
      if (!completedTours.includes(tourId)) {
        completedTours.push(tourId);
        localStorage.setItem('foremanos_completed_tours', JSON.stringify(completedTours));
      }
    } catch (error) {
      console.error('Error saving completed tour:', error);
    }
  }, [tourId]);

  if (completed || steps.length === 0) return null;

  const step = steps[currentStep];

  return (
    <div
      className={cn(
        'bg-orange-500/10 border border-orange-500/30 rounded-lg p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5 text-orange-500">
          <Lightbulb className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400">
              Tip {currentStep + 1} of {steps.length}
            </span>
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    i === currentStep ? 'bg-orange-500' : 'bg-gray-600'
                  )}
                />
              ))}
            </div>
          </div>

          <h4 className="text-sm font-semibold text-orange-100">{step.title}</h4>
          <p className="text-sm text-gray-400 mt-1">{step.description}</p>
          {step.docsUrl && (
            <a
              href={step.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors"
            >
              Learn more
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Skip tour
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {currentStep < steps.length - 1 ? (
                <>
                  Next
                  <ChevronRight className="w-3 h-3" />
                </>
              ) : (
                'Got it!'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * useFeatureTips - Hook to manage feature tip state
 */
export function useFeatureTips() {
  const isDismissed = useCallback((tipId: string): boolean => {
    if (typeof window === 'undefined') return true;

    try {
      const dismissedTips = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return dismissedTips.includes(tipId);
    } catch {
      return false;
    }
  }, []);

  const dismiss = useCallback((tipId: string) => {
    if (typeof window === 'undefined') return;

    try {
      const dismissedTips = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!dismissedTips.includes(tipId)) {
        dismissedTips.push(tipId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissedTips));
      }
    } catch (error) {
      console.error('Error dismissing tip:', error);
    }
  }, []);

  const reset = useCallback((tipId?: string) => {
    if (typeof window === 'undefined') return;

    try {
      if (tipId) {
        const dismissedTips = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const filtered = dismissedTips.filter((id: string) => id !== tipId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error resetting tips:', error);
    }
  }, []);

  return { isDismissed, dismiss, reset };
}
