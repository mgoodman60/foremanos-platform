import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';
import {
  FeatureTip,
  FeatureTipTour,
  useFeatureTips,
} from '@/components/feature-tip';

describe('FeatureTip', () => {
  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
        clear: vi.fn(() => {
          Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
        }),
      },
      writable: true,
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
  });

  describe('FeatureTip Component', () => {
    it('should not render if already dismissed', () => {
      mockLocalStorage['foremanos_dismissed_tips'] = JSON.stringify(['test-tip']);

      const { container } = render(
        <FeatureTip
          id="test-tip"
          title="Test Tip"
          description="Test description"
        />
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(container.firstChild).toBeNull();
    });

    it('should render if not dismissed', () => {
      render(
        <FeatureTip
          id="new-tip"
          title="New Feature"
          description="Check out this new feature"
        />
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText('New Feature')).toBeInTheDocument();
      expect(screen.getByText('Check out this new feature')).toBeInTheDocument();
    });

    it('should not render when show prop is false', () => {
      const { container } = render(
        <FeatureTip
          id="hidden-tip"
          title="Hidden"
          description="Should not show"
          show={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render with default variant', () => {
      render(
        <FeatureTip
          id="default-variant"
          title="Default"
          description="Default styling"
        />
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tip = screen.getByRole('note');
      expect(tip).toHaveClass('bg-blue-500/10', 'border-blue-500/30');
    });

    it('should render with highlight variant', () => {
      render(
        <FeatureTip
          id="highlight-variant"
          title="Highlight"
          description="Highlight styling"
          variant="highlight"
        />
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tip = screen.getByRole('note');
      expect(tip).toHaveClass('bg-[#F97316]/10', 'border-[#F97316]/30');
    });

    it('should render with minimal variant', () => {
      render(
        <FeatureTip
          id="minimal-variant"
          title="Minimal"
          description="Minimal styling"
          variant="minimal"
        />
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tip = screen.getByRole('note');
      expect(tip).toHaveClass('bg-dark-surface', 'border-gray-700');
    });

    it('should apply custom className', () => {
      render(
        <FeatureTip
          id="custom-class"
          title="Custom"
          description="Custom class"
          className="custom-tip-class"
        />
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tip = screen.getByRole('note');
      expect(tip).toHaveClass('custom-tip-class');
    });

    it('should render with position classes', () => {
      render(
        <FeatureTip
          id="position-test"
          title="Position"
          description="Position test"
          position="top"
        />
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tip = screen.getByRole('note');
      expect(tip).toHaveClass('mb-4');
    });

    it('should render bottom position', () => {
      render(
        <FeatureTip
          id="position-bottom"
          title="Bottom"
          description="Bottom position"
          position="bottom"
        />
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tip = screen.getByRole('note');
      expect(tip).toHaveClass('mt-4');
    });

    it('should have proper ARIA attributes', () => {
      render(
        <FeatureTip
          id="aria-tip"
          title="ARIA Test"
          description="Accessibility test"
        />
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      const tip = screen.getByRole('note');
      expect(tip).toHaveAttribute('aria-label', 'Feature tip');
    });

    it('should render documentation link when provided', () => {
      render(
        <FeatureTip
          id="doc-tip"
          title="Feature with Docs"
          description="Has documentation"
          docsUrl="https://docs.example.com"
        />
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      const link = screen.getByText('Learn more');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://docs.example.com');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('should show dismiss button', () => {
      render(
        <FeatureTip
          id="dismiss-button-tip"
          title="Dismissable"
          description="Has dismiss"
        />
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByLabelText('Dismiss tip')).toBeInTheDocument();
    });
  });

  describe('FeatureTipTour Component', () => {
    const tourSteps = [
      {
        id: 'step-1',
        title: 'Step 1',
        description: 'First step description',
      },
      {
        id: 'step-2',
        title: 'Step 2',
        description: 'Second step description',
        docsUrl: 'https://docs.example.com/step2',
      },
      {
        id: 'step-3',
        title: 'Step 3',
        description: 'Third step description',
      },
    ];

    it('should render first step', () => {
      render(<FeatureTipTour tourId="test-tour" steps={tourSteps} />);

      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('First step description')).toBeInTheDocument();
    });

    it('should show progress indicator', () => {
      render(<FeatureTipTour tourId="test-tour" steps={tourSteps} />);

      expect(screen.getByText('Tip 1 of 3')).toBeInTheDocument();
    });

    it('should advance to next step on Next click', () => {
      render(<FeatureTipTour tourId="test-tour" steps={tourSteps} />);

      expect(screen.getByText('Step 1')).toBeInTheDocument();

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      expect(screen.getByText('Step 2')).toBeInTheDocument();
      expect(screen.getByText('Tip 2 of 3')).toBeInTheDocument();
    });

    it('should show "Got it!" on last step', () => {
      render(<FeatureTipTour tourId="test-tour" steps={tourSteps} />);

      // Go to last step
      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Next'));

      expect(screen.getByText('Step 3')).toBeInTheDocument();
      expect(screen.getByText('Got it!')).toBeInTheDocument();
    });

    it('should not render if already completed', () => {
      mockLocalStorage['foremanos_completed_tours'] = JSON.stringify(['test-tour']);

      const { container } = render(
        <FeatureTipTour tourId="test-tour" steps={tourSteps} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render with empty steps', () => {
      const { container } = render(<FeatureTipTour tourId="empty-tour" steps={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('should show skip button', () => {
      render(<FeatureTipTour tourId="test-tour" steps={tourSteps} />);

      expect(screen.getByText('Skip tour')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <FeatureTipTour
          tourId="test-tour"
          steps={tourSteps}
          className="custom-tour-class"
        />
      );

      const tour = container.firstChild as HTMLElement;
      expect(tour).toHaveClass('custom-tour-class');
    });

    it('should render progress dots', () => {
      const { container } = render(
        <FeatureTipTour tourId="test-tour" steps={tourSteps} />
      );

      const dots = container.querySelectorAll('.w-2.h-2.rounded-full');
      expect(dots).toHaveLength(3);
    });

    it('should highlight current step dot', () => {
      const { container } = render(
        <FeatureTipTour tourId="test-tour" steps={tourSteps} />
      );

      const dots = container.querySelectorAll('.w-2.h-2.rounded-full');
      expect(dots[0]).toHaveClass('bg-[#F97316]');
      expect(dots[1]).toHaveClass('bg-gray-600');
    });
  });

  describe('useFeatureTips Hook', () => {
    it('should check if tip is dismissed', () => {
      mockLocalStorage['foremanos_dismissed_tips'] = JSON.stringify(['dismissed-tip']);

      const { result } = renderHook(() => useFeatureTips());

      expect(result.current.isDismissed('dismissed-tip')).toBe(true);
      expect(result.current.isDismissed('not-dismissed')).toBe(false);
    });

    it('should dismiss a tip', () => {
      const { result } = renderHook(() => useFeatureTips());

      act(() => {
        result.current.dismiss('new-tip');
      });

      const savedTips = JSON.parse(mockLocalStorage['foremanos_dismissed_tips'] || '[]');
      expect(savedTips).toContain('new-tip');
    });

    it('should not duplicate dismissed tips', () => {
      mockLocalStorage['foremanos_dismissed_tips'] = JSON.stringify(['existing-tip']);

      const { result } = renderHook(() => useFeatureTips());

      act(() => {
        result.current.dismiss('existing-tip');
      });

      const savedTips = JSON.parse(mockLocalStorage['foremanos_dismissed_tips'] || '[]');
      expect(savedTips.filter((tip: string) => tip === 'existing-tip')).toHaveLength(1);
    });

    it('should reset specific tip', () => {
      mockLocalStorage['foremanos_dismissed_tips'] = JSON.stringify(['tip1', 'tip2', 'tip3']);

      const { result } = renderHook(() => useFeatureTips());

      act(() => {
        result.current.reset('tip2');
      });

      const savedTips = JSON.parse(mockLocalStorage['foremanos_dismissed_tips'] || '[]');
      expect(savedTips).toEqual(['tip1', 'tip3']);
    });

    it('should reset all tips', () => {
      mockLocalStorage['foremanos_dismissed_tips'] = JSON.stringify(['tip1', 'tip2']);

      const { result } = renderHook(() => useFeatureTips());

      act(() => {
        result.current.reset();
      });

      expect(mockLocalStorage['foremanos_dismissed_tips']).toBeUndefined();
    });
  });
});
