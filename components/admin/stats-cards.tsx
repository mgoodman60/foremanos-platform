'use client';

import { motion } from 'framer-motion';
import { Users, FolderOpen, FileText, UserCheck, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface StatsCardsProps {
  stats: {
    usersByRole: {
      admin: number;
      client: number;
      guest: number;
      pending: number;
    };
    pendingApprovals: number;
    totalProjects: number;
    totalDocuments: number;
    recentSignups: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Users',
      value: Object.values(stats.usersByRole).reduce((a, b) => a + b, 0),
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
      change: `+${stats.recentSignups} this week`,
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: UserCheck,
      color: 'bg-yellow-100 text-yellow-600',
      change: stats.pendingApprovals > 0 ? 'Requires attention' : 'All caught up',
      badge: stats.pendingApprovals > 0,
    },
    {
      title: 'Total Projects',
      value: stats.totalProjects,
      icon: FolderOpen,
      color: 'bg-green-100 text-green-600',
      change: 'Active projects',
    },
    {
      title: 'Total Documents',
      value: stats.totalDocuments,
      icon: FileText,
      color: 'bg-purple-100 text-purple-600',
      change: 'Across all projects',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <Card className="p-6 hover:shadow-lg transition-shadow duration-200 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {card.title}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-bold text-gray-900">
                      {card.value}
                    </h3>
                    {card.badge && (
                      <span className="px-2 py-1 text-xs font-semibold text-yellow-600 bg-yellow-100 rounded-full">
                        !
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{card.change}</p>
                </div>
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </div>
              </div>
              {/* Decorative element */}
              <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-br from-gray-50 to-transparent rounded-tl-full opacity-50" />
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
