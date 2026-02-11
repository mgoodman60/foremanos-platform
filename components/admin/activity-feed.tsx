'use client';

import { motion } from 'framer-motion';
import { Clock, User, FileText, UserCheck, UserX, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: any;
  createdAt: string;
  user?: {
    username: string;
    email?: string;
  };
}

interface ActivityFeedProps {
  activities: Activity[];
}

const getActivityIcon = (action: string) => {
  if (action.includes('signup')) return UserCheck;
  if (action.includes('approved')) return UserCheck;
  if (action.includes('rejected')) return UserX;
  if (action.includes('document')) return FileText;
  if (action.includes('updated')) return Settings;
  return User;
};

const getActivityColor = (action: string) => {
  if (action.includes('signup')) return 'bg-blue-100 text-blue-600';
  if (action.includes('approved')) return 'bg-green-100 text-green-600';
  if (action.includes('rejected')) return 'bg-red-100 text-red-600';
  if (action.includes('document')) return 'bg-purple-100 text-purple-600';
  return 'bg-gray-100 text-gray-600';
};

const formatAction = (action: string) => {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <Clock aria-hidden="true" className="h-5 w-5 text-gray-400" />
      </div>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock aria-hidden="true" className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No recent activity</p>
            </div>
          ) : (
            activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.action);
              const color = getActivityColor(activity.action);
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${color} flex-shrink-0`}>
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {formatAction(activity.action)}
                    </p>
                    {activity.user && (
                      <p className="text-xs text-gray-600 truncate">
                        by {activity.user.username}
                      </p>
                    )}
                    {activity.details && activity.details.approvedUser && (
                      <p className="text-xs text-gray-400">
                        User: {activity.details.approvedUser}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
