'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, MessageSquare, ClipboardList, Activity } from 'lucide-react';

interface FieldOpsNavigationProps {
  projectSlug: string;
}

export default function FieldOpsNavigation({ projectSlug }: FieldOpsNavigationProps) {
  const pathname = usePathname();
  const basePath = `/project/${projectSlug}/field-ops`;

  const tabs = [
    { href: `${basePath}/daily-reports`, label: 'Daily Reports', icon: FileText },
    { href: `${basePath}/rfis`, label: 'RFIs', icon: MessageSquare },
    { href: `${basePath}/punch-list`, label: 'Punch List', icon: ClipboardList },
    { href: `${basePath}/health`, label: 'Health Dashboard', icon: Activity },
  ];

  return (
    <nav className="flex items-center gap-1 p-1 bg-dark-base rounded-lg">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;
        
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
