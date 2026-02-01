'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type AnnouncementPoliteness = 'polite' | 'assertive';

interface AnnouncerContextValue {
  announce: (message: string, politeness?: AnnouncementPoliteness) => void;
}

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

interface AnnouncerProviderProps {
  children: ReactNode;
}

/**
 * AnnouncerProvider - Provides aria-live regions for screen reader announcements
 *
 * Wrap your app with this provider to enable screen reader announcements
 * for dynamic content changes like loading states, form submissions, and errors.
 *
 * @example
 * // In layout.tsx
 * <AnnouncerProvider>
 *   {children}
 * </AnnouncerProvider>
 *
 * // In a component
 * const { announce } = useAnnounce();
 * announce('Form submitted successfully');
 * announce('Error: Invalid email', 'assertive');
 */
export function AnnouncerProvider({ children }: AnnouncerProviderProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const announce = useCallback((message: string, politeness: AnnouncementPoliteness = 'polite') => {
    // Clear the message first, then set it again to ensure it's announced
    // even if the same message is sent twice in a row
    if (politeness === 'assertive') {
      setAssertiveMessage('');
      // Use requestAnimationFrame to ensure the DOM updates before setting new message
      requestAnimationFrame(() => {
        setAssertiveMessage(message);
      });
    } else {
      setPoliteMessage('');
      requestAnimationFrame(() => {
        setPoliteMessage(message);
      });
    }

    // Clear messages after announcement to prevent stale content
    setTimeout(() => {
      if (politeness === 'assertive') {
        setAssertiveMessage('');
      } else {
        setPoliteMessage('');
      }
    }, 1000);
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Polite announcements - for non-urgent updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      {/* Assertive announcements - for urgent updates like errors */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

/**
 * useAnnounce - Hook to announce messages to screen readers
 *
 * @returns Object with announce function
 * @throws Error if used outside AnnouncerProvider
 *
 * @example
 * const { announce } = useAnnounce();
 *
 * // Polite announcement (default) - for status updates
 * announce('Loading documents...');
 * announce('3 documents uploaded');
 *
 * // Assertive announcement - for errors and urgent messages
 * announce('Error: File upload failed', 'assertive');
 */
export function useAnnounce(): AnnouncerContextValue {
  const context = useContext(AnnouncerContext);

  if (!context) {
    throw new Error('useAnnounce must be used within an AnnouncerProvider');
  }

  return context;
}

/**
 * Optional: Direct announcer hook that doesn't throw if provider is missing
 * Useful for components that might be used outside the provider
 */
export function useAnnounceOptional(): AnnouncerContextValue | null {
  return useContext(AnnouncerContext);
}
