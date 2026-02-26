'use client';

import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
  'audio[controls]',
  'video[controls]',
  'details>summary:first-of-type',
].join(', ');

interface UseFocusTrapOptions {
  /**
   * Whether the focus trap is active
   */
  isActive: boolean;
  /**
   * Callback when Escape is pressed
   */
  onEscape?: () => void;
  /**
   * Element to focus when trap activates. If not provided, focuses first focusable element.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * Element to return focus to when trap deactivates. If not provided, returns to previously focused element.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * Whether to return focus when trap deactivates. Default: true
   */
  returnFocusOnDeactivate?: boolean;
}

/**
 * Hook to trap focus within a container element.
 * Use this for custom modal implementations that don't use Radix Dialog.
 *
 * @example
 * function MyModal({ isOpen, onClose }) {
 *   const containerRef = useFocusTrap({
 *     isActive: isOpen,
 *     onEscape: onClose,
 *   });
 *
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       ...
 *     </div>
 *   );
 * }
 */
export function useFocusTrap({
  isActive,
  onEscape,
  initialFocusRef,
  returnFocusRef,
  returnFocusOnDeactivate = true,
}: UseFocusTrapOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element when trap activates
  useEffect(() => {
    if (isActive) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
    }
  }, [isActive]);

  // Return focus when trap deactivates
  useEffect(() => {
    return () => {
      if (returnFocusOnDeactivate && previouslyFocusedRef.current) {
        const elementToFocus = returnFocusRef?.current || previouslyFocusedRef.current;
        if (elementToFocus && typeof elementToFocus.focus === 'function') {
          // Use requestAnimationFrame to ensure focus happens after modal unmounts
          requestAnimationFrame(() => {
            elementToFocus.focus();
          });
        }
      }
    };
  }, [returnFocusOnDeactivate, returnFocusRef]);

  // Focus initial element when trap activates
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;

    // Small delay to ensure modal is rendered
    const focusTimeout = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          // If no focusable elements, focus the container itself
          container.setAttribute('tabindex', '-1');
          container.focus();
        }
      }
    }, 50);

    return () => clearTimeout(focusTimeout);
  }, [isActive, initialFocusRef]);

  // Get all focusable elements in the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    ).filter((el) => {
      // Filter out elements that are hidden or have display: none
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, []);

  // Handle keyboard events for focus trapping
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      // Handle Tab for focus trapping
      if (event.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        // Shift + Tab on first element -> focus last element
        if (event.shiftKey && activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
          return;
        }

        // Tab on last element -> focus first element
        if (!event.shiftKey && activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
          return;
        }

        // If focus is outside the container, move it inside
        if (containerRef.current && !containerRef.current.contains(activeElement)) {
          event.preventDefault();
          if (event.shiftKey) {
            lastElement.focus();
          } else {
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onEscape, getFocusableElements]);

  // Prevent focus from leaving the container
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const handleFocusIn = (event: FocusEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [isActive, getFocusableElements]);

  return containerRef;
}
