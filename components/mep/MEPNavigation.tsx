'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Server, 
  HardDrive, 
  FileCheck, 
  Wrench,
  Calculator,
  Package
} from 'lucide-react';

interface MEPNavigationProps {
  projectSlug: string;
}

export default function MEPNavigation({ projectSlug }: MEPNavigationProps) {
  const pathname = usePathname();
  const basePath = `/project/${projectSlug}/mep`;
  
  const tabs = [
    { name: 'Dashboard', href: basePath, icon: LayoutDashboard },
    { name: 'Systems', href: `${basePath}/systems`, icon: Server },
    { name: 'Equipment', href: `${basePath}/equipment`, icon: HardDrive },
    { name: 'Submittals', href: `${basePath}/submittals`, icon: FileCheck },
    { name: 'Requirements', href: `/project/${projectSlug}/requirements`, icon: Package },
    { name: 'Maintenance', href: `${basePath}/maintenance`, icon: Wrench },
    { name: 'Load Calcs', href: `${basePath}/calculations`, icon: Calculator },
  ];
  
  return (
    <div className="border-b border-gray-700 bg-dark-subtle">
      <nav className="flex space-x-1 px-4 overflow-x-auto scrollbar-hide" aria-label="MEP Navigation">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || 
            (tab.href !== basePath && pathname?.startsWith(tab.href));
          const Icon = tab.icon;
          
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px
                transition-colors whitespace-nowrap
                ${
                  isActive
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
