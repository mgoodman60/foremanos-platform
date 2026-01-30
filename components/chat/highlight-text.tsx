'use client';

interface HighlightTextProps {
  text: string;
  highlight: string;
  className?: string;
}

/**
 * Highlights matching text within a string
 * Case-insensitive matching with yellow background
 */
export function HighlightText({ text, highlight, className = '' }: HighlightTextProps) {
  if (!highlight || highlight.trim().length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Escape special regex characters
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedHighlight = escapeRegex(highlight);

  // Split text into parts (matched and unmatched)
  const parts = text.split(new RegExp(`(${escapedHighlight})`, 'gi'));

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Check if this part matches the highlight (case-insensitive)
        if (part.toLowerCase() === highlight.toLowerCase()) {
          return (
            <mark
              key={index}
              className="bg-yellow-400 text-gray-900 px-0.5 rounded font-medium"
            >
              {part}
            </mark>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}
