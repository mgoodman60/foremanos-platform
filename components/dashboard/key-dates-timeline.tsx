'use client';

interface KeyDate {
  name: string;
  date: string;
  type: 'start' | 'end' | 'milestone';
  category?: string;
}

interface KeyDatesTimelineProps {
  keyDates: KeyDate[];
}

function getRelativeLabel(dateStr: string): string {
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `${diffDays}d`;
  if (diffDays > 7 && diffDays <= 30) return `${Math.round(diffDays / 7)}w`;
  if (diffDays > 30) return `${Math.round(diffDays / 30)}mo`;
  if (diffDays < -1) return `${Math.abs(diffDays)}d ago`;
  return dateStr;
}

function getDotColor(dateStr: string): string {
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'bg-gray-600';
  if (diffDays <= 7) return 'bg-red-500';
  if (diffDays <= 30) return 'bg-amber-500';
  return 'bg-green-500';
}

export function KeyDatesTimeline({ keyDates }: KeyDatesTimelineProps) {
  if (!keyDates || keyDates.length === 0) {
    return (
      <p className="text-xs text-gray-500">No key dates scheduled</p>
    );
  }

  const sorted = [...keyDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex items-start gap-0 min-w-max relative">
        {/* Connecting line */}
        <div className="absolute top-[5px] left-[6px] right-[6px] h-px bg-gray-700" />

        {sorted.map((kd, i) => (
          <div key={`${kd.name}-${i}`} className="flex flex-col items-center min-w-[72px] relative">
            {/* Dot */}
            <div className={`w-3 h-3 rounded-full ${getDotColor(kd.date)} ring-2 ring-slate-900 z-10`} />
            {/* Vertical connector */}
            <div className="w-px h-3 bg-gray-700" />
            {/* Label */}
            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
              {getRelativeLabel(kd.date)}
            </span>
            <span className="text-[10px] text-gray-500 whitespace-nowrap max-w-[68px] truncate">
              {kd.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
