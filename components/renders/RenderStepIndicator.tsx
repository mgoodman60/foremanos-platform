'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { label: 'View Type' },
  { label: 'Style' },
  { label: 'Project Details' },
  { label: 'Photos' },
  { label: 'Generate' },
];

interface RenderStepIndicatorProps {
  currentStep: number;
}

export function RenderStepIndicator({ currentStep }: RenderStepIndicatorProps) {
  return (
    <nav aria-label="Wizard progress" className="mb-6">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;

          return (
            <li key={step.label} className="flex flex-1 items-center">
              <div className="flex w-full flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isActive && 'border-primary bg-transparent text-primary',
                    !isCompleted && !isActive && 'border-muted-foreground/30 text-muted-foreground'
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    stepNumber
                  )}
                </div>
                <span
                  className={cn(
                    'hidden text-xs sm:block',
                    isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-0.5 w-full min-w-[16px] transition-colors',
                    isCompleted ? 'bg-primary' : 'bg-muted-foreground/20'
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
