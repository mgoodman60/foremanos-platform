"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle, Bell, BellOff, TrendingDown, DollarSign,
  AlertCircle, CheckCircle, X, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface CostAlert {
  id: string;
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  threshold?: number;
  currentValue?: number;
  isRead: boolean;
  isDismissed: boolean;
  triggeredAt: string;
  BudgetItem?: { name: string; costCode?: string };
}

const ALERT_ICONS: Record<string, React.ReactNode> = {
  CPI_LOW: <TrendingDown className="h-5 w-5" />,
  SPI_LOW: <TrendingDown className="h-5 w-5" />,
  BUDGET_EXCEEDED: <DollarSign className="h-5 w-5" />,
  ITEM_OVER_BUDGET: <AlertCircle className="h-5 w-5" />,
  CONTINGENCY_LOW: <AlertTriangle className="h-5 w-5" />,
  FORECAST_OVERRUN: <TrendingDown className="h-5 w-5" />
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  WARNING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30'
};

export default function CostAlertsPanel() {
  const params = useParams();
  const slug = params?.slug as string;

  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (slug) fetchAlerts();
  }, [slug]);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/cost-alerts?unreadOnly=${!showAll}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/projects/${slug}/cost-alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true })
      });
      setAlerts(alerts.map(a => a.id === id ? { ...a, isRead: true } : a));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const dismissAlert = async (id: string) => {
    try {
      await fetch(`/api/projects/${slug}/cost-alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDismissed: true })
      });
      setAlerts(alerts.filter(a => a.id !== id));
      toast.success('Alert dismissed');
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const unreadCount = alerts.filter(a => !a.isRead).length;

  if (loading) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-card border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-yellow-400" />
            Cost Alerts
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white">{unreadCount}</Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowAll(!showAll);
              fetchAlerts();
            }}
            className="text-gray-400 hover:text-white text-sm"
          >
            {showAll ? 'Unread Only' : 'Show All'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
            <p>No active cost alerts</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${SEVERITY_COLORS[alert.severity]} ${!alert.isRead ? 'ring-1 ring-yellow-500/50' : ''}`}
                onClick={() => !alert.isRead && markAsRead(alert.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${alert.severity === 'CRITICAL' ? 'text-red-400' : alert.severity === 'WARNING' ? 'text-yellow-400' : 'text-blue-400'}`}>
                    {ALERT_ICONS[alert.alertType]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white text-sm">{alert.title}</span>
                      {!alert.isRead && (
                        <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">{alert.message}</p>
                    {alert.threshold && alert.currentValue && (
                      <p className="text-xs text-gray-400 mt-1">
                        Current: {alert.currentValue.toFixed(2)} | Threshold: {alert.threshold.toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissAlert(alert.id);
                    }}
                    className="text-gray-400 hover:text-white p-1"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
